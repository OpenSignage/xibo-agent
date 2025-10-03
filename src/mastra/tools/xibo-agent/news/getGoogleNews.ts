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

/**
 * @module getGoogleNews
 * @description Provides a tool to fetch and parse news from Google News RSS feeds
 * based on topic, location, or a search query.
 * @see https://qiita.com/KMD/items/872d8f4eed5d6ebf5df1
 */

import { XMLParser } from 'fast-xml-parser';
import { createTool } from '@mastra/core/tools';
import { z } from 'zod';
import { logger } from '../../../logger';

/**
 * Schema for a single news item from the Google News RSS feed.
 */
const googleNewsItemSchema = z.object({
  title: z.string().describe("The title of the news article."),
  link: z.string().url().describe("The URL to the full news article."),
  guid: z.object({
    '#text': z.string(),
    '@_isPermaLink': z.coerce.boolean(),
  }).or(z.string()).describe("A unique identifier for the news item."),
  pubDate: z.string().describe("The publication date of the article in GMT."),
  description: z.string().describe("An HTML snippet summarizing the news article."),
  source: z.object({
    '#text': z.string().describe("The name of the news source."),
    '@_url': z.string().url().describe("The base URL of the news source."),
  }).describe("The news source provider."),
});

/**
 * Schema for the parsed RSS feed structure.
 * It handles cases where 'item' can be a single object or an array of objects.
 */
const rssFeedSchema = z.object({
  rss: z.object({
    channel: z.object({
      title: z.string(),
      link: z.string(),
      description: z.string(),
      item: z.union([z.array(googleNewsItemSchema), googleNewsItemSchema]).optional().transform((item) => {
        if (!item) return [];
        return Array.isArray(item) ? item : [item];
      }),
    }),
  }),
});

/**
 * Defines the schema for a successful response.
 */
const successSchema = z.object({
    success: z.literal(true),
    feed: z.object({
        title: z.string().describe("The title of the RSS feed."),
        link: z.string().url().describe("The link to the RSS feed source."),
        description: z.string().describe("The description of the RSS feed."),
    }),
    items: z.array(googleNewsItemSchema).describe("An array of news items."),
});

/**
 * Defines the schema for a failed operation.
 */
const errorSchema = z.object({
  success: z.literal(false),
  message: z.string().describe("A human-readable error message."),
  error: z.any().optional().describe("Optional technical details about the error."),
});

/**
 * Language and country parameters for the Google News RSS feed.
 */
const languageEnum = z.enum(['ja', 'en-US', 'en-GB', 'zh-CN', 'de', 'es-419', 'ar']);

/**
 * Topics available for topic-based search in Google News.
 */
const topicEnum = z.enum(['WORLD', 'NATION', 'BUSINESS', 'TECHNOLOGY', 'ENTERTAINMENT', 'SPORTS', 'SCIENCE', 'HEALTH']);

/**
 * Input schema for the getGoogleNews tool, allowing search by topic, geo, or query.
 * This schema is intentionally relaxed to avoid issues with the tool framework.
 * Validation is performed inside the execute function.
 */
const inputSchema = z.object({
  searchType: z.string().optional().describe("The type of search to perform. Must be one of 'topic', 'geo', or 'query'."),
  topic: z.string().optional().describe("The news topic to search for (used when searchType is 'topic'). Examples: 'WORLD', 'NATION', 'BUSINESS'."),
  location: z.string().optional().describe("The geographic location to search for (used when searchType is 'geo')."),
  query: z.string().optional().describe("A keyword query to search for (used when searchType is 'query')."),
  limit: z.number().int().positive().optional().default(10).describe('Maximum number of news items to return.'),
  language: languageEnum.optional().default('ja').describe("The language and region for the news search."),
});

/**
 * A tool to fetch and parse news from Google News.
 */
