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

const chartTypeSchema = z.enum(['bar', 'pie', 'line', 'doughnut']);
const inputSchema = z.object({
  chartType: chartTypeSchema,
  title: z.string(),
  labels: z.array(z.string()),
  data: z.array(z.number()),
  fileName: z.string().optional(),
  returnBuffer: z.boolean().optional(),
  themeColor1: z.string().optional(),
  themeColor2: z.string().optional(),
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
    const { chartType, title, labels, data, fileName, returnBuffer, themeColor1, themeColor2 } = context as any;
    logger.info({ chartType, title }, 'Generating chart image (PNG)...');
    try {
      let chartsStyle: any = undefined;
      try {
        const { config } = await import('../xibo-agent/config');
        const path = await import('path');
        const fsMod = await import('fs/promises');
        const tplPath = path.join(config.projectRoot, 'persistent_data', 'presentations', 'templates', 'default.json');
        const raw = await fsMod.readFile(tplPath, 'utf-8');
        const tpl = JSON.parse(raw);
        chartsStyle = (tpl && tpl.visualStyles && tpl.visualStyles.charts) ? tpl.visualStyles.charts : undefined;
      } catch {}

      const primary = typeof themeColor1 === 'string' && /^#?[0-9a-fA-F]{6}$/.test(themeColor1) ? (themeColor1.startsWith('#') ? themeColor1 : `#${themeColor1}`) : (chartsStyle?.colors?.[0] || '#005A9C');
      const secondary = typeof themeColor2 === 'string' && /^#?[0-9a-fA-F]{6}$/.test(themeColor2) ? (themeColor2.startsWith('#') ? themeColor2 : `#${themeColor2}`) : (chartsStyle?.colors?.[1] || '#00B0FF');
      const alpha = (hex: string, a: number) => {
        const h = hex.replace('#','');
        const r = parseInt(h.slice(0,2),16), g = parseInt(h.slice(2,4),16), b = parseInt(h.slice(4,6),16);
        return `rgba(${r}, ${g}, ${b}, ${a})`;
      };
      const palette = Array.isArray(chartsStyle?.colors) && chartsStyle.colors.length ? chartsStyle.colors : [primary, secondary, '#FFC107', '#4CAF50', '#9C27B0', '#FF7043'];
      const alphaPie = Number.isFinite(Number(chartsStyle?.alpha?.pieDoughnut)) ? Number(chartsStyle.alpha.pieDoughnut) : 0.9;
      const alphaOthers = Number.isFinite(Number(chartsStyle?.alpha?.others)) ? Number(chartsStyle.alpha.others) : 0.7;
      const bgPalette = (palette as string[]).map((c: string) => alpha(c, (chartType === 'pie' || chartType === 'doughnut') ? alphaPie : alphaOthers));

      const titleSize = chartType === 'bar' ? (Number(chartsStyle?.titleFontSizeBar) || 34) : (Number(chartsStyle?.titleFontSizeDefault) || 26);
      const axisFontSize = Number(chartsStyle?.axisFontSize) || 14;
      const axisFontSizeX = Number(chartsStyle?.axisFontSizeX) || axisFontSize;
      const axisFontSizeY = Number(chartsStyle?.axisFontSizeY) || axisFontSize;
      const padding = Number(chartsStyle?.padding) || 28;
      const borderWidth = Number(chartsStyle?.borderWidth) || 1;
      const legendPosition = String(chartsStyle?.legend?.position || 'bottom');
      const gridColor = String(chartsStyle?.gridColor || 'rgba(0,0,0,0.10)');
      const dataLabelFontSize = Number(chartsStyle?.dataLabelFontSize) || 12;
      const dataLabelColor = String(chartsStyle?.dataLabelColor || '#111');

      // Draw numeric value labels on each bar (without external plugins)
      const barValuePlugin: any = (chartType === 'bar') ? {
        id: 'bar-value-label',
        afterDatasetsDraw: (chart: any) => {
          const { ctx } = chart;
          ctx.save();
          ctx.font = `${dataLabelFontSize}px Noto Sans JP`;
          ctx.fillStyle = dataLabelColor;
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

      const chartConfig: ChartConfiguration = {
        type: chartType,
        data: {
          labels,
          datasets: [{
            label: title,
            data,
            backgroundColor: bgPalette,
            borderColor: alpha(primary, 1),
            borderWidth,
            ...(chartType === 'bar' ? { borderRadius: Number(chartsStyle?.bar?.borderRadius) || 6, borderSkipped: (typeof chartsStyle?.bar?.borderSkipped === 'boolean' ? chartsStyle.bar.borderSkipped : false) } : {}),
            ...(chartType === 'line' ? { tension: Number(chartsStyle?.line?.tension) || 0.35, fill: true, pointRadius: Number(chartsStyle?.line?.pointRadius) || 3, pointHoverRadius: Number(chartsStyle?.line?.pointHoverRadius) || 4, backgroundColor: alpha(primary, Number(chartsStyle?.line?.fillAlpha) || 0.15) } : {}),
          }],
        },
        plugins: (chartType === 'bar' && barValuePlugin) ? [barValuePlugin as any] : undefined,
        options: {
          responsive: false,
          maintainAspectRatio: false,
          layout: { padding },
          plugins: {
            title: { display: true, text: title, font: { size: titleSize, family: 'Noto Sans JP', weight: 'bold' as any } as any, color: '#111', padding: { top: 10, bottom: 16 } as any },
            legend: { display: (chartType === 'pie' || chartType === 'doughnut'), position: legendPosition as any, labels: { font: { family: 'Noto Sans JP' } } },
          },
        },
      };

      if (chartType !== 'pie' && chartType !== 'doughnut') {
        chartConfig.options!.scales = {
          x: { grid: { display: false }, ticks: { font: { family: 'Noto Sans JP', size: axisFontSizeX } } },
          y: { beginAtZero: true, grid: { color: gridColor }, ticks: { font: { family: 'Noto Sans JP', size: axisFontSizeY } } },
        } as any;
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