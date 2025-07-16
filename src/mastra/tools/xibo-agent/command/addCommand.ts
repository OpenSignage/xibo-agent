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
 * @module addCommand
 * @description Provides a tool to add a new command to the Xibo CMS.
 * It implements the POST /command API endpoint.
 */
import { z } from 'zod';
import { createTool } from '@mastra/core';
import { getAuthHeaders } from '../auth';
import { config } from '../config';
import { logger } from '../../../index';
import { processError } from '../utility/error';
import { commandSchema } from './schemas';

/**
 * Schema for the successful response, containing the newly created command.
 */
const addCommandSuccessSchema = z.object({
  success: z.literal(true),
  data: commandSchema,
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
const outputSchema = z.union([addCommandSuccessSchema, errorResponseSchema]);

/**
 * Tool to add a new command to the Xibo CMS.
 */
export const addCommand = createTool({
  id: 'add-command',
  description: 'Adds a new command to the Xibo CMS.',
  inputSchema: z.object({
    command: z.string().describe('The name of the command.'),
    description: z
      .string()
      .optional()
      .describe('A description for the command.'),
    code: z
      .string()
      .describe(
        'A code to identify the command, used in web hooks, etc.'
      ),
    commandString: z
      .string()
      .optional()
      .describe('The command string to be sent to the Player.'),
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
      const authHeaders = await getAuthHeaders();
      const headers = {
        ...authHeaders,
        'Content-Type': 'application/x-www-form-urlencoded',
      };

      const body = new URLSearchParams();
      body.append('command', context.command);
      body.append('code', context.code);
      if (context.description) {
        body.append('description', context.description);
      }
      if (context.commandString) {
        body.append('commandString', context.commandString);
      }

      logger.debug({ url: url.toString(), body: body.toString() }, 'Attempting to add a new command');

      const response = await fetch(url.toString(), {
        method: 'POST',
        headers,
        body,
      });

      const responseData = await response.json();

      if (!response.ok) {
        const message = `Failed to add command. API responded with status ${response.status}.`;
        logger.error(
          { status: response.status, response: responseData },
          message
        );
        return { success: false as const, message, errorData: responseData };
      }

      const validationResult = commandSchema.safeParse(responseData);
      if (!validationResult.success) {
        const message = 'Add command response validation failed.';
        logger.error(
          { error: validationResult.error.flatten(), data: responseData },
          message
        );
        return {
          success: false as const,
          message,
          error: validationResult.error.flatten(),
          errorData: responseData,
        };
      }
      
      logger.info(
        {
          commandId: validationResult.data.commandId,
          commandName: validationResult.data.command,
        },
        `Successfully added command '${validationResult.data.command}' (ID: ${validationResult.data.commandId}).`
      );
      return { success: true as const, data: validationResult.data };

    } catch (error) {
      const message = 'An unexpected error occurred while adding a command.';
      const processedError = processError(error);
      logger.error({ error: processedError }, message);
      return { success: false as const, message, error: processedError };
    }
  },
});

export default addCommand; 