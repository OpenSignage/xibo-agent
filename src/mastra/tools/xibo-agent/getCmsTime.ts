import { z } from "zod";

interface GetCmsTimeParams {
  cmsUrl: string;
  apiKey: string;
}

const getCmsTimeSchema = z.object({
  cmsUrl: z.string().describe("Xibo CMSのURL"),
  apiKey: z.string().describe("Xibo CMSのAPIキー"),
});

export const getCmsTime: any = {
  name: "getCmsTime",
  description: "Xibo CMSの現在時刻を取得します",
  parameters: getCmsTimeSchema,
  execute: async ({ cmsUrl, apiKey }: GetCmsTimeParams) => {
    try {
      const response = await fetch(`${cmsUrl}/api/clock`, {
        headers: {
          "Authorization": `Bearer ${apiKey}`,
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
