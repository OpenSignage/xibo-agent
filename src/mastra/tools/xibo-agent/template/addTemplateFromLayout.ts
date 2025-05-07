import { z } from "zod";
import { createTool } from '@mastra/core/tools';
import { config } from "../config";
import { getAuthHeaders } from "../auth";

export const addTemplateFromLayout = createTool({
  id: 'add-template-from-layout',
  description: 'レイアウトからテンプレートを追加します',
  inputSchema: z.object({
    layoutId: z.number().describe('テンプレートのベースとなるレイアウトのID'),
    includeWidgets: z.number().describe('ウィジェットをテンプレートに含めるかどうか（1: 含める, 0: 含めない）'),
    name: z.string().describe('テンプレートの名前'),
    tags: z.string().optional().describe('テンプレートのタグ（カンマ区切り）'),
    description: z.string().optional().describe('テンプレートの説明')
  }),
  outputSchema: z.string(),
  execute: async ({ context }) => {
    try {
      if (!config.cmsUrl) {
        throw new Error("CMSのURLが設定されていません");
      }

      const headers = await getAuthHeaders();
      const url = `${config.cmsUrl}/api/template/${context.layoutId}`;
      console.log(`[DEBUG] addTemplateFromLayout: リクエストURL = ${url}`);

      const formData = new FormData();
      formData.append('includeWidgets', context.includeWidgets.toString());
      formData.append('name', context.name);
      if (context.tags) formData.append('tags', context.tags);
      if (context.description) formData.append('description', context.description);

      const response = await fetch(url, {
        method: 'POST',
        headers,
        body: formData
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => null);
        console.error(`[DEBUG] addTemplateFromLayout: HTTPエラーが発生しました: ${response.status}`, errorData);
        throw new Error(`HTTP error! status: ${response.status}${errorData ? `, message: ${JSON.stringify(errorData)}` : ''}`);
      }

      const data = await response.json();
      console.log("[DEBUG] addTemplateFromLayout: テンプレートの追加が成功しました");
      return JSON.stringify(data);
    } catch (error) {
      console.error("[DEBUG] addTemplateFromLayout: エラーが発生しました", error);
      return `エラーが発生しました: ${error instanceof Error ? error.message : "不明なエラー"}`;
    }
  },
}); 