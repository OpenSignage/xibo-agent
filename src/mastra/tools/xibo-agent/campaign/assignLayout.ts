import { z } from "zod";
import { createTool } from '@mastra/core/tools';
import { config } from "../config";
import { getAuthHeaders } from "../auth";

export const assignLayout = createTool({
  id: 'assign-layout',
  description: 'キャンペーンにレイアウトを割り当てます',
  inputSchema: z.object({
    campaignId: z.number().describe('レイアウトを割り当てるキャンペーンのID'),
    layoutId: z.number().describe('割り当てるレイアウトのID'),
    daysOfWeek: z.array(z.number()).optional().describe('広告キャンペーン：特定の曜日（ISO週）に制限する'),
    dayPartId: z.number().optional().describe('広告キャンペーン：特定の時間帯に制限する'),
    geoFence: z.string().optional().describe('広告キャンペーン：特定のジオフェンスに制限する')
  }),
  outputSchema: z.string(),
  execute: async ({ context }) => {
    try {
      if (!config.cmsUrl) {
        throw new Error("CMSのURLが設定されていません");
      }

      const headers = await getAuthHeaders();
      const url = `${config.cmsUrl}/api/campaign/layout/assign/${context.campaignId}`;
      console.log(`[DEBUG] assignLayout: リクエストURL = ${url}`);

      const formData = new FormData();
      formData.append('layoutId', context.layoutId.toString());
      if (context.daysOfWeek) formData.append('daysOfWeek[]', JSON.stringify(context.daysOfWeek));
      if (context.dayPartId) formData.append('dayPartId', context.dayPartId.toString());
      if (context.geoFence) formData.append('geoFence', context.geoFence);

      const response = await fetch(url, {
        method: 'POST',
        headers,
        body: formData
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => null);
        console.error(`[DEBUG] assignLayout: HTTPエラーが発生しました: ${response.status}`, errorData);
        throw new Error(`HTTP error! status: ${response.status}${errorData ? `, message: ${JSON.stringify(errorData)}` : ''}`);
      }

      console.log("[DEBUG] assignLayout: レイアウトの割り当てが成功しました");
      return "レイアウトが正常に割り当てられました";
    } catch (error) {
      console.error("[DEBUG] assignLayout: エラーが発生しました", error);
      return `エラーが発生しました: ${error instanceof Error ? error.message : "不明なエラー"}`;
    }
  },
}); 