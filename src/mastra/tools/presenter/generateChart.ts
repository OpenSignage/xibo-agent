/*
 * Copyright (C) 2025 Open Source Digital Signage Initiative.
 *
 * You can redistribute it and/or modify
 * it under the terms of the Elastic License 2.0 (ELv2) as published by
 * the Search AI Company, either version 3 of the License, or
 * any later version.
 *
 * You should have received a copy of the GElastic License 2.0 (ELv2).
 * see <https://www.elastic.co/licensing/elastic-license>.
 */
import { createTool } from '@mastra/core/tools';
import { z } from 'zod';
import { logger } from '../../logger';
import { ChartJSNodeCanvas } from 'chartjs-node-canvas';
import { ChartConfiguration } from 'chart.js';
import { promises as fs } from 'fs';

/**
 * @module generateChartTool
 * @description Generates a PNG chart image from data. Supports on-memory buffer return.
 */
const chartTypeSchema = z.enum(['bar', 'pie', 'line', 'doughnut']);
const inputSchema = z.object({
  chartType: chartTypeSchema,
  title: z.string().describe('The title of the chart.'),
  labels: z.array(z.string()).describe('The labels for the chart data.'),
  data: z.array(z.number()).describe('The numerical data for the chart.'),
  fileName: z.string().optional().describe('Optional base name for the image. Ignored in buffer mode.'),
  returnBuffer: z.boolean().optional().describe('If true, returns PNG buffer instead of writing a file.'),
  themeColor1: z.string().optional().describe('Optional primary theme color (hex like #RRGGBB) for styling.'),
  themeColor2: z.string().optional().describe('Optional secondary theme color for styling.'),
});

const outputFileSchema = z.object({ imagePath: z.string() });
const outputBufferSchema = z.object({ buffer: z.any(), bufferSize: z.number() });

const errorResponseSchema = z.object({
  success: z.literal(false),
  message: z.string(),
  error: z.any().optional(),
});

const successResponseSchema = z.object({ success: z.literal(true), data: z.union([outputBufferSchema, outputFileSchema]) });

// Singleton ChartJSNodeCanvas and in-memory LRU cache for chart buffers
let singletonCanvas: ChartJSNodeCanvas | null = null;
const getCanvas = () => {
  if (!singletonCanvas) {
    // Render at higher resolution for clearer display in PPTX (16:9)
    singletonCanvas = new ChartJSNodeCanvas({ width: 1280, height: 720, backgroundColour: 'white' });
  }
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
      // Style preset derived from optional theme colors
      const primary = typeof themeColor1 === 'string' && /^#?[0-9a-fA-F]{6}$/.test(themeColor1) ? (themeColor1.startsWith('#') ? themeColor1 : `#${themeColor1}`) : '#005A9C';
      const secondary = typeof themeColor2 === 'string' && /^#?[0-9a-fA-F]{6}$/.test(themeColor2) ? (themeColor2.startsWith('#') ? themeColor2 : `#${themeColor2}`) : '#00B0FF';
      const alpha = (hex: string, a: number) => {
        const h = hex.replace('#', '');
        const r = parseInt(h.slice(0,2), 16), g = parseInt(h.slice(2,4), 16), b = parseInt(h.slice(4,6), 16);
        return `rgba(${r}, ${g}, ${b}, ${a})`;
      };
      const palette = [primary, secondary, '#FFC107', '#4CAF50', '#9C27B0', '#FF7043'];
      const bgPalette = palette.map((c, i) => alpha(c, (chartType === 'pie' || chartType === 'doughnut') ? 0.9 : 0.7));

      const chartConfig: ChartConfiguration = {
        type: chartType,
        data: {
          labels: labels,
          datasets: [{
            label: title,
            data: data,
            backgroundColor: bgPalette,
            borderColor: alpha(primary, 1),
            borderWidth: 1,
            ...(chartType === 'bar' ? { borderRadius: 6, borderSkipped: false } : {}),
            ...(chartType === 'line' ? { tension: 0.35, fill: true, pointRadius: 3, pointHoverRadius: 4, backgroundColor: alpha(primary, 0.15) } : {}),
          }],
        },
        options: {
          responsive: false,
          maintainAspectRatio: false,
          layout: { padding: 28 },
          plugins: {
            title: { display: true, text: title, font: { size: 26, family: 'Noto Sans JP', weight: 'bold' as any }, color: '#111', padding: { top: 10, bottom: 16 } as any },
            legend: { display: (chartType === 'pie' || chartType === 'doughnut'), position: 'bottom', labels: { font: { family: 'Noto Sans JP' } } },
          },
        },
      };

      if (chartType !== 'pie') {
        chartConfig.options!.scales = {
          x: { grid: { display: false }, ticks: { font: { family: 'Noto Sans JP', size: 14 } } },
          y: { beginAtZero: true, grid: { color: 'rgba(0,0,0,0.10)' }, ticks: { font: { family: 'Noto Sans JP', size: 14 } } },
        } as any;
      }

      const key = makeKey({ chartType, title, labels, data, primary, secondary });
      const hit = chartCache.get(key);
      const canvas = getCanvas();
      const buffer = hit || await canvas.renderToBuffer(chartConfig, 'image/png');
      if (!hit) cachePut(key, buffer);

      // Prefer disk mode by default to avoid large payloads in workflow states
      if (returnBuffer === true) {
        logger.info({ bytes: buffer.length }, 'Generated chart PNG in-memory.');
        return { success: true, data: { buffer, bufferSize: buffer.length } } as const;
      }

      // Write to disk (default path under temp/charts)
      const { config } = await import('../xibo-agent/config');
      const path = await import('path');
      const chartDir = path.join(config.tempDir, 'charts');
      const imagePath = path.join(chartDir, `${fileName || 'chart'}.png`);
      await fs.mkdir(chartDir, { recursive: true });
      await fs.writeFile(imagePath, buffer, 'binary');
      logger.info({ imagePath }, 'Generated chart PNG and saved to disk (legacy mode).');
      return { success: true, data: { imagePath } } as const;

    } catch (error) {
      const message = error instanceof Error ? error.message : "An unknown error occurred during chart generation.";
      logger.error({ error }, 'Failed to generate chart.');
      return {
        success: false,
        message,
        error,
      } as const;
    }
  },
}); 