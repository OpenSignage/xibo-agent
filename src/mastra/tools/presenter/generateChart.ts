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
  data: z.array(z.number()),
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

let singletonCanvas: ChartJSNodeCanvas | null = null;
const getCanvas = () => {
  if (!singletonCanvas) singletonCanvas = new ChartJSNodeCanvas({ width: 1280, height: 720, backgroundColour: 'white' });
  return singletonCanvas;
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
      const alphaOthers = Number.isFinite(Number(chartsStyle?.alpha?.others)) ? Number(chartsStyle.alpha.others) : 1;
      const bgPalette = (palette as string[]).length ? (palette as string[]).map((c: string) => alpha(c, (chartType === 'pie' || chartType === 'doughnut') ? alphaPie : alphaOthers)) : undefined as any;

      const titleSize = chartType === 'bar' ? (Number(chartsStyle?.titleFontSizeBar)) : (Number(chartsStyle?.titleFontSizeDefault));
      const axisFontSize = Number(chartsStyle?.axisFontSize);
      const axisFontSizeX = Number.isFinite(Number(chartsStyle?.axisFontSizeX)) ? Number(chartsStyle?.axisFontSizeX) : axisFontSize;
      const axisFontSizeY = Number.isFinite(Number(chartsStyle?.axisFontSizeY)) ? Number(chartsStyle?.axisFontSizeY) : axisFontSize;
      const padding = Number(chartsStyle?.padding);
      const borderWidth = Number(chartsStyle?.borderWidth);
      const legendPosition = chartsStyle?.legend?.position ? String(chartsStyle?.legend?.position) : undefined;
      const gridColor = chartsStyle?.gridColor ? String(chartsStyle?.gridColor) : undefined;
      const dataLabelFontSize = Number(chartsStyle?.dataLabelFontSize);
      const dataLabelColor = chartsStyle?.dataLabelColor ? String(chartsStyle?.dataLabelColor) : undefined;

      // Draw numeric value labels on each bar (without external plugins)
      const barValuePlugin: any = (chartType === 'bar' && Number.isFinite(dataLabelFontSize) && dataLabelColor) ? {
        id: 'bar-value-label',
        afterDatasetsDraw: (chart: any) => {
          const { ctx } = chart;
          ctx.save();
          ctx.font = `${dataLabelFontSize as number}px Noto Sans JP`;
          ctx.fillStyle = dataLabelColor as string;
          ctx.textAlign = 'center';
          ctx.textBaseline = 'bottom';
          const meta = chart.getDatasetMeta(0);
          if (!meta || !Array.isArray(meta.data)) { ctx.restore(); return; }
          meta.data.forEach((element: any, index: number) => {
            const raw = (Array.isArray(data) ? data[index] : undefined);
            if (typeof raw !== 'number') return;
            const valText = `${raw}`;
            const pos = typeof element.tooltipPosition === 'function' ? element.tooltipPosition() : { x: element.x, y: element.y };
            const textY = Math.min(pos.y, element.y || pos.y) - 4;
            ctx.fillText(valText, pos.x, textY);
          });
          ctx.restore();
        },
      } : undefined;

      // Map logical types to Chart.js base types + options
      const baseType = ((): any => {
        if (chartType === 'horizontalBar' || chartType === 'stackedBar') return 'bar';
        if (chartType === 'area') return 'line';
        if (chartType === 'polarArea') return 'polarArea';
        return chartType as any;
      })();

      const chartConfig: ChartConfiguration = {
        type: baseType,
        data: {
          labels,
          datasets: [{
            label: title,
            data: ((): any => {
              if (chartType === 'scatter') {
                return (data || []).map((y: number, i: number) => ({ x: i, y }));
              }
              if (chartType === 'bubble') {
                return (data || []).map((y: number, i: number) => ({ x: i, y, r: 5 }));
              }
              return data;
            })(),
            ...(bgPalette ? { backgroundColor: bgPalette } : {}),
            ...(primary ? { borderColor: alpha(primary, 1) } : {}),
            borderWidth,
            ...(baseType === 'bar' ? { ...(Number.isFinite(Number(chartsStyle?.bar?.borderRadius)) ? { borderRadius: Number(chartsStyle?.bar?.borderRadius) } : {}), ...(typeof chartsStyle?.bar?.borderSkipped === 'boolean' ? { borderSkipped: chartsStyle.bar.borderSkipped } : {}) } : {}),
            ...(baseType === 'line' ? { ...(Number.isFinite(Number(chartsStyle?.line?.tension)) ? { tension: Number(chartsStyle?.line?.tension) } : {}), fill: (chartType === 'area') || undefined, ...(Number.isFinite(Number(chartsStyle?.line?.pointRadius)) ? { pointRadius: Number(chartsStyle?.line?.pointRadius) } : {}), ...(Number.isFinite(Number(chartsStyle?.line?.pointHoverRadius)) ? { pointHoverRadius: Number(chartsStyle?.line?.pointHoverRadius) } : {}), ...(primary && Number.isFinite(Number(chartsStyle?.line?.fillAlpha)) ? { backgroundColor: alpha(primary, Number(chartsStyle?.line?.fillAlpha)) } : {}) } : {}),
          }],
        },
        plugins: ((baseType === 'bar') && barValuePlugin) ? [barValuePlugin as any] : undefined,
        options: {
          responsive: false,
          maintainAspectRatio: false,
          ...(Number.isFinite(padding) ? { layout: { padding } as any } : {}),
          plugins: {
            title: { display: true, text: title, font: { ...(Number.isFinite(titleSize) ? { size: titleSize } : {}), family: 'Noto Sans JP', weight: 'bold' as any } as any, color: '#111', padding: { top: 10, bottom: 16 } as any },
            ...(legendPosition ? { legend: { position: legendPosition as any, labels: { font: { family: 'Noto Sans JP' } } } as any } : {}),
          },
        },
      };

      if (baseType === 'radar') {
        (chartConfig.options as any).scales = { r: { ...(gridColor ? { angleLines: { color: gridColor } } : {}), ...(gridColor ? { grid: { color: gridColor } } : {}), ticks: { font: { family: 'Noto Sans JP', ...(Number.isFinite(axisFontSize) ? { size: axisFontSize } : {}) } } } } as any;
      } else if (baseType === 'polarArea') {
        (chartConfig.options as any).scales = { r: { ...(gridColor ? { grid: { color: gridColor } } : {}), ticks: { font: { family: 'Noto Sans JP', ...(Number.isFinite(axisFontSize) ? { size: axisFontSize } : {}) } } } } as any;
      } else if (baseType !== 'pie' && baseType !== 'doughnut') {
        const scales: any = {
          x: { ...(gridColor ? { grid: { display: false } } : {}), ticks: { font: { family: 'Noto Sans JP', ...(Number.isFinite(axisFontSizeX) ? { size: axisFontSizeX } : {}) } } },
          y: { ...(gridColor ? { grid: { color: gridColor } } : {}), ticks: { font: { family: 'Noto Sans JP', ...(Number.isFinite(axisFontSizeY) ? { size: axisFontSizeY } : {}) } } },
        };
        if (chartType === 'horizontalBar') {
          (chartConfig.options as any).indexAxis = 'y';
        }
        if (chartType === 'stackedBar') {
          scales.x.stacked = true; scales.y.stacked = true;
        }
        (chartConfig.options as any).scales = scales;
      }

      const key = makeKey({ chartType, title, labels, data, primary, secondary, chartsStyle });
      const hit = chartCache.get(key);
      const canvas = getCanvas();
      const buffer = hit || await canvas.renderToBuffer(chartConfig, 'image/png');
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