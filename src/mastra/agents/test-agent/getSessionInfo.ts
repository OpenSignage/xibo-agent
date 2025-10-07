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
 * Get Session Tool
 * 
 * This tool demonstrates how to access runtime context safely and
 * logs available session-related information if present.
 */

import { createTool } from "@mastra/core";
import { z } from "zod";
import { logger } from "../../logger";
import { extractContextIds } from "./contextUtils";

// Define output schemas
const successSchema = z.object({
  success: z.literal(true),
  runtimeKeys: z.array(z.string()),
  threadId: z.string().optional(),
  resourceId: z.string().optional(),
  userId: z.string().optional(),
  preview: z.any().optional(),
});

const errorSchema = z.object({
  success: z.literal(false),
  message: z.string(),
});

export const getSessionInfo = createTool({
  id: "get-session-info",
  description: "Return what is available in runtimeContext (sanitized)",
  inputSchema: z.object({
    threadId: z.string().optional(),
    resourceId: z.string().optional(),
  }).passthrough(),
  outputSchema: z.union([successSchema, errorSchema]),
  execute: async ({ context, runtimeContext }) => {
    try {
      const rt = (runtimeContext as any) || {};
      const session = rt?.session || {};
      const userId = session?.user?.id;
      const { threadId, resourceId } = extractContextIds({ runtimeContext, context });

      const runtimeKeys = Object.keys(rt);

      // Build a small, sanitized preview to avoid huge payloads
      const preview = {
        session: {
          user: userId ? { id: String(userId) } : undefined,
          thread: threadId ? { id: String(threadId) } : undefined,
          resource: resourceId ? { id: String(resourceId) } : undefined,
        },
        hasRequest: Boolean(rt.request),
        hasResponse: Boolean(rt.response),
        headerKeys: Object.keys((rt?.request?.headers || {}) as Record<string, any>),
      };

      if (resourceId || threadId || userId) {
        logger.info({ resourceId, threadId, userId }, "Session information available");
      } else {
        logger.info("Session information not available in runtimeContext");
      }

      return { success: true, runtimeKeys, threadId, resourceId, userId, preview } as z.infer<typeof successSchema>;
    } catch (error) {
      logger.error({ error }, "Failed to read session information");
      return { success: false, message: "Failed to get session information" } as z.infer<typeof errorSchema>;
    }
  },
});