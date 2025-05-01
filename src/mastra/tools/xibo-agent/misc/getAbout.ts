import { z } from "zod";
import { createTool } from '@mastra/core/tools';
import { config } from "../config";
import { getAuthHeaders } from "../auth";

const aboutResponseSchema = z.object({
  version: z.string(),
  sourceUrl: z.string().nullable(),
});

export const getAbout = createTool({
  id: 'get-about',
  description: 'Xibo APIのバージョン情報などの詳細を取得します',
  inputSchema: z.object({
    _placeholder: z.string().optional().describe('このツールは入力パラメータを必要としません')
  }),
  outputSchema: z.string(),
  execute: async ({ context }) => {
    try {
      console.log("[DEBUG] getAbout: 開始");
      console.log("[DEBUG] getAbout: config =", config);
      
      if (!config.cmsUrl) {
        console.error("[DEBUG] getAbout: CMSのURLが設定されていません");
        throw new Error("CMSのURLが設定されていません");
      }
      console.log(`[DEBUG] getAbout: CMS URL = ${config.cmsUrl}`);

      const headers = await getAuthHeaders();
      console.log("[DEBUG] getAbout: 認証ヘッダーを取得しました");

      console.log(`[DEBUG] getAbout: APIリクエストを開始します: ${config.cmsUrl}/api/about`);
      const response = await fetch(`${config.cmsUrl}/api/about`, {
        headers,
      });

      console.log(`[DEBUG] getAbout: レスポンスステータス = ${response.status}`);
      if (!response.ok) {
        console.error(`[DEBUG] getAbout: HTTPエラーが発生しました: ${response.status}`);
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const data = await response.json();
      console.log("[DEBUG] getAbout: レスポンスデータを取得しました");
      console.log("[DEBUG] getAbout: レスポンスデータの構造:");
      console.log("version:", data.version);
      console.log("sourceUrl:", data.sourceUrl);
      console.log("全データ:", JSON.stringify(data, null, 2));

      const validatedData = aboutResponseSchema.parse(data);
      console.log("[DEBUG] getAbout: データの検証が成功しました");

      return JSON.stringify(validatedData, null, 2);
    } catch (error) {
      console.error("[DEBUG] getAbout: エラーが発生しました", error);
      return `エラーが発生しました: ${error instanceof Error ? error.message : "不明なエラー"}`;
    }
  },
});
