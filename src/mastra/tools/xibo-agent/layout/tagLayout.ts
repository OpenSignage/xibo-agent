import { z } from "zod";
import { createTool } from '@mastra/core/tools';
import { config } from "../config";
import { getAuthHeaders } from "../auth";

export const tagLayout = createTool({
  id: 'tag-layout',
  description: 'レイアウトにタグを追加します',
  inputSchema: z.object({
    layoutId: z.number().describe('タグを追加するレイアウトのID'),
    tags: z.array(z.string()).describe('追加するタグの配列')
  }),
  outputSchema: z.string(),
  execute: async ({ context }) => {
    try {
      if (!config.cmsUrl) {
        throw new Error("CMSのURLが設定されていません");
      }

      const headers = await getAuthHeaders();
      const url = `${config.cmsUrl}/api/layout/${context.layoutId}/tag`;
      console.log(`[DEBUG] tagLayout: リクエストURL = ${url}`);

      const formData = new FormData();
      context.tags.forEach(tag => {
        formData.append('tag[]', tag);
      });

      const response = await fetch(url, {
        method: 'POST',
        headers,
        body: formData
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => null);
        console.error(`[DEBUG] tagLayout: HTTPエラーが発生しました: ${response.status}`, errorData);
        throw new Error(`HTTP error! status: ${response.status}${errorData ? `, message: ${JSON.stringify(errorData)}` : ''}`);
      }

      console.log("[DEBUG] tagLayout: タグの追加が成功しました");
      return "タグが正常に追加されました";
    } catch (error) {
      console.error("[DEBUG] tagLayout: エラーが発生しました", error);
      return `エラーが発生しました: ${error instanceof Error ? error.message : "不明なエラー"}`;
    }
  },
}); 