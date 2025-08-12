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
import fs from 'fs/promises';
import path from 'path';
import { contentScrapeTool } from '../../tools/market-research/contentScrape';
import { pdfScrapeTool } from '../../tools/market-research/pdfScrape';
import { powerpointExtractTool } from '../../tools/product-analysis';
import { summarizeAndAnalyzeTool } from '../../tools/market-research/summarizeAndAnalyze';

const finalOutputSchema = z.object({
  report: z.string().describe('The final analysis report.'),
  sources: z.array(z.string()).describe('List of sources used for the analysis.'),
});

/**
 * @module productAnalysisWorkflow
 * @description A workflow to analyze product information from a directory of files.
 */
export const productAnalysisWorkflow = createWorkflow({
  id: 'product-analysis-workflow',
  description: 'Analyzes product information from a directory of files (.pdf, .pptx, .txt with URLs).',
  inputSchema: z.object({
    directoryPath: z.string().describe('The path to the directory containing product information files.'),
    productName: z.string().describe('The name of the product or service being analyzed.'),
  }),
  outputSchema: finalOutputSchema,
})
.then(createStep({
  id: 'gather-files',
  inputSchema: z.object({ 
    directoryPath: z.string(),
    productName: z.string(),
  }),
  outputSchema: z.object({
    pdfFiles: z.array(z.string()),
    pptxFiles: z.array(z.string()),
    textFiles: z.array(z.string()),
    productName: z.string(),
  }),
  execute: async ({ inputData }) => {
    const { directoryPath, productName } = inputData;
    logger.info({ directoryPath }, 'Step 1: Gathering files from directory...');
    const allFiles = await fs.readdir(directoryPath, { recursive: true, withFileTypes: true });
    
    const pdfFiles = allFiles.filter(f => f.isFile() && f.name.endsWith('.pdf')).map(f => path.join(f.path, f.name));
    const pptxFiles = allFiles.filter(f => f.isFile() && f.name.endsWith('.pptx')).map(f => path.join(f.path, f.name));
    const textFiles = allFiles.filter(f => f.isFile() && f.name.endsWith('.txt')).map(f => path.join(f.path, f.name));

    logger.info({ pdfs: pdfFiles.length, pptx: pptxFiles.length, txt: textFiles.length }, 'Step 1: File gathering complete.');
    return { pdfFiles, pptxFiles, textFiles, productName };
  }
}))
.then(createStep({
  id: 'extract-content',
  inputSchema: z.object({
    pdfFiles: z.array(z.string()),
    pptxFiles: z.array(z.string()),
    textFiles: z.array(z.string()),
    productName: z.string(),
  }),
  outputSchema: z.object({
    extractedTexts: z.array(z.object({ source: z.string(), content: z.string() })),
    productName: z.string(),
  }),
  execute: async ({ inputData, runtimeContext }) => {
    const { pdfFiles, pptxFiles, textFiles, productName } = inputData;
    logger.info('Step 2: Extracting content from all files...');
    const promises = [];
    const sources: string[] = [];

    // PDF files
    for (const filePath of pdfFiles) {
      sources.push(filePath);
      promises.push(pdfScrapeTool.execute({ context: { url: `file://${filePath}` }, runtimeContext }));
    }

    // PowerPoint files
    for (const filePath of pptxFiles) {
      sources.push(filePath);
      promises.push(powerpointExtractTool.execute({ context: { filePath }, runtimeContext }));
    }

    // Text files (containing URLs)
    for (const filePath of textFiles) {
        try {
            const fileContent = await fs.readFile(filePath, 'utf-8');
            const urls = fileContent.split(/\r?\n/).filter(line => line.startsWith('http'));
            for (const url of urls) {
                sources.push(url);
                promises.push(contentScrapeTool.execute({ context: { url }, runtimeContext }));
            }
        } catch (error) {
            logger.warn({ filePath, error }, `Failed to read or process text file.`);
        }
    }

    const results = await Promise.allSettled(promises);
    const extractedTexts = results
      .map((result, index) => {
        if (result.status === 'fulfilled' && result.value.success) {
          return { source: sources[index], content: result.value.data.content };
        }
        const reason = result.status === 'rejected' ? result.reason : (result.value as { message: string }).message;
        logger.warn({ source: sources[index], reason }, 'Failed to extract content from a source.');
        return null;
      })
      .filter((item): item is { source: string; content: string } => item !== null && item.content.length > 0);

    logger.info(`Step 2: Content extraction complete. Extracted from ${extractedTexts.length} sources.`);
    return { extractedTexts, productName };
  }
}))
.then(createStep({
  id: 'generate-analysis-report',
  inputSchema: z.object({
    productName: z.string(),
    extractedTexts: z.array(z.object({ source: z.string(), content: z.string() })),
  }),
  outputSchema: finalOutputSchema,
  execute: async (params) => {
    const { productName, extractedTexts } = params.inputData;
    const { runtimeContext } = params;
    logger.info(`Step 3: Generating analysis report for ${productName}...`);

    if (extractedTexts.length === 0) {
      logger.warn('No content to generate report from.');
      return { report: '分析に必要な情報をファイルから抽出できませんでした。', sources: [] };
    }

    const combinedText = extractedTexts
      .map(t => `Source: ${t.source}\nContent:\n${t.content}`)
      .join('\n\n---\n\n');

    const sources = extractedTexts.map(t => t.source);

    const objective = `以下の情報に基づき、製品「${productName}」に関する包括的な分析レポートを作成してください。
レポートには、以下の点を必ず含めてください。

- **製品概要**: この製品が何であり、どのような問題を解決するのか。
- **主な機能と特徴**: 製品の主要な機能や特筆すべき点をリストアップしてください。
- **強み (Strengths)**: 競合と比較した際の明確な利点は何か。
- **弱み (Weaknesses)**: 製品が抱える課題や改善点は何か。
- **ターゲット顧客層**: この製品はどのような顧客（企業、個人、特定の職種など）を対象としているか。
- **総括**: 全体をまとめた結論。`;

    const reportResult = await summarizeAndAnalyzeTool.execute({ 
      context: { 
        text: combinedText, 
        objective,
        temperature: 0.7, // Default temperature for balanced creativity
        topP: 0.9,        // Default nucleus sampling for focused output
      }, 
      runtimeContext 
    });

    if (!reportResult.success) {
      const message = `Failed to generate the final report. Reason: ${reportResult.message}`;
      logger.error(message, { error: reportResult });
      return { report: `レポート生成に失敗しました: ${message}`, sources };
    }

    logger.info('Step 3: Report generation complete.');
    return { report: reportResult.data.summary, sources };
  }
}))
.commit(); 