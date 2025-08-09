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

/**
 * @module webSearchTool
 * @description A tool to perform web searches using the Brave Search API.
 * This tool handles pagination, rate limiting, and deduplication of search results.
 */
const outputSchema = z.object({
  results: z.array(z.object({
    title: z.string().describe('The title of the search result.'),
    url: z.string().url().describe('The URL of the search result.'),
    description: z.string().optional().describe('A short description or snippet of the page content.'),
  })).describe('A list of search results.'),
});

// Structured error response schema, according to the coding rules.
const errorResponseSchema = z.object({
  success: z.literal(false),
  message: z.string(),
  error: z.any().optional(),
  errorData: z.any().optional(),
});

// Structured success response schema.
const successResponseSchema = z.object({
  success: z.literal(true),
  data: outputSchema,
});

export const webSearchTool = createTool({
  id: 'web-search',
  description: 'Performs a web search for a given query and returns a list of relevant pages.',
  inputSchema: z.object({
    query: z.string().describe('The search query.'),
    maxResults: z.number().optional().default(20).describe('Maximum number of search results to return (default: 20)'),
  }),
  outputSchema: z.union([successResponseSchema, errorResponseSchema]),
  execute: async ({ context }) => {
    const { query, maxResults = 20 } = context;
    const apiKey = process.env.BRAVE_API_KEY;

    // Check if API key is configured
    if (!apiKey) {
      const errorMessage = 'BRAVE_API_KEY environment variable is not set.';
      logger.error(errorMessage);
      return {
        success: false,
        message: errorMessage,
      } as const;
    }

    /**
     * Makes a single API call to Brave Search with retry logic for rate limiting
     * @param offset - The pagination offset (0, 1, 2, etc.)
     * @param retryCount - Current retry attempt number
     * @returns Promise with API response or error
     */
    const makeApiCall = async (offset: number, retryCount = 0): Promise<any> => {
      const url = `https://api.search.brave.com/res/v1/web/search?q=${encodeURIComponent(query)}&count=20&offset=${offset}`;
      
      try {
        const response = await fetch(url, {
          headers: {
            'X-Subscription-Token': apiKey,
            'Accept': 'application/json',
            'User-Agent': 'Mozilla/5.0 (compatible; XiboAgent/1.0)',
          },
        });

        // Handle rate limiting with exponential backoff
        if (response.status === 429) {
          if (retryCount < 3) {
            const delay = Math.pow(2, retryCount) * 1000; // Exponential backoff: 1s, 2s, 4s
            logger.warn(`Rate limited (429). Retrying in ${delay}ms (attempt ${retryCount + 1}/3)`);
            await new Promise(resolve => setTimeout(resolve, delay));
            return makeApiCall(offset, retryCount + 1);
          } else {
            return {
              success: false,
              message: 'Rate limit exceeded after 3 retries',
              error: { status: 429 }
            };
          }
        }

        // Handle invalid request parameters
        if (response.status === 422) {
          const errorDetails = await response.text().catch(() => 'Could not read error details.');
          logger.error('Invalid request (422)', { query, offset, errorDetails });
          return {
            success: false,
            message: 'Invalid request parameters',
            error: { status: 422 },
            errorData: errorDetails
          };
        }

        // Handle other HTTP errors
        if (!response.ok) {
          const errorDetails = await response.text().catch(() => 'Could not read error details.');
          return {
            success: false,
            message: `Brave Search API request failed with status ${response.status}`,
            error: { status: response.status },
            errorData: errorDetails
          };
        }

        const data = await response.json();
        return { success: true, data };
      } catch (error) {
        return {
          success: false,
          message: `API call failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
          error: error
        };
      }
    };

    try {
      const allResults: any[] = [];
      const maxApiCalls = Math.ceil(maxResults / 20);
      
      logger.info(`Starting web search for query: "${query}". Requesting ${maxResults} results in ${maxApiCalls} API calls.`);
      
      // Make multiple API calls to get the requested number of results
      for (let i = 0; i < maxApiCalls; i++) {
        const offset = i; // Brave API uses 0-based offset for pagination
        logger.info(`Making API call ${i + 1}/${maxApiCalls} with offset ${offset}`);
        
        try {
          const apiResult = await makeApiCall(offset);
          
          // Handle API errors
          if (!apiResult.success) {
            if (apiResult.error?.status === 429) {
              logger.error('Rate limit exceeded. Stopping search.');
              break;
            } else if (apiResult.error?.status === 422) {
              logger.error('Invalid request parameters. Stopping search.');
              break;
            } else {
              return apiResult;
            }
          }
          
          // Extract and format search results
          const data = apiResult.data;
          const results = (data.web?.results || []).map((item: any) => ({
            title: item.title,
            url: item.url,
            description: item.description,
          }));

          logger.info(`API call ${i + 1} returned ${results.length} results`);
          allResults.push(...results);

          // Stop if we received fewer results than expected (end of results)
          if (results.length < 20) {
            logger.info(`Received fewer than 20 results (${results.length}), stopping API calls`);
            break;
          }

          // Add delay between API calls to avoid rate limiting
          if (i < maxApiCalls - 1) {
            await new Promise(resolve => setTimeout(resolve, 1000));
          }
        } catch (error) {
          return {
            success: false,
            message: `Unexpected error during API call: ${error instanceof Error ? error.message : 'Unknown error'}`,
            error: error
          };
        }
      }

      logger.info(`Total results collected: ${allResults.length}`);

      // Remove duplicate URLs to ensure unique results
      const seenUrls = new Set<string>();
      const uniqueResults: any[] = [];
      
      for (const result of allResults) {
        if (!seenUrls.has(result.url)) {
          seenUrls.add(result.url);
          uniqueResults.push(result);
          
          // Stop when we have enough unique results
          if (uniqueResults.length >= maxResults) {
            break;
          }
        }
      }

      logger.info(`After removing duplicates: ${uniqueResults.length} results`);

      // Validate the final results against the schema
      const validatedData = outputSchema.safeParse({
        results: uniqueResults
      });

      if (!validatedData.success) {
        const message = "Validation error occurred";
        logger.error(message, { error: validatedData.error.format() });
        return {
          success: false,
          message: message,
          error: validatedData.error.format(),
          errorData: { results: uniqueResults },
        } as const;
      }
      
      logger.info(`Web search completed successfully. Found ${uniqueResults.length} unique results.`);
      return { success: true, data: validatedData.data } as const;

    } catch (error) {
      const message = error instanceof Error ? error.message : "An unknown error occurred during web search.";
      logger.error(message, { error });
      return { 
        success: false, 
        message,
        error: error
      } as const;
    }
  },
}); 