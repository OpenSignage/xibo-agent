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
import { pdfScrapeTool } from '../../tools/market-research/pdfScrape'; // Import the new tool

// Create workflow steps from existing tools for reuse
const searchStep = createStep(webSearchTool);
const summarizeStep = createStep(summarizeAndAnalyzeTool);

// --- Define schemas for workflow output, aligned with tool standards ---
const successOutputSchema = z.object({
  success: z.literal(true),
  data: z.object({
    report: z.string().describe('The final, consolidated research report.'),
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
  description: 'A comprehensive workflow to search, scrape, and analyze information to produce a report.',
  inputSchema: z.object({ topic: z.string() }),
  outputSchema: finalOutputSchema, // Use the new structured output schema
})
.then(createStep({
    id: 'prepare-search-query',
    inputSchema: z.object({ topic: z.string() }),
    outputSchema: z.object({ query: z.string(), topic: z.string() }),
    execute: async ({ inputData }) => {
      logger.info({ topic: inputData.topic }, 'Step 1: Preparing search query...');
      const lang = process.env.LANG || '';
      const suffix = lang.startsWith('ja') ? '市場 分析' : 'market analysis';
      return { query: `${inputData.topic} ${suffix}`, topic: inputData.topic };
    },
}))
.then(createStep({
    id: 'execute-search',
    inputSchema: z.object({ query: z.string(), topic: z.string() }),
    outputSchema: z.object({
        results: z.array(z.object({ url: z.string() })),
        topic: z.string(),
        // Add a flag to indicate search success or failure
        searchSuccess: z.boolean(),
    }),
    execute: async (params) => {
        logger.info({ query: params.inputData.query }, 'Step 2: Executing web search...');
        const searchResults = await searchStep.execute({ ...params, inputData: { query: params.inputData.query } });
        if (!searchResults.success) {
            logger.error(`Web Search Tool Failed: ${searchResults.message}`);
            // On failure, return empty results and a 'false' flag
            return { results: [], topic: params.inputData.topic, searchSuccess: false };
        }
        logger.info(`Step 2: Web search successful, found ${searchResults.data.results.length} results.`);
        return { ...searchResults.data, topic: params.inputData.topic, searchSuccess: true };
    },
}))
.then(createStep({
    id: 'scrape-and-summarize',
    inputSchema: z.object({
        results: z.array(z.object({ url: z.string() })),
        topic: z.string(),
        searchSuccess: z.boolean(),
    }),
    outputSchema: z.object({
        summaries: z.array(z.string()),
        topic: z.string(),
    }),
    execute: async ({ inputData, runtimeContext }) => {
        // If the previous step failed, do nothing and return empty summaries.
        if (!inputData.searchSuccess) {
            logger.warn('Skipping scrape and summarize due to search failure.');
            return { summaries: [], topic: inputData.topic };
        }

        const { results, topic } = inputData;
        logger.info(`Step 3: Scraping and summarizing up to 10 articles for topic "${topic}"...`);
        const topUrls = results.slice(0, 10).map((r) => r.url);
        const summaries: string[] = [];

        // Determine the summary language from the LANG environment variable.
        const lang = process.env.LANG || '';
        const summaryObjective = lang.startsWith('ja')
            ? `この記事の要点を日本語で要約してください。`
            : `Summarize the key findings of this article.`;

        for (const url of topUrls) {
            let scrapeResult;
            // Check if the URL is a PDF and call the appropriate tool
            if (url.toLowerCase().endsWith('.pdf')) {
                scrapeResult = await pdfScrapeTool.execute({ context: { url }, runtimeContext });
            } else {
                scrapeResult = await contentScrapeTool.execute({ context: { url }, runtimeContext });
            }

            if (scrapeResult.success && scrapeResult.data.content.length > 100) {
                // Since summarize tool also returns structured response, handle it
                const summaryResult = await summarizeAndAnalyzeTool.execute({
                    context: { text: scrapeResult.data.content, objective: summaryObjective },
                    runtimeContext,
                });
                 if(summaryResult.success) {
                    summaries.push(`Source: ${url}\nSummary:\n${summaryResult.data.summary}\n---`);
                 }
            } else if (!scrapeResult.success) {
                logger.warn({ url, error: scrapeResult.message }, 'Skipping URL due to scraping failure.');
            }
        }
        logger.info(`Step 3: Finished scraping. Generated ${summaries.length} summaries.`);
        return { summaries, topic };
    },
}))
.then(createStep({
    id: 'generate-final-report',
    inputSchema: z.object({ summaries: z.array(z.string()), topic: z.string() }),
    outputSchema: finalOutputSchema, // This step's output is the final output of the workflow
    execute: async (params) => {
        const { summaries, topic } = params.inputData;
        if (summaries.length === 0) {
            const message = "Could not find enough information to generate a report.";
            logger.warn(message);
            return { success: false, message } as const;
        }

        // Determine the output language from the LANG environment variable.
        const lang = process.env.LANG || '';
        const languageInstruction = lang.startsWith('ja') 
            ? '日本語で' 
            : 'in English';

        const finalPrompt = {
            text: `Summaries:\n\n${summaries.join('\n\n')}`,
            objective: `Create a comprehensive final report on the topic: "${topic}". The report must be written ${languageInstruction}.`,
        };
        
        const finalReportResult = await summarizeStep.execute({ ...params, inputData: finalPrompt });
        if (!finalReportResult.success) {
            const message = `Failed to generate the final report. Reason: ${finalReportResult.message}`;
            logger.error(message, { error: finalReportResult });
            return { success: false, message, error: finalReportResult } as const;
        }

        return { 
            success: true, 
            data: { report: finalReportResult.data.summary } 
        } as const;
    },
}))
.commit(); 