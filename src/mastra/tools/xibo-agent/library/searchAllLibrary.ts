import { z } from "zod";
import { createTool } from "@mastra/core/tools";
import { config } from "../config";
import { getAuthHeaders } from "../auth";

export const searchAllLibrary = createTool({
  id: "search-all-library",
  description: "すべてのライブラリファイルの検索",
  inputSchema: z.object({}),
  outputSchema: z.string(),
  execute: async () => {
    if (!config.cmsUrl) {
      throw new Error("CMS URL is not set");
    }

    const url = new URL(`${config.cmsUrl}/library/search`);
    console.log(`Requesting URL: ${url.toString()}`);

    const response = await fetch(url.toString(), {
      method: "GET",
      headers: await getAuthHeaders(),
    });

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    const data = await response.json();
    console.log("Library search successful");
    return JSON.stringify(data);
  },
}); 