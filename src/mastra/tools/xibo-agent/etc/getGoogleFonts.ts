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
 * @module getGoogleFonts
 * @description Provides a tool to fetch Google Fonts metadata from the Google Fonts Developer API
 * and optionally generate a preview image for each font.
 * API specification: https://developers.google.com/fonts/docs/developer_api
 */

import { createTool } from '@mastra/core/tools';
import { z } from 'zod';
import { logger } from '../../../logger';  
import { config } from '../config';
import * as opentype from 'opentype.js';
import { createCanvas } from 'canvas';
import * as fs from 'fs';
import * as path from 'path';

// Valid sort options for Google Fonts API
const SORT_OPTIONS = ['alpha', 'date', 'popularity', 'style', 'trending'] as const;

// Valid category options for font filtering
const CATEGORY_OPTIONS = ['serif', 'sans-serif', 'monospace', 'display', 'handwriting'] as const;

// Valid capability options
const CAPABILITY_OPTIONS = ['VF', 'WOFF2'] as const;

/**
 * Schema for a single font item from the Google Fonts API.
 */
const googleFontItemSchema = z.object({
  family: z.string(),
  variants: z.array(z.string()),
  subsets: z.array(z.string()),
  version: z.string(),
  lastModified: z.string(),
  files: z.record(z.string().url()),
  category: z.string(),
  kind: z.string(),
  previewUrl: z.string().optional().describe("The URL to the generated preview image."),
});

/**
 * Defines the schema for a successful response.
 */
const successSchema = z.object({
    success: z.literal(true),
    total: z.number().int().describe("The total number of fonts returned."),
    fonts: z.array(googleFontItemSchema).describe("An array of font metadata objects."),
    kind: z.string().optional().describe("The kind of resource, typically 'webfonts#webfontList'."),
});

/**
 * Defines the schema for a failed operation.
 */
const errorSchema = z.object({
  success: z.literal(false),
  message: z.string().describe("A human-readable error message."),
  error: z.any().optional().describe("Optional technical details about the error."),
});

const inputSchema = z.object({
    family: z.string().optional().describe('Filter by font family name'),
    subset: z.string().optional().default('japanese').describe('Filter by font subset name (e.g., latin, cyrillic, greek, japanese)'),
    category: z.enum(CATEGORY_OPTIONS).optional().describe('Filter by font category (serif, sans-serif, monospace, display, handwriting)'),
    capability: z.enum(CAPABILITY_OPTIONS).array().optional().default(['VF']).describe('Filter by font capability (VF for variable fonts, WOFF2 for WOFF2 format)'),
    sort: z.enum(SORT_OPTIONS).optional().describe('Sort order for results (alpha, date, popularity, style, trending)'),
    limit: z.number().int().positive().optional().describe('Maximum number of fonts to return (default: 20)'),
    preview: z.boolean().default(false).describe("Generate a preview image for the font."),
    previewText: z.string().optional().describe("Text to render in the preview image. Required if preview is true."),
    fontSize: z.number().default(24).describe("Font size for the preview image in points."),
});


/**
 * Tool to retrieve font information from Google Fonts API
 * 
 * This tool fetches metadata about available fonts from the Google Fonts Developer API.
 * It allows filtering by various criteria and sorting the results.
 * It can also generate preview images for the fonts.
 * API key is automatically loaded from environment variables.
 */
