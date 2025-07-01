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
 * @module edit-widget-audio
 * @description This module provides a tool to edit a widget's audio.
 */
import { z } from "zod";
import { createTool } from '@mastra/core/tools';
import { config } from "../config";
import { getAuthHeaders } from "../auth";
import { logger } from "../../../index";

const audioSchema = z.object({
    widgetId: z.number(),
    mediaId: z.number(),
    volume: z.number(),
    loop: z.number(),
});

export const editWidgetAudio = createTool({
  id: 'edit-widget-audio',
  description: "Edits a widget's audio.",
  inputSchema: z.object({
    widgetId: z.number().describe("The ID of the widget to edit the audio for."),
    mediaId: z.number().optional().describe('The ID of the audio file in the CMS library.'),
    volume: z.number().min(0).max(100).optional().describe('The volume (0-100).'),
    loop: z.number().min(0).max(1).optional().describe('The loop flag (0: no loop, 1: loop).')
  }),
  outputSchema: z.object({
    success: z.boolean(),
    data: audioSchema.optional(),
    message: z.string().optional(),
    errorData: z.any().optional(),
  }),
  execute: async ({ context }) => {
    try {
      if (!config.cmsUrl) {
        logger.error("editWidgetAudio: CMS URL is not configured");
        return { success: false, message: "CMS URL is not configured" };
      }

      const headers = await getAuthHeaders();
      const url = `${config.cmsUrl}/api/playlist/widget/audio/${context.widgetId}`;
      logger.debug(`editWidgetAudio: Request URL = ${url}`);

      const formData = new FormData();
      if (context.mediaId !== undefined) formData.append('mediaId', context.mediaId.toString());
      if (context.volume !== undefined) formData.append('volume', context.volume.toString());
      if (context.loop !== undefined) formData.append('loop', context.loop.toString());

      const response = await fetch(url, {
        method: 'PUT',
        headers,
        body: formData
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => response.text());
        logger.error(`editWidgetAudio: HTTP error occurred: ${response.status}`, {
            status: response.status,
            error: errorData,
        });
        return {
            success: false,
            message: `HTTP error! status: ${response.status}`,
            errorData,
        };
      }

      const data = await response.json();
      const validatedData = audioSchema.parse(data);
      
      logger.info(`editWidgetAudio: Widget ${context.widgetId} audio edited successfully.`);
      return { success: true, data: validatedData };
    } catch (error) {
      if (error instanceof z.ZodError) {
        logger.error("editWidgetAudio: Validation error", { error: error.issues });
        return { success: false, message: "Validation error occurred", errorData: error.issues };
      }
      const errorMessage = error instanceof Error ? error.message : "An unknown error occurred";
      logger.error("editWidgetAudio: An unexpected error occurred", { error: errorMessage });
      return { success: false, message: errorMessage };
    }
  },
}); 