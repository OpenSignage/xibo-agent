/*
 * Copyright (C) 2025 Open Source Digital Signage Initiative.
 *
 * Elastic License 2.0 (ELv2)
 */
import { createWorkflow, createStep } from '@mastra/core/workflows';
import { z } from 'zod';
import path from 'path';
import { promises as fs } from 'fs';
import { config } from '../../tools/xibo-agent/config';
import { logger } from '../../logger';

/**
 * @workflow presenter-md-to-recipe
 * 指定されたMarkdown(.md)ファイルからプレゼンレシピ(JSON)を生成します。
 * - 仕様: シンプルな見出し/段落/箇条書きを slides[] にマップ
 * - 入力: mdFileName (persistent_data/generated/reports 下のファイル名)
 * - 出力: recipeFileName (persistent_data/presentations/recipes 下に保存)
 */
export const mdToRecipeWorkflow = createWorkflow({
  id: 'presenter-md-to-recipe',
  description: 'Convert Markdown report to presentation recipe JSON.',
  inputSchema: z.object({
    mdFileName: z.string().describe('File name under persistent_data/generated/reports (e.g., report.md)'),
    recipeFileName: z.string().optional().describe('Output file name under persistent_data/presentations/recipes'),
  }),
  outputSchema: z.object({ success: z.literal(true), data: z.object({ recipeFileName: z.string() }) }).or(z.object({ success: z.literal(false), message: z.string() })),
})
.then(createStep({
  id: 'read-markdown',
  inputSchema: z.object({ mdFileName: z.string(), recipeFileName: z.string().optional() }),
  outputSchema: z.object({ mdContent: z.string(), recipeFileName: z.string().optional() }),
  execute: async ({ inputData }) => {
    try {
      const reportsDir = path.join(config.projectRoot, 'persistent_data', 'generated', 'reports');
      const mdPath = path.join(reportsDir, inputData.mdFileName);
      const mdContent = await fs.readFile(mdPath, 'utf-8');
      return { mdContent, recipeFileName: inputData.recipeFileName };
    } catch (e) {
      logger.error({ e }, 'mdToRecipe: failed to read md file');
      return { mdContent: '', recipeFileName: inputData.recipeFileName };
    }
  },
}))
.then(createStep({
  id: 'convert-to-recipe',
  inputSchema: z.object({ mdContent: z.string(), recipeFileName: z.string().optional() }),
  outputSchema: z.object({ slides: z.array(z.any()), recipeFileName: z.string().optional() }),
  execute: async ({ inputData }) => {
    const lines = inputData.mdContent.split(/\r?\n/);
    type Slide = { title: string; bullets: string[]; notes?: string; layout?: string; visual_recipe?: any };
    const slides: Slide[] = [];
    let current: Slide | null = null;

    const pushCurrent = () => { if (current) { slides.push(current); current = null; } };
    for (const raw of lines) {
      const line = raw.trim();
      if (!line) continue;
      const h = line.match(/^(#{1,3})\s+(.*)$/);
      if (h) {
        pushCurrent();
        current = { title: h[2].trim(), bullets: [] };
        continue;
      }
      const li = line.match(/^[-*]\s+(.+)$/);
      if (li) {
        if (!current) current = { title: 'スライド', bullets: [] };
        current.bullets.push(li[1].trim());
        continue;
      }
      // paragraph → notes として格納
      if (!current) current = { title: 'スライド', bullets: [] };
      current.notes = (current.notes ? current.notes + '\n' : '') + line;
    }
    pushCurrent();

    // フォールバック: スライドがない場合は1枚作る
    if (slides.length === 0) slides.push({ title: '概要', bullets: [] });
    return { slides, recipeFileName: inputData.recipeFileName };
  },
}))
.then(createStep({
  id: 'write-recipe',
  inputSchema: z.object({ slides: z.array(z.any()), recipeFileName: z.string().optional() }),
  outputSchema: z.object({ success: z.boolean(), recipeFileName: z.string().optional(), message: z.string().optional() }),
  execute: async ({ inputData }) => {
    try {
      const recipesDir = path.join(config.projectRoot, 'persistent_data', 'presentations', 'recipes');
      await fs.mkdir(recipesDir, { recursive: true });
      const outName = inputData.recipeFileName || `recipe-${Date.now()}.json`;
      const outPath = path.join(recipesDir, outName);
      const recipe = { themeColor1: '#26A69A', themeColor2: '#8BC34A', slides: inputData.slides };
      await fs.writeFile(outPath, JSON.stringify(recipe, null, 2), 'utf-8');
      return { success: true, recipeFileName: outName } as const;
    } catch (e) {
      logger.error({ e }, 'mdToRecipe: failed to write recipe json');
      return { success: false, message: 'Failed to write recipe JSON' } as const;
    }
  },
}))
.commit();

