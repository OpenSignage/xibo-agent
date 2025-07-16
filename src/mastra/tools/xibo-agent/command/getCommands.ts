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
 * @module getCommands
 * @description Provides a tool to retrieve a list of commands from the Xibo CMS.
 * It implements the GET /command API endpoint and supports various filter options.
 */
import { z } from 'zod';
import { createTool } from '@mastra/core';
import { getAuthHeaders } from '../auth';
import { config } from '../config';
import { logger } from '../../../index';
import { processError } from '../utility/error';
import { commandSchema } from './schemas';

/**
 * Schema for the successful response, containing an array of commands.
 */
const getCommandsSuccessSchema = z.object({
  success: z.literal(true),
  data: z.array(commandSchema),
});

/**
 * Schema for a standardized error response.
 */
const errorResponseSchema = z.object({
  success: z.literal(false),
  message: z.string().describe('A simple, readable error message.'),
  error: z
    .any()
    .optional()
    .describe('Detailed error information, e.g., from Zod.'),
  errorData: z.any().optional().describe('Raw response data from the CMS.'),
});

/**
 * Union schema for tool output, covering both success and error cases.
 */
const outputSchema = z.union([getCommandsSuccessSchema, errorResponseSchema]);

/**
 * Tool for retrieving a list of commands from the Xibo CMS.
 */
export const getCommands = createTool({
  id: 'get-commands',
  description: 'Gets a list of all commands from the Xibo CMS.',
  inputSchema: z.object({
    commandId: z
      .number()
      .optional()
      .describe('Filter by a specific command ID.'),
    command: z.string().optional().describe('Filter by the command name.'),
    code: z.string().optional().describe('Filter by the command code.'),
  }),
  outputSchema,
  execute: async ({ context }) => {
    if (!config.cmsUrl) {
      const message = 'CMS URL is not configured.';
      logger.error({}, message);
      return { success: false as const, message };
    }

    try {
      const url = new URL(`${config.cmsUrl}/api/command`);

      // Append query parameters from context if they exist
      if (context.commandId) {
        url.searchParams.append('commandId', context.commandId.toString());
      }
      if (context.command) {
        url.searchParams.append('command', context.command);
      }
      if (context.code) {
        url.searchParams.append('code', context.code);
      }

      logger.debug(
        { url: url.toString() },
        'Attempting to get a list of commands'
      );

      const response = await fetch(url.toString(), {
        method: 'GET',
        headers: await getAuthHeaders(),
      });

      const responseData = await response.json();

      if (!response.ok) {
        const message = `Failed to get commands. API responded with status ${response.status}.`;
        logger.error(
          { status: response.status, response: responseData },
          message
        );
        return { success: false as const, message, errorData: responseData };
      }

      // The API can return a direct array or an object with a data property.
      // We'll try to parse the direct array first.
      const arrayValidation = z.array(commandSchema).safeParse(responseData);
      if (arrayValidation.success) {
        logger.info(
          { count: arrayValidation.data.length },
          `Successfully retrieved ${arrayValidation.data.length} commands.`
        );
        return { success: true as const, data: arrayValidation.data };
      }

      // If array parsing fails, it might be a wrapped object.
      // Let's create a temporary schema for that case and parse.
      const objectValidation = z
        .object({ data: z.array(commandSchema) })
        .safeParse(responseData);
      if (objectValidation.success) {
        logger.info(
          { count: objectValidation.data.data.length },
          `Successfully retrieved ${objectValidation.data.data.length} commands.`
        );
        return { success: true as const, data: objectValidation.data.data };
      }

      // If both validations fail, return a validation error.
      const message =
        'Get commands response validation failed for both array and object formats.';
      logger.error(
        {
          arrayError: arrayValidation.error.flatten(),
          objectError: objectValidation.error.flatten(),
          data: responseData,
        },
        message
      );
      return {
        success: false as const,
        message,
        error: {
          arrayError: arrayValidation.error.flatten(),
          objectError: objectValidation.error.flatten(),
        },
        errorData: responseData,
      };
    } catch (error) {
      const message = 'An unexpected error occurred while getting commands.';
      const processedError = processError(error);
      logger.error({ error: processedError }, message);
      return { success: false as const, message, error: processedError };
    }
  },
});

export default getCommands; 