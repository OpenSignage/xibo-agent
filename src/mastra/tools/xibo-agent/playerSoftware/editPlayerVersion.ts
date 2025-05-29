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

export const editPlayerVersion = createTool({
  id: "edit-player-version",
  description: "プレイヤーバージョンを編集",
  inputSchema: z.object({
    versionId: z.number(),
    playerShowVersion: z.string().optional(),
    version: z.string().optional(),
    code: z.number().optional(),
  }),
  outputSchema: apiResponseSchema,
  execute: async ({ context }) => {
    if (!config.cmsUrl) {
      throw new Error("CMS URL is not set");
    }

    const url = new URL(`${config.cmsUrl}/playersoftware/${context.versionId}`);
    
    // フォームデータの作成
    const formData = new FormData();
    if (context.playerShowVersion) formData.append("playerShowVersion", context.playerShowVersion);
    if (context.version) formData.append("version", context.version);
    if (context.code) formData.append("code", context.code.toString());

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
    console.log("Player version edited successfully");
    return validatedData;
  },
});

export default editPlayerVersion; 