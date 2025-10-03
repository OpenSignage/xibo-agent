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
 * @module getXiboNews
 * @description Provides a tool to fetch and parse the RSS news feed from xibosignage.com.
 */

import { XMLParser } from 'fast-xml-parser';
import { createTool } from '@mastra/core/tools';
import { z } from 'zod';
import { logger } from '../../../logger';

/**
 * Schema for a single news item from the Xibo RSS feed.
 */
const newsItemSchema = z.object({
  title: z.string().describe("The title of the news article."),
  link: z.string().url().describe("The URL to the full news article."),
  description: z.string().describe("A summary or excerpt of the news article."),
  pubDate: z.string().describe("The publication date of the article."),
  creator: z.string().optional().describe("The author of the article."),
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
      item: z.union([z.array(newsItemSchema), newsItemSchema]).transform((item) => {
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
    items: z.array(newsItemSchema).describe("An array of news items."),
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
 * A tool to fetch and parse the Xibo news feed.
 */
export const getXiboNews = createTool({
  id: 'get-xibo-news',
  description: 'Fetches the latest news from the Xibo blog RSS feed.',
  inputSchema: z.object({
    limit: z.number().int().positive().optional().describe('Maximum number of news items to return (default: 5).'),
  }),
  outputSchema: z.union([successSchema, errorSchema]),
  execute: async ({ context: input }): Promise<z.infer<typeof successSchema> | z.infer<typeof errorSchema>> => {
    const limit = input?.limit || 5;
    const rssUrl = 'https://xibosignage.com/rss.xml';
    
    logger.info(`Fetching Xibo news from ${rssUrl} with a limit of ${limit}.`);
    
    let response;
    try {
      response = await fetch(rssUrl);
    } catch (error: any) {
      const message = `Network error while fetching RSS feed: ${error.message}`;
      logger.error({ error }, message);
      return { success: false, message, error };
    }
    
    if (!response.ok) {
        const message = `Failed to fetch RSS feed. Status: ${response.status} ${response.statusText}`;
        logger.error({ status: response.status }, message);
        return { success: false, message, error: { statusCode: response.status } };
    }
    
    try {
        const xmlData = await response.text();
        const parser = new XMLParser();
        const parsedXml = parser.parse(xmlData);

        const validationResult = rssFeedSchema.safeParse(parsedXml);

        if (!validationResult.success) {
            const message = "RSS feed validation failed.";
            logger.error({ error: validationResult.error.issues, data: parsedXml }, message);
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
      const message = `Error parsing or processing RSS feed: ${error.message}`;
      logger.error({ error }, message);
      return { success: false, message, error };
    }
  },
});
