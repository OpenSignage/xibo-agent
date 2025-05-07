import { z } from "zod";
import { createTool } from '@mastra/core/tools';
import { config } from "../config";
import { getAuthHeaders } from "../auth";

// APIレスポンスのスキーマ
const responseSchema = z.object({
  success: z.boolean(),
  message: z.string()
});

export const deleteNotification = createTool({
  id: 'delete-notification',
  description: '通知を削除します',
  inputSchema: z.object({
    notificationId: z.number().describe('削除する通知のID')
  }),

  outputSchema: z.string(),
  execute: async ({ context }) => {
    try {
      console.log("[DEBUG] deleteNotification: 開始");
      console.log("[DEBUG] deleteNotification: config =", config);
      
      if (!config.cmsUrl) {
        console.error("[DEBUG] deleteNotification: CMSのURLが設定されていません");
        throw new Error("CMSのURLが設定されていません");
      }
      console.log(`[DEBUG] deleteNotification: CMS URL = ${config.cmsUrl}`);

      const headers = await getAuthHeaders();
      console.log("[DEBUG] deleteNotification: 認証ヘッダーを取得しました");
      console.log("[DEBUG] deleteNotification: 認証ヘッダー =", headers);

      console.log("[DEBUG] deleteNotification: 通知ID =", context.notificationId);

      const response = await fetch(`${config.cmsUrl}/api/notification/${context.notificationId}`, {
        method: 'DELETE',
        headers
      });

      console.log(`[DEBUG] deleteNotification: レスポンスステータス = ${response.status}`);
      if (!response.ok) {
        const errorData = await response.json().catch(() => null);
        console.error(`[DEBUG] deleteNotification: HTTPエラーが発生しました: ${response.status}`, errorData);
        throw new Error(`HTTP error! status: ${response.status}${errorData ? `, message: ${JSON.stringify(errorData)}` : ''}`);
      }

      const data = await response.json();
      console.log("[DEBUG] deleteNotification: レスポンスデータを取得しました");
      console.log("[DEBUG] deleteNotification: レスポンスデータの構造:");
      console.log("生データ:", JSON.stringify(data, null, 2));
      console.log("データ型:", typeof data);
      console.log("キー一覧:", Object.keys(data));

      const validatedData = responseSchema.parse(data);
      console.log("[DEBUG] deleteNotification: データの検証が成功しました");

      return JSON.stringify(validatedData, null, 2);
    } catch (error) {
      console.error("[DEBUG] deleteNotification: エラーが発生しました", error);
      return `エラーが発生しました: ${error instanceof Error ? error.message : "不明なエラー"}`;
    }
  },
}); 