import { z } from "zod";
import { createTool } from '@mastra/core/tools';
import { config } from "../config";
import { getAuthHeaders } from "../auth";

const notificationSchema = z.object({
  notificationId: z.number(),
  subject: z.string(),
  body: z.string(),
  createdDt: z.string(),
  releaseDt: z.string(),
  isEmail: z.number(),
  isInterrupt: z.number(),
  isSystem: z.number(),
  userId: z.number(),
  displayGroupIds: z.array(z.number()),
  displayGroupNames: z.array(z.string()),
  read: z.number(),
  readDt: z.string().nullable(),
  readBy: z.string().nullable()
});

// APIレスポンスのスキーマ
const responseSchema = notificationSchema;

export const postNotification = createTool({
  id: 'post-notification',
  description: '新しい通知を作成します',
  inputSchema: z.object({
    subject: z.string().describe('通知の件名'),
    body: z.string().optional().describe('通知の本文'),
    releaseDt: z.string().optional().describe('通知の公開日時（ISO 8601形式）'),
    isInterrupt: z.number().describe('ウェブポータルのナビゲーション/ログインを中断するかどうかのフラグ（0-1）'),
    displayGroupIds: z.array(z.number()).describe('通知を割り当てる表示グループIDの配列'),
    userGroupIds: z.array(z.number()).describe('通知を割り当てるユーザーグループIDの配列')
  }),

  outputSchema: z.string(),
  execute: async ({ context }) => {
    try {
      console.log("[DEBUG] postNotification: 開始");
      console.log("[DEBUG] postNotification: config =", config);
      
      if (!config.cmsUrl) {
        console.error("[DEBUG] postNotification: CMSのURLが設定されていません");
        throw new Error("CMSのURLが設定されていません");
      }
      console.log(`[DEBUG] postNotification: CMS URL = ${config.cmsUrl}`);

      const headers = await getAuthHeaders();
      console.log("[DEBUG] postNotification: 認証ヘッダーを取得しました");
      console.log("[DEBUG] postNotification: 認証ヘッダー =", headers);

      console.log("[DEBUG] postNotification: 通知データ =", context);

      // 日付文字列をISO 8601形式に変換
      const requestBody = {
        ...context,
        releaseDt: context.releaseDt ? new Date(context.releaseDt).toISOString() : undefined
      };

      console.log("[DEBUG] postNotification: リクエストボディ =", requestBody);

      const response = await fetch(`${config.cmsUrl}/api/notification`, {
        method: 'POST',
        headers: {
          ...headers,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(requestBody)
      });

      console.log(`[DEBUG] postNotification: レスポンスステータス = ${response.status}`);
      if (!response.ok) {
        const errorData = await response.json().catch(() => null);
        console.error(`[DEBUG] postNotification: HTTPエラーが発生しました: ${response.status}`, errorData);
        throw new Error(`HTTP error! status: ${response.status}${errorData ? `, message: ${JSON.stringify(errorData)}` : ''}`);
      }

      const data = await response.json();
      console.log("[DEBUG] postNotification: レスポンスデータを取得しました");
      console.log("[DEBUG] postNotification: レスポンスデータの構造:");
      console.log("生データ:", JSON.stringify(data, null, 2));
      console.log("データ型:", typeof data);
      console.log("キー一覧:", Object.keys(data));

      const validatedData = responseSchema.parse(data);
      console.log("[DEBUG] postNotification: データの検証が成功しました");

      return JSON.stringify(validatedData, null, 2);
    } catch (error) {
      console.error("[DEBUG] postNotification: エラーが発生しました", error);
      return `エラーが発生しました: ${error instanceof Error ? error.message : "不明なエラー"}`;
    }
  },
}); 