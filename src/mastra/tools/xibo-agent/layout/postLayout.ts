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

export const postLayout = createTool({
  id: 'post-layout',
  description: '新しいレイアウトを作成します',
  inputSchema: z.object({
    name: z.string().describe('レイアウト名'),
    description: z.string().optional().describe('レイアウトの説明'),
    layoutId: z.number().optional().describe('テンプレートとして使用するレイアウトID'),
    resolutionId: z.number().optional().describe('テンプレートを使用しない場合の解像度ID'),
    returnDraft: z.boolean().optional().describe('成功時に下書きレイアウトを返すかどうか'),
    code: z.string().optional().describe('レイアウトの識別コード'),
    folderId: z.number().optional().describe('レイアウトを割り当てるフォルダID')
  }),

  outputSchema: z.string(),
  execute: async ({ context }) => {
    try {
      console.log("[DEBUG] postLayout: 開始");
      console.log("[DEBUG] postLayout: config =", config);
      
      if (!config.cmsUrl) {
        console.error("[DEBUG] postLayout: CMSのURLが設定されていません");
        throw new Error("CMSのURLが設定されていません");
      }
      console.log(`[DEBUG] postLayout: CMS URL = ${config.cmsUrl}`);

      const headers = await getAuthHeaders();
      console.log("[DEBUG] postLayout: 認証ヘッダーを取得しました");
      console.log("[DEBUG] postLayout: 認証ヘッダー =", headers);

      console.log("[DEBUG] postLayout: リクエストデータ =", context);

      // フォームデータの構築
      const formData = new URLSearchParams();
      formData.append('name', context.name);
      if (context.description) formData.append('description', context.description);
      if (context.layoutId) formData.append('layoutId', context.layoutId.toString());
      if (context.resolutionId) formData.append('resolutionId', context.resolutionId.toString());
      if (context.returnDraft !== undefined) formData.append('returnDraft', context.returnDraft.toString());
      if (context.code) formData.append('code', context.code);
      if (context.folderId) formData.append('folderId', context.folderId.toString());

      const url = `${config.cmsUrl}/api/layout`;
      console.log(`[DEBUG] postLayout: リクエストURL = ${url}`);

      const response = await fetch(url, {
        method: 'POST',
        headers: {
          ...headers,
          'Content-Type': 'application/x-www-form-urlencoded'
        },
        body: formData.toString()
      });

      console.log(`[DEBUG] postLayout: レスポンスステータス = ${response.status}`);
      if (!response.ok) {
        const errorData = await response.json().catch(() => null);
        console.error(`[DEBUG] postLayout: HTTPエラーが発生しました: ${response.status}`, errorData);
        throw new Error(`HTTP error! status: ${response.status}${errorData ? `, message: ${JSON.stringify(errorData)}` : ''}`);
      }

      const data = await response.json();
      console.log("[DEBUG] postLayout: レスポンスデータを取得しました");
      console.log("[DEBUG] postLayout: レスポンスデータの構造:");
      console.log("生データ:", JSON.stringify(data, null, 2));
      console.log("データ型:", typeof data);
      console.log("キー一覧:", Object.keys(data));

      const validatedData = layoutResponseSchema.parse(data);
      console.log("[DEBUG] postLayout: データの検証が成功しました");

      return JSON.stringify(validatedData, null, 2);
    } catch (error) {
      console.error("[DEBUG] postLayout: エラーが発生しました", error);
      return `エラーが発生しました: ${error instanceof Error ? error.message : "不明なエラー"}`;
    }
  },
}); 