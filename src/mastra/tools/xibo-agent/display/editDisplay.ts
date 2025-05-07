import { z } from "zod";
import { createTool } from "@mastra/core/tools";
import { config } from "../config";
import { getAuthHeaders } from "../utils/auth";

export const editDisplay = createTool({
  id: "edit-display",
  description: "ディスプレイの編集",
  inputSchema: z.object({
    displayId: z.number(),
    display: z.string(),
    description: z.string().optional(),
    tags: z.string().optional(),
    auditingUntil: z.string().optional(),
    longitude: z.number().optional(),
    timeZone: z.string().optional(),
    languages: z.string().optional(),
    displayProfileId: z.number().optional(),
    displayTypeId: z.number().optional(),
    screenSize: z.number().optional(),
    customId: z.string().optional(),
    ref1: z.string().optional(),
    ref2: z.string().optional(),
    ref3: z.string().optional(),
    ref4: z.string().optional(),
    ref5: z.string().optional(),
    clearCachedData: z.number().optional(),
  }),
  outputSchema: z.string(),
  execute: async ({ context }) => {
    if (!config.cmsUrl) {
      throw new Error("CMS URL is not set");
    }

    const url = new URL(`${config.cmsUrl}/display/${context.displayId}`);
    const formData = new FormData();
    formData.append("display", context.display);
    if (context.description) formData.append("description", context.description);
    if (context.tags) formData.append("tags", context.tags);
    if (context.auditingUntil) formData.append("auditingUntil", context.auditingUntil);
    if (context.longitude) formData.append("longitude", context.longitude.toString());
    if (context.timeZone) formData.append("timeZone", context.timeZone);
    if (context.languages) formData.append("languages", context.languages);
    if (context.displayProfileId) formData.append("displayProfileId", context.displayProfileId.toString());
    if (context.displayTypeId) formData.append("displayTypeId", context.displayTypeId.toString());
    if (context.screenSize) formData.append("screenSize", context.screenSize.toString());
    if (context.customId) formData.append("customId", context.customId);
    if (context.ref1) formData.append("ref1", context.ref1);
    if (context.ref2) formData.append("ref2", context.ref2);
    if (context.ref3) formData.append("ref3", context.ref3);
    if (context.ref4) formData.append("ref4", context.ref4);
    if (context.ref5) formData.append("ref5", context.ref5);
    if (context.clearCachedData) formData.append("clearCachedData", context.clearCachedData.toString());

    console.log(`Requesting URL: ${url.toString()}`);

    const response = await fetch(url.toString(), {
      method: "PUT",
      headers: await getAuthHeaders(),
      body: formData,
    });

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    const data = await response.json();
    console.log("Display edited successfully");
    return JSON.stringify(data);
  },
}); 