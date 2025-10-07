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
    summarizedText: z.string().describe('A short summary of the generated report suitable for final reply.'),
    mdFileName: z.string().describe('The saved report file name (e.g., "xxxx.md").'),
    pdfFileName: z.string().describe('The saved PDF file name (e.g., "xxxx.pdf").'),
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
  description: 'Automated market research workflow. Given a topic, it performs web search, fetches top sources (including PDFs), then summarizes and analyzes the content to produce a marketing-oriented report in Markdown. The full report is saved to persistent_data/generated/reports as <title-YYYY-MM-DD>.md (and PDF). The workflow returns a short summarizedText along with saved file names (mdFileName, pdfFileName). Artifacts can be downloaded via /ext-api/download/report/:fileName. Use maxWebsites to control how many sources are processed.',
  inputSchema: z.object({ 
    topic: z.string().describe('Topic to research (keyword)'),
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
      logger.info({ topic: inputData.topic }, 'Preparing search query');
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
        logger.info({ query: params.inputData.query }, 'Executing web search');
        const searchResults = await searchStep.execute({ 
          ...params, 
          inputData: { 
            query: params.inputData.query,
            maxResults: params.inputData.maxWebsites
          } 
        });
        if (!searchResults.success) {
            logger.error({ message: searchResults.message }, 'Web search failed');
            return { results: [], topic: params.inputData.topic, searchSuccess: false, maxWebsites: params.inputData.maxWebsites };
        }
        logger.info({ count: searchResults.data.results.length }, 'Web search completed');
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
            logger.warn('Skipping scrape due to search failure');
            return { scrapedData: [], topic: inputData.topic };
        }
        const { results, topic, maxWebsites } = inputData;
        logger.info({ topic, maxWebsites }, 'Starting content scrape');
        const topResults = results.slice(0, maxWebsites);
        const scrapedData: { url: string; title: string; content: string; }[] = [];

        // Helper: sleep with jitter
        const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

        // Retry with exponential backoff and jitter
        const attemptScrape = async (url: string, title: string) => {
            const maxRetries = 2; // retry up to 2 times (total attempts = 3)
            const baseDelayMs = 500;
            for (let attempt = 0; attempt <= maxRetries; attempt++) {
                try {
                    // polite small jitter before each attempt
                    await sleep(100 + Math.floor(Math.random() * 150));
                    const isPdf = url.toLowerCase().endsWith('.pdf');
                    const res = isPdf
                        ? await pdfScrapeTool.execute({ context: { url }, runtimeContext })
                        : await contentScrapeTool.execute({ context: { url }, runtimeContext });
                    if (!res.success) {
                        throw new Error(res.message || 'Scrape failed');
                    }
                    const content = res.data.content || '';
                    if (content.length <= 100) {
                        throw new Error('Content too short');
                    }
                    return { url, title, content };
                } catch (err) {
                    if (attempt === maxRetries) throw err;
                    const backoff = baseDelayMs * Math.pow(2, attempt) + Math.floor(Math.random() * 200);
                    logger.warn({ url, attempt, backoff }, 'Scrape failed, retrying');
                    await sleep(backoff);
                }
            }
            // Should not reach here
            throw new Error('Unexpected retry loop exit');
        };

        // Concurrency-limited execution (p-limit equivalent with chunking)
        const concurrency = 2;
        for (let i = 0; i < topResults.length; i += concurrency) {
            const batch = topResults.slice(i, i + concurrency);
            const promises = batch.map(({ url, title }) => attemptScrape(url, title));
            const settled = await Promise.allSettled(promises);
            for (const s of settled) {
                if (s.status === 'fulfilled') {
                    scrapedData.push(s.value);
                } else {
                    logger.warn({ error: s.reason instanceof Error ? s.reason.message : String(s.reason) }, 'Skipping URL due to scraping failure');
                }
            }
        }
        logger.info({ scrapedCount: scrapedData.length }, 'Content scrape finished');
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
            logger.warn('No content to generate report from');
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
            logger.error({ reason: finalReportResult.message }, 'Failed to generate the final report');
            // Even on failure, return empty text to allow the workflow to proceed if needed
            return { reportText: `レポート生成に失敗しました: ${finalReportResult.message}`, topic };
        }
        logger.info({ length: (finalReportResult.data.summary || '').length }, 'Report text generated');
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
            logger.warn('Report text empty; skipping save');
            return { success: false, message: 'レポートが空のため、ファイルに保存できませんでした。' } as const;
        }

        // Save full report as before
        const saveResult = await saveReportStep.execute({ ...params, inputData: { title: topic, content: reportText } });

        if (!saveResult.success) {
            logger.error({ error: saveResult.message }, 'Failed to save report files');
            return { success: false, message: `レポートのファイル保存に失敗しました: ${saveResult.message}` } as const;
        }

        // Generate a short summary for final reply
        let summarizedText = '';
        try {
            // Reduce request frequency between two Gemini calls
            const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));
            await sleep(3000);
            const summaryRes = await summarizeStep.execute({
              ...params,
              inputData: {
                text: reportText,
                objective: '次のレポート本文をMarkdownで要約してください。出力は次の形式のみ: "## 要約" の見出しの下に、箇条書きで3–5項目。各項目は1行、冗長な前置き・結論・補足は禁止。重要な数値・固有名詞は保持。',
                temperature: 0.3,
                topP: 0.9,
              },
            });
            if (summaryRes.success) {
              summarizedText = summaryRes.data.summary;
            } else {
              summarizedText = reportText.slice(0, 500);
            }
        } catch {
            summarizedText = reportText.slice(0, 500);
        }

        logger.info({ mdFileName: require('path').basename(saveResult.data.filePath), pdfFileName: (saveResult.data.pdfFileName) }, 'Report files saved');
        return {
            success: true,
            data: {
                summarizedText,
                mdFileName: require('path').basename(saveResult.data.filePath),
                pdfFileName: (saveResult.data.pdfFileName),
            },
        } as const;
    },
}))
.commit(); 