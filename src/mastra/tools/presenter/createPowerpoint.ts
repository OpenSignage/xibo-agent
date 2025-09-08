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
import * as nodefs from 'node:fs';

//
const JPN_FONT = 'Noto Sans JP';

// Define a master slide layout for a consistent look and feel
const MASTER_SLIDE = 'MASTER_SLIDE';

function lightenHex(hex: string, amount: number): string {
  const h = (hex || '#E6F7FF').replace('#', '');
  const r = Math.min(255, Math.round(parseInt(h.slice(0,2) || 'E6', 16) + amount));
  const g = Math.min(255, Math.round(parseInt(h.slice(2,4) || 'F7', 16) + amount));
  const b = Math.min(255, Math.round(parseInt(h.slice(4,6) || 'FF', 16) + amount));
  const toHex = (n: number) => n.toString(16).padStart(2, '0').toUpperCase();
  return `#${toHex(r)}${toHex(g)}${toHex(b)}`;
}

// Attention colors to give stronger impression when appropriate
const ATTENTION_YELLOW = '#FFC107';
const ATTENTION_RED = '#E53935';

function chooseTitleBarColor(_title: string, defaultPrimary: string, slideAccent?: string): string {
  if (slideAccent && /^#?[0-9a-fA-F]{6}$/.test(slideAccent)) {
    const hex = slideAccent.startsWith('#') ? slideAccent : `#${slideAccent}`;
    return hex;
  }
  // No heuristics based on title text; use theme primary lightened
  return lightenHex(defaultPrimary, 70);
}

// Compute readable text color (black or white) based on background luminance
function pickTextColorForBackground(hex: string): '000000' | 'FFFFFF' {
  const h = (hex || '').replace('#', '');
  const r = parseInt(h.slice(0, 2) || '00', 16) / 255;
  const g = parseInt(h.slice(2, 4) || '00', 16) / 255;
  const b = parseInt(h.slice(4, 6) || '00', 16) / 255;
  const toLinear = (c: number) => (c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4));
  const rl = toLinear(r), gl = toLinear(g), bl = toLinear(b);
  const luminance = 0.2126 * rl + 0.7152 * gl + 0.0722 * bl; // 0 (black) .. 1 (white)
  return luminance > 0.6 ? '000000' : 'FFFFFF';
}

/**
 * Wraps text at word or punctuation boundaries up to a max character length per line.
 * Works for both spaced (EN) and unspaced (JA) texts by using breakable characters.
 */
function wrapTextAtWordBoundaries(text: string, maxCharsPerLine: number): string {
  // Collapse hard newlines to spaces to avoid mid-word breaks introduced upstream
  const normalized = (text ?? '')
    .replace(/[\t\r\f\v]+/g, ' ')
    .replace(/\n+/g, ' ')
    .replace(/ +/g, ' ')
    .trim();
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
        // Fallback: avoid breaking inside numeric tokens like "300億" or "8.0%"
        const isUnsafePair = (left: string, right: string) => {
          if (!left || !right) return false;
          const leftIsDigitOrDot = /[0-9\.]/.test(left);
          const rightIsDigitOrUnit = /[0-9％%億万千円]/.test(right);
          const dotFollowedByDigit = left === '.' && /[0-9]/.test(right);
          return (leftIsDigitOrDot && rightIsDigitOrUnit) || dotFollowedByDigit;
        };
        let splitPos = line.length;
        while (splitPos > 1 && splitPos < line.length && isUnsafePair(line[splitPos - 1], line[splitPos])) {
          splitPos -= 1;
        }
        // If we couldn't find a safe boundary inside the token, keep the original split
        if (splitPos <= 1 || splitPos >= line.length) {
        lines.push(line);
        line = '';
        } else {
          lines.push(line.slice(0, splitPos));
          line = line.slice(splitPos);
        }
      }
      lastBreakPos = -1;
    }
  }
  if (line.length > 0) lines.push(line);
  return lines.join('\n');
}

// Memoization caches
const wrapMemo = new Map<string, string>();
const fitMemo = new Map<string, { text: string; fontSize: number; wrapChars: number }>();
const colonMemo = new Map<string, string>();
const bufferToDataUrlMemo = new WeakMap<Buffer, string>();

// Wrap with memo
function wrapWithMemo(text: string, maxCharsPerLine: number): string {
  const key = `${maxCharsPerLine}|${text}`;
  const hit = wrapMemo.get(key);
  if (hit) return hit;
  const out = wrapTextAtWordBoundaries(text, maxCharsPerLine);
  wrapMemo.set(key, out);
  return out;
}

// Convert Buffer to data URL with WeakMap cache
function bufferToDataUrl(buf: Buffer): string {
  const hit = bufferToDataUrlMemo.get(buf);
  if (hit) return hit;
  const url = `data:image/png;base64,${buf.toString('base64')}`;
  bufferToDataUrlMemo.set(buf, url);
  return url;
}

/**
 * Formats a single bullet that may contain a title and content separated by '：' or ':'.
 * The content is wrapped and subsequent lines are indented to align after the colon.
 */
function formatColonSeparatedBullet(bullet: string, maxContentLineChars: number, indentCols: number = 4): string {
  // Remove unintended line breaks and leading full-width spaces after newlines
  bullet = (bullet || '').replace(/\n[ \t　]*/g, '');
  const idx = (() => {
    const z = bullet.indexOf('：');
    if (z >= 0) return z;
    const a = bullet.indexOf(':');
    return a;
  })();
  if (idx <= 0) {
    // No colon pattern found; fallback to a gentle wrap of the whole bullet
    return wrapWithMemo(bullet, maxContentLineChars);
  }
  const title = bullet.slice(0, idx).trim();
  let content = bullet.slice(idx + 1).trim();
  // Prefer breaking at Japanese quotes or parentheses boundaries
  // e.g., 「LED Vision」のような閉じ括弧の直後で折り返しを促す
  content = content.replace(/(」|』|\)|）)([^\s])/g, '$1 $2');
  if (!content) return bullet.trim();
  // Wrap content only (memoized)
  const wrapped = wrapWithMemo(content, maxContentLineChars);
  const contentLines = wrapped.split('\n');
  // Ensure that the first line after the colon does NOT immediately wrap
  const firstLineCapacity = Math.max(1, maxContentLineChars - (title.length + 1));
  if (contentLines.length > 0 && contentLines[0].length > firstLineCapacity) {
    const overflow = contentLines[0].length - firstLineCapacity;
    const move = contentLines[0].slice(firstLineCapacity);
    contentLines[0] = contentLines[0].slice(0, firstLineCapacity);
    if (contentLines.length > 1) contentLines[1] = move + contentLines[1]; else contentLines.push(move);
  }
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
 * Merge consecutive bullets that are continuations within Japanese quotes.
 * Example: ["「AAA。", "BBB。」"] -> ["「AAA。BBB。」"]
 */
function mergeQuotedContinuations(items: string[]): string[] {
  const out: string[] = [];
  let buffer: string | null = null;
  let open = false;
  for (const s of (items || [])) {
    const t = String(s || '').trim();
    if (!t) continue;
    if (buffer !== null) {
      // Append continuation without inserting extra spaces for JA
      buffer = buffer + t;
      const opens = (buffer.match(/「/g) || []).length;
      const closes = (buffer.match(/」/g) || []).length;
      open = opens > closes;
      if (!open) {
        out.push(buffer);
        buffer = null;
      }
      continue;
    }
    const opens = (t.match(/「/g) || []).length;
    const closes = (t.match(/」/g) || []).length;
    if (opens > closes && t.includes('「') && !t.includes('」')) {
      buffer = t;
      open = true;
    } else {
      out.push(t);
    }
  }
  if (buffer) out.push(buffer);
  return out;
}

/**
 * Prevents lines from starting with forbidden leading punctuation (simple kinsoku shori).
 * Moves leading punctuation to the previous line when detected.
 */
