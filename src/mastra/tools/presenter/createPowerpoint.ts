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
 * Wraps text at word or punctuation boundaries up to a max character length per line.
 * Works for both spaced (EN) and unspaced (JA) texts by using breakable characters.
 */
function wrapTextAtWordBoundaries(text: string, maxCharsPerLine: number): string {
  const normalized = (text ?? '').replace(/[\t\r\f\v]+/g, ' ').replace(/ +/g, ' ').trim();
  if (normalized.length <= maxCharsPerLine || maxCharsPerLine <= 0) return normalized;
  const breakable = /[\s、。，．,\.;:：;・／\/()（）「」『』\-–—]/; // include punctuation and spaces
  const lines: string[] = [];
  let line = '';
  let lastBreakPos = -1; // index in current line where we can break
  for (let i = 0; i < normalized.length; i++) {
    const ch = normalized[i];
    line += ch;
    if (breakable.test(ch)) {
      lastBreakPos = line.length; // break after this char
    }
    if (line.length >= maxCharsPerLine) {
      if (lastBreakPos > 0) {
        lines.push(line.slice(0, lastBreakPos));
        line = line.slice(lastBreakPos);
      } else {
        lines.push(line);
        line = '';
      }
      lastBreakPos = -1;
    }
  }
  if (line.length > 0) lines.push(line);
  return lines.join('\n');
}

/**
 * Formats a single bullet that may contain a title and content separated by '：' or ':'.
 * The content is wrapped and subsequent lines are indented to align after the colon.
 */
function formatColonSeparatedBullet(bullet: string, maxContentLineChars: number, indentCols: number = 4): string {
  const idx = (() => {
    const z = bullet.indexOf('：');
    if (z >= 0) return z;
    const a = bullet.indexOf(':');
    return a;
  })();
  if (idx <= 0) {
    // No colon pattern found; fallback to a gentle wrap of the whole bullet
    return wrapTextAtWordBoundaries(bullet, maxContentLineChars);
  }
  const title = bullet.slice(0, idx).trim();
  let content = bullet.slice(idx + 1).trim();
  if (!content) return bullet.trim();
  // Wrap content only
  const wrapped = wrapTextAtWordBoundaries(content, maxContentLineChars);
  const contentLines = wrapped.split('\n');
  const first = `${title}：${contentLines[0]}`;
  // Use full-width spaces to create a visual hanging indent for subsequent lines
  const clamped = Math.max(2, Math.min(indentCols, 8));
  const indent = '　'.repeat(clamped);
  const rest = contentLines.slice(1).map(l => `${indent}${l}`);
  return [first, ...rest].join('\n');
}

/**
 * Formats an array of bullets using colon-separated alignment.
 */
function formatBulletsForColonSeparation(bullets: string[], maxContentLineChars: number, indentCols: number = 4): string {
  return bullets.map(b => formatColonSeparatedBullet(b, maxContentLineChars, indentCols)).join('\n');
}

/**
 * Prevents lines from starting with forbidden leading punctuation (simple kinsoku shori).
 * Moves leading punctuation to the previous line when detected.
 */
function preventLeadingPunctuation(text: string): string {
  const forbid = /[、。，．,，。・;；:：)/）】』〉》”’]/;
  const lines = text.split('\n');
  for (let i = 1; i < lines.length; i++) {
    // Preserve existing indent (half/full width spaces)
    const match = lines[i].match(/^([ \t　]*)/);
    const indent = match ? match[1] : '';
    let rest = lines[i].slice(indent.length);
    if (rest.length === 0) continue;
    // If first visible character is forbidden punctuation, move it to previous line end
    while (rest.length > 0 && forbid.test(rest[0])) {
      lines[i - 1] = (lines[i - 1] || '').replace(/\s+$/, '') + rest[0];
      rest = rest.slice(1);
    }
    lines[i] = indent + rest;
  }
  return lines.join('\n');
}

/**
 * Dynamically fits bullets to a target number of lines per bullet by
 * adjusting wrap width in proportion to font size, and reducing font size if needed.
 */
