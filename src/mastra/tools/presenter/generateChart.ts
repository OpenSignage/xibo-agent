/*
 * Copyright (C) 2025 Open Source Digital Signage Initiative.
 * (restored stable implementation)
 */
import { createTool } from '@mastra/core/tools';
import { z } from 'zod';
import { logger } from '../../logger';
import { ChartJSNodeCanvas } from 'chartjs-node-canvas';
import { ChartConfiguration } from 'chart.js';
import { promises as fs } from 'fs';

const chartTypeSchema = z.enum([
  'bar', 'line', 'pie', 'doughnut',
  'radar', 'polarArea', 'scatter', 'bubble',
  'horizontalBar', 'stackedBar', 'area'
]);
const inputSchema = z.object({
  chartType: chartTypeSchema,
  title: z.string(),
  labels: z.array(z.string()),
  // NOTE: scatter/bubble では {x,y} 形式を受けるため any に緩和
  data: z.array(z.any()),
  fileName: z.string().optional(),
  returnBuffer: z.boolean().optional(),
  themeColor1: z.string().optional(),
  themeColor2: z.string().optional(),
  chartsStyle: z.any().optional(),
});

const outputFileSchema = z.object({ imagePath: z.string() });
const outputBufferSchema = z.object({ buffer: z.any(), bufferSize: z.number() });
const errorResponseSchema = z.object({ success: z.literal(false), message: z.string(), error: z.any().optional() });
const successResponseSchema = z.object({ success: z.literal(true), data: z.union([outputBufferSchema, outputFileSchema]) });

type CanvasKey = string;
const canvasPool = new Map<CanvasKey, ChartJSNodeCanvas>();
const getCanvas = (width: number, height: number, background: 'white'|'transparent'): ChartJSNodeCanvas => {
  const key = `${width}x${height}-${background}`;
  let c = canvasPool.get(key);
  if (!c) {
    const bg = background === 'transparent' ? 'rgba(0,0,0,0)' : 'white';
    c = new ChartJSNodeCanvas({ width, height, backgroundColour: bg });
    canvasPool.set(key, c);
  }
  return c;
};

type ChartKey = string;
const chartCache = new Map<ChartKey, Buffer>();
const chartCacheOrder: ChartKey[] = [];
const CHART_CACHE_MAX = 50;
const makeKey = (o: any) => JSON.stringify(o);
const cachePut = (k: ChartKey, buf: Buffer) => {
  if (chartCache.has(k)) return;
  chartCache.set(k, buf);
  chartCacheOrder.push(k);
  if (chartCacheOrder.length > CHART_CACHE_MAX) {
    const old = chartCacheOrder.shift();
    if (old) chartCache.delete(old);
  }
};

