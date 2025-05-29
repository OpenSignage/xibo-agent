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

export const getUserPermissions = createTool({
  id: "get-user-permissions",
  description: "ユーザー権限を取得",
  inputSchema: z.object({
    entity: z.string(),
    objectId: z.number(),
  }),
  outputSchema: apiResponseSchema,
  execute: async ({ context }) => {
    if (!config.cmsUrl) {
      throw new Error("CMS URL is not set");
    }

    const url = new URL(`${config.cmsUrl}/user/permissions/${context.entity}/${context.objectId}`);
    
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
    console.log("User permissions retrieved successfully");
    return validatedData;
  },
});

export default getUserPermissions; 