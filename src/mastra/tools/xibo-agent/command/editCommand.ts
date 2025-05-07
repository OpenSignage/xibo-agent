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
  data: commandSchema,
});

export const editCommand = createTool({
  id: "edit-command",
  description: "コマンドを編集",
  inputSchema: z.object({
    commandId: z.number(),
    command: z.string(),
    description: z.string().optional(),
    commandString: z.string().optional(),
    validationString: z.string().optional(),
    availableOn: z.string().optional(),
    createAlertOn: z.enum(["success", "failure", "always", "never"]).optional(),
  }),
  outputSchema: apiResponseSchema,
  execute: async ({ context }) => {
    if (!config.cmsUrl) {
      throw new Error("CMS URL is not set");
    }

    const url = new URL(`${config.cmsUrl}/command/${context.commandId}`);
    
    // フォームデータの作成
    const formData = new FormData();
    formData.append("command", context.command);
    if (context.description) formData.append("description", context.description);
    if (context.commandString) formData.append("commandString", context.commandString);
    if (context.validationString) formData.append("validationString", context.validationString);
    if (context.availableOn) formData.append("availableOn", context.availableOn);
    if (context.createAlertOn) formData.append("createAlertOn", context.createAlertOn);

    console.log(`Requesting URL: ${url.toString()}`);

    const response = await fetch(url.toString(), {
      method: "PUT",
      headers: await getAuthHeaders(),
      body: formData,
    });

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    const rawData = await response.json();
    const validatedData = apiResponseSchema.parse(rawData);
    console.log("Command edited successfully");
    return validatedData;
  },
});

export default editCommand; 