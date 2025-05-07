import { z } from "zod";
import { createTool } from '@mastra/core/tools';
import { config } from "../config";
import { getAuthHeaders } from "../auth";

export const searchAllTemplates = createTool({
  id: 'search-all-templates',
  description: 'すべてのテンプレートを検索します（ローカルとコネクタ）',
  inputSchema: z.object({}),
  outputSchema: z.string(),
  execute: async () => {
    try {
      if (!config.cmsUrl) {
        throw new Error("CMSのURLが設定されていません");
      }

      const headers = await getAuthHeaders();
      const url = `${config.cmsUrl}/api/template/search`;
      console.log(`[DEBUG] searchAllTemplates: リクエストURL = ${url}`);

      const response = await fetch(url, {
        method: 'GET',
        headers
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => null);
        console.error(`[DEBUG] searchAllTemplates: HTTPエラーが発生しました: ${response.status}`, errorData);
        throw new Error(`HTTP error! status: ${response.status}${errorData ? `, message: ${JSON.stringify(errorData)}` : ''}`);
      }

      const data = await response.json();
      console.log("[DEBUG] searchAllTemplates: テンプレートの検索が成功しました");
      return JSON.stringify(data);
    } catch (error) {
      console.error("[DEBUG] searchAllTemplates: エラーが発生しました", error);
      return `エラーが発生しました: ${error instanceof Error ? error.message : "不明なエラー"}`;
    }
  },
}); 