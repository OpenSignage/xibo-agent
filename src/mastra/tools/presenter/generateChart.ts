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
const chartTypeSchema = z.enum(['bar', 'pie', 'line']);
const inputSchema = z.object({
  chartType: chartTypeSchema,
  title: z.string().describe('The title of the chart.'),
  labels: z.array(z.string()).describe('The labels for the chart data.'),
  data: z.array(z.number()).describe('The numerical data for the chart.'),
  fileName: z.string().optional().describe('Optional base name for the image. Ignored in buffer mode.'),
  returnBuffer: z.boolean().optional().describe('If true, returns PNG buffer instead of writing a file.'),
});

const outputFileSchema = z.object({ imagePath: z.string() });
const outputBufferSchema = z.object({ buffer: z.any(), bufferSize: z.number() });

const errorResponseSchema = z.object({
  success: z.literal(false),
  message: z.string(),
  error: z.any().optional(),
});

const successResponseSchema = z.object({ success: z.literal(true), data: z.union([outputBufferSchema, outputFileSchema]) });

export const generateChartTool = createTool({
  id: 'generate-chart',
  description: 'Generates a chart image (bar, pie, or line) as PNG. Supports on-memory buffer return.',
  inputSchema,
  outputSchema: z.union([successResponseSchema, errorResponseSchema]),
  execute: async ({ context }) => {
    const { chartType, title, labels, data, fileName, returnBuffer } = context as any;
    logger.info({ chartType, title }, 'Generating chart image (PNG)...');

    try {
      const chartConfig: ChartConfiguration = {
        type: chartType,
        data: {
          labels: labels,
          datasets: [{
            label: title,
            data: data,
            backgroundColor: [
              'rgba(0, 90, 156, 0.7)', 'rgba(255, 99, 132, 0.7)', 'rgba(54, 162, 235, 0.7)',
              'rgba(255, 206, 86, 0.7)', 'rgba(75, 192, 192, 0.7)', 'rgba(153, 102, 255, 0.7)'
            ],
            borderColor: 'rgba(0, 90, 156, 1)',
            borderWidth: 1,
          }],
        },
        options: {
          plugins: {
            title: { display: true, text: title, font: { size: 16 } },
            legend: { display: chartType === 'pie' }
          },
        },
      };

      if (chartType !== 'pie') {
        chartConfig.options!.scales = { y: { beginAtZero: true } };
      }

      const chartJSNodeCanvas = new ChartJSNodeCanvas({ width: 800, height: 450, backgroundColour: 'white' });
      const buffer = await chartJSNodeCanvas.renderToBuffer(chartConfig, 'image/png');

      // Prefer buffer mode by default
      if (returnBuffer !== false) {
        logger.info({ bytes: buffer.length }, 'Generated chart PNG in-memory.');
        return { success: true, data: { buffer, bufferSize: buffer.length } } as const;
      }

      // Legacy fallback: write to disk only if explicitly requested (returnBuffer === false)
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