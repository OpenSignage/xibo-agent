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
import { createTool } from "@mastra/core/tools";
import { config } from "../config";
import { getAuthHeaders } from "../auth";

// Define output schema for display group response
const tagSchema = z.object({
  tag: z.string(),
  tagId: z.number(),
  value: z.string()
});

const displayGroupSchema = z.object({
  displayGroupId: z.number(),
  displayGroup: z.string(),
  description: z.string().nullable(),
  isDisplaySpecific: z.number(),
  isDynamic: z.number(),
  dynamicCriteria: z.string().nullable(),
  dynamicCriteriaLogicalOperator: z.string().nullable(),
  dynamicCriteriaTags: z.string().nullable(),
  dynamicCriteriaExactTags: z.number(),
  dynamicCriteriaTagsLogicalOperator: z.string().nullable(),
  userId: z.number(),
  tags: z.array(tagSchema),
  bandwidthLimit: z.number(),
  groupsWithPermissions: z.string().nullable(),
  createdDt: z.string(),
  modifiedDt: z.string(),
  folderId: z.number(),
  permissionsFolderId: z.number(),
  ref1: z.string().nullable(),
  ref2: z.string().nullable(),
  ref3: z.string().nullable(),
  ref4: z.string().nullable(),
  ref5: z.string().nullable()
});

export const getDisplayGroups = createTool({
  id: "get-display-groups",
  description: "Search for display groups in the CMS",
  inputSchema: z.object({
    displayGroupId: z.number().optional().describe("ID of the display group to retrieve"),
    displayGroup: z.string().optional().describe("Name of the display group to search for"),
    displayId: z.number().optional().describe("ID of the display to find associated groups"),
    nestedDisplayId: z.number().optional().describe("ID of the nested display to find associated groups"),
    dynamicCriteria: z.string().optional().describe("Dynamic criteria for filtering display groups"),
  }),
  outputSchema: z.object({
    success: z.boolean(),
    message: z.string().optional(),
    data: z.array(displayGroupSchema).optional()
  }),
  execute: async ({ context }) => {
    if (!config.cmsUrl) {
      throw new Error("CMS URL is not set");
    }

    const url = new URL(`${config.cmsUrl}/api/displaygroup`);
    if (context.displayGroupId) url.searchParams.append("displayGroupId", context.displayGroupId.toString());
    if (context.displayGroup) url.searchParams.append("displayGroup", context.displayGroup);
    if (context.displayId) url.searchParams.append("displayId", context.displayId.toString());
    if (context.nestedDisplayId) url.searchParams.append("nestedDisplayId", context.nestedDisplayId.toString());
    if (context.dynamicCriteria) url.searchParams.append("dynamicCriteria", context.dynamicCriteria);

    console.log(`Requesting URL: ${url.toString()}`);

    const response = await fetch(url.toString(), {
      method: "GET",
      headers: await getAuthHeaders(),
    });

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    const data = await response.json();
    console.log("Display groups retrieved successfully");

    // Validate response data against schema
    try {
      const validatedData = z.array(displayGroupSchema).parse(data);
      
      // Check if data is empty
      if (validatedData.length === 0) {
        const searchCriteria = [];
        if (context.displayGroupId) searchCriteria.push(`ID: ${context.displayGroupId}`);
        if (context.displayGroup) searchCriteria.push(`Name: ${context.displayGroup}`);
        if (context.displayId) searchCriteria.push(`Display ID: ${context.displayId}`);
        if (context.nestedDisplayId) searchCriteria.push(`Nested Display ID: ${context.nestedDisplayId}`);
        if (context.dynamicCriteria) searchCriteria.push(`Dynamic Criteria: ${context.dynamicCriteria}`);

        const criteriaMessage = searchCriteria.length > 0 
          ? ` with criteria: ${searchCriteria.join(', ')}`
          : '';

        console.log(`No display groups found${criteriaMessage}`);
        return {
          success: false,
          message: `No display groups found${criteriaMessage}`
        };
      }

      return {
        success: true,
        data: validatedData
      };
    } catch (error) {
      console.error("Response validation failed:", error);
      return {
        success: false,
        message: "Invalid response format from CMS API"
      };
    }
  },
}); 