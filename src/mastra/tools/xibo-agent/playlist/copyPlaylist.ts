import { z } from "zod";
import { createTool } from '@mastra/core/tools';
import { config } from "../config";
import { getAuthHeaders } from "../auth";

export const copyPlaylist = createTool({
  id: 'copy-playlist',
  description: 'プレイリストをコピーします',
  inputSchema: z.object({
    playlistId: z.number().describe('コピーするプレイリストのID'),
    name: z.string().describe('新しいプレイリストの名前'),
    copyMediaFiles: z.number().describe('メディアファイルをコピーするかどうか（0: コピーしない, 1: コピーする）')
  }),
  outputSchema: z.string(),
  execute: async ({ context }) => {
    try {
      if (!config.cmsUrl) {
        throw new Error("CMSのURLが設定されていません");
      }

      const headers = await getAuthHeaders();
      const url = `${config.cmsUrl}/api/playlist/copy/${context.playlistId}`;
      console.log(`[DEBUG] copyPlaylist: リクエストURL = ${url}`);

      const formData = new FormData();
      formData.append('name', context.name);
      formData.append('copyMediaFiles', context.copyMediaFiles.toString());

      const response = await fetch(url, {
        method: 'POST',
        headers,
        body: formData
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => null);
        console.error(`[DEBUG] copyPlaylist: HTTPエラーが発生しました: ${response.status}`, errorData);
        throw new Error(`HTTP error! status: ${response.status}${errorData ? `, message: ${JSON.stringify(errorData)}` : ''}`);
      }

      const data = await response.json();
      console.log("[DEBUG] copyPlaylist: プレイリストのコピーが成功しました");
      return JSON.stringify(data);
    } catch (error) {
      console.error("[DEBUG] copyPlaylist: エラーが発生しました", error);
      return `エラーが発生しました: ${error instanceof Error ? error.message : "不明なエラー"}`;
    }
  },
}); 