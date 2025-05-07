import { z } from "zod";
import { createTool } from '@mastra/core/tools';
import { config } from "../config";
import { getAuthHeaders } from "../auth";

export const selectCampaignFolder = createTool({
  id: 'select-campaign-folder',
  description: 'キャンペーンのフォルダを選択します',
  inputSchema: z.object({
    campaignId: z.number().describe('フォルダを選択するキャンペーンのID'),
    folderId: z.number().optional().describe('割り当てるフォルダのID')
  }),
  outputSchema: z.string(),
  execute: async ({ context }) => {
    try {
      if (!config.cmsUrl) {
        throw new Error("CMSのURLが設定されていません");
      }

      const headers = await getAuthHeaders();
      const url = `${config.cmsUrl}/api/campaign/${context.campaignId}/selectfolder`;
      console.log(`[DEBUG] selectCampaignFolder: リクエストURL = ${url}`);

      const formData = new FormData();
      if (context.folderId) formData.append('folderId', context.folderId.toString());

      const response = await fetch(url, {
        method: 'PUT',
        headers,
        body: formData
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => null);
        console.error(`[DEBUG] selectCampaignFolder: HTTPエラーが発生しました: ${response.status}`, errorData);
        throw new Error(`HTTP error! status: ${response.status}${errorData ? `, message: ${JSON.stringify(errorData)}` : ''}`);
      }

      const data = await response.json();
      console.log("[DEBUG] selectCampaignFolder: フォルダの選択が成功しました");
      return JSON.stringify(data);
    } catch (error) {
      console.error("[DEBUG] selectCampaignFolder: エラーが発生しました", error);
      return `エラーが発生しました: ${error instanceof Error ? error.message : "不明なエラー"}`;
    }
  },
}); 