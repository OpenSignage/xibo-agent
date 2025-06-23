import { z } from "zod";
import { createTool } from "@mastra/core/tools";
import { config } from "../config";
import { getAuthHeaders } from "../auth";

const apiResponseSchema = z.object({
  success: z.boolean(),
  data: z.null(),
});

export const setUserPermissions = createTool({
  id: "set-user-permissions",
  description: "Sets permissions for a specific user.",
  inputSchema: z.object({
    entity: z.string(),
    objectId: z.number(),
    groupIds: z.array(z.string()),
    ownerId: z.number().optional(),
  }),
  outputSchema: apiResponseSchema,
  execute: async ({ context }) => {
    if (!config.cmsUrl) {
      throw new Error("CMS URL is not set");
    }

    // Construct the request URL for the user permissions API endpoint.
    const url = new URL(`${config.cmsUrl}/api/user/permissions/${context.entity}/${context.objectId}`);
    
    // Create a FormData object to send the permission data.
    const formData = new FormData();
    context.groupIds.forEach(groupId => {
      formData.append("groupIds[]", groupId);
    });
    // Optionally include the new owner's ID.
    if (context.ownerId) formData.append("ownerId", context.ownerId.toString());

    console.log(`Requesting URL: ${url.toString()}`);

    // Perform the POST request to the Xibo CMS API.
    const response = await fetch(url.toString(), {
      method: "POST",
      headers: await getAuthHeaders(),
      body: formData,
    });

    // Handle non-successful HTTP responses.
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    console.log("User permissions set successfully");
    // Return a standard success response.
    return {
      success: true,
      data: null
    };
  },
});

export default setUserPermissions; 