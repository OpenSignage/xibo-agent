import { z } from "zod";
import { createTool } from '@mastra/core/tools';
import { config } from "../config";
import { getAuthHeaders } from "../auth";

// APIレスポンスのスキーマ
const responseSchema = z.object({
  success: z.boolean(),
  message: z.string()
});

export const deleteSchedule = createTool({
  id: 'delete-schedule',
  description: 'スケジュールを削除します',
  inputSchema: z.object({
    eventId: z.number().describe('削除するスケジュールのイベントID')
  }),

  outputSchema: z.string(),
  execute: async ({ context }) => {
    try {
      console.log("[DEBUG] deleteSchedule: 開始");
      console.log("[DEBUG] deleteSchedule: config =", config);
      
      if (!config.cmsUrl) {
        console.error("[DEBUG] deleteSchedule: CMSのURLが設定されていません");
        throw new Error("CMSのURLが設定されていません");
      }
      console.log(`[DEBUG] deleteSchedule: CMS URL = ${config.cmsUrl}`);

      const headers = await getAuthHeaders();
      console.log("[DEBUG] deleteSchedule: 認証ヘッダーを取得しました");
      console.log("[DEBUG] deleteSchedule: 認証ヘッダー =", headers);

      const { eventId } = context;
      console.log(`[DEBUG] deleteSchedule: イベントID = ${eventId}`);

      const response = await fetch(`${config.cmsUrl}/api/schedule/${eventId}`, {
        method: 'DELETE',
        headers
      });

      console.log(`[DEBUG] deleteSchedule: レスポンスステータス = ${response.status}`);
      if (!response.ok) {
        const errorData = await response.json().catch(() => null);
        console.error(`[DEBUG] deleteSchedule: HTTPエラーが発生しました: ${response.status}`, errorData);
        throw new Error(`HTTP error! status: ${response.status}${errorData ? `, message: ${JSON.stringify(errorData)}` : ''}`);
      }

      const data = await response.json();
      console.log("[DEBUG] deleteSchedule: レスポンスデータを取得しました");
      console.log("[DEBUG] deleteSchedule: レスポンスデータの構造:");
      console.log("生データ:", JSON.stringify(data, null, 2));
      console.log("データ型:", typeof data);
      console.log("キー一覧:", Object.keys(data));

      const validatedData = responseSchema.parse(data);
      console.log("[DEBUG] deleteSchedule: データの検証が成功しました");

      return JSON.stringify(validatedData, null, 2);
    } catch (error) {
      console.error("[DEBUG] deleteSchedule: エラーが発生しました", error);
      return `エラーが発生しました: ${error instanceof Error ? error.message : "不明なエラー"}`;
    }
  },
}); 