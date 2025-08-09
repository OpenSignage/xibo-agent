/*
 * Copyright (C) 2025 Open Source Digital Signage Initiative.
 *
 * You can redistribute it and/or modify
 * it under the terms of the Elastic License 2.0 (ELv2) as published by
 * the Search AI Company, either version 3 of the License, or
 * any later version *
 * You should have received a copy of the GElastic License 2.0 (ELv2).
 * see <https://www.elastic.co/licensing/elastic-license>.
 */
import { createWorkflow, createStep } from '@mastra/core/workflows';
import { z } from 'zod';
import { webSearchTool } from '../../tools/market-research/webSearch';
import { contentScrapeTool } from '../../tools/market-research/contentScrape';
import { summarizeAndAnalyzeTool } from '../../tools/market-research/summarizeAndAnalyze';
import { logger } from '../../logger';
import { pdfScrapeTool } from '../../tools/market-research/pdfScrape';
import { saveReportTool } from '../../tools/util/saveReport';
import { getReportGenerationInstructions } from './reportInstructions';

// Create reusable workflow steps from tools
const searchStep = createStep(webSearchTool);
const summarizeStep = createStep(summarizeAndAnalyzeTool);
const saveReportStep = createStep(saveReportTool);

// --- Define schemas for workflow output ---
const successOutputSchema = z.object({
  success: z.literal(true),
  data: z.object({
    reportText: z.string().describe('The final, generated report content.'),
    filePath: z.string().describe('The absolute path to where the report was saved.'),
  }),
});
const errorOutputSchema = z.object({
  success: z.literal(false),
  message: z.string(),
  error: z.any().optional(),
});
const finalOutputSchema = z.union([successOutputSchema, errorOutputSchema]);


/**
 * @module marketResearchWorkflow
 * @description A workflow that automates the process of market research.
 */