export const getGoogleNews = createTool({
  id: 'get-google-news',
  description: 'Fetches news from Google News based on a topic, location, or query.',
  inputSchema,
  outputSchema: z.union([successSchema, errorSchema]),
  execute: async ({ context: input }): Promise<z.infer<typeof successSchema> | z.infer<typeof errorSchema>> => {
    logger.info({ input }, 'Executing getGoogleNews with input:');
    
    // --- Manual Input Validation ---
    if (!input.searchType || !['topic', 'geo', 'query'].includes(input.searchType)) {
        const message = `Invalid or missing 'searchType'. It must be one of 'topic', 'geo', or 'query'. Received: ${input.searchType}`;
        logger.error({ input }, message);
        return { success: false, message };
    }
    if (input.searchType === 'topic' && !input.topic) {
        const message = "When 'searchType' is 'topic', the 'topic' parameter is required.";
        logger.error({ input }, message);
        return { success: false, message };
    }
    if (input.searchType === 'geo' && !input.location) {
        const message = "When 'searchType' is 'geo', the 'location' parameter is required.";
        logger.error({ input }, message);
        return { success: false, message };
    }
    if (input.searchType === 'query' && !input.query) {
        const message = "When 'searchType' is 'query', the 'query' parameter is required.";
        logger.error({ input }, message);
        return { success: false, message };
    }
    // --- End Manual Input Validation ---

    const { limit, language } = input;
    
    const langParamsMap: Record<z.infer<typeof languageEnum>, string> = {
        'ja': 'hl=ja&gl=JP&ceid=JP:ja',
        'en-US': 'hl=en-US&gl=US&ceid=US:en',
        'en-GB': 'hl=en-GB&gl=GB&ceid=GB:en',
        'zh-CN': 'hl=zh-CN&gl=CN&ceid=CN:zh-Hans',
        'de': 'hl=de&gl=DE&ceid=DE:de',
        'es-419': 'hl=es-419&gl=US&ceid=US:es-419',
        'ar': 'hl=ar&gl=EG&ceid=EG:ar'
    };
    const langQuery = langParamsMap[language];

    let path: string;
    switch (input.searchType) {
        case 'topic':
            path = `/headlines/section/topic/${input.topic!}`;
            break;
        case 'geo':
            path = `/headlines/section/geo/${encodeURIComponent(input.location!)}`;
            break;
        case 'query':
            path = `/search?q=${encodeURIComponent(input.query!)}`;
            break;
        default:
             // This case should be unreachable due to the manual validation above.
            return { success: false, message: `Internal error: Unhandled searchType '${input.searchType}'`};
    }
    
    const separator = path.includes('?') ? '&' : '?';
    const rssUrl = `https://news.google.com/rss${path}${separator}${langQuery}`;

    logger.info(`Fetching Google News from ${rssUrl} with a limit of ${limit}.`);
    
    let response;
    try {
      response = await fetch(rssUrl);
    } catch (error: any) {
      const message = `Network error while fetching Google News RSS feed: ${error.message}`;
      logger.error({ url: rssUrl, error }, message);
      return { success: false, message, error };
    }
    
    if (!response.ok) {
        const message = `Failed to fetch Google News RSS feed. Status: ${response.status} ${response.statusText}`;
        logger.error({ url: rssUrl, status: response.status }, message);
        return { success: false, message, error: { statusCode: response.status } };
    }
    
    try {
        const xmlData = await response.text();
        const parser = new XMLParser({ ignoreAttributes: false });
        const parsedXml = parser.parse(xmlData);
        
        const validationResult = rssFeedSchema.safeParse(parsedXml);

        if (!validationResult.success) {
            const message = "Google News RSS feed validation failed.";
            logger.error({ url: rssUrl, error: validationResult.error.issues, data: parsedXml }, message);
            return {
                success: false,
                message,
                error: { validationIssues: validationResult.error.issues, receivedData: parsedXml },
            };
        }

        const channel = validationResult.data.rss.channel;
        const limitedItems = channel.item.slice(0, limit);

        logger.info(`Successfully retrieved and parsed ${limitedItems.length} news items.`);
      
        return {
            success: true,
            feed: {
              title: channel.title,
              link: channel.link,
              description: channel.description,
            },
            items: limitedItems,
        };
    } catch (error: any) {
      const message = `Error parsing or processing Google News RSS feed: ${error.message}`;
      logger.error({ url: rssUrl, error }, message);
      return { success: false, message, error };
    }
  },
}); 