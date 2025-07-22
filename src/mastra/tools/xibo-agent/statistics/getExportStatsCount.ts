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

/**
 * @module getExportStatsCount
 * @description This module provides a tool to retrieve the count of statistics records
 * that can be exported from the Xibo CMS, based on specified filters.
 */
import { z } from 'zod';
import { createTool } from '@mastra/core/tools';
import { config } from '../config';
import { getAuthHeaders } from '../auth';
import { logger } from '../../../logger';
import { decodeErrorMessage } from '../utility/error';

// Schema for a successful response.
const successResponseSchema = z.object({
  success: z.literal(true),
  data: z.number(),
  message: z.string(),
});

// Schema for an error response.
const errorResponseSchema = z.object({
  success: z.literal(false),
  message: z.string(),
  error: z.any().optional(),
  errorData: z.any().optional(),
});

/**
 * Schema for the tool's output, which can be a success or error response.
 */
const outputSchema = z.union([successResponseSchema, errorResponseSchema]);

/**
 * @tool getExportStatsCount
 * @description A tool for retrieving the count of exportable statistics records.
 * This is useful for understanding the volume of data before performing a full export.
 */
export const getExportStatsCount = createTool({
  id: 'get-export-stats-count',
  description: 'Get the count of statistics data records for export.',
  inputSchema: z.object({
    fromDt: z.string().optional().describe("The start date for the filter (e.g., 'YYYY-MM-DD HH:MM:SS')."),
    toDt: z.string().optional().describe("The end date for the filter (e.g., 'YYYY-MM-DD HH:MM:SS')."),
    displayId: z.number().optional().describe('Filter by a single Display ID.'),
  }),
  outputSchema,
  execute: async ({ context }) => {
    if (!config.cmsUrl) {
      const message = 'CMS URL is not configured.';
      logger.error(message);
      return { success: false as const, message };
    }

    const url = new URL(`${config.cmsUrl}/api/stats/getExportStatsCount`);
    const params = new URLSearchParams();

    Object.entries(context).forEach(([key, value]) => {
      if (value !== undefined && value !== null) {
        params.append(key, String(value));
      }
    });
    url.search = params.toString();

    try {
      logger.info({ url: url.toString() }, 'Requesting export stats count.');
      
      const response = await fetch(url.toString(), {
        method: 'GET',
        headers: await getAuthHeaders(),
      });
      
      const responseData = await response.json();

      if (!response.ok) {
        const decodedError = decodeErrorMessage(responseData);
        const message = `Failed to get export stats count. API responded with status ${response.status}.`;
        logger.error({ status: response.status, response: decodedError }, message);
        return {
          success: false as const,
          message,
          errorData: decodedError,
        };
      }

      const validationResult = z.number().safeParse(responseData);

      if (!validationResult.success) {
        const message = 'Export stats count response validation failed.';
        logger.error({ error: validationResult.error.flatten(), data: responseData }, message);
        return {
          success: false as const,
          message,
          error: validationResult.error,
          errorData: responseData,
        };
      }

      const message = `Successfully retrieved export stats count: ${validationResult.data}`;
      logger.info({ count: validationResult.data }, message);
      return {
        success: true as const,
        data: validationResult.data,
        message,
      };
    } catch (error: unknown) {
      const message = 'An unexpected error occurred while getting the export stats count.';
      logger.error({ error }, message);
      return {
        success: false as const,
        message,
        error: error instanceof Error ? { name: error.name, message: error.message } : error,
      };
    }
  },
}); 