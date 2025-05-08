import { z } from "zod";
import { createTool } from "@mastra/core/tools";
import { config } from "../config";
import { getAuthHeaders } from "../auth";

export const assignLayout = createTool({
  id: "assign-layout",
  description: "キャンペーンにレイアウトを割り当てる",
  inputSchema: z.object({
    campaignId: z.number().describe("キャンペーンID"),
    layoutId: z.number().describe("割り当てるレイアウトID"),
    displayOrder: z.number().optional().describe("表示順序（オプション）"),
    unassignPrevious: z.boolean().optional().describe("以前の割り当てを解除するかどうか（オプション）"),
  }),
  outputSchema: z.string(),
  execute: async ({ context }) => {
    if (!config.cmsUrl) {
      throw new Error("CMS URL is not set");
    }

    const url = new URL(`${config.cmsUrl}/api/campaign/layout/assign/${context.campaignId}`);

    try {
      const formData = new FormData();
      formData.append("layoutId", context.layoutId.toString());
      
      if (context.displayOrder !== undefined) {
        formData.append("displayOrder", context.displayOrder.toString());
      }
      
      if (context.unassignPrevious !== undefined) {
        formData.append("unassignPrevious", context.unassignPrevious ? "1" : "0");
      }

      const response = await fetch(url.toString(), {
        method: "POST",
        headers: await getAuthHeaders(),
        body: formData,
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const data = await response.json();
      return JSON.stringify(data, null, 2);
    } catch (error) {
      console.error("レイアウト割り当て中にエラーが発生しました:", error);
      throw error;
    }
  },
});

export default assignLayout; 