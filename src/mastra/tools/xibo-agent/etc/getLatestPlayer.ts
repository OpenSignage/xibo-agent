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
 * @module getLatestPlayer
 *
 * This module provides a tool to scrape the latest player software information
 * from the Xibo Signage downloads page.
 */
import { z } from 'zod';
import * as cheerio from 'cheerio';
import { logger } from '../../../logger'; 
import { createTool } from '@mastra/core';

// Schema for the successful response data
const latestPlayerSchema = z.array(
  z.object({
    name: z.string().describe('The name of the player software.'),
    link: z
      .string()
      .optional()
      .describe('The download link for the player software.'),
  })
);

// Schema for the tool's output
const responseSchema = z.union([
  z.object({
    success: z.literal(true),
    data: latestPlayerSchema,
  }),
  z.object({
    success: z.literal(false),
    message: z.string(),
    error: z.any().optional(),
  }),
]);

/**
 * Tool to get the latest player software information.
 *
 * This tool scrapes the Xibo downloads page to get information about the
 * latest player software versions available.
 */
export const getLatestPlayer = createTool({
  id: 'getLatestPlayer',
  description:
    'Gets the latest player software information from the Xibo downloads page.',
  inputSchema: z.object({}),
  outputSchema: responseSchema,
  execute: async ({}) : Promise<z.infer<typeof responseSchema>> => {
    try {
      const response = await fetch('https://xibosignage.com/downloads');
      if (!response.ok) {
        logger.error(
          { status: response.status, statusText: response.statusText },
          'Failed to fetch the downloads page'
        );
        return {
          success: false,
          message: `Failed to fetch the page: ${response.statusText}`,
        };
      }
      const html = await response.text();
      const $ = cheerio.load(html);

      const latestReleases: z.infer<typeof latestPlayerSchema> = [];
      const baseUrl = new URL(response.url).origin;

      $('.latest-release .latest-release-listing').each(function () {
        const name = $(this).find('.release-application h3').text().trim();

        // Find the download link within the sibling .release-link div.
        // We specifically target the anchor tag with 'btn-secondary' class to get the download link.
        const linkHref = $(this).find('.release-link .btn-secondary').attr('href');

        let link: string | undefined;

        if (linkHref) {
          // Resolve relative URLs to absolute URLs using the page's base URL.
          link = new URL(linkHref, baseUrl).toString();
        }

        latestReleases.push({ name, link });
      });

      if (latestReleases.length === 0) {
        logger.info('No latest player information found on the page.');
        return {
          success: true,
          data: [],
        };
      }

      const validatedData = latestPlayerSchema.parse(latestReleases);

      return {
        success: true,
        data: validatedData,
      };
    } catch (error) {
      logger.error({ error }, 'Error fetching latest player info');
      const errorMessage =
        error instanceof Error ? error.message : 'An unknown error occurred';
      return {
        success: false,
        message: `Error fetching latest player info: ${errorMessage}`,
        error: error,
      };
    }
  },
});