function fitBulletsToLines(
  bullets: string[],
  initialFontSize: number,
  minFontSize: number,
  baseWrapCharsAtInitial: number,
  indentCols: number,
  targetMaxLinesPerBullet: number
): { text: string; fontSize: number; wrapChars: number } {
  let fontSize = initialFontSize;
  while (fontSize >= minFontSize) {
    const wrapChars = Math.max(8, Math.round(baseWrapCharsAtInitial * (fontSize / initialFontSize)));
    const formattedBullets = bullets.map(b => preventLeadingPunctuation(formatColonSeparatedBullet(b, wrapChars, indentCols)));
    const maxLines = formattedBullets.reduce((m, t) => Math.max(m, t.split('\n').length), 0);
    if (maxLines <= targetMaxLinesPerBullet) {
      return { text: formattedBullets.join('\n'), fontSize, wrapChars };
    }
    fontSize -= 1;
  }
  // Fallback at minimum font size
  const wrapChars = Math.max(8, Math.round(baseWrapCharsAtInitial * (minFontSize / initialFontSize)));
  return { text: bullets.map(b => preventLeadingPunctuation(formatColonSeparatedBullet(b, wrapChars, indentCols))).join('\n'), fontSize: minFontSize, wrapChars };
}

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
                    // Wrap long titles to avoid awkward auto-wrap
                    const wrappedTitle = wrapTextAtWordBoundaries(slideData.title, 22);
                    slide.addText(wrappedTitle, { 
                        x: 0, y: 0, w: '100%', h: '55%', // Move title up by adjusting the bounding box height
                        align: 'center', valign: 'middle', 
                        fontSize: 44, bold: true, fontFace: JPN_FONT,
                        color: '000000', // Ensure text is black
                        outline: { size: 1.5, color: 'FFFFFF' }, // Add a white outline
                    });
                    if (slideData.bullets.length > 0) {
                        // Format multiple colon-separated entries across lines for readability
                        const subtitle = preventLeadingPunctuation(formatBulletsForColonSeparation(slideData.bullets, 24, 4));
                        const wrappedSubtitle = subtitle;
                        slide.addText(wrappedSubtitle, {
                            x: 0, y: '70%', w: '100%', // Move subtitle down
                            align: 'center', valign: 'top', 
                            fontSize: 18, fontFace: JPN_FONT,
                            color: '000000', // Ensure text is black for visibility
                            outline: { size: 1.0, color: 'FFFFFF' }, // Add a white outline
                        });
                    }
                    break;
                case 'section_header':
                    slide.addText(wrapTextAtWordBoundaries(slideData.title, 28), {
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
                    slide.addText(wrapTextAtWordBoundaries(slideData.title, 30), { 
                        x: 0, y: '80%', w: '100%', 
                        align: 'center', fontSize: 18, fontFace: JPN_FONT
                    });
                    break;
                case 'content_with_visual':
                    slide.addText(wrapTextAtWordBoundaries(slideData.title, 36), { x: 0.5, y: 0.25, w: '90%', h: 0.75, fontSize: 32, bold: true, fontFace: JPN_FONT });
                    // Dynamically fit bullets to max 3 lines per bullet, reducing font size if needed
                    const fittedCv = fitBulletsToLines(slideData.bullets, /*initial*/18, /*min*/16, /*baseWrap*/22, /*indent*/4, /*targetLines*/3);
                    slide.addText(fittedCv.text, { 
                        x: 0.5, y: 1.5, w: '45%', h: '75%', 
                        fontSize: fittedCv.fontSize, bullet: { type: 'bullet' }, fontFace: JPN_FONT,
                        valign: 'top', paraSpaceAfter: 12,
                    });
                    if (slideData.imagePath) {
                        slide.addImage({ path: slideData.imagePath, x: 5.25, y: 1.5, w: 4.5, h: 4.5 * (9 / 16) });
                    }
                    break;
                case 'content_only':
                default:
                    slide.addText(wrapTextAtWordBoundaries(slideData.title, 40), { x: 0.5, y: 0.25, w: '90%', h: 0.75, fontSize: 32, bold: true, fontFace: JPN_FONT });
                    // Allow a bit more content on content-only slides: target 4 lines per bullet
                    const fittedCo = fitBulletsToLines(slideData.bullets, /*initial*/20, /*min*/19, /*baseWrap*/30, /*indent*/3, /*targetLines*/4);
                    slide.addText(fittedCo.text, { 
                        x: 0.8, y: 1.5, w: '88%', h: '75%', 
                        fontSize: fittedCo.fontSize, bullet: { type: 'bullet' }, align: 'left', fontFace: JPN_FONT,
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