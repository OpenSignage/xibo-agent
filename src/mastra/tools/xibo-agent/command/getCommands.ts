import { z } from "zod";
import { createTool } from "@mastra/core/tools";
import { config } from "../config";
import { getAuthHeaders } from "../utils/auth";

const commandSchema = z.object({
  commandId: z.number(),
  command: z.string(),
  code: z.string(),
  description: z.string().nullable(),
  userId: z.number(),
  commandString: z.string().nullable(),
  validationString: z.string().nullable(),
  displayProfileId: z.number().nullable(),
  commandStringDisplayProfile: z.string().nullable(),
  validationStringDisplayProfile: z.string().nullable(),
  availableOn: z.string().nullable(),
  createAlertOn: z.string().nullable(),
});

const apiResponseSchema = z.object({
  success: z.boolean(),
  data: z.array(commandSchema),
});

export const getCommands = createTool({
  id: "get-commands",
  description: "コマンドを検索",
  inputSchema: z.object({
    commandId: z.number().optional(),
    command: z.string().optional(),
    code: z.string().optional(),
    useRegexForName: z.number().optional(),
    useRegexForCode: z.number().optional(),
    logicalOperatorName: z.enum(["AND", "OR"]).optional(),
    logicalOperatorCode: z.enum(["AND", "OR"]).optional(),
  }),
  outputSchema: apiResponseSchema,
  execute: async ({ context }) => {
    if (!config.cmsUrl) {
      throw new Error("CMS URL is not set");
    }

    const url = new URL(`${config.cmsUrl}/command`);
    
    // クエリパラメータの追加
    if (context.commandId) url.searchParams.append("commandId", context.commandId.toString());
    if (context.command) url.searchParams.append("command", context.command);
    if (context.code) url.searchParams.append("code", context.code);
    if (context.useRegexForName) url.searchParams.append("useRegexForName", context.useRegexForName.toString());
    if (context.useRegexForCode) url.searchParams.append("useRegexForCode", context.useRegexForCode.toString());
    if (context.logicalOperatorName) url.searchParams.append("logicalOperatorName", context.logicalOperatorName);
    if (context.logicalOperatorCode) url.searchParams.append("logicalOperatorCode", context.logicalOperatorCode);

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
    console.log("Commands retrieved successfully");
    return validatedData;
  },
});

export default getCommands; 