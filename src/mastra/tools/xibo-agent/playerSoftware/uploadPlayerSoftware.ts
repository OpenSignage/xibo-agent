import { z } from "zod";
import { createTool } from "@mastra/core/tools";
import { config } from "../config";
import { getAuthHeaders } from "../auth";

const apiResponseSchema = z.object({
  success: z.boolean(),
  data: z.object({
    versionId: z.number(),
    type: z.string(),
    version: z.string(),
    code: z.number(),
    playerShowVersion: z.string(),
    createdAt: z.string(),
    modifiedAt: z.string(),
    modifiedBy: z.string(),
    fileName: z.string(),
    size: z.number(),
    md5: z.string(),
  }),
});

export const uploadPlayerSoftware = createTool({
  id: "upload-player-software",
  description: "プレイヤーソフトウェアをアップロード",
  inputSchema: z.object({
    file: z.instanceof(File),
  }),
  outputSchema: apiResponseSchema,
  execute: async ({ context }) => {
    if (!config.cmsUrl) {
      throw new Error("CMS URL is not set");
    }

    const url = new URL(`${config.cmsUrl}/playersoftware`);
    
    // フォームデータの作成
    const formData = new FormData();
    formData.append("files", context.file);

    console.log(`Requesting URL: ${url.toString()}`);

    const response = await fetch(url.toString(), {
      method: "POST",
      headers: await getAuthHeaders(),
      body: formData,
    });

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    const rawData = await response.json();
    const validatedData = apiResponseSchema.parse(rawData);
    console.log("Player software uploaded successfully");
    return validatedData;
  },
});

export default uploadPlayerSoftware; 