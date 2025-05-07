import { z } from "zod";
import { createTool } from '@mastra/core/tools';
import { config } from "../config";
import { getAuthHeaders } from "../auth";

export const applyLayoutTemplate = createTool({
  id: 'apply-layout-template',
  description: 'テンプレートをレイアウトに適用します',
  inputSchema: z.object({
    layoutId: z.number().describe('テンプレートを適用するレイアウトのID'),
    templateId: z.number().describe('適用するテンプレートのID')
  }),
  outputSchema: z.string(),
  execute: async ({ context }) => {
    try {
      if (!config.cmsUrl) {
        throw new Error("CMSのURLが設定されていません");
      }

      const headers = await getAuthHeaders();
      const url = `${config.cmsUrl}/api/layout/applyTemplate/${context.layoutId}`;
      console.log(`[DEBUG] applyLayoutTemplate: リクエストURL = ${url}`);

      const formData = new FormData();
      formData.append('templateId', context.templateId.toString());

      const response = await fetch(url, {
        method: 'POST',
        headers,
        body: formData
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => null);
        console.error(`[DEBUG] applyLayoutTemplate: HTTPエラーが発生しました: ${response.status}`, errorData);
        throw new Error(`HTTP error! status: ${response.status}${errorData ? `, message: ${JSON.stringify(errorData)}` : ''}`);
      }

      console.log("[DEBUG] applyLayoutTemplate: テンプレートの適用が成功しました");
      return "テンプレートが正常に適用されました";
    } catch (error) {
      console.error("[DEBUG] applyLayoutTemplate: エラーが発生しました", error);
      return `エラーが発生しました: ${error instanceof Error ? error.message : "不明なエラー"}`;
    }
  },
}); 