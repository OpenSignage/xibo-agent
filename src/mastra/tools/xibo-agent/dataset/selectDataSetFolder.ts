import { z } from "zod";
import { createTool } from "@mastra/core/tools";
import { config } from "../config";
import { getAuthHeaders } from "../utils/auth";

const dataSetSchema = z.object({
  dataSetId: z.number(),
  dataSet: z.string(),
  description: z.string().optional(),
  code: z.string().optional(),
  isRemote: z.number(),
  method: z.string().optional(),
  uri: z.string().optional(),
  postData: z.string().optional(),
  authentication: z.string().optional(),
  username: z.string().optional(),
  password: z.string().optional(),
  customHeaders: z.string().optional(),
  userAgent: z.string().optional(),
  refreshRate: z.number().optional(),
  clearRate: z.number().optional(),
  runsAfter: z.number().optional(),
  dataRoot: z.string().optional(),
  summarize: z.string().optional(),
  summarizeField: z.string().optional(),
  sourceId: z.number().optional(),
  ignoreFirstRow: z.number().optional(),
  rowLimit: z.number().optional(),
  limitPolicy: z.string().optional(),
  csvSeparator: z.string().optional(),
  folderId: z.number().optional(),
  permissionsFolderId: z.number().optional(),
});

const apiResponseSchema = z.object({
  success: z.boolean(),
  data: dataSetSchema,
});

export const selectDataSetFolder = createTool({
  id: "select-data-set-folder",
  description: "データセットのフォルダを選択",
  inputSchema: z.object({
    menuId: z.number(),
    folderId: z.number(),
  }),
  outputSchema: apiResponseSchema,
  execute: async ({ context }) => {
    if (!config.cmsUrl) {
      throw new Error("CMS URL is not set");
    }

    const url = new URL(`${config.cmsUrl}/dataset/${context.menuId}/selectfolder`);
    const formData = new FormData();
    formData.append("folderId", context.folderId.toString());

    console.log(`Requesting URL: ${url.toString()}`);

    const response = await fetch(url.toString(), {
      method: "PUT",
      headers: await getAuthHeaders(),
      body: formData,
    });

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    const rawData = await response.json();
    const validatedData = apiResponseSchema.parse(rawData);
    console.log("Data set folder selected successfully");
    return validatedData;
  },
});

export default selectDataSetFolder; 