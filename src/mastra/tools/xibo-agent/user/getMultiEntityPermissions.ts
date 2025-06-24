import { z } from "zod";
import { createTool } from "@mastra/core/tools";
import { config } from "../config";
import { getAuthHeaders } from "../auth";
import { logger } from "../../../index";
import { decodeErrorMessage } from "../utility/error";

const permissionSchema = z.object({
  groupId: z.number(),
  group: z.string(),
  view: z.number(),
  edit: z.number(),
  delete: z.number(),
});

const successSchema = z.object({
  success: z.literal(true),
  data: z.array(permissionSchema),
});

const errorSchema = z.object({
  success: z.literal(false),
  message: z.string().describe("A human-readable error message."),
  error: z
    .any()
    .optional()
    .describe("Optional technical details about the error."),
});

export const getMultiEntityPermissions = createTool({
  id: "get-multi-entity-permissions",
  description: "Gets permissions for multiple entities.",
  inputSchema: z.object({
    entity: z.string(),
    ids: z.string(),
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
      `${config.cmsUrl}/api/user/permissions/${context.entity}`
    );
    url.searchParams.append("ids", context.ids);

    logger.info(`Requesting multi-entity permissions from: ${url.toString()}`);

    const response = await fetch(url.toString(), {
      method: "GET",
      headers: await getAuthHeaders(),
    });

    const responseText = await response.text();
    let responseData: any;

    try {
      responseData = JSON.parse(responseText);
    } catch (e) {
      responseData = responseText;
    }

    if (!response.ok) {
      const decodedText = decodeErrorMessage(responseText);
      const errorMessage = `Failed to get multi-entity permissions. API responded with status ${response.status}.`;
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

    const validationResult = successSchema.safeParse({
      success: true, // Assuming success if response is ok
      data: responseData,
    });

    if (!validationResult.success) {
      const errorMessage =
        "Multi-entity permissions response validation failed.";
      logger.error(errorMessage, {
        error: validationResult.error.issues,
        data: responseData,
      });
      return {
        success: false,
        message: errorMessage,
        error: {
          validationIssues: validationResult.error.issues,
          receivedData: responseData,
        },
      };
    }

    logger.info("Multi-entity permissions retrieved successfully");
    return validationResult.data;
  },
});

export default getMultiEntityPermissions; 