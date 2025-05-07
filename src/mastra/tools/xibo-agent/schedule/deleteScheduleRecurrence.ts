import { z } from "zod";
import { createTool } from '@mastra/core/tools';
import { config } from "../config";
import { getAuthHeaders } from "../auth";

// APIレスポンスのスキーマ
const responseSchema = z.object({
  success: z.boolean(),
  message: z.string()
});

export const deleteScheduleRecurrence = createTool({
  id: 'delete-schedule-recurrence',
  description: 'スケジュールの繰り返しを削除します',
  inputSchema: z.object({
    eventId: z.number().describe('削除するスケジュールのイベントID'),
    deleteAll: z.boolean().optional().describe('すべての繰り返しを削除するかどうか（デフォルト: false）')
  }),

  outputSchema: z.string(),
  execute: async ({ context }) => {
    try {
      console.log("[DEBUG] deleteScheduleRecurrence: 開始");
      console.log("[DEBUG] deleteScheduleRecurrence: config =", config);
      
      if (!config.cmsUrl) {
        console.error("[DEBUG] deleteScheduleRecurrence: CMSのURLが設定されていません");
        throw new Error("CMSのURLが設定されていません");
      }
      console.log(`[DEBUG] deleteScheduleRecurrence: CMS URL = ${config.cmsUrl}`);

      const headers = await getAuthHeaders();
      console.log("[DEBUG] deleteScheduleRecurrence: 認証ヘッダーを取得しました");
      console.log("[DEBUG] deleteScheduleRecurrence: 認証ヘッダー =", headers);

      const { eventId, deleteAll = false } = context;
      console.log(`[DEBUG] deleteScheduleRecurrence: イベントID = ${eventId}, すべて削除 = ${deleteAll}`);

      const response = await fetch(`${config.cmsUrl}/api/schedule/${eventId}/recurrence`, {
        method: 'DELETE',
        headers: {
          ...headers,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ deleteAll })
      });

      console.log(`[DEBUG] deleteScheduleRecurrence: レスポンスステータス = ${response.status}`);
      if (!response.ok) {
        const errorData = await response.json().catch(() => null);
        console.error(`[DEBUG] deleteScheduleRecurrence: HTTPエラーが発生しました: ${response.status}`, errorData);
        throw new Error(`HTTP error! status: ${response.status}${errorData ? `, message: ${JSON.stringify(errorData)}` : ''}`);
      }

      const data = await response.json();
      console.log("[DEBUG] deleteScheduleRecurrence: レスポンスデータを取得しました");
      console.log("[DEBUG] deleteScheduleRecurrence: レスポンスデータの構造:");
      console.log("生データ:", JSON.stringify(data, null, 2));
      console.log("データ型:", typeof data);
      console.log("キー一覧:", Object.keys(data));

      const validatedData = responseSchema.parse(data);
      console.log("[DEBUG] deleteScheduleRecurrence: データの検証が成功しました");

      return JSON.stringify(validatedData, null, 2);
    } catch (error) {
      console.error("[DEBUG] deleteScheduleRecurrence: エラーが発生しました", error);
      return `エラーが発生しました: ${error instanceof Error ? error.message : "不明なエラー"}`;
    }
  },
}); 