/*
 * Copyright (C) 2025 Open Source Digital Signage Initiative.
 * You should have received a copy of the GElastic License 2.0 (ELv2).
 * see <https://www.elastic.co/licensing/elastic-license>.
 */
import { createWorkflow, createStep } from '@mastra/core/workflows';
import { z } from 'zod';
import { webSearchTool } from '../../tools/market-research/webSearch';
import { contentScrapeTool } from '../../tools/market-research/contentScrape';
import { summarizeAndAnalyzeTool } from '../../tools/market-research/summarizeAndAnalyze';
import { logger } from '../../logger';

// Create workflow steps from existing tools for reuse
const searchStep = createStep(webSearchTool);
const finalReportStep = createStep(summarizeAndAnalyzeTool);

/**
 * @module marketResearchWorkflow
 * @description A workflow that automates the process of market research.
 */
export const marketResearchWorkflow = createWorkflow({
  id: 'market-research-workflow',
  description: 'A comprehensive workflow to search, scrape, and analyze information to produce a report.',
  inputSchema: z.object({
    topic: z.string().describe('The central topic for the market research.'),
  }),
  outputSchema: z.object({
    report: z.string().describe('The final, consolidated research report.'),
  }),
})
.then(createStep({
    id: 'prepare-search-query',
    inputSchema: z.object({ topic: z.string() }),
    outputSchema: z.object({
      query: z.string(),
      topic: z.string(),
    }),
    execute: async ({ inputData }) => ({
      query: `${inputData.topic} market analysis`,
      topic: inputData.topic,
    }),
  })
)
.then(createStep({
    id: 'execute-search-and-preserve-topic',
    inputSchema: z.object({
        query: z.string(),
        topic: z.string(),
    }),
    outputSchema: searchStep.outputSchema.extend({
        topic: z.string(),
    }),
    execute: async (params) => {
        const searchResults = await searchStep.execute({
            ...params,
            inputData: { query: params.inputData.query },
        });
        return {
            ...searchResults,
            topic: params.inputData.topic,
        };
    },
}))
.then(createStep({
    id: 'scrape-and-summarize-articles',
    inputSchema: searchStep.outputSchema.extend({
        topic: z.string(),
    }),
    outputSchema: z.object({
        summaries: z.array(z.string()),
        topic: z.string(),
    }),
    execute: async ({ inputData, runtimeContext }) => {
        const { results, topic } = inputData;
        const topUrls = results.slice(0, 3).map((r: any) => r.url);
        const summaries: string[] = [];
        for (const url of topUrls) {
            try {
                const scrapedContent = await contentScrapeTool.execute({ context: { url }, runtimeContext });
                if (scrapedContent.content.length > 100) {
                    const individualSummary = await summarizeAndAnalyzeTool.execute({
                        context: {
                            text: scrapedContent.content,
                            objective: `Summarize the key findings from this article regarding "${topic}".`,
                        },
                        runtimeContext
                    });
                    summaries.push(`Source: ${url}\nSummary:\n${individualSummary.summary}\n---`);
                }
            } catch (error) {
                logger.error({ error, url }, `Skipping URL due to an error.`);
            }
        }
        return { summaries, topic };
    },
}))
.then(createStep({
    id: 'prepare-final-report-input',
    inputSchema: z.object({
        summaries: z.array(z.string()),
        topic: z.string(),
    }),
    outputSchema: summarizeAndAnalyzeTool.inputSchema,
    execute: async ({ inputData }) => ({
      text: `Here are summaries from multiple sources about "${inputData.topic}":\n\n${inputData.summaries.join('\n\n')}`,
      objective: `Based *only* on the provided information, create a comprehensive, well-structured final market research report on the topic: "${inputData.topic}". Synthesize the findings into a coherent document.`,
    }),
}))
.then(finalReportStep)
.then(createStep({
    id: 'format-final-output',
    inputSchema: summarizeAndAnalyzeTool.outputSchema,
    outputSchema: z.object({
        report: z.string(),
    }),
    execute: async ({ inputData }) => ({
        report: inputData.summary,
    }),
}))
.commit(); 