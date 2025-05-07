import { z } from "zod";
import { createTool } from '@mastra/core/tools';
import { config } from "../config";
import { getAuthHeaders } from "../auth";

export const getWidgetDataTypes = createTool({
  id: 'get-widget-data-types',
  description: 'ウィジェットのデータ型一覧を取得します',
  inputSchema: z.object({}),
  outputSchema: z.string(),
  execute: async () => {
    try {
      if (!config.cmsUrl) {
        throw new Error("CMSのURLが設定されていません");
      }

      const headers = await getAuthHeaders();
      const url = `${config.cmsUrl}/api/playlist/widget/data/types`;
      console.log(`[DEBUG] getWidgetDataTypes: リクエストURL = ${url}`);

      const response = await fetch(url, {
        method: 'GET',
        headers
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => null);
        console.error(`[DEBUG] getWidgetDataTypes: HTTPエラーが発生しました: ${response.status}`, errorData);
        throw new Error(`HTTP error! status: ${response.status}${errorData ? `, message: ${JSON.stringify(errorData)}` : ''}`);
      }

      const data = await response.json();
      console.log("[DEBUG] getWidgetDataTypes: データ型一覧の取得が成功しました");
      return JSON.stringify(data);
    } catch (error) {
      console.error("[DEBUG] getWidgetDataTypes: エラーが発生しました", error);
      return `エラーが発生しました: ${error instanceof Error ? error.message : "不明なエラー"}`;
    }
  },
}); 