export const marketResearchWorkflow = createWorkflow({
  id: 'market-research-workflow',
  description: 'A comprehensive workflow to search, scrape, analyze, generate a report, and save it to a file.',
  inputSchema: z.object({ 
    topic: z.string(),
    maxWebsites: z.number().optional().default(20).describe('Maximum number of websites to scrape (default: 20)')
  }),
  outputSchema: finalOutputSchema,
})
.then(createStep({
    id: 'prepare-search-query',
    inputSchema: z.object({ 
      topic: z.string(), 
      maxWebsites: z.number().optional().default(20) 
    }),
    outputSchema: z.object({ 
      query: z.string(), 
      topic: z.string(), 
      maxWebsites: z.number() 
    }),
    execute: async ({ inputData }) => {
      logger.info({ topic: inputData.topic }, 'Step 1: Preparing search query...');
      const lang = process.env.LANG || '';
      const suffix = lang.startsWith('ja') ? '市場 分析' : 'market analysis';
      const maxWebsites = inputData.maxWebsites ?? 20;
      return { query: `${inputData.topic} ${suffix}`, topic: inputData.topic, maxWebsites };
    },
}))
.then(createStep({
    id: 'execute-search',
    inputSchema: z.object({ 
      query: z.string(), 
      topic: z.string(), 
      maxWebsites: z.number() 
    }),
    outputSchema: z.object({
        results: z.array(z.object({ url: z.string(), title: z.string() })),
        topic: z.string(),
        searchSuccess: z.boolean(),
        maxWebsites: z.number(),
    }),
    execute: async (params) => {
        logger.info({ query: params.inputData.query }, 'Step 2: Executing web search...');
        const searchResults = await searchStep.execute({ 
          ...params, 
          inputData: { 
            query: params.inputData.query,
            maxResults: params.inputData.maxWebsites
          } 
        });
        if (!searchResults.success) {
            logger.error(`Web Search Tool Failed: ${searchResults.message}`);
            return { results: [], topic: params.inputData.topic, searchSuccess: false, maxWebsites: params.inputData.maxWebsites };
        }
        logger.info(`Step 2: Web search successful, found ${searchResults.data.results.length} results.`);
        return { ...searchResults.data, topic: params.inputData.topic, searchSuccess: true, maxWebsites: params.inputData.maxWebsites };
    },
}))
.then(createStep({
    id: 'scrape-content',
    inputSchema: z.object({
        results: z.array(z.object({ url: z.string(), title: z.string() })),
        topic: z.string(),
        searchSuccess: z.boolean(),
        maxWebsites: z.number(),
    }),
    outputSchema: z.object({
        scrapedData: z.array(z.object({
            url: z.string().url(),
            title: z.string(),
            content: z.string(),
        })),
        topic: z.string(),
    }),
    execute: async ({ inputData, runtimeContext }) => {
        if (!inputData.searchSuccess) {
            logger.warn('Skipping scrape due to search failure.');
            return { scrapedData: [], topic: inputData.topic };
        }
        const { results, topic, maxWebsites } = inputData;
        logger.info(`Step 3: Scraping up to ${maxWebsites} articles for topic "${topic}"...`);
        const topResults = results.slice(0, maxWebsites);
        const scrapedData: { url: string; title: string; content: string; }[] = [];

        for (const result of topResults) {
            const { url, title } = result;
            let scrapeResult;
            if (url.toLowerCase().endsWith('.pdf')) {
                scrapeResult = await pdfScrapeTool.execute({ context: { url }, runtimeContext });
            } else {
                scrapeResult = await contentScrapeTool.execute({ context: { url }, runtimeContext });
            }
            if (scrapeResult.success && scrapeResult.data.content.length > 100) {
                scrapedData.push({ url, title, content: scrapeResult.data.content });
            } else if (!scrapeResult.success) {
                logger.warn({ url, error: scrapeResult.message }, 'Skipping URL due to scraping failure.');
            }
        }
        logger.info(`Step 3: Finished scraping. Scraped ${scrapedData.length} articles.`);
        return { scrapedData, topic };
    },
}))
.then(createStep({
    id: 'generate-final-report',
    inputSchema: z.object({
        scrapedData: z.array(z.object({
            url: z.string().url(),
            title: z.string(),
            content: z.string(),
        })),
        topic: z.string(),
    }),
    outputSchema: z.object({
        reportText: z.string(),
        topic: z.string(),
    }),
    execute: async (params) => {
        const { scrapedData, topic } = params.inputData;
        
        if (scrapedData.length === 0) {
            logger.warn("No content to generate report from.");
            return { reportText: '', topic };
        }

        const textForReport = scrapedData
            .map(s => `Source URL: ${s.url}\nTitle: ${s.title}\nContent Summary:\n${s.content}`)
            .join('\n\n---\n\n');

        const finalObjective = getReportGenerationInstructions(topic);

        const finalReportResult = await summarizeStep.execute({ 
          ...params, 
          inputData: { 
            text: textForReport, 
            objective: finalObjective,
            temperature: 0.7, // Default temperature for consistent analysis
            topP: 0.9 // Default topP for focused analysis
          } 
        });

        if (!finalReportResult.success) {
            const message = `Failed to generate the final report. Reason: ${finalReportResult.message}`;
            logger.error(message, { error: finalReportResult });
            // Even on failure, return empty text to allow the workflow to proceed if needed
            return { reportText: `レポート生成に失敗しました: ${message}`, topic };
        }
        
        return { reportText: finalReportResult.data.summary, topic };
    },
}))
.then(createStep({
    id: 'save-report-to-file',
    inputSchema: z.object({
        reportText: z.string(),
        topic: z.string(),
    }),
    outputSchema: finalOutputSchema,
    execute: async (params) => {
        const { reportText, topic } = params.inputData;

        if (!reportText) {
            return { success: false, message: "レポートが空のため、ファイルに保存できませんでした。" } as const;
        }

        const saveResult = await saveReportStep.execute({ ...params, inputData: { title: topic, content: reportText } });

        if (!saveResult.success) {
            // If saving fails, still return the report text to the user.
            logger.error('Failed to save the report to a file.', { error: saveResult.message });
            return { success: false, message: `レポートのファイル保存に失敗しました: ${saveResult.message}` } as const;
        }

        return {
            success: true,
            data: {
                reportText,
                filePath: saveResult.data.filePath,
            },
        } as const;
    },
}))
.commit(); 