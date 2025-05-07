import { z } from "zod";
import { createTool } from '@mastra/core/tools';
import { config } from "../config";
import { getAuthHeaders } from "../auth";

export const getCampaigns = createTool({
  id: 'get-campaigns',
  description: 'キャンペーンを検索します',
  inputSchema: z.object({
    campaignId: z.number().optional().describe('キャンペーンIDでフィルタリング'),
    name: z.string().optional().describe('名前でフィルタリング'),
    tags: z.string().optional().describe('タグでフィルタリング'),
    exactTags: z.number().optional().describe('タグフィルターを完全一致として扱うかどうか'),
    logicalOperator: z.string().optional().describe('複数のタグでフィルタリングする場合の論理演算子（AND|OR）'),
    hasLayouts: z.number().optional().describe('レイアウトの有無でフィルタリング'),
    isLayoutSpecific: z.number().optional().describe('レイアウト固有のキャンペーンかどうかでフィルタリング'),
    retired: z.number().optional().describe('廃止されたキャンペーンでフィルタリング'),
    totalDuration: z.number().optional().describe('合計時間を含めるかどうか'),
    embed: z.string().optional().describe('関連データ（レイアウト、権限、タグ、イベント）を含めるかどうか'),
    folderId: z.number().optional().describe('フォルダIDでフィルタリング')
  }),
  outputSchema: z.string(),
  execute: async ({ context }) => {
    try {
      if (!config.cmsUrl) {
        throw new Error("CMSのURLが設定されていません");
      }

      const headers = await getAuthHeaders();
      const params = new URLSearchParams();
      
      if (context.campaignId) params.append('campaignId', context.campaignId.toString());
      if (context.name) params.append('name', context.name);
      if (context.tags) params.append('tags', context.tags);
      if (context.exactTags) params.append('exactTags', context.exactTags.toString());
      if (context.logicalOperator) params.append('logicalOperator', context.logicalOperator);
      if (context.hasLayouts) params.append('hasLayouts', context.hasLayouts.toString());
      if (context.isLayoutSpecific) params.append('isLayoutSpecific', context.isLayoutSpecific.toString());
      if (context.retired) params.append('retired', context.retired.toString());
      if (context.totalDuration) params.append('totalDuration', context.totalDuration.toString());
      if (context.embed) params.append('embed', context.embed);
      if (context.folderId) params.append('folderId', context.folderId.toString());

      const url = `${config.cmsUrl}/api/campaign?${params.toString()}`;
      console.log(`[DEBUG] getCampaigns: リクエストURL = ${url}`);

      const response = await fetch(url, {
        method: 'GET',
        headers
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => null);
        console.error(`[DEBUG] getCampaigns: HTTPエラーが発生しました: ${response.status}`, errorData);
        throw new Error(`HTTP error! status: ${response.status}${errorData ? `, message: ${JSON.stringify(errorData)}` : ''}`);
      }

      const data = await response.json();
      console.log("[DEBUG] getCampaigns: キャンペーンの検索が成功しました");
      return JSON.stringify(data);
    } catch (error) {
      console.error("[DEBUG] getCampaigns: エラーが発生しました", error);
      return `エラーが発生しました: ${error instanceof Error ? error.message : "不明なエラー"}`;
    }
  },
}); 