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
 * getNews.ts
 * 
 * Xibo Agent Tool to fetch and parse RSS news feed from xibosignage.com
 */

import { XMLParser } from 'fast-xml-parser';
import { createLogger } from '@mastra/core/logger';
import { createTool } from '@mastra/core/tools';
import { z } from 'zod';

const logger = createLogger({ name: 'xibo-agent:etc:getNews' });

/**
 * News item structure from Xibo RSS feed
 */
interface NewsItem {
  title: string;
  link: string;
  description: string;
  pubDate: string;
  creator?: string;
}

/**
 * Parsed RSS feed structure
 */
interface RSSFeed {
  rss: {
    channel: {
      title: string;
      link: string;
      description: string;
      item: NewsItem[] | NewsItem;
    }
  }
}

/**
 * Fetch and parse the Xibo news feed
 * @returns Promise with news items array
 */
export const getNews = createTool({
  id: 'get-news',
  description: 'Fetches the latest news from the Xibo blog RSS feed',
  inputSchema: z.object({
    limit: z.number().optional().describe('Maximum number of news items to return (default: 5)')
  }),
  outputSchema: z.any(),
  execute: async ({ context }) => {
    const limit = context?.limit || 5;
    const rssUrl = 'https://xibosignage.com/rss.xml';
    
    logger.info(`Fetching Xibo news from ${rssUrl}`);
    
    try {
      // Fetch the RSS feed
      const response = await fetch(rssUrl);
      
      if (!response.ok) {
        throw new Error(`Failed to fetch RSS feed: ${response.status} ${response.statusText}`);
      }
      
      const xmlData = await response.text();
      
      // Parse XML
      const parser = new XMLParser({
        ignoreAttributes: false,
        attributeNamePrefix: "_",
      });
      
      const result = parser.parse(xmlData) as RSSFeed;
      
      // Extract news items
      let items: NewsItem[] = [];
      
      if (result.rss && result.rss.channel) {
        if (Array.isArray(result.rss.channel.item)) {
          items = result.rss.channel.item.slice(0, limit);
        } else if (result.rss.channel.item) {
          // If there's only one item, it might not be in an array
          items = [result.rss.channel.item];
        }
      }
      
      logger.info(`Retrieved ${items.length} news items from Xibo RSS feed`);
      
      return {
        success: true,
        feed: {
          title: result.rss?.channel?.title || 'Xibo News',
          link: result.rss?.channel?.link || 'https://xibosignage.com/blog',
          description: result.rss?.channel?.description || '',
        },
        items: items.map(item => ({
          title: item.title,
          link: item.link,
          description: item.description,
          pubDate: item.pubDate,
          creator: item.creator
        }))
      };
    } catch (error) {
      logger.error('Error fetching Xibo news:', { error: error instanceof Error ? error.message : 'Unknown error' });
      return {
        success: false,
        message: error instanceof Error ? error.message : 'Failed to fetch Xibo news',
      };
    }
  }
}); 