import { z } from "zod";
import { createTool } from "@mastra/core/tools";
import { config } from "../config";
import { getAuthHeaders } from "../auth";

export const removeLayout = createTool({
  id: "remove-layout",
  description: "キャンペーンからレイアウトを削除する",
  inputSchema: z.object({
    campaignId: z.number().describe("キャンペーンID"),
    layoutId: z.number().describe("削除するレイアウトID"),
  }),
  outputSchema: z.string(),
  execute: async ({ context }) => {
    if (!config.cmsUrl) {
      throw new Error("CMS URL is not set");
    }

    const url = new URL(`${config.cmsUrl}/api/campaign/layout/${context.campaignId}/${context.layoutId}`);

    try {
      const response = await fetch(url.toString(), {
        method: "DELETE",
        headers: await getAuthHeaders(),
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const data = await response.json();
      return JSON.stringify(data, null, 2);
    } catch (error) {
      console.error("レイアウト削除中にエラーが発生しました:", error);
      throw error;
    }
  },
});

export default removeLayout; 