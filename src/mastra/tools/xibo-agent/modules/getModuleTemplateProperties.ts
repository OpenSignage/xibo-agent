import { z } from "zod";
import { createTool } from "@mastra/core/tools";
import { config } from "../config";
import { getAuthHeaders } from "../auth";

const propertySchema = z.object({
  id: z.string(),
  type: z.string(),
  title: z.string().nullable(),
  helpText: z.string().nullable(),
  options: z.array(z.any()).optional(),
});

const apiResponseSchema = z.object({
  success: z.boolean(),
  data: z.record(z.string(), z.object({
    id: z.string(),
    type: z.string(),
    title: z.string().nullable(),
    helpText: z.string().nullable(),
    options: z.array(z.any()).optional(),
  })),
});

export const getModuleTemplateProperties = createTool({
  id: "get-module-template-properties",
  description: "モジュールテンプレートのプロパティを取得",
  inputSchema: z.object({
    dataType: z.string(),
    templateId: z.string(),
  }),
  outputSchema: apiResponseSchema,
  execute: async ({ context }) => {
    if (!config.cmsUrl) {
      throw new Error("CMS URL is not set");
    }

    const url = new URL(`${config.cmsUrl}/module/template/${context.dataType}/properties/${context.templateId}`);
    
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
    console.log("Module template properties retrieved successfully");
    return validatedData;
  },
});

export default getModuleTemplateProperties; 