export const generateChartTool = createTool({
  id: 'generate-chart',
  description: 'Generates a chart image (bar, pie, or line) as PNG. Supports on-memory buffer return.',
  inputSchema,
  outputSchema: z.union([successResponseSchema, errorResponseSchema]),
  execute: async ({ context }) => {
    const { chartType, title, labels, data, fileName, returnBuffer, themeColor1, themeColor2, chartsStyle: chartsStyleFromCtx } = context as any;
    logger.info({ chartType, title }, 'Generating chart image (PNG)...');
    try {
      let chartsStyle: any = chartsStyleFromCtx || {};

      const primary = typeof themeColor1 === 'string' && /^#?[0-9a-fA-F]{6}$/.test(themeColor1) ? (themeColor1.startsWith('#') ? themeColor1 : `#${themeColor1}`) : (chartsStyle?.colors?.[0]);
      const secondary = typeof themeColor2 === 'string' && /^#?[0-9a-fA-F]{6}$/.test(themeColor2) ? (themeColor2.startsWith('#') ? themeColor2 : `#${themeColor2}`) : (chartsStyle?.colors?.[1]);
      const alpha = (hex: string, a: number) => {
        const h = hex.replace('#','');
        const r = parseInt(h.slice(0,2),16), g = parseInt(h.slice(2,4),16), b = parseInt(h.slice(4,6),16);
        return `rgba(${r}, ${g}, ${b}, ${a})`;
      };
      const palette = Array.isArray(chartsStyle?.colors) && chartsStyle.colors.length ? chartsStyle.colors : [primary, secondary].filter(Boolean) as string[];
      const alphaPie = Number.isFinite(Number(chartsStyle?.alpha?.pieDoughnut)) ? Number(chartsStyle.alpha.pieDoughnut) : 1;
      const alphaOthers = Number.isFinite(Number(chartsStyle?.alpha?.others)) ? Number(chartsStyle.alpha.others) : 0.35;
      const alphaForThis = (chartType === 'pie' || chartType === 'doughnut')
        ? alphaPie
        : (chartType === 'polarArea' ? (Number.isFinite(Number(chartsStyle?.alpha?.others)) ? Number(chartsStyle.alpha.others) : alphaOthers) : alphaOthers);
      const bgPalette = (palette as string[]).length ? (palette as string[]).map((c: string) => alpha(c, (chartType === 'pie' || chartType === 'doughnut' || chartType === 'polarArea') ? alphaForThis : alphaOthers)) : undefined as any;

      // Chart.js default color repertoire (from official examples)
      const chartJsDefaultColors = ['#4dc9f6','#f67019','#f53794','#537bc4','#acc236','#166a8f','#00a950','#58595b','#8549ba','#e8c3b9','#36a2eb','#ff6384'];
      const buildChartJsPalette = (n: number, a: number): { fills: string[]; borders: string[] } => {
        const fills: string[] = []; const borders: string[] = [];
        for (let i = 0; i < n; i++) {
          const hex = chartJsDefaultColors[i % chartJsDefaultColors.length];
          fills.push(alpha(hex, a));
          borders.push(alpha(hex, 1));
        }
        return { fills, borders };
      };

      // Palette policy: default is pastel for全チャート; vividはテンプレで明示指定時のみ
      const needRandomVividBars = String(chartsStyle?.paletteMode || '').toLowerCase() === 'vivid';
      const barFillAlpha = Number.isFinite(Number((chartsStyle?.alpha && chartsStyle.alpha.barFill))) ? Number((chartsStyle as any).alpha.barFill) : 0.2;
      const makeVividPalette = (n: number): { fills: string[]; borders: string[] } => {
        const fills: string[] = []; const borders: string[] = [];
        const golden = 0.61803398875; // golden ratio to spread hues evenly
        let h = (Math.abs(hashString(title || 'bar')) % 1000) / 1000; // deterministic seed from title
        for (let i = 0; i < n; i++) {
          h = (h + golden) % 1;
          const s = 0.85; const v = 0.95; const a = barFillAlpha;
          const { r, g, b } = hsvToRgb(h, s, v);
          fills.push(`rgba(${Math.round(r)}, ${Math.round(g)}, ${Math.round(b)}, ${a})`);
          borders.push(`rgb(${Math.round(r)}, ${Math.round(g)}, ${Math.round(b)})`);
        }
        return { fills, borders };
      };
      const hsvToRgb = (h: number, s: number, v: number) => {
        const i = Math.floor(h * 6); const f = h * 6 - i;
        const p = v * (1 - s); const q = v * (1 - f * s); const t = v * (1 - (1 - f) * s);
        let r=0, g=0, b=0;
        switch (i % 6) {
          case 0: r = v; g = t; b = p; break;
          case 1: r = q; g = v; b = p; break;
          case 2: r = p; g = v; b = t; break;
          case 3: r = p; g = q; b = v; break;
          case 4: r = t; g = p; b = v; break;
          case 5: r = v; g = p; b = q; break;
        }
        return { r: r * 255, g: g * 255, b: b * 255 };
      };
      const hashString = (s: string): number => {
        let h = 2166136261; // FNV-1a
        for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h += (h << 1) + (h << 4) + (h << 7) + (h << 8) + (h << 24); }
        return h >>> 0;
      };

      // Map logical types to Chart.js base types + options (must be defined before use)
      let baseType: any;
      {
        const mapBase = (): any => {
          if (chartType === 'horizontalBar' || chartType === 'stackedBar') return 'bar';
          if (chartType === 'area') return 'line';
          if (chartType === 'polarArea') return 'polarArea';
          return chartType as any;
        };
        baseType = mapBase();
      }

      const titleSize = (baseType === 'bar') ? (Number(chartsStyle?.titleFontSizeBar)) : (Number(chartsStyle?.titleFontSizeDefault));
      const axisFontSize = Number(chartsStyle?.axisFontSize);
      const axisFontSizeX = Number.isFinite(Number(chartsStyle?.axisFontSizeX)) ? Number(chartsStyle?.axisFontSizeX) : axisFontSize;
      const axisFontSizeY = Number.isFinite(Number(chartsStyle?.axisFontSizeY)) ? Number(chartsStyle?.axisFontSizeY) : axisFontSize;
      const padding = Number(chartsStyle?.padding);
      const borderWidth = Number(chartsStyle?.borderWidth);
      const mapPos = (p?: string): 'top'|'right'|'bottom'|'left' => {
        const s = String(p || '').toLowerCase();
        if (s === 't' || s === 'top') return 'top';
        if (s === 'r' || s === 'right') return 'right';
        if (s === 'b' || s === 'bottom') return 'bottom';
        if (s === 'l' || s === 'left') return 'left';
        return 'top';
      };
      const legendPosition = mapPos(chartsStyle?.legend?.position);
      const legendDisplay: boolean = ((): boolean => {
        if (typeof chartsStyle?.legend?.display === 'boolean') return chartsStyle.legend.display as boolean;
        return true;
      })();
      const legendFontScale = Number.isFinite(Number(chartsStyle?.legend?.fontScale)) ? Number(chartsStyle?.legend?.fontScale) : undefined;
      const legendFontSizeRaw = Number.isFinite(Number(chartsStyle?.legend?.fontSize)) ? Number(chartsStyle?.legend?.fontSize) : undefined;
      const legendLabelsPadding = Number.isFinite(Number(chartsStyle?.legend?.padding)) ? Number(chartsStyle?.legend?.padding) : undefined;
      const gridColor = chartsStyle?.gridColor ? String(chartsStyle?.gridColor) : undefined;
      const dataLabelFontSize = Number.isFinite(Number(chartsStyle?.dataLabelFontSize)) ? Number(chartsStyle?.dataLabelFontSize) : undefined;
      const dataLabelColor = typeof chartsStyle?.dataLabelColor === 'string' ? String(chartsStyle?.dataLabelColor) : undefined;

      // Draw numeric value labels on each bar (supports stacked/multiple datasets) — place inside bars
      const barValuePlugin: any = ((baseType === 'bar') && Number.isFinite(dataLabelFontSize) && dataLabelColor) ? {
        id: 'bar-value-label',
        afterDatasetsDraw: (chart: any) => {
          const { ctx } = chart;
          ctx.save();
          ctx.font = `${dataLabelFontSize as number}px Noto Sans JP`;
          ctx.fillStyle = dataLabelColor as string;
          const isHorizontal = (chart?.config?.options as any)?.indexAxis === 'y';
          const insideOffset = Number.isFinite(Number((chart?.options as any)?.plugins?.datalabels?.offset))
            ? Number((chart?.options as any)?.plugins?.datalabels?.offset)
            : (Number.isFinite(Number((chart?.config as any)?.options?.dataLabelInsideOffset))
                ? Number((chart?.config as any)?.options?.dataLabelInsideOffset)
                : 6);
          ctx.textAlign = isHorizontal ? 'right' : 'center';
          ctx.textBaseline = isHorizontal ? 'middle' : 'top';
          const datasets = chart?.data?.datasets || [];
          datasets.forEach((ds: any, di: number) => {
            const meta = chart.getDatasetMeta(di);
            if (!meta || !Array.isArray(meta.data)) return;
            meta.data.forEach((element: any, index: number) => {
              const v = Array.isArray(ds?.data) ? ds.data[index] : undefined;
              const raw = (typeof v === 'number') ? v : (v && typeof v === 'object' && typeof (v as any).y === 'number' ? (v as any).y : undefined);
              if (typeof raw !== 'number' || !Number.isFinite(raw)) return;
              const valText = `${raw}`;
              const pos = typeof element.tooltipPosition === 'function' ? element.tooltipPosition() : { x: element.x, y: element.y };
              if (isHorizontal) {
                const endX = (element.x || pos.x);
                const textX = endX - insideOffset;
                const textY = (element.y || pos.y);
                ctx.fillText(valText, textX, textY);
              } else {
                const topY = Math.min(pos.y, element.y || pos.y);
                const textY = topY + insideOffset;
                ctx.fillText(valText, pos.x, textY);
              }
            });
          });
          ctx.restore();
        },
      } : undefined;

      // Draw numeric value labels on circular charts (pie/doughnut/polarArea)
      const circularValuePlugin: any = ((chartType === 'pie' || chartType === 'doughnut' || chartType === 'polarArea') && Number.isFinite(dataLabelFontSize) && dataLabelColor) ? {
        id: 'circular-value-label',
        afterDatasetsDraw: (chart: any) => {
          const { ctx } = chart;
          ctx.save();
          ctx.font = `${dataLabelFontSize as number}px Noto Sans JP`;
          ctx.fillStyle = dataLabelColor as string;
          ctx.textAlign = 'center';
          ctx.textBaseline = 'middle';
          const meta = chart.getDatasetMeta(0);
          if (!meta || !Array.isArray(meta.data)) { ctx.restore(); return; }
          meta.data.forEach((arc: any, index: number) => {
            const raw = (Array.isArray(data) ? data[index] : undefined);
            if (typeof raw !== 'number') return;
            const pos = typeof arc.tooltipPosition === 'function' ? arc.tooltipPosition() : { x: arc.x, y: arc.y };
            ctx.fillText(`${raw}`, pos.x, pos.y);
          });
          ctx.restore();
        },
      } : undefined;

      // Draw point labels for scatter at the plotted position
      const scatterPointLabelPlugin: any = (chartType === 'scatter' && Number.isFinite(Number(chartsStyle?.labelFontSize)) && chartsStyle?.labelColor) ? {
        id: 'scatter-point-label',
        afterDatasetsDraw: (chart: any) => {
          const { ctx } = chart;
          const lblSize = Number(chartsStyle?.labelFontSize);
          const lblColor = String(chartsStyle?.labelColor);
          const offsetY = Number.isFinite(Number(chartsStyle?.labelOffsetY)) ? Number(chartsStyle?.labelOffsetY) : -12;
          ctx.save();
          ctx.font = `${lblSize}px Noto Sans JP`;
          ctx.fillStyle = lblColor;
          ctx.textAlign = 'center';
          ctx.textBaseline = 'bottom';
          const meta = chart.getDatasetMeta(0);
          if (!meta || !Array.isArray(meta.data)) { ctx.restore(); return; }
          const useLabels = Array.isArray(labels) ? labels : [];
          meta.data.forEach((element: any, index: number) => {
            const pos = typeof element.tooltipPosition === 'function' ? element.tooltipPosition() : { x: element.x, y: element.y };
            const text = String(useLabels[index] ?? `P${index+1}`);
            ctx.fillText(text, pos.x, pos.y + offsetY);
          });
          ctx.restore();
        },
      } : undefined;

      // Draw point labels for bubble at the plotted position
      const bubblePointLabelPlugin: any = (chartType === 'bubble' && Number.isFinite(Number(chartsStyle?.labelFontSize)) && chartsStyle?.labelColor) ? {
        id: 'bubble-point-label',
        afterDatasetsDraw: (chart: any) => {
          const { ctx } = chart;
          const lblSize = Number(chartsStyle?.labelFontSize);
          const lblColor = String(chartsStyle?.labelColor);
          const offsetY = Number.isFinite(Number(chartsStyle?.labelOffsetY)) ? Number(chartsStyle?.labelOffsetY) : -12;
          ctx.save();
          ctx.font = `${lblSize}px Noto Sans JP`;
          ctx.fillStyle = lblColor;
          ctx.textAlign = 'center';
          ctx.textBaseline = 'bottom';
          const meta = chart.getDatasetMeta(0);
          if (!meta || !Array.isArray(meta.data)) { ctx.restore(); return; }
          const useLabels = Array.isArray(labels) ? labels : [];
          meta.data.forEach((element: any, index: number) => {
            const pos = typeof element.tooltipPosition === 'function' ? element.tooltipPosition() : { x: element.x, y: element.y };
            const text = String(useLabels[index] ?? `B${index+1}`);
            ctx.fillText(text, pos.x, pos.y + offsetY);
          });
          ctx.restore();
        },
      } : undefined;

      // baseType already defined above

      // Determine canvas size & background
      // Use a unified square canvas for all chart types to keep aspect handling simple and predictable
      const width = 1200;
      const height = 1200;
      const transparent = chartsStyle?.transparent === true || chartsStyle?.background === 'transparent';
      // cutout will be set after chartConfig is created

      // Resolve legend font size (supports absolute size or scale)
      const legendFontSize = ((): number|undefined => {
        if (legendFontScale && legendFontScale > 0 && legendFontScale < 1) {
          const basis = Math.min(width, height);
          return Math.max(10, Math.round(basis * legendFontScale));
        }
        return legendFontSizeRaw;
      })();

      // Build dataset colors
      const isCircular = (chartType === 'pie' || chartType === 'doughnut' || chartType === 'polarArea');
      const makePastelPalette = (n: number, a: number): string[] => {
        const out: string[] = [];
        const golden = 0.61803398875; let h = 0.15;
        for (let i = 0; i < n; i++) { h = (h + golden) % 1; const s = 0.45; const v = 0.95; const { r, g, b } = hsvToRgb(h, s, v); out.push(`rgba(${Math.round(r)}, ${Math.round(g)}, ${Math.round(b)}, ${a})`); }
        return out;
      };
      const computedBgForCircular = ((): { fills: string[]; borders: string[] } | undefined => {
        if (!isCircular) return undefined;
        const need = (labels || []).length;
        if (Array.isArray(bgPalette) && bgPalette.length >= need) {
          const borders = (bgPalette as string[]).slice(0, need).map((rgba: string) => rgba.replace(/rgba\(([^)]+)\)/, (m, g)=>{
            const parts = g.split(',').map((s:string)=>s.trim()); return `rgb(${parts[0]}, ${parts[1]}, ${parts[2]})`; }));
          return { fills: (bgPalette as string[]).slice(0, need), borders };
        }
        const a = alphaForThis;
        const pjs = buildChartJsPalette(need, a);
        return pjs;
      })();

      const computedBgForOthers = ((): { fills: string[]; borders: string[] } | undefined => {
        if (isCircular) return undefined;
        const need = (labels || []).length;
        if (Array.isArray(bgPalette) && bgPalette.length >= need) {
          // derive opaque borders from provided palette
          const borders = (bgPalette as string[]).slice(0, need).map((rgba: string) => rgba.replace(/rgba\(([^)]+)\)/, (m, g)=>{
            const parts = g.split(',').map((s:string)=>s.trim()); return `rgb(${parts[0]}, ${parts[1]}, ${parts[2]})`; }));
          return { fills: (bgPalette as string[]).slice(0, need), borders };
        }
        const a = Number.isFinite(alphaOthers) ? alphaOthers : 0.6;
        // Prefer Chart.js default palette
        const pjs = buildChartJsPalette(need, a);
        return pjs;
      })();

      // Build datasets (supports stackedBar multi-series)
      const datasets: any[] = ((): any[] => {
        // scatter
        if (chartType === 'scatter') {
          const pts = (data || []).map((v: any, i: number) => {
            if (v && typeof v === 'object') {
              if (Array.isArray(v) && v.length >= 2) return { x: Number(v[0]), y: Number(v[1]) };
              if (typeof v.x !== 'undefined' && typeof v.y !== 'undefined') return { x: Number(v.x), y: Number(v.y) };
            }
            return { x: i, y: Number(v) };
          });
          const baseSty: any = {};
          if (needRandomVividBars) { const p = makeVividPalette((labels || []).length); Object.assign(baseSty, { backgroundColor: p.fills, borderColor: p.borders }); }
          else if (isCircular) { if (computedBgForCircular) Object.assign(baseSty, { backgroundColor: computedBgForCircular.fills, borderColor: computedBgForCircular.borders }); }
          else { if (computedBgForOthers) Object.assign(baseSty, { backgroundColor: computedBgForOthers.fills, borderColor: computedBgForOthers.borders }); }
          if (primary) Object.assign(baseSty, { borderColor: alpha(primary, 1) });
          if (Number.isFinite(borderWidth)) Object.assign(baseSty, { borderWidth });
          return [{ label: title, data: pts, ...(baseSty), ...(baseType === 'line' ? {} : {}) }];
        }
        // bubble
        if (chartType === 'bubble') {
          const raw = Array.isArray(data) ? data : [];
          const minR = Number.isFinite(Number(chartsStyle?.pointMinRadius)) ? Number(chartsStyle?.pointMinRadius) : 6;
          const maxR = Number.isFinite(Number(chartsStyle?.pointMaxRadius)) ? Number(chartsStyle?.pointMaxRadius) : 26;
          const parsed = raw.map((v: any, i: number) => {
            if (v && typeof v === 'object') {
              if (Array.isArray(v)) {
                const x = Number(v[0]); const y = Number(v[1]); const z = Number(v[2]);
                return { x: Number.isFinite(x) ? x : i, y: Number(y), z: Number.isFinite(z) ? z : undefined };
              }
              const x = Number(v.x); const y = Number(v.y); const z = (typeof v.z !== 'undefined') ? Number(v.z) : undefined; const r = (typeof v.r !== 'undefined') ? Number(v.r) : undefined;
              return { x: Number.isFinite(x) ? x : i, y, z, r };
            }
            return { x: i, y: Number(v) };
          });
          const zVals = parsed.map(p => (typeof p.r === 'number' && Number.isFinite(p.r)) ? undefined : (Number.isFinite(Number(p.z)) ? Number(p.z) : undefined)).filter((n:any) => typeof n === 'number') as number[];
          const hasZ = zVals.length > 0; let zMin = 0, zMax = 1; if (hasZ) { zMin = Math.min(...zVals); zMax = Math.max(...zVals); if (zMax === zMin) zMax = zMin + 1; }
          const scaleR = (z:number|undefined, r:number|undefined): number => { if (typeof r === 'number' && Number.isFinite(r)) return Math.max(1, r); if (!hasZ || typeof z !== 'number' || !Number.isFinite(z)) return minR; const t = (z - zMin) / (zMax - zMin); return minR + t * (maxR - minR); };
          const pts = parsed.map(p => ({ x: p.x, y: p.y, r: scaleR(p.z, p.r) }));
          return [{ label: title, data: pts }];
        }
        // stackedBar multi-series
        if (chartType === 'stackedBar') {
          let seriesArr: Array<{ label?: string; data: number[] }>; let seriesCount = 0;
          if (Array.isArray(data) && data.length && typeof data[0] === 'object' && Array.isArray((data[0] as any).data)) {
            seriesArr = (data as any[]).map((s:any) => ({ label: String(s.label ?? ''), data: (Array.isArray(s.data) ? s.data.map((n:any)=>Number(n)||0) : []) }));
            seriesCount = seriesArr.length;
          } else if (Array.isArray(data) && data.length && Array.isArray(data[0])) {
            seriesArr = (data as any[]).map((row:any[], i:number) => ({ label: `Series ${i+1}`, data: row.map((n:any)=>Number(n)||0) }));
            seriesCount = seriesArr.length;
          } else {
            // fallback to single series
            seriesArr = [{ label: title, data: (Array.isArray(data) ? (data as any[]).map((n:any)=>Number(n)||0) : []) }];
            seriesCount = 1;
          }
          const p = buildChartJsPalette(seriesCount, Number.isFinite(alphaOthers) ? alphaOthers : 0.6);
          return seriesArr.map((s, i) => ({
            label: s.label || `Series ${i+1}`,
            data: s.data,
            backgroundColor: p.fills[i % p.fills.length],
            borderColor: p.borders[i % p.borders.length],
            ...(Number.isFinite(borderWidth) ? { borderWidth } : {}),
            ...(Number.isFinite(Number(chartsStyle?.bar?.borderRadius)) ? { borderRadius: Number(chartsStyle?.bar?.borderRadius) } : {}),
            ...(typeof chartsStyle?.bar?.borderSkipped === 'boolean' ? { borderSkipped: chartsStyle.bar.borderSkipped } : {}),
          }));
        }
        // default single-series
        const baseSty: any = {};
        if (needRandomVividBars) { const p = makeVividPalette((labels || []).length); Object.assign(baseSty, { backgroundColor: p.fills, borderColor: p.borders }); }
        else if (isCircular) { if (computedBgForCircular) Object.assign(baseSty, { backgroundColor: computedBgForCircular.fills, borderColor: computedBgForCircular.borders }); }
        else { if (computedBgForOthers) Object.assign(baseSty, { backgroundColor: computedBgForOthers.fills, borderColor: computedBgForOthers.borders }); }
        if (primary) Object.assign(baseSty, { borderColor: alpha(primary, 1) });
        if (Number.isFinite(borderWidth)) Object.assign(baseSty, { borderWidth });
        const extraLine: any = (baseType === 'line') ? { ...(Number.isFinite(Number(chartsStyle?.line?.tension)) ? { tension: Number(chartsStyle?.line?.tension) } : {}), fill: (chartType === 'area') || undefined, ...(Number.isFinite(Number(chartsStyle?.line?.pointRadius)) ? { pointRadius: Number(chartsStyle?.line?.pointRadius) } : {}), ...(Number.isFinite(Number(chartsStyle?.line?.pointHoverRadius)) ? { pointHoverRadius: Number(chartsStyle?.line?.pointHoverRadius) } : {}), ...(primary && Number.isFinite(Number(chartsStyle?.line?.fillAlpha)) ? { backgroundColor: alpha(primary, Number(chartsStyle?.line?.fillAlpha)) } : {}) } : {};
        const extraRadar: any = (baseType === 'radar') ? { fill: true, borderWidth: (Number.isFinite(Number(chartsStyle?.borderWidth)) ? Number(chartsStyle?.borderWidth) : 2) } : {};
        return [{ label: title, data: (Array.isArray(data) ? data : []), ...(baseSty), ...(extraLine), ...(extraRadar), ...(baseType === 'bar' ? { ...(Number.isFinite(Number(chartsStyle?.bar?.borderRadius)) ? { borderRadius: Number(chartsStyle?.bar?.borderRadius) } : {}), ...(typeof chartsStyle?.bar?.borderSkipped === 'boolean' ? { borderSkipped: chartsStyle.bar.borderSkipped } : {}) } : {}) }];
      })();

      const chartConfig: ChartConfiguration = {
        type: baseType,
        data: {
          labels,
          datasets,
        },
        plugins: ((): any[]|undefined => {
          const arr: any[] = [];
          if (baseType === 'bar' && barValuePlugin) arr.push(barValuePlugin);
          if ((chartType === 'pie' || chartType === 'doughnut' || chartType === 'polarArea') && circularValuePlugin) arr.push(circularValuePlugin);
          if (chartType === 'scatter' && scatterPointLabelPlugin) arr.push(scatterPointLabelPlugin);
          if (chartType === 'bubble' && bubblePointLabelPlugin) arr.push(bubblePointLabelPlugin);
          return arr.length ? arr : undefined;
        })(),
        options: {
          responsive: false,
          maintainAspectRatio: false,
          ...(() => {
            // Circular charts: trust Chart.js auto layout (no extra padding)
            if (isCircular) {
              return {} as any;
            }
            // Non-circular: avoid extra padding when legend hidden
            if (!legendDisplay) {
              return { layout: { padding: Number.isFinite(padding) ? Number(padding) : 0 } } as any;
            }
            const dynPad: any = {};
            const pos = (legendPosition || 'top').toLowerCase();
            if (pos.startsWith('t')) dynPad.top = Math.max(Math.max(60, (legendFontSize ? legendFontSize * 2 : 0) + 20), Number.isFinite(padding) ? Number(padding) : 0);
            else if (pos.startsWith('r')) dynPad.right = Math.max(220, Number.isFinite(padding) ? Number(padding) : 0);
            else if (pos.startsWith('l')) dynPad.left = Math.max(220, Number.isFinite(padding) ? Number(padding) : 0);
            else if (pos.startsWith('b')) dynPad.bottom = Math.max(Math.max(60, (legendFontSize ? legendFontSize * 2 : 0) + 20), Number.isFinite(padding) ? Number(padding) : 0);
            return { layout: { padding: Object.keys(dynPad).length ? dynPad : (Number.isFinite(padding) ? padding : 0) } } as any;
          })(),
          plugins: {
            title: { display: !!(title && String(title).trim()), text: title, font: { ...(Number.isFinite(titleSize) ? { size: titleSize } : {}), family: 'Noto Sans JP', weight: 'bold' as any } as any, color: '#111', padding: { top: 10, bottom: 16 } as any },
            legend: {
              display: legendDisplay,
              position: legendPosition as any,
              labels: {
                font: { family: 'Noto Sans JP', ...(legendFontSize ? { size: legendFontSize } : {}) },
                color: '#111',
                ...(legendLabelsPadding ? { padding: legendLabelsPadding } : {}),
                // enlarge marker box proportionally to font size for readability
                ...(legendFontSize ? { boxWidth: Math.round(legendFontSize * 1.2), boxHeight: Math.round(legendFontSize * 0.6) } : {})
              }
            } as any,
          },
        },
      };

      // Ensure scatter dataset parsing keys/point style explicitly
      if (chartType === 'scatter') {
        try {
          const ds = (chartConfig.data as any).datasets?.[0];
          if (ds) {
            ds.parsing = { xAxisKey: 'x', yAxisKey: 'y' } as any;
            ds.showLine = false;
            const pr = Number.isFinite(Number(chartsStyle?.pointRadius)) ? Number(chartsStyle?.pointRadius) : 10;
            const phr = Number.isFinite(Number(chartsStyle?.pointHoverRadius)) ? Number(chartsStyle?.pointHoverRadius) : (pr + 2);
            const pColor = typeof chartsStyle?.pointColor === 'string' ? String(chartsStyle?.pointColor) : '#111111';
            const pBorderColor = typeof chartsStyle?.pointBorderColor === 'string' ? String(chartsStyle?.pointBorderColor) : '#000000';
            const pBorderWidth = Number.isFinite(Number(chartsStyle?.pointBorderWidth)) ? Number(chartsStyle?.pointBorderWidth) : 2;
            ds.pointRadius = pr;
            ds.pointHoverRadius = phr;
            ds.pointBackgroundColor = pColor;
            ds.pointBorderColor = pBorderColor;
            ds.pointBorderWidth = pBorderWidth;
            // no-op
          }
        } catch {}
      }
      // no-op

      if (chartType === 'doughnut' && Number.isFinite(Number(chartsStyle?.holeScale))) {
        const cut = Math.max(0, Math.min(1, Number(chartsStyle.holeScale)));
        (chartConfig.options as any).cutout = `${Math.round(cut * 100)}%`;
      }

      if (baseType === 'radar') {
        const pointLabelSize = Number.isFinite(Number(chartsStyle?.labelFontSize)) ? Number(chartsStyle?.labelFontSize) : undefined;
        const pointLabelColor = chartsStyle?.labelColor ? String(chartsStyle?.labelColor) : '#333333';
        (chartConfig.options as any).scales = { r: {
          ...(gridColor ? { angleLines: { color: gridColor } } : {}),
          ...(gridColor ? { grid: { color: gridColor } } : {}),
          ticks: { font: { family: 'Noto Sans JP', ...(Number.isFinite(axisFontSize) ? { size: axisFontSize } : {}) } },
          pointLabels: { font: { family: 'Noto Sans JP', ...(pointLabelSize ? { size: pointLabelSize } : {}) }, color: pointLabelColor }
        } } as any;
      } else if (baseType === 'polarArea') {
        (chartConfig.options as any).scales = { r: { ...(gridColor ? { grid: { color: gridColor } } : {}), ticks: { font: { family: 'Noto Sans JP', ...(Number.isFinite(axisFontSize) ? { size: axisFontSize } : {}) } } } } as any;
      } else if (baseType !== 'pie' && baseType !== 'doughnut') {
        const scales: any = {
          x: { ...(gridColor ? { grid: { display: false } } : {}), ticks: { font: { family: 'Noto Sans JP', ...(Number.isFinite(axisFontSizeX) ? { size: axisFontSizeX } : {}) } } },
          y: { ...(gridColor ? { grid: { color: gridColor } } : {}), ticks: { font: { family: 'Noto Sans JP', ...(Number.isFinite(axisFontSizeY) ? { size: axisFontSizeY } : {}) } } },
        };
        if (chartType === 'scatter') {
          const needsLog = (() => {
            try {
              const vals = Array.isArray(data) ? data : [];
              const nums = vals.map((v:any) => (v && typeof v === 'object') ? { x: Number(v.x ?? (Array.isArray(v)? v[0] : NaN)), y: Number(v.y ?? (Array.isArray(v)? v[1] : NaN)) } : { x: NaN, y: NaN });
              const xs = nums.map(n => n.x).filter(n => Number.isFinite(n) && n > 0);
              const ys = nums.map(n => n.y).filter(n => Number.isFinite(n) && n > 0);
              const posPctX = xs.length / Math.max(1, nums.length);
              const posPctY = ys.length / Math.max(1, nums.length);
              const range = (arr:number[]) => {
                if (!arr.length) return 0; const min = Math.min(...arr), max = Math.max(...arr); return max / Math.max(1e-9, min);
              };
              const rx = range(xs), ry = range(ys);
              const useLogX = posPctX > 0.8 && rx >= 100;
              const useLogY = posPctY > 0.8 && ry >= 100;
              return { useLogX, useLogY };
            } catch { return { useLogX: false, useLogY: false }; }
          })();
          scales.x.type = needsLog.useLogX ? 'logarithmic' : 'linear';
          scales.x.position = 'bottom';
          scales.y.type = needsLog.useLogY ? 'logarithmic' : 'linear';
          if (needsLog.useLogX) (scales.x.ticks = scales.x.ticks || {}).callback = (v: any) => `${v}`;
          if (needsLog.useLogY) (scales.y.ticks = scales.y.ticks || {}).callback = (v: any) => `${v}`;
        }
        if (chartType === 'horizontalBar') {
          (chartConfig.options as any).indexAxis = 'y';
        }
        if (chartType === 'stackedBar') {
          scales.x.stacked = true; scales.y.stacked = true;
        }
        (chartConfig.options as any).scales = scales;
      }

      const key = makeKey({ chartType, title, labels, data, primary, secondary, chartsStyle, width, height, transparent, legendFontSize });
      const hit = chartCache.get(key);
      const canvas = getCanvas(width, height, transparent ? 'transparent' : 'white');
      const buffer: Buffer = hit || await canvas.renderToBuffer(chartConfig, 'image/png');
      if (!hit) cachePut(key, buffer);

      if (returnBuffer === true) {
        logger.info({ bytes: buffer.length }, 'Generated chart PNG in-memory.');
        return { success: true, data: { buffer, bufferSize: buffer.length } } as const;
      }

      const { config } = await import('../xibo-agent/config');
      const path = await import('path');
      const chartDir = path.join(config.tempDir, 'charts');
      const imagePath = path.join(chartDir, `${fileName || 'chart'}.png`);
      await fs.mkdir(chartDir, { recursive: true });
      await fs.writeFile(imagePath, buffer, 'binary');
      logger.info({ imagePath }, 'Generated chart PNG and saved to disk (legacy mode).');
      return { success: true, data: { imagePath } } as const;
    } catch (error) {
      const message = error instanceof Error ? error.message : 'An unknown error occurred during chart generation.';
      logger.error({ error }, 'Failed to generate chart.');
      return { success: false, message, error } as const;
    }
  },
}); 