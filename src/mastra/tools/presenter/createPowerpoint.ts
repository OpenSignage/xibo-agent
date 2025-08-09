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

//
const JPN_FONT = 'Yu Gothic';

// Define a master slide layout for a consistent look and feel
const MASTER_SLIDE = 'MASTER_SLIDE';

/**
 * @module createPowerpointTool
 * @description A tool to create a PowerPoint presentation from structured slide data.
 */
const slideSchema = z.object({
  title: z.string().describe('The title of the slide.'),
  bullets: z.array(z.string()).describe('An array of bullet points for the slide content.'),
  imagePath: z.string().optional().describe('An optional path to an image to include on the slide.'),
  notes: z.string().optional().describe('Speaker notes for the slide.'),
  layout: z.enum(['title_slide', 'section_header', 'content_with_visual', 'content_only', 'quote']).optional().describe('The layout type for the slide.'),
  special_content: z.string().optional().describe('Special content for layouts like \'quote\'.'),
});

const inputSchema = z.object({
  fileName: z.string().describe('The base name for the output .pptx file (e.g., "presentation").'),
  slides: z.array(slideSchema).describe('An array of slide objects representing the presentation structure.'),
  themeColor1: z.string().optional().describe('The primary hex color for the background gradient.'),
  themeColor2: z.string().optional().describe('The secondary hex color for the background gradient.'),
  titleSlideImagePath: z.string().optional().describe('An optional path to a background image for the title slide.'),
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
    const { fileName, slides, themeColor1, themeColor2, titleSlideImagePath } = context;
    const presenterDir = config.presentationsDir;
    const filePath = path.join(presenterDir, `${fileName}.pptx`);

    logger.info({ filePath, slideCount: slides.length }, 'Creating PowerPoint presentation...');

    try {
        await fs.mkdir(presenterDir, { recursive: true });
        const pres = new PptxGenJS();

        // Set the default theme fonts to a Japanese font to support notes.
        pres.theme = {
            bodyFontFace: JPN_FONT,
            headFontFace: JPN_FONT,
        };

        // 1. Define the Master Slide (now for footer only)
        pres.defineSlideMaster({
            title: MASTER_SLIDE,
            // Background is now handled on each slide individually
            objects: [
                {
                    text: {
                        text: `Copyright (C) ${new Date().getFullYear()} Your Company. All Rights Reserved.`,
                        options: { 
                            x: 0.5, y: '95%', w: '90%', 
                            align: 'center', fontSize: 10, color: '666666',
                            fontFace: JPN_FONT,
                        },
                    },
                },
            ],
        });

        // 2. Create slides using the Master Slide
        for (const [index, slideData] of slides.entries()) {
            const slide = pres.addSlide({ masterName: MASTER_SLIDE });

            // Set a fixed light blue background as a temporary solution, as gradient logic is unstable.
            if (index === 0 && titleSlideImagePath) {
                try {
                    // Check if the file exists before trying to use it
                    await fs.access(titleSlideImagePath);
                    slide.background = { path: titleSlideImagePath };
                    logger.info({ path: titleSlideImagePath }, "Set title slide background image.");
                } catch (error) {
                    logger.warn({ path: titleSlideImagePath, error }, "Could not access title slide image file. Using default background.");
                    slide.background = { color: 'E6F7FF' }; // Fallback
                }
            } else {
                slide.background = { color: 'E6F7FF' }; // Light Blue for other slides
            }


            // Add speaker notes if provided
            if (slideData.notes) {
                // The notes will inherit the default font from the theme set above.
                slide.addNotes(slideData.notes);
            }

            switch (slideData.layout) {
                case 'title_slide':
                    slide.addText(slideData.title, { 
                        x: 0, y: 0, w: '100%', h: '55%', // Move title up by adjusting the bounding box height
                        align: 'center', valign: 'middle', 
                        fontSize: 44, bold: true, fontFace: JPN_FONT,
                        color: '000000', // Ensure text is black
                        outline: { size: 1.5, color: 'FFFFFF' }, // Add a white outline
                    });
                    if (slideData.bullets.length > 0) {
                        slide.addText(slideData.bullets.join(', '), {
                            x: 0, y: '70%', w: '100%', // Move subtitle down
                            align: 'center', valign: 'top', 
                            fontSize: 18, fontFace: JPN_FONT,
                            color: '000000', // Ensure text is black for visibility
                            outline: { size: 1.0, color: 'FFFFFF' }, // Add a white outline
                        });
                    }
                    break;
                case 'section_header':
                    slide.addText(slideData.title, {
                        x: 0, y: 0, w: '100%', h: '100%',
                        align: 'center', valign: 'middle',
                        fontSize: 36, bold: true, fontFace: JPN_FONT
                    });
                    break;
                case 'quote':
                    if (slideData.special_content) {
                        slide.addText(`“${slideData.special_content}”`, {
                            x: 0, y: 0, w: '100%', h: '100%',
                            align: 'center', valign: 'middle',
                            fontSize: 32, italic: true, fontFace: JPN_FONT
                        });
                    }
                    slide.addText(slideData.title, { 
                        x: 0, y: '80%', w: '100%', 
                        align: 'center', fontSize: 18, fontFace: JPN_FONT
                    });
                    break;
                case 'content_with_visual':
                    slide.addText(slideData.title, { x: 0.5, y: 0.25, w: '90%', h: 0.75, fontSize: 32, bold: true, fontFace: JPN_FONT });
                    slide.addText(slideData.bullets.join('\n'), { 
                        x: 0.5, y: 1.5, w: '45%', h: '75%', 
                        fontSize: 18, bullet: { type: 'bullet' }, fontFace: JPN_FONT,
                        valign: 'top', paraSpaceAfter: 12,
                    });
                    if (slideData.imagePath) {
                        slide.addImage({ path: slideData.imagePath, x: 5.25, y: 1.5, w: 4.5, h: 4.5 * (9 / 16) });
                    }
                    break;
                case 'content_only':
                default:
                    slide.addText(slideData.title, { x: 0.5, y: 0.25, w: '90%', h: 0.75, fontSize: 32, bold: true, fontFace: JPN_FONT });
                    slide.addText(slideData.bullets.join('\n'), { 
                        x: 1.0, y: 1.5, w: '80%', h: '75%', 
                        fontSize: 20, bullet: { type: 'bullet' }, align: 'left', fontFace: JPN_FONT,
                        valign: 'top', paraSpaceAfter: 12,
                    });
                    break;
            }
        }
        
        await pres.writeFile({ fileName: filePath });

        // Collect unique image paths to delete
        const imagePathsToDelete = new Set<string>();
        for (const slideData of slides) {
            if (slideData.imagePath) {
                // To be safe, ensure we are only deleting files from the expected charts directory
                const chartsDir = path.join(config.tempDir, 'charts');
                if (path.resolve(path.dirname(slideData.imagePath)) === path.resolve(chartsDir)) {
                    imagePathsToDelete.add(slideData.imagePath);
                } else {
                    logger.warn({ imagePath: slideData.imagePath, expectedDir: chartsDir }, 'Skipping deletion of image from unexpected directory.');
                }
            }
        }

        // Clean up chart images
        for (const imagePath of imagePathsToDelete) {
            try {
                await fs.unlink(imagePath);
                logger.info({ imagePath }, 'Deleted temporary chart image.');
            } catch (unlinkError) {
                // Log the error but don't fail the whole process if deletion fails
                logger.warn({ error: unlinkError, imagePath }, 'Could not delete temporary chart image.');
            }
        }

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