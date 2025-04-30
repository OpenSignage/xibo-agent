import { z } from "zod";
import { config } from "../config";

interface GetCmsTimeParams {
  cmsUrl?: string;
  apiKey?: string;
}

const getCmsTimeSchema = z.object({
  cmsUrl: z.string().optional().describe("Xibo CMSのURL"),
  apiKey: z.string().optional().describe("Xibo CMSのAPIキー"),
});

export const getCmsTime: any = {
  name: "getCmsTime",
  description: "Xibo CMSの現在時刻を取得します",
  parameters: getCmsTimeSchema,
  execute: async ({ cmsUrl, apiKey }: GetCmsTimeParams) => {
    try {
      const url = cmsUrl || config.cmsUrl;
      const key = apiKey || config.apiKey;

      if (!url || !key) {
        throw new Error("CMSのURLまたはAPIキーが設定されていません");
      }

      const response = await fetch(`${url}/api/clock`, {
        headers: {
          "Authorization": `Bearer ${key}`,
          "Content-Type": "application/json",
        },
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