export const getGoogleFonts = createTool({
  id: 'get-google-fonts',
  description: 'Fetches font metadata from the Google Fonts Developer API and optionally generates previews.',
  inputSchema,
  outputSchema: z.union([successSchema, errorSchema]),
  execute: async ({ context: input }): Promise<z.infer<typeof successSchema> | z.infer<typeof errorSchema>> => {
    const apiKey = process.env.GOOGLE_FONTS_API_KEY;
    if (!apiKey) {
      const message = 'Google Fonts API Key is not set in environment variables (GOOGLE_FONTS_API_KEY).';
      logger.error(`getGoogleFonts: ${message}`);
      return { success: false as const, message };
    }

    const limit = input.limit || 20;

    const params = new URLSearchParams({ key: apiKey });
    if (input.family) params.append('family', input.family);
    if (input.subset) params.append('subset', input.subset);
    if (input.category) params.append('category', input.category);
    if (input.sort) params.append('sort', input.sort);
    if (input.capability && input.capability.length > 0) {
      input.capability.forEach(cap => params.append('capability', cap));
    }

    const apiUrl = `https://www.googleapis.com/webfonts/v1/webfonts?${params.toString()}`;
    logger.info(`Fetching Google Fonts data with filters: ${params.toString().replace(/key=[^&]+/, 'key=***')}`);
    
    try {
      const response = await fetch(apiUrl);
      const data = await response.json();

      if (!response.ok) {
        const message = `Google Fonts API Error: ${data.error?.message || response.statusText}`;
        logger.error(message, { error: data.error });
        return { success: false as const, message, error: data.error };
      }

      const validationResult = z.object({ items: z.array(googleFontItemSchema.omit({previewUrl: true})), kind: z.string().optional() }).safeParse(data);

      if(!validationResult.success){
        const message = "Google Fonts API response validation failed.";
        logger.error(message, { error: validationResult.error.issues, data });
        return { success: false as const, message, error: { validationIssues: validationResult.error.issues, receivedData: data } };
      }

      let fonts = validationResult.data.items.slice(0, limit) as z.infer<typeof googleFontItemSchema>[];
      
      if (input.preview) {
        if (!input.previewText) {
            const message = "previewText is required when preview is enabled.";
            logger.error(`getGoogleFonts: ${message}`);
            return { success: false as const, message };
        }

        const previewDir = config.previewFontImageDir;
        if (!fs.existsSync(previewDir)) {
          fs.mkdirSync(previewDir, { recursive: true });
        }

        const PADDING = 10;

        for (const font of fonts) {
            const fontUrl = font.files['regular'] || Object.values(font.files)[0];
            if (!fontUrl) continue;

            try {
                const fontResponse = await fetch(fontUrl);
                const fontBuffer = await fontResponse.arrayBuffer();
                const loadedFont = opentype.parse(fontBuffer);

                const text = input.previewText!;
                const fontSize = input.fontSize;
                
                const textPath = loadedFont.getPath(text, 0, 0, fontSize);
                const boundingBox = textPath.getBoundingBox();

                const canvasWidth = Math.ceil(boundingBox.x2 - boundingBox.x1) + PADDING * 2;
                const canvasHeight = Math.ceil(boundingBox.y2 - boundingBox.y1) + PADDING * 2;

                const canvas = createCanvas(canvasWidth, canvasHeight);
                const ctx = canvas.getContext('2d');

                ctx.fillStyle = '#ffffff';
                ctx.fillRect(0, 0, canvasWidth, canvasHeight);

                ctx.fillStyle = '#000000';
                const drawX = PADDING - boundingBox.x1;
                const drawY = PADDING - boundingBox.y1;
                
                ctx.translate(drawX, drawY);
                textPath.draw(ctx as any);
                
                const previewFileName = `${font.family.replace(/\s/g, '_')}.png`;
                const previewFilePath = path.join(previewDir, previewFileName);
                
                const pngBuffer = canvas.toBuffer('image/png');
                fs.writeFileSync(previewFilePath, pngBuffer);

                font.previewUrl = `${config.apiUrl}/getFontImage/${previewFileName}`;

            } catch (previewError: any) {
                logger.warn(`Could not generate preview for font ${font.family}: ${previewError.message}`);
            }
        }
      }

      logger.info(`Successfully retrieved ${fonts.length} fonts from Google Fonts API.`);
      
      return {
        success: true,
        total: fonts.length,
        fonts: fonts,
        kind: validationResult.data.kind,
      };
    } catch (error: any) {
      const message = `Failed to fetch or parse Google Fonts data: ${error.message}`;
      logger.error(message, { error });
      return { success: false as const, message, error };
    }
  }
}); 