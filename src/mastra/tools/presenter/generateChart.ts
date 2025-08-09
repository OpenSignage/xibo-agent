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
import path from 'path';
import { config } from '../xibo-agent/config';

/**
 * @module generateChartTool
 * @description A tool to generate a chart image from data and save it.
 */
const chartTypeSchema = z.enum(['bar', 'pie', 'line']);
const inputSchema = z.object({
    chartType: chartTypeSchema,
    title: z.string().describe('The title of the chart.'),
    labels: z.array(z.string()).describe('The labels for the chart data.'),
    data: z.array(z.number()).describe('The numerical data for the chart.'),
    fileName: z.string().describe('The base name for the output image file (e.g., "chart_1").')
});

const outputSchema = z.object({
  imagePath: z.string().describe('The absolute path to the generated chart image.'),
});

const errorResponseSchema = z.object({
  success: z.literal(false),
  message: z.string(),
  error: z.any().optional(),
});

const successResponseSchema = z.object({
  success: z.literal(true),
  data: outputSchema,
});

export const generateChartTool = createTool({
  id: 'generate-chart',
  description: 'Generates a chart image (bar, pie, or line) from the provided data and saves it as a PNG file.',
  inputSchema,
  outputSchema: z.union([successResponseSchema, errorResponseSchema]),
  execute: async ({ context }) => {
    const { chartType, title, labels, data, fileName } = context;
    const chartDir = path.join(config.tempDir, 'charts');
    const imagePath = path.join(chartDir, `${fileName}.png`);

    logger.info({ chartType, title, imagePath }, 'Generating chart image...');

    try {
      await fs.mkdir(chartDir, { recursive: true });

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
      const buffer = await chartJSNodeCanvas.renderToBuffer(chartConfig);
      await fs.writeFile(imagePath, buffer, 'binary');
      
      logger.info({ imagePath }, 'Successfully generated and saved chart image.');
      return {
        success: true,
        data: { imagePath },
      } as const;

    } catch (error) {
      const message = error instanceof Error ? error.message : "An unknown error occurred during chart generation.";
      logger.error({ error, imagePath }, 'Failed to generate chart.');
      return {
        success: false,
        message,
        error,
      } as const;
    }
  },
}); 