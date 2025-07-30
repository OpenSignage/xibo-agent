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
import PptxGenJS from 'pptxgenjs';
import path from 'path';
import { config } from '../xibo-agent/config';
import fs from 'fs/promises';

const JPN_FONT = 'Yu Gothic';

/**
 * @module createPowerpointTool
 * @description A tool to create a PowerPoint presentation from structured slide data.
 */
const slideSchema = z.object({
  title: z.string().describe('The title of the slide.'),
  bullets: z.array(z.string()).describe('An array of bullet points for the slide content.'),
  imagePath: z.string().optional().describe('An optional path to an image to include on the slide.'),
  notes: z.string().optional().describe('Speaker notes for the slide.'),
});

const inputSchema = z.object({
  fileName: z.string().describe('The base name for the output .pptx file (e.g., "presentation").'),
  slides: z.array(slideSchema).describe('An array of slide objects representing the presentation structure.'),
});

const outputSchema = z.object({
  filePath: z.string().describe('The absolute path to the saved PowerPoint file.'),
});

const errorResponseSchema = z.object({
  success: z.literal(false),
  message: z.string(),
  error: z.any().optional(),
});

const successResponseSchema = z.object({
  success: z.literal(true),
  data: outputSchema,
});

export const createPowerpointTool = createTool({
  id: 'create-powerpoint',
  description: 'Creates a PowerPoint (.pptx) file from an array of slide data (titles, bullets, optional images, and optional speaker notes).',
  inputSchema,
  outputSchema: z.union([successResponseSchema, errorResponseSchema]),
  execute: async ({ context }) => {
    const { fileName, slides } = context;
    const presenterDir = config.presentationsDir;
    const filePath = path.join(presenterDir, `${fileName}.pptx`);

    logger.info({ filePath, slideCount: slides.length }, 'Creating PowerPoint presentation...');

    try {
        await fs.mkdir(presenterDir, { recursive: true });
        const pres = new PptxGenJS();

        for (const slideData of slides) {
            const slide = pres.addSlide();

            // Add speaker notes if provided
            if (slideData.notes) {
                slide.addNotes(slideData.notes);
            }

            slide.addText(slideData.title, { 
                x: 0.5, y: 0.25, w: '90%', h: 0.75, 
                fontSize: 32, bold: true, align: 'center',
                fontFace: JPN_FONT,
            });

            if (slideData.imagePath) {
                // With an image, text goes on the left
                slide.addText(slideData.bullets.join('\n'), { 
                    x: 0.5, y: 1.5, w: '45%', h: '75%', 
                    fontSize: 18, bullet: { type: 'bullet' },
                    fontFace: JPN_FONT,
                });
                slide.addImage({ 
                    path: slideData.imagePath, 
                    x: 5.25, y: 1.5, w: 4.5, h: 4.5 * (9/16) // 16:9 aspect ratio
                });
            } else {
                // Without an image, text is centered
                slide.addText(slideData.bullets.join('\n'), { 
                    x: 1.0, y: 1.5, w: '80%', h: '75%', 
                    fontSize: 20, bullet: { type: 'bullet' }, align: 'left',
                    fontFace: JPN_FONT,
                });
            }
        }
        
        await pres.writeFile({ fileName: filePath });

        logger.info({ filePath }, 'Successfully created PowerPoint presentation.');
        return {
            success: true,
            data: { filePath },
        } as const;

    } catch (error) {
        const message = error instanceof Error ? error.message : "An unknown error occurred during PowerPoint creation.";
        logger.error({ error, filePath }, 'Failed to create PowerPoint file.');
        return {
            success: false,
            message,
            error,
        } as const;
    }
  },
}); 