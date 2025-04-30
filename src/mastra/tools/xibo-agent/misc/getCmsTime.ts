import { z } from "zod";
import { config } from "../config";
import { getAuthHeaders } from "../auth";

interface GetCmsTimeParams {
  cmsUrl?: string;
}

const getCmsTimeSchema = z.object({
  cmsUrl: z.string().optional().describe("Xibo CMSのURL"),
});

export const getCmsTime: any = {
  name: "getCmsTime",
  description: "Xibo CMSの現在時刻を取得します",
  parameters: getCmsTimeSchema,
  execute: async ({ cmsUrl }: GetCmsTimeParams) => {
    try {
      const url = cmsUrl || config.cmsUrl;

      if (!url) {
        throw new Error("CMSのURLが設定されていません");
      }

      const headers = await getAuthHeaders();
      const response = await fetch(`${url}/api/clock`, {
        headers,
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const data = await response.json();
      return JSON.stringify(data);
    } catch (error: unknown) {
      if (error instanceof Error) {
        return `エラーが発生しました: ${error.message}`;
      }
      return "不明なエラーが発生しました";
    }
  },
};
