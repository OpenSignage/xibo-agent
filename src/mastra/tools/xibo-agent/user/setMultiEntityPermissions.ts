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

export const setMultiEntityPermissions = createTool({
  id: "set-multi-entity-permissions",
  description: "Sets permissions for multiple entities.",
  inputSchema: z.object({
    entity: z.string(),
    ids: z.array(z.number()),
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

    const url = new URL(
      `${config.cmsUrl}/api/user/permissions/${context.entity}/multiple`
    );

    // フォームデータの作成
    const formData = new FormData();
    context.ids.forEach((id) => {
      formData.append("ids[]", id.toString());
    });
    context.groupIds.forEach((groupId) => {
      formData.append("groupIds[]", groupId);
    });
    if (context.ownerId)
      formData.append("ownerId", context.ownerId.toString());

    logger.info(`Setting multi-entity permissions at: ${url.toString()}`);

    const response = await fetch(url.toString(), {
      method: "POST",
      headers: await getAuthHeaders(),
      body: formData,
    });

    if (!response.ok) {
      const responseText = await response.text();
      const decodedText = decodeErrorMessage(responseText);
      const errorMessage = `Failed to set multi-entity permissions. API responded with status ${response.status}.`;
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

    const successMessage = "Multi-entity permissions set successfully";
    logger.info(successMessage);
    return {
      success: true,
      message: successMessage,
    };
  },
});

export default setMultiEntityPermissions; 