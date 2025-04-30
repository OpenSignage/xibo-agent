import { z } from "zod";
import { DynamicStructuredTool } from "@langchain/core/tools";
import { config } from "../config";
import { getAuthHeaders } from "../auth";

const aboutResponseSchema = z.object({
  version: z.string(),
  apiVersion: z.string(),
  serverTime: z.string(),
  serverTimeZone: z.string(),
});

export const getAbout = new DynamicStructuredTool({
  name: "getAbout",
  description: "Xibo APIのバージョン情報などの詳細を取得します。",
  schema: z.object({}),
  func: async () => {
    try {
      const headers = await getAuthHeaders();
      const response = await fetch(`${config.cmsUrl}/api/about`, {
        headers,
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const data = await response.json();
      const validatedData = aboutResponseSchema.parse(data);

      return JSON.stringify(validatedData, null, 2);
    } catch (error) {
      return `エラーが発生しました: ${error instanceof Error ? error.message : "不明なエラー"}`;
    }
  },
});
