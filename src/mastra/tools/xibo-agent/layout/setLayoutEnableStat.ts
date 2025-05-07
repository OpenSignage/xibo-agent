import { z } from "zod";
import { createTool } from '@mastra/core/tools';
import { config } from "../config";
import { getAuthHeaders } from "../auth";

export const setLayoutEnableStat = createTool({
  id: 'set-layout-enable-stat',
  description: 'レイアウトの統計有効化設定を行います',
  inputSchema: z.object({
    layoutId: z.number().describe('統計設定を変更するレイアウトのID'),
    enableStat: z.number().describe('統計を有効にするかどうか（0: 無効、1: 有効）')
  }),
  outputSchema: z.string(),
  execute: async ({ context }) => {
    try {
      if (!config.cmsUrl) {
        throw new Error("CMSのURLが設定されていません");
      }

      const headers = await getAuthHeaders();
      const url = `${config.cmsUrl}/api/layout/setenablestat/${context.layoutId}`;
      console.log(`[DEBUG] setLayoutEnableStat: リクエストURL = ${url}`);

      const formData = new FormData();
      formData.append('enableStat', context.enableStat.toString());

      const response = await fetch(url, {
        method: 'POST',
        headers,
        body: formData
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => null);
        console.error(`[DEBUG] setLayoutEnableStat: HTTPエラーが発生しました: ${response.status}`, errorData);
        throw new Error(`HTTP error! status: ${response.status}${errorData ? `, message: ${JSON.stringify(errorData)}` : ''}`);
      }

      console.log("[DEBUG] setLayoutEnableStat: レイアウトの統計設定が成功しました");
      return "レイアウトの統計設定が正常に更新されました";
    } catch (error) {
      console.error("[DEBUG] setLayoutEnableStat: エラーが発生しました", error);
      return `エラーが発生しました: ${error instanceof Error ? error.message : "不明なエラー"}`;
    }
  },
}); 