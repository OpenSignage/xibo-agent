import { z } from "zod";
import { createTool } from '@mastra/core/tools';
import { config } from "../config";
import { getAuthHeaders } from "../auth";

const regionPositionSchema = z.object({
  regionId: z.number(),
  top: z.number(),
  left: z.number(),
  width: z.number(),
  height: z.number()
});

export const positionRegions = createTool({
  id: 'position-regions',
  description: 'レイアウトの全リージョンの位置を設定します',
  inputSchema: z.object({
    layoutId: z.number().describe('リージョンの位置を設定するレイアウトのID'),
    regions: z.array(regionPositionSchema).describe('リージョンの位置情報の配列')
  }),
  outputSchema: z.string(),
  execute: async ({ context }) => {
    try {
      if (!config.cmsUrl) {
        throw new Error("CMSのURLが設定されていません");
      }

      const headers = await getAuthHeaders();
      const url = `${config.cmsUrl}/api/region/position/all/${context.layoutId}`;
      console.log(`[DEBUG] positionRegions: リクエストURL = ${url}`);

      const formData = new FormData();
      context.regions.forEach(region => {
        formData.append('regions[]', JSON.stringify(region));
      });

      const response = await fetch(url, {
        method: 'PUT',
        headers,
        body: formData
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => null);
        console.error(`[DEBUG] positionRegions: HTTPエラーが発生しました: ${response.status}`, errorData);
        throw new Error(`HTTP error! status: ${response.status}${errorData ? `, message: ${JSON.stringify(errorData)}` : ''}`);
      }

      console.log("[DEBUG] positionRegions: リージョンの位置設定が成功しました");
      return "リージョンの位置が正常に設定されました";
    } catch (error) {
      console.error("[DEBUG] positionRegions: エラーが発生しました", error);
      return `エラーが発生しました: ${error instanceof Error ? error.message : "不明なエラー"}`;
    }
  },
}); 