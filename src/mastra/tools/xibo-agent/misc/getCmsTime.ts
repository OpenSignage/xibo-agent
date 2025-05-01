import { z } from "zod";
import { createTool } from '@mastra/core/tools';
import { config } from "../config";
import { getAuthHeaders } from "../auth";

export const getCmsTime = createTool({
  id: 'get-cms-time',
  description: 'Xibo CMSの現在時刻を取得します',
  inputSchema: z.object({
    _placeholder: z.string().optional().describe('このツールは入力パラメータを必要としません')
  }),
  outputSchema: z.string(),
  execute: async ({ context }) => {
    try {
      console.log("[DEBUG] getCmsTime: 開始");
      console.log("[DEBUG] getCmsTime: config =", config);
      
      if (!config.cmsUrl) {
        console.error("[DEBUG] getCmsTime: CMSのURLが設定されていません");
        throw new Error("CMSのURLが設定されていません");
      }
      console.log(`[DEBUG] getCmsTime: CMS URL = ${config.cmsUrl}`);

      const headers = await getAuthHeaders();
      console.log("[DEBUG] getCmsTime: 認証ヘッダーを取得しました");

      console.log(`[DEBUG] getCmsTime: APIリクエストを開始します: ${config.cmsUrl}/api/clock`);
      const response = await fetch(`${config.cmsUrl}/api/clock`, {
        headers,
      });

      console.log(`[DEBUG] getCmsTime: レスポンスステータス = ${response.status}`);
      if (!response.ok) {
        console.error(`[DEBUG] getCmsTime: HTTPエラーが発生しました: ${response.status}`);
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const data = await response.json();
      console.log("[DEBUG] getCmsTime: レスポンスデータを取得しました");
      console.log(`[DEBUG] getCmsTime: レスポンスデータ = ${JSON.stringify(data)}`);
      
      return JSON.stringify(data);
    } catch (error: unknown) {
      console.error("[DEBUG] getCmsTime: エラーが発生しました", error);
      if (error instanceof Error) {
        return `エラーが発生しました: ${error.message}`;
      }
      return "不明なエラーが発生しました";
    }
  },
});
