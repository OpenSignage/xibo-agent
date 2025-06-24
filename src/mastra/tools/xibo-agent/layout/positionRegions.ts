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

import { z } from "zod";
import { createTool } from '@mastra/core/tools';
import { config } from "../config";
import { getAuthHeaders } from "../auth";
import { decodeErrorMessage } from "../utility/error";
import { logger } from "../../../index";

/**
 * Defines the schema for a successful response.
 */
const successSchema = z.object({
  success: z.literal(true),
  message: z.string(),
});

/**
 * Defines the schema for a failed operation.
 */
const errorSchema = z.object({
  success: z.literal(false),
  message: z.string().describe("A human-readable error message."),
  error: z
    .any()
    .optional()
    .describe("Optional technical details about the error."),
});

/**
 * Schema for region position data
 * Defines the position and size of a region within a layout
 */
const regionPositionSchema = z.object({
  regionId: z.number(),
  top: z.number(),
  left: z.number(),
  width: z.number(),
  height: z.number()
});

/**
 * Tool to position all regions within a layout
 * Implements the region/position/all endpoint from Xibo API
 * Allows for batch positioning of multiple regions at once
 */
export const positionRegions = createTool({
  id: 'position-regions',
  description: 'Set the position of all regions in a layout',
  inputSchema: z.object({
    layoutId: z.number().describe('ID of the layout to position regions for'),
    regions: z.array(regionPositionSchema).describe('Array of region position information')
  }),
  outputSchema: z.union([successSchema, errorSchema]),
  execute: async ({ context }): Promise<z.infer<typeof successSchema> | z.infer<typeof errorSchema>> => {
    if (!config.cmsUrl) {
      const errorMessage = "CMS URL is not configured";
      logger.error(`positionRegions: ${errorMessage}`);
      return { success: false, message: errorMessage };
    }

    const headers = await getAuthHeaders();
    // Remove 'Content-Type' so that fetch can set it with the correct boundary for FormData
    delete headers["Content-Type"];
    
    const url = `${config.cmsUrl}/api/region/position/all/${context.layoutId}`;
    logger.info(
      `Setting positions for regions in layout ${context.layoutId}`
    );

    const formData = new FormData();
    context.regions.forEach((region) => {
      formData.append("regions[]", JSON.stringify(region));
    });

    const response = await fetch(url, {
      method: "POST", // This endpoint uses POST, not PUT
      headers,
      body: formData,
    });

    if (response.status === 204) {
      logger.info(
        `Region positions set successfully for layout ${context.layoutId}`
      );
      return { success: true, message: "Region positions set successfully" };
    }

    if (!response.ok) {
      const responseText = await response.text();
      const decodedText = decodeErrorMessage(responseText);
      const errorMessage = `Failed to set region positions. API responded with status ${response.status}.`;
      logger.error(errorMessage, {
        status: response.status,
        layoutId: context.layoutId,
        response: decodedText,
      });

      return {
        success: false,
        message: `${errorMessage} Message: ${decodedText}`,
        error: {
          statusCode: response.status,
          responseBody: decodedText,
        },
      };
    }
    
    // In case of a 200 OK with a body, which is not the primary success case (204)
    logger.info(`Region positions set successfully for layout ${context.layoutId} with status ${response.status}`);
    return { success: true, message: "Region positions set successfully" };
  },
}); 