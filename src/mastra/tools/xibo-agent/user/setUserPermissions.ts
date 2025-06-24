import { z } from "zod";
import { createTool } from "@mastra/core/tools";
import { config } from "../config";
import { getAuthHeaders } from "../auth";
import { logger } from "../../../index";
import { decodeErrorMessage } from "../utility/error";

const successSchema = z.object({
  success: z.literal(true),
  message: z.string().describe("A confirmation message."),
});

const errorSchema = z.object({
  success: z.literal(false),
  message: z.string().describe("A human-readable error message."),
  error: z
    .any()
    .optional()
    .describe("Optional technical details about the error."),
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
  outputSchema: z.union([successSchema, errorSchema]),
  execute: async ({
    context,
  }): Promise<
    z.infer<typeof successSchema> | z.infer<typeof errorSchema>
  > => {
    if (!config.cmsUrl) {
      const errorMessage = "CMS URL is not configured.";
      logger.error(errorMessage);
      return {
        success: false,
        message: errorMessage,
      };
    }

    // Construct the request URL for the user permissions API endpoint.
    const url = new URL(
      `${config.cmsUrl}/api/user/permissions/${context.entity}/${context.objectId}`
    );

    // Create a FormData object to send the permission data.
    const formData = new FormData();
    context.groupIds.forEach((groupId) => {
      formData.append("groupIds[]", groupId);
    });
    // Optionally include the new owner's ID.
    if (context.ownerId)
      formData.append("ownerId", context.ownerId.toString());

    logger.info(`Setting user permissions at: ${url.toString()}`);

    // Perform the POST request to the Xibo CMS API.
    const response = await fetch(url.toString(), {
      method: "POST",
      headers: await getAuthHeaders(),
      body: formData,
    });

    // Handle non-successful HTTP responses.
    if (!response.ok) {
      const responseText = await response.text();
      const decodedText = decodeErrorMessage(responseText);
      const errorMessage = `Failed to set user permissions. API responded with status ${response.status}.`;
      logger.error(errorMessage, {
        status: response.status,
        response: decodedText,
      });
      return {
        success: false,
        message: `${errorMessage} Message: ${decodedText}`,
        error: {
          statusCode: response.status,
          responseBody: decodedText,
        },
      };
    }

    const successMessage = "User permissions set successfully";
    logger.info(successMessage);
    // Return a standard success response.
    return {
      success: true,
      message: successMessage,
    };
  },
});

export default setUserPermissions; 