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
 * @module getUserPermissions
 * @description This module provides a tool to retrieve the permissions
 * for a specific entity (like a user or display group) from the Xibo CMS.
 * It calls the appropriate API endpoint and validates the response structure.
 */

import { z } from "zod";
import { createTool } from "@mastra/core/tools";
import { LogLevel } from "@mastra/core";
import { config } from "../config";
import { getAuthHeaders } from "../auth";
import { logger } from "../../../index";

/**
 * Defines the schema for a single permission entry returned by the Xibo API.
 * This ensures that the received permission data conforms to the expected structure.
 */
const permissionSchema = z.object({
  permissionId: z.number().describe("The ID of the permission record."),
  entityId: z
    .number()
    .describe("The ID of the entity associated with the permission."),
  groupId: z.number().describe("The ID of the group."),
  objectId: z.number().describe("The ID of the object the permission applies to."),
  isUser: z
    .number()
    .describe("Flag indicating if the permission is for a user (1) or group (0)."),
  entity: z.string().describe("The name of the entity (e.g., 'layout', 'campaign')."),
  objectIdString: z.string().describe("The string representation of the object ID."),
  group: z.string().describe("The name of the group."),
  view: z.number().describe("View permission flag (0 or 1)."),
  edit: z.number().describe("Edit permission flag (0 or 1)."),
  delete: z.number().describe("Delete permission flag (0 or 1)."),
  modifyPermissions: z
    .number()
    .describe("Permission to modify permissions flag (0 or 1)."),
});

/**
 * A tool designed to get user permissions for a specific entity from the Xibo CMS.
 * It takes an entity type and an object ID as input and returns a list of permission objects.
 */
export const getUserPermissions = createTool({
  id: "get-user-permissions",
  description: "Get user permissions for a specific entity.",
  inputSchema: z.object({
    entity: z
      .string()
      .describe("The type of entity (e.g., 'user', 'displaygroup')."),
    objectId: z.number().describe("The ID of the object."),
  }),
  outputSchema: z
    .array(permissionSchema)
    .describe("An array of permission objects."),

  execute: async ({ context }) => {
    // Ensure the CMS URL is configured before proceeding.
    if (!config.cmsUrl) {
      const errorMessage = "CMS URL is not configured.";
      logger.error(errorMessage);
      throw new Error(errorMessage);
    }

    // Construct the request URL for the user permissions API endpoint.
    const url = new URL(
      `${config.cmsUrl}/api/user/permissions/${context.entity}/${context.objectId}`,
    );

    logger.info(`Requesting user permissions from: ${url.toString()}`);

    try {
      // Perform the GET request to the Xibo CMS API.
      const response = await fetch(url.toString(), {
        method: "GET",
        headers: await getAuthHeaders(),
      });
      console.log(response);
      // Handle non-successful HTTP responses.
      if (!response.ok) {
        const errorText = await response.text();
        const errorMessage = `Failed to get user permissions: ${response.status} ${response.statusText} - ${errorText}`;
        logger.error(errorMessage);
        throw new Error(
          `HTTP error! status: ${response.status}, message: ${errorText}`,
        );
      }

      // Parse the JSON response from the API.
      const rawData = await response.json();
      // Validate the received data against the permission schema.
      const permissions = z.array(permissionSchema).parse(rawData);

      const successMessage = "Successfully retrieved user permissions.";
      logger.info(successMessage, { permissions });

      return permissions;
    } catch (error: any) {
      // Handle Zod validation errors specifically.
      if (error instanceof z.ZodError) {
        const errorMessage = "Zod validation error getting user permissions.";
        logger.error(errorMessage, error.issues);
        throw new Error(errorMessage, { cause: error });
      }

      // Re-throw known errors to be handled by the caller.
      if (error instanceof Error) {
        throw error;
      }

      // Catch any other unexpected errors.
      const errorMessage =
        "An unexpected error occurred while getting user permissions.";
      logger.error(errorMessage, error);
      throw new Error(errorMessage);
    }
  },
});

export default getUserPermissions; 