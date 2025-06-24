import { z } from "zod";
import { createTool } from "@mastra/core/tools";
import { config } from "../config";
import { getAuthHeaders } from "../auth";
import { logger } from "../../../index";
import { decodeErrorMessage } from "../utility/error";

const userOptionSchema = z.object({
  option: z.string(),
  value: z.string(),
});

const successSchema = z.object({
  success: z.literal(true),
  data: z.array(userOptionSchema),
});

const errorSchema = z.object({
  success: z.literal(false),
  message: z.string().describe("A human-readable error message."),
  error: z
    .any()
    .optional()
    .describe("Optional technical details about the error."),
});

export const getUserPreferences = createTool({
  id: "get-user-preferences",
  description: "Gets user preferences.",
  inputSchema: z.object({
    preference: z.string().optional(),
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

    const url = new URL(`${config.cmsUrl}/api/user/pref`);
    if (context.preference)
      url.searchParams.append("preference", context.preference);

    logger.info(`Requesting user preferences from: ${url.toString()}`);

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
      const errorMessage = `Failed to get user preferences. API responded with status ${response.status}.`;
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

    const validationResult = z.array(userOptionSchema).safeParse(responseData);

    if (!validationResult.success) {
      const errorMessage = "User preferences response validation failed.";
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
    logger.info("User preferences retrieved successfully");
    return {
      success: true,
      data: validationResult.data,
    };
  },
});

export default getUserPreferences; 