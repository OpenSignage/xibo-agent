import { z } from "zod";
import { createTool } from '@mastra/core/tools';
import { config } from "../config";
import { getAuthHeaders } from "../auth";

export const putCampaign = createTool({
  id: 'put-campaign',
  description: 'キャンペーンを編集します',
  inputSchema: z.object({
    campaignId: z.number().describe('編集するキャンペーンのID'),
    name: z.string().describe('キャンペーンの名前'),
    folderId: z.number().optional().describe('フォルダID'),
    manageLayouts: z.number().optional().describe('レイアウトを管理するかどうかのフラグ（1: 管理する, 0: 管理しない）'),
    layoutIds: z.array(z.number()).optional().describe('このキャンペーンに割り当てるレイアウトIDの配列（順序付き）'),
    cyclePlaybackEnabled: z.number().optional().describe('サイクルベースの再生を有効にするかどうか（1: 有効, 0: 無効）'),
    playCount: z.number().optional().describe('サイクルベースの再生で、次のレイアウトに移る前に各レイアウトを何回再生するか'),
    listPlayOrder: z.string().optional().describe('レイアウトリストで、同じ再生順序のキャンペーンをどのように再生するか'),
    targetType: z.string().optional().describe('広告キャンペーンの場合、ターゲットの測定方法（plays|budget|imp）'),
    target: z.number().optional().describe('広告キャンペーンの場合、キャンペーン全体での再生のターゲット数')
  }),
  outputSchema: z.string(),
  execute: async ({ context }) => {
    try {
      if (!config.cmsUrl) {
        throw new Error("CMSのURLが設定されていません");
      }

      const headers = await getAuthHeaders();
      const url = `${config.cmsUrl}/api/campaign/${context.campaignId}`;
      console.log(`[DEBUG] putCampaign: リクエストURL = ${url}`);

      const formData = new FormData();
      formData.append('name', context.name);
      if (context.folderId) formData.append('folderId', context.folderId.toString());
      if (context.manageLayouts) formData.append('manageLayouts', context.manageLayouts.toString());
      if (context.layoutIds) formData.append('layoutIds', JSON.stringify(context.layoutIds));
      if (context.cyclePlaybackEnabled) formData.append('cyclePlaybackEnabled', context.cyclePlaybackEnabled.toString());
      if (context.playCount) formData.append('playCount', context.playCount.toString());
      if (context.listPlayOrder) formData.append('listPlayOrder', context.listPlayOrder);
      if (context.targetType) formData.append('targetType', context.targetType);
      if (context.target) formData.append('target', context.target.toString());

      const response = await fetch(url, {
        method: 'PUT',
        headers,
        body: formData
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => null);
        console.error(`[DEBUG] putCampaign: HTTPエラーが発生しました: ${response.status}`, errorData);
        throw new Error(`HTTP error! status: ${response.status}${errorData ? `, message: ${JSON.stringify(errorData)}` : ''}`);
      }

      const data = await response.json();
      console.log("[DEBUG] putCampaign: キャンペーンの編集が成功しました");
      return JSON.stringify(data);
    } catch (error) {
      console.error("[DEBUG] putCampaign: エラーが発生しました", error);
      return `エラーが発生しました: ${error instanceof Error ? error.message : "不明なエラー"}`;
    }
  },
}); 