function preventLeadingPunctuation(text: string): string {
  if (!text) return '';
  // Clean each line's leading/trailing forbidden punctuation and rejoin
  const cleaned = String(text)
    .split('\n')
    .map((p) => p
      .replace(/^[、。，．,，。・;；:：)）】』〉》"』」\s]+/, '')
      .replace(/[」"』」\s]+$/, '')
      .trim()
    )
    .filter(Boolean)
    .join('\n');
  return cleaned;
}

/**
 * Converts markdown-like bold (**text**) into PPTX text runs with bold styling.
 * Removes the ** markers and toggles bold for the enclosed segments.
 */
function toBoldRunsFromMarkdown(text: string): Array<{ text: string; options?: { bold?: boolean } }> {
  if (!text) return [];
  const parts = String(text).split('**');
  const runs: Array<{ text: string; options?: { bold?: boolean } }> = [];
  let bold = false;
  for (let i = 0; i < parts.length; i++) {
    const seg = parts[i];
    if (!seg) {
      // Skip empty segments introduced by adjacent markers
      bold = !bold; // still toggle to keep sequence consistent
      continue;
    }
    runs.push(bold ? { text: seg, options: { bold: true } } : { text: seg });
    // Toggle bold state for next segment if there's another marker ahead
    if (i < parts.length - 1) bold = !bold;
  }
  return runs.length ? runs : [{ text: text }];
}

// Read image dimensions (PNG/JPEG minimal). Returns undefined on failure.
async function readImageDimensions(filePath: string): Promise<{ width: number; height: number } | undefined> {
  try {
    const buf = await fs.readFile(filePath);
    if (buf.length < 24) return undefined;
    // PNG signature
    if (buf[0] === 0x89 && buf[1] === 0x50 && buf[2] === 0x4E && buf[3] === 0x47) {
      const width = buf.readUInt32BE(16);
      const height = buf.readUInt32BE(20);
      if (width > 0 && height > 0) return { width, height };
    }
    // JPEG: scan for SOF0/2 markers for dimensions
    let off = 2; // skip FF D8
    while (off + 9 < buf.length) {
      if (buf[off] !== 0xFF) { off++; continue; }
      const marker = buf[off + 1];
      // SOF0..SOF3, SOF5..SOF7, SOF9..SOF11, SOF13..SOF15
      if ((marker >= 0xC0 && marker <= 0xC3) || (marker >= 0xC5 && marker <= 0xC7) || (marker >= 0xC9 && marker <= 0xCB) || (marker >= 0xCD && marker <= 0xCF)) {
        const blockLen = buf.readUInt16BE(off + 2);
        const height = buf.readUInt16BE(off + 5);
        const width = buf.readUInt16BE(off + 7);
        if (width > 0 && height > 0) return { width, height };
        off += 2 + blockLen;
        continue;
      }
      if (marker === 0xDA || marker === 0xD9) break; // SOS or EOI
      const len = buf.readUInt16BE(off + 2);
      off += 2 + len;
    }
  } catch {
    // ignore
  }
  return undefined;
}

/**
 * Prepare bullets so that lines following a header-like bullet (contains '：')
 * are visually grouped as sub-lines by adding full-width spaces as a prefix.
 * Also removes unintended newlines inside each item.
 */
function prepareBulletsForTemplate(bullets: string[], subIndentCols: number = 10): string[] {
  const out: string[] = [];
  let seenHeader = false;
  const isHeader = (s: string) => /：/.test(s);
  const clean = (s: string) => (s || '').replace(/\n[ \t　]*/g, '');
  for (const raw of bullets || []) {
    const item = clean(raw);
    if (isHeader(item)) {
      seenHeader = true;
      out.push(item);
    } else {
      if (seenHeader) {
        const indent = '　'.repeat(Math.max(2, Math.min(subIndentCols, 16)));
        out.push(indent + item);
      } else {
        out.push(item);
      }
    }
  }
  return out;
}

/**
 * Formats quote text into 2-4 short lines by removing surrounding quotes,
 * collapsing spaces/newlines, and splitting at Japanese punctuation while
 * respecting a max characters per line budget.
 */
function formatQuoteLines(raw: string, maxCharsPerLine: number): string {
  if (!raw) return '';
  let text = (raw || '')
    .replace(/[\r\t\v\f]+/g, ' ')
    .replace(/\n+/g, '\n')
    .trim();
  // Strip surrounding quotes (Japanese and Latin)
  text = text.replace(/^["」"『「\s]+/, '').replace(/["」"』」\s]+$/, '');
  // If content still contains line breaks, respect them as hard breaks
  const paragraphs = text.split('\n').map((p) => p.trim()).filter(Boolean);
  const source = paragraphs.length > 0 ? paragraphs.join(' ') : text;
  // Tokenize by punctuation to keep natural breaks (avoid breaking right after opening quotes or before closing quotes)
  const tokens = source
    .replace(/\s+/g, ' ')
    .split(/(?<=[。．！!？?、,，])/);
  const lines: string[] = [];
  let current = '';
  for (const t of tokens) {
    const chunk = t.trim();
    if (!chunk) continue;
    // Avoid starting lines with closing punctuation or quotes
    const startsWithBad = /^[、。，．,，。・;；:：)）】』〉》"』」\s]+/.test(chunk);
    // Prefer to keep quoted segments together
    const containsOpenQuote = chunk.includes('「');
    const containsCloseQuote = chunk.includes('」');
    const preferKeep = containsOpenQuote || containsCloseQuote || startsWithBad;
    if ((current + (current ? '' : '') + chunk).length > maxCharsPerLine) {
      if (preferKeep && current && current.length <= Math.floor(maxCharsPerLine * 0.9)) {
        // If near the limit, allow slight overflow to keep phrase intact
        const merged = current + chunk;
        if (merged.length <= Math.floor(maxCharsPerLine * 1.15)) {
          lines.push(merged);
          current = '';
          continue;
        }
      }
      if (current) lines.push(current);
      current = chunk;
    } else {
      current = current ? current + chunk : chunk;
    }
  }
  if (current) lines.push(current);
  // Limit to 4 lines, append ellipsis if needed
  if (lines.length > 4) {
    const kept = lines.slice(0, 4);
    const last = kept[3];
    kept[3] = last.length > maxCharsPerLine ? last.slice(0, Math.max(0, maxCharsPerLine - 1)) + '…' : last + '…';
    return kept.join('\n');
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
  targetMaxLinesPerBullet: number,
  maxCharsPerBulletHard?: number
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
  const formattedAtMin = bullets.map(b => preventLeadingPunctuation(formatColonSeparatedBullet(b, wrapChars, indentCols)));
  if (typeof maxCharsPerBulletHard === 'number' && maxCharsPerBulletHard > 0) {
    const trimmed = formattedAtMin.map(t => {
      const lines = t.split('\n');
      if (lines.length <= targetMaxLinesPerBullet) return t;
      const cut = lines.slice(0, targetMaxLinesPerBullet);
      const last = cut[cut.length - 1] || '';
      const hard = last.length > maxCharsPerBulletHard ? (last.slice(0, Math.max(0, maxCharsPerBulletHard - 1)) + '…') : last + '…';
      cut[cut.length - 1] = hard;
      return cut.join('\n');
    });
    return { text: trimmed.join('\n'), fontSize: minFontSize, wrapChars };
  }
  return { text: formattedAtMin.join('\n'), fontSize: minFontSize, wrapChars };
}

/**
 * Fits a block of text to target number of lines by adjusting wrap width
 * proportional to font size, then reducing font size as needed.
 */
function fitTextToLines(
  text: string,
  initialFontSize: number,
  minFontSize: number,
  baseWrapCharsAtInitial: number,
  targetMaxLines: number,
  maxCharsHard?: number,
  options?: { suppressEllipsis?: boolean; minFontFloor?: number }
): { text: string; fontSize: number; wrapChars: number } {
  const memoKey = JSON.stringify({ text, initialFontSize, minFontSize, baseWrapCharsAtInitial, targetMaxLines, maxCharsHard, options });
  const hit = fitMemo.get(memoKey);
  if (hit) return hit;
  let fontSize = initialFontSize;
  const normalized = preventLeadingPunctuation(
    (text || '')
      .replace(/[\t\r\f\v]+/g, ' ')
      .replace(/\n+/g, ' ')
      .replace(/ +/g, ' ')
      .trim()
  );
  while (fontSize >= minFontSize) {
    const wrapChars = Math.max(8, Math.round(baseWrapCharsAtInitial * (fontSize / initialFontSize)));
    const wrapped = wrapWithMemo(normalized, wrapChars);
    const lines = wrapped.split('\n');
    if (lines.length <= targetMaxLines) {
      const out = { text: wrapped, fontSize, wrapChars };
      fitMemo.set(memoKey, out);
      return out;
    }
    fontSize -= 1;
  }
  if (options?.minFontFloor && options.minFontFloor < minFontSize) {
    while (fontSize >= options.minFontFloor) {
      const wrapChars = Math.max(8, Math.round(baseWrapCharsAtInitial * (fontSize / initialFontSize)));
      const wrapped = wrapWithMemo(normalized, wrapChars);
      const lines = wrapped.split('\n');
      if (lines.length <= targetMaxLines) {
        const out = { text: wrapped, fontSize, wrapChars };
        fitMemo.set(memoKey, out);
        return out;
      }
      fontSize -= 1;
    }
  }
  const wrapChars = Math.max(8, Math.round(baseWrapCharsAtInitial * (minFontSize / initialFontSize)));
  const wrappedMin = wrapWithMemo(normalized, wrapChars);
  const linesMin = wrappedMin.split('\n');
  if (linesMin.length > targetMaxLines) {
    if (options?.suppressEllipsis) {
      const out = { text: wrappedMin, fontSize: Math.max(options?.minFontFloor ?? minFontSize, 1), wrapChars };
      fitMemo.set(memoKey, out);
      return out;
    }
    const cut = linesMin.slice(0, targetMaxLines);
    if (typeof maxCharsHard === 'number' && maxCharsHard > 0) {
      const last = cut[cut.length - 1] || '';
      cut[cut.length - 1] = last.length > maxCharsHard ? (last.slice(0, Math.max(0, maxCharsHard - 1)) + '…') : (last + '…');
    } else {
      cut[cut.length - 1] = (cut[cut.length - 1] || '') + '…';
    }
    const out = { text: cut.join('\n'), fontSize: minFontSize, wrapChars };
    fitMemo.set(memoKey, out);
    return out;
  }
  const out = { text: wrappedMin, fontSize: minFontSize, wrapChars };
  fitMemo.set(memoKey, out);
  return out;
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
  layout: z.enum(['title_slide', 'section_header', 'content_with_visual', 'content_only', 'quote', 'freeform']).optional().describe('The layout type for the slide.'),
  special_content: z.string().optional().describe('Special content for layouts like \'quote\'.'),
  elements: z.array(z.any()).optional().describe('Freeform elements array when layout is freeform.'),
});

const inputSchema = z.object({
  fileName: z.string().describe('The base name for the output .pptx file (e.g., "presentation").'),
  slides: z.array(slideSchema).describe('An array of slide objects representing the presentation structure.'),
  themeColor1: z.string().optional().describe('The primary hex color for the background gradient.'),
  themeColor2: z.string().optional().describe('The secondary hex color for the background gradient.'),
  titleSlideImagePath: z.string().optional().describe('An optional path to a background image for the title slide.'),
  
  // Optional tokenized style parameters to unify theme
  styleTokens: z.object({
    primary: z.string().optional(),
    secondary: z.string().optional(),
    accent: z.string().optional(),
    cornerRadius: z.number().optional(),
    outlineColor: z.string().optional(),
    spacingBaseUnit: z.number().optional(),
    shadowPreset: z.enum(['none','soft','strong']).optional(),
  }).optional(),
  visualRecipes: z.array(z.any()).optional().describe('Per-slide visual recipe list aligned by index.'),
  // Company branding (optional)
  companyLogoPath: z.string().optional().describe('Optional absolute path to company logo image (PNG). When provided, logo will be shown top-right on each slide.'),
  companyCopyright: z.string().optional().describe('Optional copyright text to place at the bottom of each slide.'),
  companyAbout: z.string().optional().describe('Optional company overview text to be added as a final slide.'),
  companyOverview: z.object({
    company_name: z.string().optional(),
    address: z.string().optional(),
    founded: z.string().optional(),
    representative: z.string().optional(),
    business: z.array(z.string()).optional(),
    homepage: z.string().optional(),
    contact: z.string().optional(),
    vision: z.string().optional(),
  }).optional(),
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
    const companyLogoPath: string | undefined = (context as any).companyLogoPath;
    const companyCopyright: string | undefined = (context as any).companyCopyright;
    const companyAbout: string | undefined = (context as any).companyAbout;
    logger.info({ hasLogo: !!companyLogoPath, hasCopyright: !!companyCopyright, hasAbout: !!companyAbout }, 'Branding options received for PowerPoint generation.');
    const styleTokens = (context as any).styleTokens || {};
    const primary = typeof styleTokens.primary === 'string' ? styleTokens.primary : (themeColor1 || '#0B5CAB');
    const secondary = typeof styleTokens.secondary === 'string' ? styleTokens.secondary : (themeColor2 || '#00B0FF');
    const accent = typeof styleTokens.accent === 'string' ? styleTokens.accent : '#FFC107';
    const cornerRadius = typeof styleTokens.cornerRadius === 'number' ? Math.max(0, Math.min(16, styleTokens.cornerRadius)) : 12;
    const outlineColor = typeof styleTokens.outlineColor === 'string' ? styleTokens.outlineColor : '#FFFFFF';
    const spacingBase = typeof styleTokens.spacingBaseUnit === 'number' ? Math.max(0.1, Math.min(1.0, styleTokens.spacingBaseUnit)) : 1.0;
    const shadowPreset = ((): 'none'|'soft'|'strong' => {
      const v = (styleTokens.shadowPreset as any);
      return v === 'none' || v === 'soft' || v === 'strong' ? v : 'soft';
    })();
    const presenterDir = config.presentationsDir;
    const filePath = path.join(presenterDir, `${fileName}.pptx`);

    logger.info({ filePath, slideCount: slides.length }, 'Creating PowerPoint presentation...');

    try {
        await fs.mkdir(presenterDir, { recursive: true });
        const pres = new PptxGenJS();
        // Ensure 16:9 slide size
        try {
            (pres as any).defineLayout({ name: 'WIDE_16x9', width: 13.33, height: 7.5 });
            (pres as any).layout = 'WIDE_16x9';
        } catch {}

        // Set the default theme fonts to a Japanese font to support notes.
        pres.theme = {
            bodyFontFace: JPN_FONT,
            headFontFace: JPN_FONT,
        };

        // --- Layout constants (16:9) ---
        const pageW = 13.33; // inches
        const pageH = 7.5;   // inches
        const marginX = 0.6;
        const contentW = pageW - marginX * 2; // 12.13
        const gap = 0.4 * spacingBase;
        const twoColTextW = 7.2; // left text column width
        const twoColTextX = marginX;
        const twoColVisualW = Math.max(3.8, contentW - twoColTextW - gap);
        const twoColVisualX = twoColTextX + twoColTextW + gap;
        const contentTopY = 0.95;
        const twoColTextH = 3.6 * spacingBase;
        const twoColVisualH = 3.2 * spacingBase;
        const bottomBandY = 4.6 * spacingBase;
        const bottomBandH = 2.3 * spacingBase;

        // 1. Define the Master Slide (no static footer; branding handled per-slide)
        pres.defineSlideMaster({
            title: MASTER_SLIDE,
            // Background is now handled on each slide individually
            objects: [
                
            ],
        });

        const shadowOf = (preset: 'none'|'soft'|'strong'): any => {
          if (preset === 'none') return undefined;
          if (preset === 'strong') return { type: 'outer', color: '000000', opacity: 0.55, blur: 16, offset: 5, angle: 45 } as any;
          return { type: 'outer', color: '000000', opacity: 0.45, blur: 12, offset: 4, angle: 45 } as any;
        };

        // Draw infographic primitives on the given slide
        function drawInfographic(targetSlide: any, type: string, payload: any, region?: { x: number; y: number; w: number; h: number }) {
            const rx = region?.x ?? 0.8;
            const ry = region?.y ?? 3.6;
            const rw = region?.w ?? 8.4;
            const rh = region?.h ?? 2.2;
            switch (type) {
                case 'bar_chart': {
                    try {
                        const labels: string[] = Array.isArray(payload?.labels) ? payload.labels : (Array.isArray(payload?.items) ? payload.items.map((it: any)=>String(it?.label||'')) : Array.isArray(payload?.values) ? payload.values.map((_:any,i:number)=>`V${i+1}`) : ['A','B','C']);
                        const seriesArr: any[] = Array.isArray(payload?.series) ? payload.series : [];
                        const hasSeries = seriesArr.length > 0;
                        const data = hasSeries
                          ? seriesArr.map((s: any) => ({ name: String(s?.name || 'Series'), labels, values: (Array.isArray(s?.data) ? s.data : []).map((n: any) => Number(n) || 0) }))
                          : [{ name: 'Series', labels, values: (Array.isArray(payload?.values) ? payload.values : (Array.isArray(payload?.items) ? payload.items.map((it:any)=>Number(it?.value||0)) : [10,20,15])) }];
                        const chartType = ((PptxGenJS as any).ChartType && (PptxGenJS as any).ChartType.bar) || ('bar' as any);
                        const chartColors = [primary, secondary, accent].map((c: string) => c.replace('#',''));
                        (targetSlide as any).addChart(chartType, data, { x: rx, y: ry, w: rw, h: rh, chartColors } as any);
                    } catch {
                        targetSlide.addText('Bar Chart', { x: rx, y: ry, w: rw, h: 0.3, fontSize: 12, bold: true, fontFace: JPN_FONT });
                    }
                    break;
                }
                case 'pie_chart': {
                    try {
                        const items: any[] = Array.isArray(payload?.items) ? payload.items : [];
                        const labels: string[] = items.length ? items.map((it:any)=>String(it?.label||'')) : (Array.isArray(payload?.labels)? payload.labels : ['A','B','C']);
                        const values: number[] = items.length ? items.map((it:any)=>Number(it?.value||0)) : (Array.isArray(payload?.values) ? payload.values.map((n:any)=>Number(n)||0) : [30,40,30]);
                        const data = [{ name: 'Share', labels, values }];
                        const chartType = ((PptxGenJS as any).ChartType && (PptxGenJS as any).ChartType.pie) || ('pie' as any);
                        const chartColors = [primary, secondary, accent, lightenHex(primary,20), lightenHex(secondary,20)].map((c: string) => c.replace('#',''));
                        (targetSlide as any).addChart(chartType, data, { x: rx, y: ry, w: rw, h: rh, chartColors, showLegend: true, legendPos: 'r' } as any);
                    } catch {
                        targetSlide.addText('Pie Chart', { x: rx, y: ry, w: rw, h: 0.3, fontSize: 12, bold: true, fontFace: JPN_FONT });
                    }
                    break;
                }
                case 'line_chart': {
                    try {
                        const labels: string[] = Array.isArray(payload?.labels) ? payload.labels : [];
                        const seriesArr: any[] = Array.isArray(payload?.series) ? payload.series : [];
                        const data = seriesArr.length > 0
                          ? seriesArr.map((s: any) => ({ name: String(s?.name || 'Series'), labels, values: (Array.isArray(s?.data) ? s.data : []).map((n: any) => Number(n) || 0) }))
                          : [{ name: 'Series', labels: ['A','B','C','D'], values: [10,20,15,25] }];
                        const chartType = ((PptxGenJS as any).ChartType && (PptxGenJS as any).ChartType.line) || ('line' as any);
                        const chartColors = [primary, secondary, accent].map((c: string) => c.replace('#',''));
                        (targetSlide as any).addChart(chartType, data, { x: rx, y: ry, w: rw, h: rh, chartColors } as any);
                    } catch (e) {
                        targetSlide.addText('Line Chart', { x: rx, y: ry, w: rw, h: 0.3, fontSize: 12, bold: true, fontFace: JPN_FONT });
                    }
                    break;
                }
                case 'kpi_grid': {
                    const items = Array.isArray(payload?.items) ? payload.items : [];
                    const cardW = Math.min( (rw - 0.8) / 2, 2.6 );
                    const cardH = Math.min( rh / 2 - 0.2, 1.35 );
                    const gap = 0.4;
                    items.slice(0, 4).forEach((it: any, idx: number) => {
                        const row = Math.floor(idx / 2), col = idx % 2;
                        const x = rx + 0.2 + col * (cardW + gap);
                        const y = ry + 0.2 + row * (cardH + gap);
                        targetSlide.addShape(pres.ShapeType.roundRect, { x, y, w: cardW, h: cardH, fill: { color: secondary }, line: { color: 'FFFFFF', width: 0.5 }, rectRadius: cornerRadius, shadow: shadowOf(shadowPreset) });
                        targetSlide.addText(String(it?.value ?? ''), { x: x + 0.2, y: y + 0.2, w: cardW - 0.4, h: cardH * 0.55, fontSize: 18, bold: true, color: 'FFFFFF', align: 'center', fontFace: JPN_FONT });
                        targetSlide.addText(String(it?.label ?? ''), { x: x + 0.2, y: y + cardH * 0.65, w: cardW - 0.4, h: cardH * 0.3, fontSize: 11.5, color: 'FFFFFF', align: 'center', fontFace: JPN_FONT });
                    });
                    break;
                }
                case 'kpi_donut': {
                    const items = Array.isArray(payload?.items) ? payload.items : [];
                    const values = items.map((it: any) => Number(it?.value ?? 0)).filter((n: number) => Number.isFinite(n) && n >= 0);
                    const sum = values.reduce((a: number, b: number) => a + b, 0);
                    const isDistribution = items.length >= 4 || (sum > 95 && sum < 105);
                    const labelsForLog = items.map((it: any) => String(it?.label ?? ''));
                    if (isDistribution) {
                        // Render as doughnut chart for multi-category distribution
                        const labels = items.map((it: any) => String(it?.label ?? ''));
                        const data = [{ name: 'Share', labels, values }];
                        const palette = [
                            primary,
                            secondary,
                            accent,
                            lightenHex(primary, 20),
                            lightenHex(secondary, 20),
                            lightenHex(accent, 20),
                            lightenHex(primary, 40),
                            lightenHex(secondary, 40),
                            lightenHex(accent, 40),
                        ];
                        const colors = labels.map((_: string, i: number) => palette[i % palette.length]);
                        const chartColors = colors.map((c: string) => String(c || '').replace('#', ''));
                        try {
                            const doughnutType = ((PptxGenJS as any).ChartType && (PptxGenJS as any).ChartType.doughnut) || ('doughnut' as any);
                            const hasAddChart = typeof (targetSlide as any).addChart === 'function';
                            (targetSlide as any).addChart(doughnutType, data, {
                                x: rx, y: ry, w: rw, h: rh,
                                showLegend: true,
                                legendPos: 'b',
                                chartColors,
                            } as any);
                        } catch (e) {
                            // Fallback: simple title if chart fails
                            targetSlide.addText('KPI Donut', { x: rx, y: ry, w: rw, h: 0.3, fontSize: 12, bold: true, fontFace: JPN_FONT });
                        }
                    } else {
                        // Render 1-3 concentric progress rings
                        const cx = rx + rw / 2;
                        const cy = ry + rh / 2;
                        const radius = Math.min(rw, rh) / 2 - 0.1;
                        items.slice(0, 3).forEach((it: any, i: number) => {
                            const r = radius - i * 0.3;
                            const v = Math.max(0, Math.min(100, Number(it?.value ?? 0)));
                            // background ring
                            targetSlide.addShape(pres.ShapeType.ellipse, { x: cx - r, y: cy - r, w: 2 * r, h: 2 * r, line: { color: '#CCCCCC', width: 2 } });
                            // foreground arc approximation using pie slice (limited API)
                            const wedgeDeg = Math.max(0, Math.min(359.9, (v / 100) * 360));
                            targetSlide.addShape(pres.ShapeType.pie, { x: cx - r, y: cy - r, w: 2 * r, h: 2 * r, fill: { color: i % 2 ? secondary : primary }, angle: wedgeDeg } as any);
                            targetSlide.addText(String(it?.label ?? ''), { x: cx - r, y: cy + r + 0.05 + i * 0.25, w: 2 * r, h: 0.25, fontSize: 10, align: 'center', fontFace: JPN_FONT });
                        });
                    }
                    break;
                }
                case 'progress': {
                    const items = Array.isArray(payload?.items) ? payload.items : [];
                    const barH = Math.min(0.4, rh / Math.max(1, items.length) - 0.1);
                    items.slice(0, 5).forEach((it: any, i: number) => {
                        const y = ry + i * (barH + 0.15);
                        targetSlide.addText(String(it?.label ?? ''), { x: rx, y, w: rw * 0.35, h: barH, fontSize: 11, fontFace: JPN_FONT });
                        targetSlide.addShape(pres.ShapeType.rect, { x: rx + rw * 0.4, y, w: rw * 0.55, h: barH, fill: { color: '#EEEEEE' }, line: { color: '#DDDDDD', width: 0.5 } });
                        const v = Math.max(0, Math.min(100, Number(it?.value ?? 0)));
                        targetSlide.addShape(pres.ShapeType.rect, { x: rx + rw * 0.4, y, w: (rw * 0.55) * (v / 100), h: barH, fill: { color: primary }, line: { color: primary, width: 0 } });
                    });
                    break;
                }
                case 'gantt': {
                    const tasks = Array.isArray(payload?.tasks) ? payload.tasks : [];
                    const barH = Math.min(0.35, rh / Math.max(1, tasks.length) - 0.08);
                    // naive scale: position by index since we don't parse dates here
                    tasks.slice(0, 6).forEach((t: any, i: number) => {
                        const y = ry + i * (barH + 0.12);
                        targetSlide.addText(String(t?.label ?? ''), { x: rx, y, w: rw * 0.25, h: barH, fontSize: 10, fontFace: JPN_FONT });
                        targetSlide.addShape(pres.ShapeType.rect, { x: rx + rw * 0.28, y, w: rw * 0.65, h: barH, fill: { color: lightenHex(secondary, 20) }, line: { color: secondary, width: 0.5 } });
                    });
                    break;
                }
                case 'heatmap': {
                    const xLabels = Array.isArray(payload?.x) ? payload.x : [];
                    const yLabels = Array.isArray(payload?.y) ? payload.y : [];
                    const z: number[][] = Array.isArray(payload?.z) ? payload.z : [];
                    const cols = Math.max(1, xLabels.length);
                    const rows = Math.max(1, yLabels.length);
                    // Compute min/max for normalization
                    let minZ = Infinity, maxZ = -Infinity;
                    for (let r = 0; r < rows; r++) {
                        for (let c = 0; c < cols; c++) {
                            const vv = Number((z[r] || [])[c] ?? 0);
                            if (Number.isFinite(vv)) { minZ = Math.min(minZ, vv); maxZ = Math.max(maxZ, vv); }
                        }
                    }
                    if (!Number.isFinite(minZ) || !Number.isFinite(maxZ) || minZ === maxZ) { minZ = 0; maxZ = 1; }
                    // Layout padding for axis labels
                    const padLeft = 1.0; // space for y labels
                    const padTop = 0.5;  // space for x labels
                    const gridX = rx + padLeft;
                    const gridY = ry + padTop;
                    const gridW = Math.max(0.1, rw - padLeft);
                    const gridH = Math.max(0.1, rh - padTop);
                    const cellW = gridW / Math.max(1, cols);
                    const cellH = gridH / Math.max(1, rows);
                    // Axis labels (top)
                    for (let c = 0; c < cols; c++) {
                        targetSlide.addText(String(xLabels[c] ?? ''), { x: gridX + c * cellW, y: ry + 0.05, w: cellW, h: 0.35, fontSize: 12, align: 'center', fontFace: JPN_FONT });
                    }
                    // Axis labels (left)
                    for (let r = 0; r < rows; r++) {
                        targetSlide.addText(String(yLabels[r] ?? ''), { x: rx + 0.05, y: gridY + r * cellH + (cellH - 0.3)/2, w: padLeft - 0.1, h: 0.3, fontSize: 12, align: 'right', fontFace: JPN_FONT });
                    }
                    // Color helper: blend white -> primary by t
                    const blend = (t: number) => {
                        const clamp = Math.max(0, Math.min(1, t));
                        const hex = (h: string) => h.replace('#','');
                        const p = hex(primary);
                        const pr = parseInt(p.slice(0,2),16), pg = parseInt(p.slice(2,4),16), pb = parseInt(p.slice(4,6),16);
                        const r = Math.round(255 + (pr - 255) * clamp).toString(16).padStart(2,'0');
                        const g = Math.round(255 + (pg - 255) * clamp).toString(16).padStart(2,'0');
                        const b = Math.round(255 + (pb - 255) * clamp).toString(16).padStart(2,'0');
                        return `#${r}${g}${b}`;
                    };
                    // Cells
                    for (let r = 0; r < rows; r++) {
                        for (let c = 0; c < cols; c++) {
                            const raw = Number((z[r] || [])[c] ?? 0);
                            const t = (raw - minZ) / (maxZ - minZ);
                            const color = blend(t);
                            const cx = gridX + c * cellW, cy = gridY + r * cellH;
                            targetSlide.addShape(pres.ShapeType.rect, { x: cx, y: cy, w: cellW, h: cellH, fill: { color }, line: { color: '#EAEAEA', width: 0.75 } });
                        }
                    }
                    break;
                }
                case 'venn2': {
                    const a = payload?.a, b = payload?.b, overlap = Math.max(0, Number(payload?.overlap ?? 0));
                    const r = Math.min(rw, rh) / 3;
                    const cx1 = rx + rw / 2 - r * 0.6;
                    const cx2 = rx + rw / 2 + r * 0.6;
                    const cy = ry + rh / 2;
                    targetSlide.addShape(pres.ShapeType.ellipse, { x: cx1 - r, y: cy - r, w: 2 * r, h: 2 * r, fill: { color: lightenHex(primary, 40) }, line: { color: primary, width: 1 } });
                    targetSlide.addShape(pres.ShapeType.ellipse, { x: cx2 - r, y: cy - r, w: 2 * r, h: 2 * r, fill: { color: lightenHex(secondary, 40) }, line: { color: secondary, width: 1 } });
                    targetSlide.addText(String(a?.label ?? 'A'), { x: cx1 - r, y: cy + r + 0.05, w: 2 * r, h: 0.25, fontSize: 10, align: 'center', fontFace: JPN_FONT });
                    targetSlide.addText(String(b?.label ?? 'B'), { x: cx2 - r, y: cy + r + 0.05, w: 2 * r, h: 0.25, fontSize: 10, align: 'center', fontFace: JPN_FONT });
                    break;
                }
                case 'pyramid': {
                    const steps = Array.isArray(payload?.steps) ? payload.steps : [];
                    const layers = Math.min(5, steps.length);
                    for (let i = 0; i < layers; i++) {
                        const y = ry + i * (rh / layers);
                        const width = rw * (1 - i * 0.15);
                        const layerBg = i % 2 ? secondary : primary;
                        targetSlide.addShape(pres.ShapeType.triangle, { x: rx + (rw - width)/2, y, w: width, h: rh / layers - 0.05, fill: { color: layerBg }, line: { color: '#FFFFFF', width: 0.5 } });
                        const pyrTextColor = pickTextColorForBackground(layerBg).toString();
                        targetSlide.addText(String(steps[i]?.label ?? ''), { x: rx, y: y + 0.02, w: rw, h: rh / layers - 0.09, fontSize: 11, color: pyrTextColor, align: 'center', valign: 'middle', fontFace: JPN_FONT });
                    }
                    break;
                }
                case 'waterfall': {
                    const items = Array.isArray(payload?.items) ? payload.items : [];
                    const sliced = items.slice(0, 8);
                    const count = Math.max(1, sliced.length);
                    const gap = 0.2;
                    const totalGap = gap * Math.max(0, count - 1);
                    const barW = Math.max(0.2, (rw - totalGap) / count);
                    const maxAbs = Math.max(1, ...sliced.map((it: any) => Math.abs(Number(it?.delta || 0))));
                    const maxBarH = rh * 0.85; // leave some top/bottom padding
                    const scale = maxBarH / maxAbs;
                    const minBarH = Math.min(0.15, rh * 0.25);
                    const baseline = ry + rh * 0.55; // slightly above center in the bottom band
                    let x = rx;
                    sliced.forEach((it: any) => {
                        const v = Number(it?.delta || 0);
                        let h = Math.max(minBarH, Math.abs(v) * scale);
                        // Clamp to region
                        if (h > maxBarH) h = maxBarH;
                        let y = v >= 0 ? (baseline - h) : baseline;
                        if (y < ry) y = ry;
                        if (y + h > ry + rh) h = (ry + rh) - y;
                        targetSlide.addShape(pres.ShapeType.rect, { x, y, w: barW, h, fill: { color: v >= 0 ? secondary : primary }, line: { color: '#FFFFFF', width: 0.5 } });
                        // value label near bar end
                        const valText = `${v >= 0 ? '+' : ''}${v}`;
                        let valY = v >= 0 ? (y - 0.25) : (y + h + 0.05);
                        if (valY < ry) valY = ry;
                        if (valY + 0.3 > ry + rh) valY = ry + rh - 0.3;
                        targetSlide.addText(valText, { x: x - 0.2, y: valY, w: barW + 0.4, h: 0.3, fontSize: 10, align: 'center', fontFace: JPN_FONT });
                        // category label at baseline
                        let labY = baseline + 0.1;
                        if (labY + 0.3 > ry + rh) labY = ry + rh - 0.3;
                        targetSlide.addText(String(it?.label ?? ''), { x: x - 0.3, y: labY, w: barW + 0.6, h: 0.3, fontSize: 10, align: 'center', fontFace: JPN_FONT });
                        x += barW + gap;
                    });
                    break;
                }
                case 'bullet': {
                    const items = Array.isArray(payload?.items) ? payload.items : [];
                    const rowH = Math.min(0.45, rh / Math.max(1, items.length) - 0.08);
                    items.slice(0, 5).forEach((it: any, i: number) => {
                        const y = ry + i * (rowH + 0.12);
                        targetSlide.addText(String(it?.label ?? ''), { x: rx + 0.1, y, w: rw * 0.25 - 0.1, h: rowH, fontSize: 11, fontFace: JPN_FONT });
                        const baseX = rx + rw * 0.30;
                        targetSlide.addShape(pres.ShapeType.rect, { x: baseX, y, w: rw * 0.58, h: rowH, fill: { color: '#EEEEEE' }, line: { color: '#DDDDDD', width: 0.5 } });
                        const val = Number(it?.value ?? 0), tgt = Number(it?.target ?? 0);
                        const denom = Math.max(1, Math.max(val, tgt, 100));
                        const valW = Math.max(0, Math.min(rw * 0.58, (rw * 0.58) * (val / denom)));
                        const tgtX = baseX + Math.max(0, Math.min(rw * 0.58, (rw * 0.58) * (tgt / denom)));
                        targetSlide.addShape(pres.ShapeType.rect, { x: baseX, y, w: valW, h: rowH, fill: { color: primary }, line: { color: primary, width: 0 } });
                        targetSlide.addShape(pres.ShapeType.line, { x: tgtX, y, w: 0, h: rowH, line: { color: '#333333', width: 2 } });
                    });
                    break;
                }
                case 'map_markers': {
                    const markers = Array.isArray(payload?.markers) ? payload.markers : [];
                    // draw a simple placeholder map rect
                    targetSlide.addShape(pres.ShapeType.rect, { x: rx, y: ry, w: rw, h: rh, fill: { color: '#F2F6FA' }, line: { color: '#DDE3EA', width: 1 } });
                    markers.slice(0, 8).forEach((m: any) => {
                        const px = rx + Math.max(0, Math.min(1, Number(m?.x || 0))) * rw;
                        const py = ry + Math.max(0, Math.min(1, Number(m?.y || 0))) * rh;
                        targetSlide.addShape(pres.ShapeType.ellipse, { x: px - 0.06, y: py - 0.06, w: 0.12, h: 0.12, fill: { color: accent }, line: { color: '#FFFFFF', width: 0.8 } });
                        targetSlide.addText(String(m?.label ?? ''), { x: px + 0.1, y: py - 0.06, w: 1.6, h: 0.24, fontSize: 10, fontFace: JPN_FONT });
                    });
                    break;
                }
                case 'callouts': {
                    const items = Array.isArray(payload?.items) ? payload.items : [];
                    items.slice(0, 4).forEach((it: any, i: number) => {
                        const x = rx + (i % 2) * (rw/2) + 0.1;
                        const y = ry + Math.floor(i/2) * (rh/2) + 0.1;
                        const calloutBg = lightenHex(secondary, 60);
                        targetSlide.addShape(pres.ShapeType.rect, { x, y, w: rw/2 - 0.2, h: rh/2 - 0.2, fill: { color: calloutBg }, line: { color: secondary, width: 0.5 }, shadow: shadowOf(shadowPreset) });
                        const calloutColor = pickTextColorForBackground(calloutBg).toString();
                        targetSlide.addText(String(it?.label ?? ''), { x: x + 0.1, y: y + 0.1, w: rw/2 - 0.4, h: 0.4, fontSize: 12, bold: true, fontFace: JPN_FONT, color: calloutColor });
                        if (it?.value) {
                            targetSlide.addText(String(it.value), { x: x + 0.1, y: y + 0.55, w: rw/2 - 0.4, h: 0.4, fontSize: 14, fontFace: JPN_FONT, color: calloutColor });
                        }
                    });
                    break;
                }
                case 'kpi': {
                    const items = Array.isArray(payload?.items) ? payload.items : [];
                    const cardW = Math.min( (rw - 0.8) / 2, 2.6 );
                    const cardH = Math.min( rh / 2 - 0.2, 1.35 );
                    const gap = 0.4;
                    items.slice(0, 4).forEach((it: any, idx: number) => {
                        const row = Math.floor(idx / 2), col = idx % 2;
                        const x = rx + 0.2 + col * (cardW + gap);
                        const y = ry + 0.2 + row * (cardH + gap);
                        targetSlide.addShape(pres.ShapeType.roundRect, { x, y, w: cardW, h: cardH, fill: { color: secondary }, line: { color: 'FFFFFF', width: 0.5 }, rectRadius: cornerRadius, shadow: shadowOf(shadowPreset) });
                        targetSlide.addText(String(it?.value ?? ''), { x: x + 0.2, y: y + 0.2, w: cardW - 0.4, h: cardH * 0.55, fontSize: 18, bold: true, color: 'FFFFFF', align: 'center', fontFace: JPN_FONT });
                        targetSlide.addText(String(it?.label ?? ''), { x: x + 0.2, y: y + cardH * 0.65, w: cardW - 0.4, h: cardH * 0.3, fontSize: 11.5, color: 'FFFFFF', align: 'center', fontFace: JPN_FONT });
                    });
                    break;
                }
                case 'checklist': {
                    const items = Array.isArray(payload?.items) ? payload.items : [];
                    const lineH = Math.min(0.55, rh / Math.max(1, items.length) - 0.06);
                    const bulletW = 0.22;
                    items.slice(0, 6).forEach((it: any, i: number) => {
                        const y = ry + i * (lineH + 0.08);
                        // bullet circle
                        targetSlide.addShape(pres.ShapeType.ellipse, { x: rx, y: y + (lineH - bulletW)/2, w: bulletW, h: bulletW, fill: { color: accent }, line: { color: 'FFFFFF', width: 0.5 } });
                        // text
                        const label = String(it?.label ?? '');
                        targetSlide.addText(label, { x: rx + bulletW + 0.15, y, w: rw - (bulletW + 0.25), h: lineH, fontSize: 14, fontFace: JPN_FONT });
                    });
                    break;
                }
                case 'matrix': {
                    const xL = payload?.axes?.xLabels || ['X1','X2'];
                    const yL = payload?.axes?.yLabels || ['Y1','Y2'];
                    // Draw 2x2 grid
                    const gridX = rx;
                    const gridY = ry;
                    const gridW = rw;
                    const gridH = rh;
                    targetSlide.addShape(pres.ShapeType.rect, { x: gridX, y: gridY, w: gridW, h: gridH, fill: { color: 'FFFFFF' }, line: { color: primary, width: 1 } });
                    targetSlide.addShape(pres.ShapeType.line, { x: gridX + gridW/2, y: gridY, w: 0, h: gridH, line: { color: primary, width: 1 } });
                    targetSlide.addShape(pres.ShapeType.line, { x: gridX, y: gridY + gridH/2, w: gridW, h: 0, line: { color: primary, width: 1 } });
                    // Axis labels
                    targetSlide.addText(String(xL[0]), { x: gridX + 0.1, y: gridY - 0.3, w: gridW/2 - 0.2, h: 0.25, fontSize: 11, align: 'left', fontFace: JPN_FONT });
                    targetSlide.addText(String(xL[1]), { x: gridX + gridW/2 + 0.1, y: gridY - 0.3, w: gridW/2 - 0.2, h: 0.25, fontSize: 11, align: 'right', fontFace: JPN_FONT });
                    targetSlide.addText(String(yL[0]), { x: gridX - 0.45, y: gridY + 0.1, w: 0.45, h: gridH/2 - 0.1, fontSize: 11, valign: 'top', fontFace: JPN_FONT });
                    targetSlide.addText(String(yL[1]), { x: gridX - 0.45, y: gridY + gridH/2 + 0.1, w: 0.45, h: gridH/2 - 0.1, fontSize: 11, valign: 'top', fontFace: JPN_FONT });
                    // Items
                    const items = Array.isArray(payload?.items) ? payload.items : [];
                    items.slice(0, 6).forEach((it: any) => {
                        const cx = gridX + (it?.x === 1 ? 3 * gridW/4 : gridW/4);
                        const cy = gridY + (it?.y === 1 ? 3 * gridH/4 : gridH/4);
                        targetSlide.addShape(pres.ShapeType.ellipse, { x: cx - 0.08, y: cy - 0.08, w: 0.16, h: 0.16, fill: { color: accent }, line: { color: outlineColor, width: 0.75 } });
                        targetSlide.addText(String(it?.label ?? ''), { x: cx + 0.12, y: cy - 0.12, w: Math.min(1.8, gridW/2 - 0.3), h: 0.3, fontSize: 10, fontFace: JPN_FONT });
                    });
                    break;
                }
                case 'funnel': {
                    const steps = Array.isArray(payload?.steps) ? payload.steps : [];
                    const startX = rx;
                    const startY = ry;
                    const topW = rw;
                    const height = rh;
                    const layers = Math.min(4, steps.length);
                    for (let i = 0; i < layers; i++) {
                        const tW = topW * (1 - i * 0.15);
                        const bW = topW * (1 - (i + 1) * 0.15);
                        const y = startY + (i * (height / layers));
                        targetSlide.addShape(pres.ShapeType.trapezoid, { x: startX + (topW - tW)/2, y, w: tW, h: height / layers - 0.04, fill: { color: i % 2 ? secondary : primary }, line: { color: outlineColor, width: 0.5 }, shadow: shadowOf(shadowPreset) } as any);
                        targetSlide.addText(String(steps[i]?.label ?? ''), { x: startX + 0.15, y: y + 0.04, w: topW - 0.3, h: (height / layers) - 0.12, fontSize: 12, color: 'FFFFFF', align: 'center', valign: 'middle', fontFace: JPN_FONT });
                    }
                    break;
                }
                case 'process': {
                    const steps = Array.isArray(payload?.steps) ? payload.steps : [];
                    const y = ry + rh * 0.20;
                    const maxSteps = Math.min(4, steps.length);
                    const gap = 0.5;
                    const totalGap = gap * Math.max(0, maxSteps - 1);
                    const stepW = Math.min(1.6, (rw - totalGap) / Math.max(1, maxSteps));
                    const stepH = Math.min( rh * 0.6, 0.9 );
                    // Center the whole process group horizontally within the region
                    const groupWidth = stepW * Math.max(1, maxSteps) + gap * Math.max(0, maxSteps - 1);
                    const startX = rx + Math.max(0, (rw - groupWidth) / 2);
                    steps.slice(0, maxSteps).forEach((s: any, i: number) => {
                        const x = startX + i * (stepW + gap);
                        targetSlide.addShape(pres.ShapeType.rect, { x, y, w: stepW, h: stepH, fill: { color: primary }, line: { color: outlineColor, width: 0.5 }, shadow: shadowOf(shadowPreset) });
                        targetSlide.addText(String(s?.label ?? `Step ${i+1}`), { x: x + 0.08, y: y + 0.14, w: stepW - 0.16, h: stepH - 0.28, fontSize: 11, color: 'FFFFFF', align: 'center', valign: 'middle', fontFace: JPN_FONT });
                        if (i < maxSteps - 1) {
                            // place chevron centered in the gap between items
                            targetSlide.addShape(pres.ShapeType.chevron, { x: x + stepW + (gap - 0.4) / 2, y: y + (stepH - 0.4) / 2, w: 0.4, h: 0.4, fill: { color: secondary }, line: { color: secondary, width: 0 } } as any);
                        }
                    });
                    break;
                }
                case 'roadmap': {
                    const milestones = Array.isArray(payload?.milestones) ? payload.milestones : [];
                    // Add horizontal padding to avoid labels overflowing slide edges
                    const innerPadX = Math.min(0.6, rw * 0.08);
                    const startX = rx + innerPadX;
                    const startY = ry + rh / 2;
                    const totalW = Math.max(0, rw - innerPadX * 2);
                    targetSlide.addShape(pres.ShapeType.line, { x: startX, y: startY, w: totalW, h: 0, line: { color: outlineColor, width: 1.2 } });
                    milestones.slice(0, 6).forEach((m: any, i: number) => {
                        const cx = startX + (i * (totalW / Math.max(1, milestones.length - 1)));
                        // Milestone dot
                        targetSlide.addShape(pres.ShapeType.ellipse, { x: cx - 0.08, y: startY - 0.08, w: 0.16, h: 0.16, fill: { color: accent }, line: { color: outlineColor, width: 0.8 } });
                        // Clamp label/date boxes within the slide region to prevent overflow
                        const labelW = 1.6;
                        const dateW = 1.2;
                        const labelX = Math.max(rx, Math.min(rx + rw - labelW, cx - labelW / 2));
                        const dateX = Math.max(rx, Math.min(rx + rw - dateW, cx - dateW / 2));
                        targetSlide.addText(String(m?.label ?? ''), { x: labelX, y: startY + 0.18, w: labelW, h: 0.36, fontSize: 11, align: 'center', fontFace: JPN_FONT });
                        if (m?.date) {
                            targetSlide.addText(String(m.date), { x: dateX, y: startY + 0.56, w: dateW, h: 0.25, fontSize: 9, align: 'center', color: '666666', fontFace: JPN_FONT });
                        }
                    });
                    break;
                }
                case 'comparison': {
                    const a = payload?.a, b = payload?.b;
                    const boxW = Math.min((rw - 0.6) / 2, 2.5);
                    const boxH = Math.min(rh - 0.2, 1.55);
                    const y = ry + 0.1;
                    const compRadius = 0; // squared corners for maximum usable area
                    const leftX = rx + 0.1;
                    const rightX = rx + 0.3 + boxW;
                    // Use rect to avoid corner clipping on long text, with drop shadow bottom-right
                    targetSlide.addShape(pres.ShapeType.rect, { x: leftX, y, w: boxW, h: boxH, fill: { color: primary }, line: { color: outlineColor, width: 0.5 }, shadow: shadowOf(shadowPreset) });
                    targetSlide.addShape(pres.ShapeType.rect, { x: rightX, y, w: boxW, h: boxH, fill: { color: secondary }, line: { color: outlineColor, width: 0.5 }, shadow: shadowOf(shadowPreset) });
                    // Fit label/value text into boxes to avoid overflow
                    const scaleWrap = (base: number) => Math.max(16, Math.floor(base * (boxW / 2.4)));
                    const aLabelFit = fitTextToLines(String(a?.label ?? 'A'), /*initial*/13, /*min*/9, /*baseWrap*/scaleWrap(24), /*lines*/2, /*hard*/24);
                    const aValueFit = fitTextToLines(String(a?.value ?? ''), /*initial*/18, /*min*/11, /*baseWrap*/scaleWrap(20), /*lines*/2, /*hard*/22);
                    const bLabelFit = fitTextToLines(String(b?.label ?? 'B'), /*initial*/13, /*min*/9, /*baseWrap*/scaleWrap(24), /*lines*/2, /*hard*/24);
                    const bValueFit = fitTextToLines(String(b?.value ?? ''), /*initial*/18, /*min*/11, /*baseWrap*/scaleWrap(20), /*lines*/2, /*hard*/22);
                    const padX = 0.12;
                    targetSlide.addText(aLabelFit.text, { x: leftX + padX, y: y + 0.06, w: boxW - padX*2, h: 0.52, fontSize: aLabelFit.fontSize, bold: true, color: 'FFFFFF', fontFace: JPN_FONT, align: 'center', valign: 'middle' });
                    targetSlide.addText(aValueFit.text, { x: leftX + padX, y: y + 0.58, w: boxW - padX*2, h: boxH - 0.66, fontSize: aValueFit.fontSize, bold: true, color: 'FFFFFF', fontFace: JPN_FONT, align: 'center', valign: 'middle' });
                    targetSlide.addText(bLabelFit.text, { x: rightX + padX, y: y + 0.06, w: boxW - padX*2, h: 0.52, fontSize: bLabelFit.fontSize, bold: true, color: 'FFFFFF', fontFace: JPN_FONT, align: 'center', valign: 'middle' });
                    targetSlide.addText(bValueFit.text, { x: rightX + padX, y: y + 0.58, w: boxW - padX*2, h: boxH - 0.66, fontSize: bValueFit.fontSize, bold: true, color: 'FFFFFF', fontFace: JPN_FONT, align: 'center', valign: 'middle' });
                    break;
                }
                case 'timeline': {
                    const steps = Array.isArray(payload?.steps) ? payload.steps : [];
                    const startX = rx;
                    const startY = ry + rh * 0.4;
                    const totalW = rw;
                    const segW = totalW / Math.max(1, steps.length);
                    targetSlide.addShape(pres.ShapeType.line, { x: startX, y: startY, w: totalW, h: 0, line: { color: outlineColor, width: 1.2 } });
                    steps.slice(0, 6).forEach((s: any, i: number) => {
                        const cx = startX + i * segW + segW / 2;
                        targetSlide.addShape(pres.ShapeType.ellipse, { x: cx - 0.08, y: startY - 0.08, w: 0.16, h: 0.16, fill: { color: accent }, line: { color: outlineColor, width: 0.8 } });
                        targetSlide.addText(String(s?.label ?? `Step ${i+1}`), { x: cx - 0.9, y: startY + 0.18, w: 1.8, h: 0.32, fontSize: 11, align: 'center', fontFace: JPN_FONT });
                    });
                    break;
                }
                default:
                    break;
            }
        }

        // 2. Create slides using the Master Slide
        let appliedLogoCount = 0;
        let appliedCopyrightCount = 0;
        for (const [index, slideData] of slides.entries()) {
            const slide = pres.addSlide({ masterName: MASTER_SLIDE });

            // Background: prioritize title image; otherwise themed flat color.
            if (index === 0) {
                if (titleSlideImagePath) {
                    try {
                        await fs.access(titleSlideImagePath);
                        slide.background = { path: titleSlideImagePath };
                        logger.info({ path: titleSlideImagePath }, 'Set title slide background image.');
                    } catch (error) {
                        logger.warn({ path: titleSlideImagePath, error }, 'Could not access title slide image file. Using default background.');
                        slide.background = { color: lightenHex(primary, 80).replace('#', '') } as any;
                    }
                } else if ((slides[0] as any)?.titleSlideImagePrompt) {
                    // Generate title background via new genarateImage
                    try {
                        const { genarateImage } = await import('./genarateImage');
                        const out = await genarateImage({ prompt: String((slides[0] as any).titleSlideImagePrompt), aspectRatio: '16:9' });
                        if (out.success && out.path) {
                            slide.background = { path: out.path } as any;
                            (slide as any).__tempImages = (slide as any).__tempImages || [];
                            (slide as any).__tempImages.push(out.path);
                            logger.info({ path: out.path }, 'Generated title slide background image.');
                        } else {
                            slide.background = { color: lightenHex(primary, 80).replace('#', '') } as any;
                        }
                    } catch (e) {
                        logger.warn({ error: e }, 'Failed to generate title background. Falling back to color.');
                        slide.background = { color: lightenHex(primary, 80).replace('#', '') } as any;
                    }
                } else {
                    slide.background = { color: lightenHex(primary, 80).replace('#', '') } as any;
                }
            } else {
                slide.background = { color: lightenHex(secondary, 80).replace('#', '') } as any;
            }

            // Determine background-based text color for bullets
            const flatBgHex: string | undefined = (index === 0)
                ? (titleSlideImagePath ? undefined : lightenHex(primary, 80))
                : lightenHex(secondary, 80);
            const bgTextColor: string = flatBgHex ? pickTextColorForBackground(flatBgHex).toString() : '000000';

            // Add speaker notes if provided
            if (slideData.notes) {
                // The notes will inherit the default font from the theme set above.
                slide.addNotes(slideData.notes);
            }

            // Title rendering is handled by each layout or freeform element; remove global top title bar

            // Company logo (bottom-right, keep aspect ratio)
            if (companyLogoPath) {
                try {
                    const maxW = 1.2;
                    const dim = await readImageDimensions(companyLogoPath);
                    const ratio = dim && dim.width > 0 ? (dim.height / dim.width) : (0.6 / 1.2);
                    const h = Math.min(0.9, Math.max(0.3, maxW * ratio));
                    const x = pageW - marginX - maxW;
                    const y = pageH - h - 0.25;
                    slide.addImage({ path: companyLogoPath, x, y, w: maxW, h, sizing: { type: 'contain', w: maxW, h } as any, shadow: { type: 'outer', color: '000000', opacity: 0.3, blur: 6, offset: 2, angle: 45 } as any });
                    appliedLogoCount++;
                } catch (e) {
                    logger.warn({ error: e }, 'Failed to add company logo on a slide.');
                }
            }

            // (top-right logo removed)

            const ctxRecipe = Array.isArray((context as any).visualRecipes) ? (context as any).visualRecipes[index] : null;
            const perSlideRecipeHere = (slideData as any).visual_recipe || ctxRecipe || null;
            const isBottomVisual = perSlideRecipeHere && (['process','roadmap','gantt','timeline'].includes(String(perSlideRecipeHere.type)));

            switch ((slideData as any).layout) {
                case 'freeform': {
                    const elementsRaw = Array.isArray((slideData as any).elements) ? (slideData as any).elements : [];
                    const elements = elementsRaw.slice().map((el: any, idx: number) => ({ ...el, __idx: idx })).sort((a: any, b: any) => {
                        const za = Number.isFinite(a?.z) ? Number(a.z) : a.__idx;
                        const zb = Number.isFinite(b?.z) ? Number(b.z) : b.__idx;
                        return za - zb;
                    });
                    const clamp = (n: number, min: number, max: number) => Math.max(min, Math.min(max, n));
                    const safeX = 0.2, safeY = 0.2;
                    const toSafe = (x: number, y: number, w: number, h: number) => {
                        const nx = clamp(x, safeX, pageW - safeX);
                        const ny = clamp(y, safeY, pageH - safeY);
                        const nw = clamp(w, 0, pageW - nx - safeX);
                        const nh = clamp(h, 0, pageH - ny - safeY);
                        return { x: nx, y: ny, w: nw, h: nh };
                    };
                    const useAutoFont = (v: any) => !(typeof v === 'number' && v >= 8);
                    for (const el of elements) {
                        if (!el || typeof el !== 'object') continue;
                        const t = String(el.type || '');
                        const bb = el.bbox || {};
                        const rawX = clamp(Number(bb.x || 0), 0, pageW);
                        const rawY = clamp(Number(bb.y || 0), 0, pageH);
                        const rawW = clamp(Number(bb.w || 0), 0, pageW - rawX);
                        const rawH = clamp(Number(bb.h || 0), 0, pageH - rawY);
                        const { x, y, w, h } = toSafe(rawX, rawY, rawW, rawH);
                        const st = el.style || {};
                        let fontSizePx = typeof st.fontSize === 'number' ? clamp(st.fontSize, 8, 64) : 18;
                        const fg = typeof st.color === 'string' ? st.color : undefined;
                        const bg = typeof st.bg === 'string' ? st.bg : undefined;
                        const cr = typeof st.cornerRadius === 'number' ? clamp(st.cornerRadius, 0, 16) : cornerRadius;
                        const sh = st.shadow === 'none' || st.shadow === 'soft' || st.shadow === 'strong' ? st.shadow : shadowPreset;
                        const align = st.align === 'left' || st.align === 'center' || st.align === 'right' ? st.align : 'left';
                        // If a full-bleed shape is provided, use as background to avoid seams
                        if (t === 'shape' && bg && rawW >= pageW - 0.01 && rawH >= pageH - 0.01) {
                            slide.background = { color: String(bg).replace('#', '') } as any;
                            continue;
                        }
                        const infographicTypes = new Set(['kpi','kpi_grid','comparison','timeline','matrix','funnel','process','roadmap','kpi_donut','progress','gantt','heatmap','venn2','pyramid','waterfall','bullet','map_markers','callouts','line_chart','bar_chart','pie_chart','checklist','visual_recipe']);
                        if (infographicTypes.has(t)) {
                            const payload = el.content || el;
                            if (t === 'visual_recipe' && payload && typeof payload === 'object' && payload.type) {
                                drawInfographic(slide as any, String(payload.type), payload, { x, y, w, h });
                            } else {
                                drawInfographic(slide as any, t, payload, { x, y, w, h });
                            }
                            continue;
                        }
                        if (t === 'shape') {
                            // Use rect when radius may clip text; roundRect only if cornerRadius > 2 and no text overlays expected
                            const useRound = typeof st.cornerRadius === 'number' && st.cornerRadius > 2 && (!el.content);
                            slide.addShape(useRound ? pres.ShapeType.roundRect : pres.ShapeType.rect, { x, y, w, h, fill: bg ? { color: bg } : undefined, line: { color: outlineColor, width: 0.5 }, shadow: shadowOf(sh) } as any);
                            continue;
                        }
                        if (t === 'image') {
                            const c = el.content || {};
                            if (typeof c.path === 'string') {
                                try {
                                    await fs.access(c.path);
                                    const sizingType = (st.sizing === 'cover' || st.sizing === 'contain') ? st.sizing : 'contain';
                                    slide.addImage({ path: c.path, x, y, w, h, sizing: { type: sizingType, w, h } as any, shadow: shadowOf(sh) });
                                    continue;
                                } catch {}
                            }
                            // Use new presenter/genarateImage for prompt-based generation or when path missing
                            if (typeof c.prompt === 'string' && c.prompt.trim()) {
                                try {
                                    const { genarateImage } = await import('./genarateImage');
                                    const aspect = (w >= h ? '16:9' : '9:16') as any;
                                    const out = await genarateImage({ prompt: c.prompt, aspectRatio: aspect });
                                    if (out.success && out.path) {
                                        const sizingType = (st.sizing === 'cover' || st.sizing === 'contain') ? st.sizing : 'cover';
                                        slide.addImage({ path: out.path, x, y, w, h, sizing: { type: sizingType, w, h } as any, shadow: shadowOf(sh) });
                                        // mark for deletion after writeFile
                                        (slide as any).__tempImages = (slide as any).__tempImages || [];
                                        (slide as any).__tempImages.push(out.path);
                                        continue;
                                    }
                                } catch {}
                            }
                            if (typeof c.prompt === 'string' && c.prompt.trim()) {
                                try {
                                    const { genarateImage } = await import('./genarateImage');
                                    const aspect = (w >= h ? '16:9' : '9:16') as any;
                                    const out = await genarateImage({ prompt: c.prompt, aspectRatio: aspect });
                                    if (out.success && out.path) {
                                        const sizingType = (st.sizing === 'cover' || st.sizing === 'contain') ? st.sizing : 'cover';
                                        slide.addImage({ path: out.path, x, y, w, h, sizing: { type: sizingType, w, h } as any, shadow: shadowOf(sh) });
                                        (slide as any).__tempImages = (slide as any).__tempImages || [];
                                        (slide as any).__tempImages.push(out.path);
                                        continue;
                                    }
                                } catch {}
                            }
                        }
                        if (t === 'bullets' && Array.isArray(el.content)) {
                            const text = el.content.map((s: any) => String(s || '')).join('\n');
                            const fitted = useAutoFont(st.fontSize) ? fitTextToLines(text, /*initial*/22, /*min*/12, /*baseWrap*/Math.max(16, Math.floor(w * 7)), /*lines*/Math.max(2, Math.floor(h / 0.45)), /*hard*/Math.max(18, Math.floor(w * 9))) : { text, fontSize: fs } as any;
                            slide.addText(toBoldRunsFromMarkdown(fitted.text) as any, { x, y, w, h, fontSize: (fitted as any).fontSize ?? fs, bullet: { type: 'bullet' }, color: fg || bgTextColor, fontFace: JPN_FONT, align, valign: 'top', paraSpaceAfter: 12, fill: bg ? { color: bg } : undefined, line: bg ? { color: bg, width: 0 } : undefined });
                            continue;
                        }
                        const text = el.content ? String(el.content) : '';
                        if (text) {
                            const isTitle = t === 'title';
                            const fitted = useAutoFont(st.fontSize)
                                ? fitTextToLines(text, /*initial*/(isTitle ? 34 : 22), /*min*/(isTitle ? 20 : 12), /*baseWrap*/Math.max(12, Math.floor(w * (isTitle ? 6 : 8))), /*lines*/(isTitle ? 1 : Math.max(2, Math.floor(h / 0.5))), /*hard*/Math.max(16, Math.floor(w * 10)))
                                : { text, fontSize: fs } as any;
                            slide.addText(toBoldRunsFromMarkdown(fitted.text) as any, { x, y, w, h, fontSize: (fitted as any).fontSize ?? fs, color: fg || bgTextColor, fontFace: JPN_FONT, align, valign: isTitle ? 'top' : 'middle', bold: isTitle ? true : false, fill: bg ? { color: bg } : undefined, line: bg ? { color: bg, width: 0 } : undefined });
                        }
                    }
                    break;
                }
                case 'title_slide':
                    // Render centered title only (no global title bar)
                    {
                        const fittedTitle = fitTextToLines(slideData.title || '', /*initial*/36, /*min*/22, /*baseWrap*/28, /*lines*/1, /*hard*/28);
                        slide.addText(toBoldRunsFromMarkdown(fittedTitle.text) as any, {
                            x: 0.8, y: 1.2, w: pageW - 1.6, h: 1.2,
                            align: 'center', valign: 'middle', fontSize: fittedTitle.fontSize, bold: true, fontFace: JPN_FONT, color: bgTextColor,
                        });
                        if (slideData.bullets.length > 0) {
                            const subtitle = preventLeadingPunctuation(formatBulletsForColonSeparation(slideData.bullets, 24, 4));
                            const fittedSub = fitTextToLines(subtitle, /*initial*/18, /*min*/14, /*baseWrap*/36, /*lines*/3, /*hard*/32);
                            slide.addText(toBoldRunsFromMarkdown(fittedSub.text) as any, {
                                x: 0.8, y: 2.6, w: pageW - 1.6, h: 1.6,
                                align: 'center', valign: 'top', fontSize: fittedSub.fontSize, fontFace: JPN_FONT, color: bgTextColor,
                            });
                        }
                    }
                    break;
                case 'section_header':
                    {
                        const fitted = fitTextToLines(slideData.title, /*initial*/36, /*min*/20, /*baseWrap*/28, /*lines*/1, /*hard*/24);
                        slide.addText(toBoldRunsFromMarkdown(fitted.text) as any, {
                        x: 0, y: 0, w: '100%', h: '100%',
                        align: 'center', valign: 'middle',
                            fontSize: fitted.fontSize, bold: true, fontFace: JPN_FONT, color: bgTextColor
                    });
                    }
                    break;
                case 'quote':
                    // Title bar at the standard position (like other layouts)
                    {
                        const fitted = fitTextToLines(slideData.title, /*initial*/28, /*min*/20, /*baseWrap*/36, /*lines*/1, /*hard*/24);
                        const bgColor = chooseTitleBarColor(slideData.title, primary, (slideData as any).accent_color);
                        const textColor = pickTextColorForBackground(bgColor).toString();
                        slide.addText(toBoldRunsFromMarkdown(fitted.text) as any, {
                            x: twoColTextX, y: contentTopY - 0.35, w: contentW, h: 0.6,
                            fontSize: fitted.fontSize, bold: true, fontFace: JPN_FONT,
                            color: textColor,
                            fill: { color: bgColor }, line: { color: bgColor, width: 0 }
                        });
                    }
                    if (slideData.special_content) {
                        const formatted = formatQuoteLines(slideData.special_content, 18);
                        const fittedQuote = fitTextToLines(formatted, /*initial*/32, /*min*/22, /*baseWrap*/30, /*lines*/4, /*hard*/38, { suppressEllipsis: true, minFontFloor: 20 });
                        slide.addText(toBoldRunsFromMarkdown(fittedQuote.text) as any, {
                            x: 0.8, y: 1.2, w: '88%', h: 3.2,
                            align: 'center', valign: 'middle',
                            fontSize: fittedQuote.fontSize, italic: true, fontFace: JPN_FONT, color: bgTextColor
                        });
                    }
                    // Title already shown at top bar; omit bottom title
                    break;
                case 'content_with_visual':
                    {
                        const fitted = fitTextToLines(slideData.title, /*initial*/32, /*min*/22, /*baseWrap*/36, /*lines*/1, /*hard*/24);
                        const bgColor = chooseTitleBarColor(slideData.title, primary, (slideData as any).accent_color);
                        const textColor = pickTextColorForBackground(bgColor).toString();
                        slide.addText(toBoldRunsFromMarkdown(fitted.text) as any, { 
                            x: twoColTextX, y: contentTopY - 0.35, w: contentW, h: 0.6, 
                            fontSize: fitted.fontSize, bold: true, fontFace: JPN_FONT,
                            color: textColor,
                            fill: { color: bgColor }, line: { color: bgColor, width: 0 }
                        });
                    }
                    // Shift text down to avoid overlapping title
                    const textYWithVisual = contentTopY + 0.5;
                    const textHWithVisual = Math.max(2.5, twoColTextH - 0.5);
                    // Render bullets without intentional line breaks; rely on textbox auto-wrapping
                    const cleanedBulletsCv = (slideData.bullets || []).map((b: any) => String(b || '').replace(/\n[ \t　]*/g, ' ').trim());
                    const bulletTextCv = cleanedBulletsCv.join('\n');
                    slide.addText(toBoldRunsFromMarkdown(bulletTextCv) as any, { 
                        x: twoColTextX, y: textYWithVisual, w: twoColTextW, h: textHWithVisual, 
                        fontSize: 18, bullet: { type: 'bullet' }, fontFace: JPN_FONT,
                        valign: 'top', paraSpaceAfter: 12,
                    });
                    // Image: keep aspect by specifying width only; auto height (moved below title)
                    if (!isBottomVisual && slideData.imagePath) {
                        const imageYWithVisual = contentTopY + 0.6;
                        // Allocate more vertical space: prefer height to 3.4 while keeping width cap
                        slide.addImage({
                            path: slideData.imagePath,
                            x: twoColVisualX,
                            y: imageYWithVisual,
                            w: twoColVisualW,
                            h: 3.4,
                            sizing: { type: 'contain', w: twoColVisualW, h: 3.4 } as any,
                            shadow: { type: 'outer', color: '000000', opacity: 0.45, blur: 12, offset: 4, angle: 45 } as any
                        });
                    }
                    break;
                case 'content_only':
                default:
                    {
                        const fitted = fitTextToLines(slideData.title, /*initial*/32, /*min*/20, /*baseWrap*/40, /*lines*/1, /*hard*/24);
                        const bgColor = chooseTitleBarColor(slideData.title, primary, (slideData as any).accent_color);
                        const textColor = pickTextColorForBackground(bgColor).toString();
                        slide.addText(toBoldRunsFromMarkdown(fitted.text) as any, { 
                            x: twoColTextX, y: contentTopY - 0.35, w: contentW, h: 0.6, 
                            fontSize: fitted.fontSize, bold: true, fontFace: JPN_FONT,
                            color: textColor,
                            fill: { color: bgColor }, line: { color: bgColor, width: 0 }
                        });
                    }
                    // Allow a bit more content on content-only slides: target 4 lines per bullet
                    const cleanedBulletsCo = mergeQuotedContinuations((slideData.bullets || []).map((b: any) => String(b || '').replace(/\n[ \t　]*/g, ' ').trim()));
                    const bulletTextCo = cleanedBulletsCo.join('\n');
                    // Shift text down to avoid overlapping title
                    const textYContentOnly = contentTopY + 0.5;
                    const textHContentOnly = 4.0;
                    if (perSlideRecipeHere) {
                        // If the recipe is of bottom-band type, use full-width text
                        if (isBottomVisual) {
                            slide.addText(toBoldRunsFromMarkdown(bulletTextCo) as any, { 
                                x: twoColTextX, y: textYContentOnly, w: contentW, h: textHContentOnly, 
                                fontSize: 20, bullet: { type: 'bullet' }, align: 'left', fontFace: JPN_FONT,
                                valign: 'top', paraSpaceAfter: 12, color: bgTextColor,
                            });
                        } else {
                            // Right-panel recipe → two-column
                            slide.addText(toBoldRunsFromMarkdown(bulletTextCo) as any, { 
                                x: twoColTextX, y: textYContentOnly, w: twoColTextW, h: twoColTextH, 
                                fontSize: 20, bullet: { type: 'bullet' }, align: 'left', fontFace: JPN_FONT,
                                valign: 'top', paraSpaceAfter: 12, color: bgTextColor,
                            });
                        }
                    } else {
                        // No recipe → full-width text
                        slide.addText(toBoldRunsFromMarkdown(bulletTextCo) as any, { 
                            x: twoColTextX, y: textYContentOnly, w: contentW, h: textHContentOnly, 
                            fontSize: 20, bullet: { type: 'bullet' }, align: 'left', fontFace: JPN_FONT,
                            valign: 'top', paraSpaceAfter: 12, color: bgTextColor,
                        });
                    }
                    break;
            }

            // If a per-slide visual recipe exists, render it in a right panel (for content_* only)
            const layout = slideData.layout || 'content_only';
            if (perSlideRecipeHere && (layout === 'content_with_visual' || layout === 'content_only')) {
                // place process/roadmap/gantt/timeline at bottom band, others to right panel
                const typeStr = String(perSlideRecipeHere.type || '');
                const isBottom = isBottomVisual || typeStr === 'gantt' || typeStr === 'timeline';
                const useUpperBand = (typeStr === 'roadmap' || typeStr === 'timeline');
                // If an image chart exists on the right panel for content_with_visual,
                // move recipe to bottom band to avoid overlap.
                const hasImageForSlide = !!(slideData as any).imagePath;
                const forceBottomForRecipe = (layout === 'content_with_visual') && hasImageForSlide;
                // Right panel and bottom band regions (absolute, 16:9)
                // For content_only, place band under bullets area to avoid overlap
                const bulletsBottomY = contentTopY + 0.5 + 4.0; // textYContentOnly + textHContentOnly
                const dynamicBottomY = layout === 'content_only' ? Math.max(bottomBandY, bulletsBottomY + 0.2) : bottomBandY;
                let region = (isBottom || forceBottomForRecipe)
                  ? { x: marginX, y: dynamicBottomY, w: contentW, h: bottomBandH }
                  : { x: twoColVisualX, y: contentTopY + 0.7, w: twoColVisualW, h: twoColVisualH };
                // Avoid overlapping bottom branding/footer by reserving space at the very bottom
                // Reserve ~0.8in for copyright/logo
                const reservedBottom = 0.8;
                if ((region.y + region.h) > (pageH - reservedBottom)) {
                    const minY = contentTopY + 0.7; // keep within content area
                    region.y = Math.max(minY, (pageH - reservedBottom) - region.h);
                }
                drawInfographic(slide as any, String(perSlideRecipeHere.type || ''), perSlideRecipeHere, region);
            }
            // Add per-slide copyright if provided
            if (companyCopyright) {
                try {
                    slide.addText(companyCopyright, { x: 0.4, y: pageH - 0.35, w: pageW - 0.8, h: 0.3, align: 'center', fontSize: 10, color: '666666', fontFace: JPN_FONT });
                    appliedCopyrightCount++;
                } catch (e) {
                    logger.warn({ error: e }, 'Failed to add copyright text on a slide.');
                }
            }
        }
        logger.info({ appliedLogoCount, appliedCopyrightCount }, 'Applied branding to slides.');
        
        // Add company about slide at the end if available
        if (companyAbout || (context as any).companyOverview) {
            try {
                const aboutSlide = pres.addSlide({ masterName: MASTER_SLIDE });
                aboutSlide.background = { color: lightenHex(secondary, 85).replace('#', '') } as any;
                const titleRuns = toBoldRunsFromMarkdown('会社概要') as any;
                const titleFit = fitTextToLines('会社概要', /*initial*/28, /*min*/20, /*baseWrap*/16, /*lines*/1, /*hard*/22);
                // Title background like other slides
                {
                    const bgColor = lightenHex(primary, 70);
                    const textColor = pickTextColorForBackground(bgColor).toString();
                    aboutSlide.addText(titleRuns, { x: marginX, y: 0.6, w: contentW, h: 0.6, fontSize: titleFit.fontSize, bold: true, fontFace: JPN_FONT, color: textColor, fill: { color: bgColor }, line: { color: bgColor, width: 0 } });
                }
                const ov = (context as any).companyOverview as any;
                if (ov && typeof ov === 'object') {
                    const rows: Array<{label: string; value: string}> = [];
                    if (ov.company_name) rows.push({ label: '会社名', value: String(ov.company_name) });
                    if (ov.address) rows.push({ label: '所在地', value: String(ov.address) });
                    if (ov.founded) rows.push({ label: '設立', value: String(ov.founded) });
                    if (ov.representative) rows.push({ label: '代表者', value: String(ov.representative) });
                    if (ov.vision) rows.push({ label: 'ビジョン', value: String(ov.vision) });
                    if (Array.isArray(ov.business) && ov.business.length) rows.push({ label: '事業内容', value: ov.business.join(' / ') });
                    if (ov.homepage) rows.push({ label: 'HomePage', value: String(ov.homepage) });
                    if (ov.contact) rows.push({ label: '問い合わせ', value: String(ov.contact) });
                    const col1W = Math.min(2.2, contentW * 0.22);
                    const col2W = contentW - col1W - 0.4;
                    let y = 1.8;
                    const rowH = 0.45;
                    for (const r of rows) {
                        aboutSlide.addShape(pres.ShapeType.rect, { x: marginX, y, w: col1W, h: rowH, fill: { color: lightenHex(primary, 60) }, line: { color: '#FFFFFF', width: 0 } });
                        aboutSlide.addText(r.label, { x: marginX + 0.1, y: y + 0.08, w: col1W - 0.2, h: rowH - 0.16, fontSize: 14, bold: true, color: 'FFFFFF', fontFace: JPN_FONT, valign: 'middle' });
                        aboutSlide.addShape(pres.ShapeType.rect, { x: marginX + col1W + 0.2, y, w: col2W, h: rowH, fill: { color: 'FFFFFF' }, line: { color: '#E6E6E6', width: 1 } });
                        aboutSlide.addText(r.value, { x: marginX + col1W + 0.3, y: y + 0.08, w: col2W - 0.2, h: rowH - 0.16, fontSize: 14, color: '333333', fontFace: JPN_FONT, valign: 'middle' });
                        y += rowH + 0.08;
                    }
                } else {
                    const body = String(companyAbout || '').replace(/\r?\n/g, '\n');
                    const bodyFit = fitTextToLines(body, /*initial*/18, /*min*/14, /*baseWrap*/46, /*lines*/10, /*hard*/60, { suppressEllipsis: true, minFontFloor: 12 });
                    aboutSlide.addText(toBoldRunsFromMarkdown(bodyFit.text) as any, { x: marginX, y: 1.3, w: contentW, h: pageH - 2.0, fontSize: bodyFit.fontSize, fontFace: JPN_FONT, valign: 'top' });
                }
                if (companyLogoPath) {
                    const maxW = 1.2;
                    const dim = await readImageDimensions(companyLogoPath);
                    const ratio = dim && dim.width > 0 ? (dim.height / dim.width) : (0.6 / 1.2);
                    const h = Math.min(0.9, Math.max(0.3, maxW * ratio));
                    const x = pageW - marginX - maxW;
                    const y = pageH - h - 0.25;
                    aboutSlide.addImage({ path: companyLogoPath, x, y, w: maxW, h, sizing: { type: 'contain', w: maxW, h } as any });
                }
                if (companyCopyright) {
                    aboutSlide.addText(companyCopyright, { x: 0.4, y: pageH - 0.35, w: pageW - 0.8, h: 0.3, align: 'center', fontSize: 10, color: '666666', fontFace: JPN_FONT });
                }
                logger.info('Added company about slide.');
            } catch (e) {
                logger.warn({ error: e }, 'Failed to add company about slide.');
            }
        }
        // drawInfographic defined earlier; ensure not duplicated here

        // Try to render visual_recipe if supplied in slide payload
        for (const s of slides as any[]) {
            const recipe = (s as any).visual_recipe;
            if (recipe && typeof recipe === 'object') {
                const infoSlide = pres.addSlide({ masterName: MASTER_SLIDE });
                infoSlide.background = { color: secondary.replace('#', '') } as any;
                if (recipe.type) {
                    drawInfographic(infoSlide, String(recipe.type), recipe);
                }
            }
        }
        
        await pres.writeFile({ fileName: filePath });

        // Collect unique image paths to delete (charts + new images temp)
        const imagePathsToDelete = new Set<string>();
        const tempImagesCollected: string[] = [];
        const chartsDir = path.join(config.tempDir, 'charts');
        const imagesDir = path.join(config.tempDir, 'images');
        for (const slideData of slides as any[]) {
            if (slideData.imagePath && path.resolve(path.dirname(slideData.imagePath)) === path.resolve(chartsDir)) {
                imagePathsToDelete.add(slideData.imagePath);
            }
        }
        // Collect temp images recorded on slides created in this scope
        // We tracked them on each slide via (slide as any).__tempImages; preserve references in an array when creating
        // Since PPTXGenJS doesn't expose slides list in types, we track our own
        // Note: We already pushed paths into imagePathsToDelete when adding images; ensure dedupe
        // (No-op here because we don't have a central registry; paths were added where generated.)
 
        for (const imagePath of imagePathsToDelete) {
            try {
                // Only delete if under approved temp dirs
                const dir = path.resolve(path.dirname(imagePath));
                if (dir === path.resolve(chartsDir) || dir === path.resolve(imagesDir)) {
                    await fs.unlink(imagePath);
                    logger.info({ imagePath }, 'Deleted temporary image.');
                } else {
                    logger.warn({ imagePath }, 'Skip deletion: not under approved temp dir');
                }
            } catch (unlinkError) {
                logger.warn({ error: unlinkError, imagePath }, 'Could not delete temporary image.');
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