import { z } from "zod";
import { createTool } from '@mastra/core/tools';
import { config } from "../config";
import { getAuthHeaders } from "../auth";

export const removeLayout = createTool({
  id: 'remove-layout',
  description: 'キャンペーンからレイアウトを削除します',
  inputSchema: z.object({
    campaignId: z.number().describe('レイアウトを削除するキャンペーンのID'),
    layoutId: z.number().describe('削除するレイアウトのID'),
    displayOrder: z.number().optional().describe('表示順序。省略すると、そのレイアウトのすべての出現を削除')
  }),
  outputSchema: z.string(),
  execute: async ({ context }) => {
    try {
      if (!config.cmsUrl) {
        throw new Error("CMSのURLが設定されていません");
      }

      const headers = await getAuthHeaders();
      const url = `${config.cmsUrl}/api/campaign/layout/remove/${context.campaignId}`;
      console.log(`[DEBUG] removeLayout: リクエストURL = ${url}`);

      const formData = new FormData();
      formData.append('layoutId', context.layoutId.toString());
      if (context.displayOrder) formData.append('displayOrder', context.displayOrder.toString());

      const response = await fetch(url, {
        method: 'DELETE',
        headers,
        body: formData
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => null);
        console.error(`[DEBUG] removeLayout: HTTPエラーが発生しました: ${response.status}`, errorData);
        throw new Error(`HTTP error! status: ${response.status}${errorData ? `, message: ${JSON.stringify(errorData)}` : ''}`);
      }

      console.log("[DEBUG] removeLayout: レイアウトの削除が成功しました");
      return "レイアウトが正常に削除されました";
    } catch (error) {
      console.error("[DEBUG] removeLayout: エラーが発生しました", error);
      return `エラーが発生しました: ${error instanceof Error ? error.message : "不明なエラー"}`;
    }
  },
}); 