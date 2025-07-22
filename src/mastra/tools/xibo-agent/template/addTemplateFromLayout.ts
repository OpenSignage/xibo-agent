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
 * @module
 * This module provides a tool for creating a new template from an existing layout in the Xibo CMS.
 * It implements the POST /template/layout/{id} endpoint.
 */

import { z } from "zod";
import { createTool } from '@mastra/core/tools';
import { config } from "../config";
import { getAuthHeaders } from "../auth";
import { decodeErrorMessage } from "../utility/error";
import { logger } from '../../../logger';
import { templateSchema } from "./schemas";

/**
 * Tool to add a new template from an existing layout in the CMS.
 */
export const addTemplateFromLayout = createTool({
  id: 'add-template-from-layout',
  description: 'Add a new template from an existing layout in the CMS',
  inputSchema: z.object({
    layoutId: z.number().describe("The ID of the layout to create the template from."),
    name: z.string().describe("The name for the new template."),
    tags: z.string().optional().describe("A comma-separated list of tags to assign to the new template."),
  }),
  outputSchema: z.object({
    success: z.boolean().describe("Indicates whether the operation was successful."),
    message: z.string().optional().describe("A message providing details about the operation outcome."),
    data: templateSchema.optional().describe("The created template object on success."),
    error: z.any().optional().describe("Error details if the operation failed."),
  }),
  execute: async ({ context }) => {
    logger.info({ context }, "Executing addTemplateFromLayout tool.");
    try {
      if (!config.cmsUrl) {
        const message = "CMS URL is not configured.";
        logger.error(message);
        throw new Error(message);
      }
      
      const headers = await getAuthHeaders();
      headers['Content-Type'] = 'application/x-www-form-urlencoded';
      
      const params = new URLSearchParams();
      params.append('name', context.name);
      if (context.tags) {
        params.append('tags', context.tags);
      }

      const url = `${config.cmsUrl}/api/template/layout/${context.layoutId}`;

      logger.debug({ url, body: params.toString() }, "Sending POST request to add template from layout.");
      const response = await fetch(url, {
        method: 'POST',
        headers,
        body: params.toString()
      });

      const data = await response.json();

      if (!response.ok) {
        const errorMessage = decodeErrorMessage(JSON.stringify(data));
        const message = "Failed to add template from layout.";
        logger.error({ status: response.status, error: errorMessage }, message);
        return { success: false, message, error: { status: response.status, message: errorMessage, details: data }};
      }
      
      const validatedData = templateSchema.parse(data);
      logger.info({ templateId: validatedData.layoutId, fromLayoutId: context.layoutId }, "Successfully added template from layout.");

      return { success: true, data: validatedData, message: "Template added successfully from layout." };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "An unknown error occurred.";
      logger.error({ error }, "An unexpected error occurred in addTemplateFromLayout.");
      return { success: false, message: "An unexpected error occurred.", error: { message: errorMessage, details: error } };
    }
  },
}); 