/*
 * Copyright (C) 2025 Open Source Digital Signage Initiative.
 *
 * You can redistribute it and/or modify
 * it under the terms of the Elastic License 2.0 (ELv2) as published by
 * the Search AI Company, either version 3 of the License, or
 * any later version.
 *
 * You should have received a copy of the GElastic License 2.0 (ELv2).
 * see <https://www.elastic.co/licensing/elastic-license>.
 */
import { createWorkflow, createStep } from '@mastra/core/workflows';
import { z } from 'zod';
import { logger } from '../../logger';
import { promises as fs } from 'fs';
import path from 'path';
import { config } from '../../tools/xibo-agent/config';
import { createPowerpointTool } from '../../tools/presenter/createPowerpoint';

const successOutputSchema = z.object({
  success: z.literal(true),
  data: z.object({ fileName: z.string() })
});
const errorOutputSchema = z.object({ success: z.literal(false), message: z.string() });
const finalOutputSchema = z.union([successOutputSchema, errorOutputSchema]);

/**
 * @workflow presenter-recipe-to-pptx
 * 読み込んだレシピ(JSON)のスライド配列をそのままPPTXに組み立てるシンプルなテスト用ワークフロー。
 * 本番のアセンブルと同じ `createPowerpointTool` を使用します（AI処理なし）。
 */
export const recipeToPptxWorkflow = createWorkflow({
  id: 'presenter-recipe-to-pptx',
  description: 'Load a prepared slides recipe JSON and build a PPTX (no AI).',
  inputSchema: z.object({
    recipeFileName: z.string().describe('File under persistent_data/presentations/recipes'),
    fileNameBase: z.string().describe('Base name for output PPTX'),
    templateName: z.string().optional().describe('Template JSON filename under persistent_data/presentations/templates (default: default.json)'),
  }),
  outputSchema: finalOutputSchema,
})
.then(createStep({
  id: 'read-recipe-json',
  inputSchema: z.object({
    recipeFileName: z.string(),
    fileNameBase: z.string(),
    templateName: z.string().optional(),
  }),
  outputSchema: z.object({
    slides: z.array(z.any()),
    fileNameBase: z.string(),
    templateConfig: z.any().optional(),
    themeColor1: z.string().optional(),
    themeColor2: z.string().optional(),
  }),
  execute: async (params) => {
    const { recipeFileName, fileNameBase } = params.inputData;
    const recipePath = path.join(config.projectRoot, 'persistent_data', 'presentations', 'recipes', recipeFileName);
logger.debug({ recipePath }, 'Reading slides recipe JSON');
    let json: any;
    try {
      const raw = await fs.readFile(recipePath, 'utf-8');
      json = JSON.parse(raw);
    } catch (e) {
      const message = `Failed to read recipe file: ${recipePath}`;
      logger.error({ e }, message);
      return { slides: [], fileNameBase } as any;
    }
    const slides: any[] = Array.isArray(json?.slides) ? json.slides : [];
    const themeColor1: string | undefined = typeof json?.themeColor1 === 'string' ? json.themeColor1 : undefined;
    const themeColor2: string | undefined = typeof json?.themeColor2 === 'string' ? json.themeColor2 : undefined;
    // Load template with default layering (default.json as base, then override by selected template)
    let templateConfig: any = undefined;
    const tplName = (params.inputData as any).templateName || 'default.json';
    const tplDir = path.join(config.projectRoot, 'persistent_data', 'presentations', 'templates');
    const deepMerge = (base: any, override: any): any => {
      if (Array.isArray(base) && Array.isArray(override)) return override.slice();
      if (base && typeof base === 'object' && override && typeof override === 'object') {
        const out: any = { ...base };
        for (const k of Object.keys(override)) {
          out[k] = deepMerge(base[k], override[k]);
        }
        return out;
      }
      return override !== undefined ? override : base;
    };
    try {
      const baseRaw = await fs.readFile(path.join(tplDir, 'default.json'), 'utf-8');
      const baseTpl = JSON.parse(baseRaw);
      if (tplName && tplName !== 'default.json') {
        try {
          const selRaw = await fs.readFile(path.join(tplDir, tplName), 'utf-8');
          const selTpl = JSON.parse(selRaw);
          templateConfig = deepMerge(baseTpl, selTpl);
        } catch {
          templateConfig = baseTpl;
        }
      } else {
        templateConfig = baseTpl;
      }
    } catch {}
    return { slides, fileNameBase, templateConfig, themeColor1, themeColor2 } as any;
  },
}))
.then(createStep({
  id: 'assemble-pptx',
  inputSchema: z.object({
    slides: z.array(z.any()),
    fileNameBase: z.string(),
    templateConfig: z.any().optional(),
    themeColor1: z.string().optional(),
    themeColor2: z.string().optional(),
  }),
  outputSchema: finalOutputSchema,
  execute: async (params) => {
    const { slides, fileNameBase, templateConfig, themeColor1, themeColor2 } = params.inputData as any;
    if (!Array.isArray(slides) || !slides.length) {
      return { success: false, message: 'Recipe JSON has no slides[]' } as const;
    }
    const res = await createPowerpointTool.execute({ ...params, context: {
      fileName: fileNameBase,
      slides,
      templateConfig,
      themeColor1,
      themeColor2,
    }});
    
    if (!res.success) {
      return { success: false, message: `PPTX create failed: ${res.message}` } as const;
    }
    const fileName = path.parse(res.data.filePath).base;
    return { success: true, data: { fileName } } as const;
  },
}))
.commit();

