import { z } from "zod";
import { createTool } from '@mastra/core/tools';
import { config } from "../config";
import { getAuthHeaders } from "../auth";

// レスポンススキーマはgetLayouts.tsと同じものを使用
const layoutResponseSchema = z.object({
  layoutId: z.union([z.number(), z.string().transform(Number)]),
  ownerId: z.union([z.number(), z.string().transform(Number)]),
  campaignId: z.union([z.number(), z.string().transform(Number)]),
  parentId: z.union([z.number(), z.string().transform(Number)]).nullable(),
  publishedStatusId: z.union([z.number(), z.string().transform(Number)]),
  publishedStatus: z.string().nullable(),
  publishedDate: z.string().nullable(),
  backgroundImageId: z.union([z.number(), z.string().transform(Number)]).nullable(),
  schemaVersion: z.union([z.number(), z.string().transform(Number)]),
  layout: z.string().nullable(),
  description: z.string().nullable(),
  backgroundColor: z.string().nullable(),
  createdDt: z.string().nullable(),
  modifiedDt: z.string().nullable(),
  status: z.union([z.number(), z.string().transform(Number)]),
  retired: z.union([z.number(), z.string().transform(Number)]),
  backgroundzIndex: z.union([z.number(), z.string().transform(Number)]),
  width: z.union([z.number(), z.string().transform(Number)]),
  height: z.union([z.number(), z.string().transform(Number)]),
  orientation: z.string().nullable(),
  displayOrder: z.union([z.number(), z.string().transform(Number)]).nullable(),
  duration: z.union([z.number(), z.string().transform(Number)]),
  statusMessage: z.string().nullable(),
  enableStat: z.union([z.number(), z.string().transform(Number)]),
  autoApplyTransitions: z.union([z.number(), z.string().transform(Number)]),
  code: z.string().nullable(),
  isLocked: z.union([z.boolean(), z.array(z.any())]).transform(val => Array.isArray(val) ? false : val)
});

export const putLayout = createTool({
  id: 'put-layout',
  description: '既存のレイアウトを更新します',
  inputSchema: z.object({
    layoutId: z.number().describe('更新するレイアウトID'),
    name: z.string().optional().describe('レイアウト名'),
    description: z.string().optional().describe('レイアウトの説明'),
    backgroundColor: z.string().optional().describe('背景色'),
    backgroundImageId: z.number().optional().describe('背景画像ID'),
    backgroundzIndex: z.number().optional().describe('背景のz-index'),
    width: z.number().optional().describe('幅'),
    height: z.number().optional().describe('高さ'),
    orientation: z.string().optional().describe('向き'),
    displayOrder: z.number().optional().describe('表示順'),
    duration: z.number().optional().describe('表示時間（秒）'),
    enableStat: z.number().optional().describe('統計を有効にするかどうか（0-1）'),
    autoApplyTransitions: z.number().optional().describe('トランジションを自動適用するかどうか（0-1）'),
    code: z.string().optional().describe('レイアウトの識別コード'),
    folderId: z.number().optional().describe('レイアウトを割り当てるフォルダID')
  }),

  outputSchema: z.string(),
  execute: async ({ context }) => {
    try {
      console.log("[DEBUG] putLayout: 開始");
      console.log("[DEBUG] putLayout: config =", config);
      
      if (!config.cmsUrl) {
        console.error("[DEBUG] putLayout: CMSのURLが設定されていません");
        throw new Error("CMSのURLが設定されていません");
      }
      console.log(`[DEBUG] putLayout: CMS URL = ${config.cmsUrl}`);

      const headers = await getAuthHeaders();
      console.log("[DEBUG] putLayout: 認証ヘッダーを取得しました");
      console.log("[DEBUG] putLayout: 認証ヘッダー =", headers);

      console.log("[DEBUG] putLayout: リクエストデータ =", context);

      // フォームデータの構築
      const formData = new URLSearchParams();
      if (context.name) formData.append('name', context.name);
      if (context.description) formData.append('description', context.description);
      if (context.backgroundColor) formData.append('backgroundColor', context.backgroundColor);
      if (context.backgroundImageId) formData.append('backgroundImageId', context.backgroundImageId.toString());
      if (context.backgroundzIndex) formData.append('backgroundzIndex', context.backgroundzIndex.toString());
      if (context.width) formData.append('width', context.width.toString());
      if (context.height) formData.append('height', context.height.toString());
      if (context.orientation) formData.append('orientation', context.orientation);
      if (context.displayOrder) formData.append('displayOrder', context.displayOrder.toString());
      if (context.duration) formData.append('duration', context.duration.toString());
      if (context.enableStat !== undefined) formData.append('enableStat', context.enableStat.toString());
      if (context.autoApplyTransitions !== undefined) formData.append('autoApplyTransitions', context.autoApplyTransitions.toString());
      if (context.code) formData.append('code', context.code);
      if (context.folderId) formData.append('folderId', context.folderId.toString());

      const url = `${config.cmsUrl}/api/layout/${context.layoutId}`;
      console.log(`[DEBUG] putLayout: リクエストURL = ${url}`);

      const response = await fetch(url, {
        method: 'PUT',
        headers: {
          ...headers,
          'Content-Type': 'application/x-www-form-urlencoded'
        },
        body: formData.toString()
      });

      console.log(`[DEBUG] putLayout: レスポンスステータス = ${response.status}`);
      if (!response.ok) {
        const errorData = await response.json().catch(() => null);
        console.error(`[DEBUG] putLayout: HTTPエラーが発生しました: ${response.status}`, errorData);
        throw new Error(`HTTP error! status: ${response.status}${errorData ? `, message: ${JSON.stringify(errorData)}` : ''}`);
      }

      const data = await response.json();
      console.log("[DEBUG] putLayout: レスポンスデータを取得しました");
      console.log("[DEBUG] putLayout: レスポンスデータの構造:");
      console.log("生データ:", JSON.stringify(data, null, 2));
      console.log("データ型:", typeof data);
      console.log("キー一覧:", Object.keys(data));

      const validatedData = layoutResponseSchema.parse(data);
      console.log("[DEBUG] putLayout: データの検証が成功しました");

      return JSON.stringify(validatedData, null, 2);
    } catch (error) {
      console.error("[DEBUG] putLayout: エラーが発生しました", error);
      return `エラーが発生しました: ${error instanceof Error ? error.message : "不明なエラー"}`;
    }
  },
}); 