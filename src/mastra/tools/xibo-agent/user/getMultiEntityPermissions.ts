import { z } from "zod";
import { createTool } from "@mastra/core/tools";
import { config } from "../config";
import { getAuthHeaders } from "../auth";

const permissionSchema = z.object({
  groupId: z.number(),
  group: z.string(),
  view: z.number(),
  edit: z.number(),
  delete: z.number(),
});

const apiResponseSchema = z.object({
  success: z.boolean(),
  data: z.array(permissionSchema),
});

export const getMultiEntityPermissions = createTool({
  id: "get-multi-entity-permissions",
  description: "Gets permissions for multiple entities.",
  inputSchema: z.object({
    entity: z.string(),
    ids: z.string(),
  }),
  outputSchema: apiResponseSchema,
  execute: async ({ context }) => {
    if (!config.cmsUrl) {
      throw new Error("CMS URL is not set");
    }

    const url = new URL(`${config.cmsUrl}/api/user/permissions/${context.entity}`);
    url.searchParams.append("ids", context.ids);
    
    console.log(`Requesting URL: ${url.toString()}`);

    const response = await fetch(url.toString(), {
      method: "GET",
      headers: await getAuthHeaders(),
    });

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    const rawData = await response.json();
    const validatedData = apiResponseSchema.parse(rawData);
    console.log("Multi-entity permissions retrieved successfully");
    return validatedData;
  },
});

export default getMultiEntityPermissions; 