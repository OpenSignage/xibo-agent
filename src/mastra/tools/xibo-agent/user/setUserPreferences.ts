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

export const setUserPreferences = createTool({
  id: "set-user-preferences",
  description: "Sets user preferences.",
  inputSchema: z.object({
    preferences: z.array(userOptionSchema),
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

    logger.info(`Setting user preferences at: ${url.toString()}`);

    const response = await fetch(url.toString(), {
      method: "POST",
      headers: {
        ...(await getAuthHeaders()),
        "Content-Type": "application/json",
      },
      body: JSON.stringify(context.preferences),
    });

    if (!response.ok) {
      const responseText = await response.text();
      const decodedText = decodeErrorMessage(responseText);
      const errorMessage = `Failed to set user preferences. API responded with status ${response.status}.`;
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

    const successMessage = "User preferences set successfully";
    logger.info(successMessage);
    return {
      success: true,
      message: successMessage,
    };
  },
});

export default setUserPreferences; 