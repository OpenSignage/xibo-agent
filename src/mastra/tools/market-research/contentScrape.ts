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
import { createTool } from '@mastra/core/tools';
import { z } from 'zod';
import { logger } from '../../logger';
import * as cheerio from 'cheerio';
import axios from 'axios';
import https from 'https';
import { TextDecoder } from 'util';

// Create a custom https agent with a more permissive cipher suite
// to handle potential TLS handshake issues with older servers.
const httpsAgent = new https.Agent({
  ciphers: [
    'TLS_AES_256_GCM_SHA384',
    'TLS_CHACHA20_POLY1305_SHA256',
    'TLS_AES_128_GCM_SHA256',
    'ECDHE-RSA-AES256-GCM-SHA384',
    'ECDHE-RSA-AES128-GCM-SHA256',
    'DHE-RSA-AES256-GCM-SHA384',
    'DHE-RSA-AES128-GCM-SHA256',
    'ECDHE-RSA-AES256-SHA384',
    'ECDHE-RSA-AES128-SHA256',
    'ECDHE-RSA-AES256-SHA',
    'ECDHE-RSA-AES128-SHA',
    'DHE-RSA-AES256-SHA256',
    'DHE-RSA-AES128-SHA256',
    'DHE-RSA-AES256-SHA',
    'DHE-RSA-AES128-SHA',
    'AES256-GCM-SHA384',
    'AES128-GCM-SHA256',
    'AES256-SHA256',
    'AES128-SHA256',
    'AES256-SHA',
    'AES128-SHA',
    'DES-CBC3-SHA',
  ].join(':'),
  // WARNING: This disables certificate validation.
  // DO NOT USE IN PRODUCTION. This is for debugging specific sites with
  // incomplete certificate chains that modern browsers can handle but Node.js cannot.
  rejectUnauthorized: false, 
});


/**
 * @module contentScrapeTool
 * @description A tool to scrape the main textual content from a given URL.
 */
const outputSchema = z.object({
  url: z.string().url(),
  content: z.string().describe('The extracted main text content of the web page.'),
});

// Structured error response schema, according to the coding rules.
const errorResponseSchema = z.object({
  success: z.literal(false),
  message: z.string(),
  error: z.any().optional(),
});

// Structured success response schema.
const successResponseSchema = z.object({
  success: z.literal(true),
  data: outputSchema,
});


export const contentScrapeTool = createTool({
  id: 'content-scrape',
  description: 'Fetches a URL and extracts its main text content, removing HTML tags and boilerplate.',
  inputSchema: z.object({
    url: z.string().url().describe('The URL of the web page to scrape.'),
  }),
  outputSchema: z.union([successResponseSchema, errorResponseSchema]),
  execute: async ({ context }) => {
    const { url } = context;
    logger.info({ url }, `Attempting to scrape content...`);

    try {
      const response = await axios.get(url, {
        responseType: 'arraybuffer',
        httpsAgent,
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
          'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,image/apng,*/*;q=0.8',
          'Accept-Language': 'ja,en-US;q=0.9,en;q=0.8',
        },
        timeout: 15000,
      });

      const buffer = Buffer.from(response.data);

      const contentType = response.headers['content-type'] || '';
      const headerCharsetMatch = contentType.match(/charset=([\w-]+)/);
      let charset: string;

      if (headerCharsetMatch && headerCharsetMatch[1]) {
          charset = headerCharsetMatch[1].trim().toLowerCase();
      } else {
          const preliminaryHtml = buffer.toString('utf-8', 0, 4096);
          const metaCharsetMatch = preliminaryHtml.match(/<meta[^>]+charset=["']?([\w-]+)/i);
          if (metaCharsetMatch && metaCharsetMatch[1]) {
              charset = metaCharsetMatch[1].trim().toLowerCase();
          } else {
              charset = 'utf-8';
          }
      }
      
      let html: string;
      try {
        const decoder = new TextDecoder(charset);
        html = decoder.decode(buffer);
      } catch (e) {
        const decoder = new TextDecoder('utf-8');
        html = decoder.decode(buffer);
      }

      const $ = cheerio.load(html);

      $('script, style, nav, header, footer, aside, iframe').remove();

      const content = $('body').text();
      const cleanedContent = content.replace(/\s\s+/g, ' ').trim();
      
      logger.info({ url }, `Successfully scraped content.`);
      return { 
        success: true,
        data: { url, content: cleanedContent }
      } as const;

    } catch (error) {
      const message = error instanceof Error ? error.message : "An unknown error occurred during content scraping.";
      logger.error({ url, error }, `Failed to scrape content.`);
      return { 
        success: false, 
        message,
        error,
      } as const;
    }
  },
}); 