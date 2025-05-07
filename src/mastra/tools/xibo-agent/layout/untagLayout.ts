import { z } from "zod";
import { createTool } from '@mastra/core/tools';
import { config } from "../config";
import { getAuthHeaders } from "../auth";

export const untagLayout = createTool({
  id: 'untag-layout',
  description: 'レイアウトからタグを削除します',
  inputSchema: z.object({
    layoutId: z.number().describe('タグを削除するレイアウトのID'),
    tags: z.array(z.string()).describe('削除するタグの配列')
  }),
  outputSchema: z.string(),
  execute: async ({ context }) => {
    try {
      if (!config.cmsUrl) {
        throw new Error("CMSのURLが設定されていません");
      }

      const headers = await getAuthHeaders();
      const url = `${config.cmsUrl}/api/layout/${context.layoutId}/untag`;
      console.log(`[DEBUG] untagLayout: リクエストURL = ${url}`);

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
        console.error(`[DEBUG] untagLayout: HTTPエラーが発生しました: ${response.status}`, errorData);
        throw new Error(`HTTP error! status: ${response.status}${errorData ? `, message: ${JSON.stringify(errorData)}` : ''}`);
      }

      console.log("[DEBUG] untagLayout: タグの削除が成功しました");
      return "タグが正常に削除されました";
    } catch (error) {
      console.error("[DEBUG] untagLayout: エラーが発生しました", error);
      return `エラーが発生しました: ${error instanceof Error ? error.message : "不明なエラー"}`;
    }
  },
}); 