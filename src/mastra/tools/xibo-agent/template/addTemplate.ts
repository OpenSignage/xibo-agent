import { z } from "zod";
import { createTool } from '@mastra/core/tools';
import { config } from "../config";
import { getAuthHeaders } from "../auth";

export const addTemplate = createTool({
  id: 'add-template',
  description: 'テンプレートを追加します',
  inputSchema: z.object({
    name: z.string().describe('テンプレートの名前'),
    description: z.string().optional().describe('テンプレートの説明'),
    resolutionId: z.number().optional().describe('テンプレートの解像度ID'),
    returnDraft: z.boolean().optional().describe('成功時に下書きレイアウトを返すかどうか')
  }),
  outputSchema: z.string(),
  execute: async ({ context }) => {
    try {
      if (!config.cmsUrl) {
        throw new Error("CMSのURLが設定されていません");
      }

      const headers = await getAuthHeaders();
      const url = `${config.cmsUrl}/api/template`;
      console.log(`[DEBUG] addTemplate: リクエストURL = ${url}`);

      const formData = new FormData();
      formData.append('name', context.name);
      if (context.description) formData.append('description', context.description);
      if (context.resolutionId) formData.append('resolutionId', context.resolutionId.toString());
      if (context.returnDraft) formData.append('returnDraft', context.returnDraft.toString());

      const response = await fetch(url, {
        method: 'POST',
        headers,
        body: formData
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => null);
        console.error(`[DEBUG] addTemplate: HTTPエラーが発生しました: ${response.status}`, errorData);
        throw new Error(`HTTP error! status: ${response.status}${errorData ? `, message: ${JSON.stringify(errorData)}` : ''}`);
      }

      const location = response.headers.get('Location');
      console.log("[DEBUG] addTemplate: テンプレートの追加が成功しました");
      return `テンプレートが正常に追加されました。Location: ${location}`;
    } catch (error) {
      console.error("[DEBUG] addTemplate: エラーが発生しました", error);
      return `エラーが発生しました: ${error instanceof Error ? error.message : "不明なエラー"}`;
    }
  },
}); 