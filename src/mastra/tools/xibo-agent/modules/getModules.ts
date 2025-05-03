import { z } from "zod";
import { createTool } from '@mastra/core/tools';
import { config } from "../config";
import { getAuthHeaders } from "../auth";

const propertySchema = z.object({
  id: z.string(),
  type: z.string(),
  title: z.string().nullable(),
  helpText: z.string().nullable(),
  default: z.union([z.string(), z.number(), z.null()]),
});

const moduleResponseSchema = z.array(z.object({
  moduleId: z.union([z.number(), z.string().transform(Number)]),
  name: z.string().nullable(),
  author: z.string().nullable(),
  description: z.string().nullable(),
  icon: z.string().nullable(),
  type: z.string().nullable(),
  legacyTypes: z.union([z.array(z.string()), z.array(z.object({}))]),
  dataType: z.string().nullable(),
  group: z.union([z.array(z.string()), z.object({})]),
  dataCacheKey: z.string().nullable(),
  fallbackData: z.union([z.number(), z.string().transform(Number)]),
  regionSpecific: z.union([z.number(), z.string().transform(Number)]),
  schemaVersion: z.union([z.number(), z.string().transform(Number)]),
  compatibilityClass: z.string().nullable(),
  showIn: z.string().nullable(),
  assignable: z.union([z.number(), z.string().transform(Number)]),
  hasThumbnail: z.union([z.number(), z.string().transform(Number)]),
  thumbnail: z.string().nullable(),
  startWidth: z.union([z.number(), z.string().transform(Number)]).nullable(),
  startHeight: z.union([z.number(), z.string().transform(Number)]).nullable(),
  renderAs: z.string().nullable(),
  class: z.string().nullable(),
  validatorClass: z.array(z.string()),
  preview: z.any().nullable(),
  stencil: z.any().nullable(),
  properties: z.array(propertySchema),
  assets: z.any().nullable(),
  onInitialize: z.string().nullable(),
  onParseData: z.string().nullable(),
  onDataLoad: z.string().nullable(),
  onRender: z.string().nullable(),
  onVisible: z.string().nullable(),
  sampleData: z.union([z.string(), z.array(z.any()), z.null()]),
  enabled: z.union([z.number(), z.string().transform(Number)]),
  previewEnabled: z.union([z.number(), z.string().transform(Number)]),
  defaultDuration: z.union([z.number(), z.string().transform(Number)]),
  settings: z.array(propertySchema),
  propertyGroups: z.array(z.string()),
  requiredElements: z.array(z.string()),
  isInstalled: z.boolean(),
  isError: z.boolean(),
  errors: z.array(z.string()),
  allowPreview: z.union([z.number(), z.string().transform(Number)]).nullable(),
}));

export const getModules = createTool({
  id: 'get-modules',
  description: 'Xiboのモジュールを取得します  ',
  inputSchema: z.object({
    _placeholder: z.string().optional().describe('このツールは入力パラメータを必要としません')
  }),
  outputSchema: z.string(),
  execute: async ({ context }) => {
    try {
      if (!config.cmsUrl) {
        throw new Error("CMSのURLが設定されていません");
      }

      const headers = await getAuthHeaders();
      const response = await fetch(`${config.cmsUrl}/api/module`, {
        headers,
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const data = await response.json();
      const validatedData = moduleResponseSchema.parse(data);

      return JSON.stringify(validatedData, null, 2);
    } catch (error) {
      return `エラーが発生しました: ${error instanceof Error ? error.message : "不明なエラー"}`;
    }
  },
});