import { z } from "zod";
import { createTool } from '@mastra/core/tools';
import { config } from "../config";
import { getAuthHeaders } from "../auth";

export const setLayoutBackground = createTool({
  id: 'set-layout-background',
  description: 'レイアウトの背景画像を設定します',
  inputSchema: z.object({
    layoutId: z.number().describe('背景画像を設定するレイアウトのID'),
    backgroundImageId: z.number().describe('設定する背景画像のID')
  }),
  outputSchema: z.string(),
  execute: async ({ context }) => {
    try {
      if (!config.cmsUrl) {
        throw new Error("CMSのURLが設定されていません");
      }

      const headers = await getAuthHeaders();
      const url = `${config.cmsUrl}/api/layout/background/${context.layoutId}`;
      console.log(`[DEBUG] setLayoutBackground: リクエストURL = ${url}`);

      const formData = new FormData();
      formData.append('backgroundImageId', context.backgroundImageId.toString());

      const response = await fetch(url, {
        method: 'POST',
        headers,
        body: formData
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => null);
        console.error(`[DEBUG] setLayoutBackground: HTTPエラーが発生しました: ${response.status}`, errorData);
        throw new Error(`HTTP error! status: ${response.status}${errorData ? `, message: ${JSON.stringify(errorData)}` : ''}`);
      }

      console.log("[DEBUG] setLayoutBackground: レイアウトの背景画像設定が成功しました");
      return "レイアウトの背景画像が正常に設定されました";
    } catch (error) {
      console.error("[DEBUG] setLayoutBackground: エラーが発生しました", error);
      return `エラーが発生しました: ${error instanceof Error ? error.message : "不明なエラー"}`;
    }
  },
}); 