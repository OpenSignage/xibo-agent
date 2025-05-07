import { z } from "zod";
import { createTool } from "@mastra/core/tools";
import { config } from "../config";
import { getAuthHeaders } from "../utils/auth";

const extendSchema = z.object({
  templateId: z.string(),
  type: z.string(),
});

const stencilSchema = z.object({
  type: z.string(),
  data: z.any(),
});

const propertySchema = z.object({
  id: z.string(),
  type: z.string(),
  title: z.string().nullable(),
  helpText: z.string().nullable(),
  options: z.array(z.any()).optional(),
});

const propertyGroupSchema = z.object({
  id: z.string(),
  title: z.string(),
  properties: z.array(propertySchema),
});

const moduleTemplateSchema = z.object({
  templateId: z.string(),
  type: z.string(),
  extends: extendSchema.optional(),
  dataType: z.string(),
  title: z.string(),
  description: z.string().nullable(),
  icon: z.string().nullable(),
  thumbnail: z.string().nullable(),
  showIn: z.string().nullable(),
  properties: z.array(propertySchema),
  isVisible: z.boolean(),
  isEnabled: z.boolean(),
  propertyGroups: z.array(propertyGroupSchema).optional(),
  stencil: stencilSchema.optional(),
  assets: z.array(z.any()).optional(),
  groupsWithPermissions: z.string().nullable(),
});

const apiResponseSchema = z.object({
  success: z.boolean(),
  data: z.array(moduleTemplateSchema),
});

export const getModuleTemplates = createTool({
  id: "get-module-templates",
  description: "モジュールテンプレートを検索",
  inputSchema: z.object({
    dataType: z.string(),
    type: z.string().optional(),
  }),
  outputSchema: apiResponseSchema,
  execute: async ({ context }) => {
    if (!config.cmsUrl) {
      throw new Error("CMS URL is not set");
    }

    const url = new URL(`${config.cmsUrl}/module/templates/${context.dataType}`);
    if (context.type) {
      url.searchParams.append("type", context.type);
    }
    
    console.log(`Requesting URL: ${url.toString()}`);

    const response = await fetch(url.toString(), {
      method: "GET",
      headers: await getAuthHeaders(),
    });

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    const rawData = await response.json();
    const validatedData = apiResponseSchema.parse(rawData);
    console.log("Module templates retrieved successfully");
    return validatedData;
  },
});

export default getModuleTemplates; 