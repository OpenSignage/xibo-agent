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
const JPN_FONT = 'Noto Sans JP';

// Define a master slide layout for a consistent look and feel

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

// Resolve title bar color with optional template policy
function resolveTitleBarColorFromTemplate(templateConfig: any, layoutKey: string, fallbackPrimary: string, slideAccent?: string): string {
  try {
    const layoutColor = templateConfig?.layouts?.[layoutKey]?.titleBar?.color;
    if (typeof layoutColor === 'string' && layoutColor) return layoutColor;
    const policy = templateConfig?.rules?.titleBarColor;
    if (policy === 'fixed') {
      const tk = templateConfig?.tokens?.primary;
      if (typeof tk === 'string' && tk) return tk;
    }
  } catch {}
  return chooseTitleBarColor('', fallbackPrimary, slideAccent);
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

// Normalize common CSS color formats to PPTX hex without '#'
function normalizeColorToPptxHex(input?: string): string | undefined {
  if (!input) return undefined;
  const s = String(input).trim();
  if (!s) return undefined;
  if (s.toLowerCase() === 'transparent' || s.toLowerCase() === 'none') return undefined;
  // #RGB
  if (/^#?[0-9a-fA-F]{3}$/.test(s)) {
    const h = s.replace('#', '');
    const r = h[0]; const g = h[1]; const b = h[2];
    return `${r}${r}${g}${g}${b}${b}`.toUpperCase();
  }
  // #RRGGBB
  if (/^#?[0-9a-fA-F]{6}$/.test(s)) {
    return s.replace('#', '').toUpperCase();
  }
  // #RRGGBBAA (we keep RGB and ignore AA)
  if (/^#?[0-9a-fA-F]{8}$/.test(s)) {
    const h = s.replace('#', '');
    // Interpret as RRGGBBAA and drop the last AA
    return h.slice(0, 6).toUpperCase();
  }
  // rgb()/rgba()
  const m = s.match(/^rgba?\(\s*(\d{1,3})\s*,\s*(\d{1,3})\s*,\s*(\d{1,3})(?:\s*,\s*(0|1|0?\.\d+))?\s*\)$/i);
  if (m) {
    const toHex = (n: number) => Math.max(0, Math.min(255, n)).toString(16).padStart(2, '0').toUpperCase();
    const r = toHex(parseInt(m[1], 10));
    const g = toHex(parseInt(m[2], 10));
    const b = toHex(parseInt(m[3], 10));
    return `${r}${g}${b}`;
  }
  // As a last resort, try parseColorWithAlpha
  const parsed = parseColorWithAlpha(s);
  if (parsed) return parsed.hex;
  return undefined;
}

// Parse color string (#RRGGBB | #RRGGBBAA | rgba()) and return hex (no '#') and alpha 0..1
function parseColorWithAlpha(input?: string): { hex: string; alpha: number } | undefined {
  if (!input) return undefined;
  const s = String(input).trim();
  if (!s) return undefined;
  // #RRGGBBAA (ARGB-like but as RRGGBBAA)
  if (/^#?[0-9a-fA-F]{8}$/.test(s)) {
    const h = s.replace('#', '');
    const rgb = h.slice(0, 6).toUpperCase();
    const aa = h.slice(6, 8);
    const alpha = Math.max(0, Math.min(255, parseInt(aa, 16))) / 255;
    return { hex: rgb, alpha };
  }
  // #RRGGBB
  if (/^#?[0-9a-fA-F]{6}$/.test(s)) {
    return { hex: s.replace('#', '').toUpperCase(), alpha: 1 };
  }
  // rgb()/rgba()
  const m = s.match(/^rgba?\(\s*(\d{1,3})\s*,\s*(\d{1,3})\s*,\s*(\d{1,3})(?:\s*,\s*(0|1|0?\.\d+))?\s*\)$/i);
  if (m) {
    const toHex = (n: number) => Math.max(0, Math.min(255, n)).toString(16).padStart(2, '0').toUpperCase();
    const r = toHex(parseInt(m[1], 10));
    const g = toHex(parseInt(m[2], 10));
    const b = toHex(parseInt(m[3], 10));
    const a = m[4] !== undefined ? Math.max(0, Math.min(1, parseFloat(m[4]))) : 1;
    return { hex: `${r}${g}${b}`, alpha: a };
  }
  return undefined;
}

// Build pptxgen fill from color string, supporting alpha via transparency (0-100)
function buildFill(input?: any): any {
  if (!input) return undefined;
  if (typeof input === 'object') return input;
  const parsed = parseColorWithAlpha(String(input));
  if (!parsed) return input ? { color: String(input).replace('#','').toUpperCase() } : undefined;
  const transparency = Math.round((1 - parsed.alpha) * 100);
  if (transparency > 0) return { color: parsed.hex, transparency } as any;
  return { color: parsed.hex } as any;
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
  layout: z.enum(['title_slide', 'section_header', 'content_with_visual', 'content_with_bottom_visual', 'content_with_image', 'content_only', 'quote', 'visual_hero_split', 'comparison_cards', 'checklist_top_bullets_bottom', 'visual_only']).optional().describe('The layout type for the slide.'),
  special_content: z.string().optional().nullable().describe('Special content for layouts like \'quote\'.'),
  elements: z.array(z.any()).optional().describe('Freeform elements array when layout is freeform.'),
  visual_recipe: z.any().optional().describe('Optional visual recipe object used by template visual elements.'),
  context_for_visual: z.string().optional().describe('Optional context hint used for generating or selecting visuals.'),
  // Optional comparison_cards-specific bullets
  bulletsA: z.array(z.string()).optional().describe('Left column bullets for comparison_cards layout.'),
  bulletsB: z.array(z.string()).optional().describe('Right column bullets for comparison_cards layout.'),
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
  templateConfig: z.any().optional(),
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
    const templateConfig: any = (context as any).templateConfig || {};
    logger.info({ hasLogo: !!companyLogoPath, hasCopyright: !!companyCopyright, hasAbout: !!companyAbout }, 'Branding options received for PowerPoint generation.');
    const styleTokens = (context as any).styleTokens || {};
    const tk = templateConfig?.tokens || {};
    const aiColorPolicy = (templateConfig?.rules && typeof templateConfig.rules.aiColorPolicy === 'string')
      ? (templateConfig.rules.aiColorPolicy as 'template'|'prefer_ai'|'ai_overrides'|'disabled')
      : 'template';
    const preferAI = aiColorPolicy === 'prefer_ai' || aiColorPolicy === 'ai_overrides';
    const allowOverride = aiColorPolicy === 'ai_overrides';

    // Resolve colors based on policy
    const resolvedPrimary = (() => {
      if (preferAI && typeof themeColor1 === 'string' && themeColor1) return themeColor1;
      if (typeof tk.primary === 'string') return tk.primary;
      if (!preferAI && typeof styleTokens.primary === 'string') return styleTokens.primary;
      return themeColor1 || '#0B5CAB';
    })();
    const resolvedSecondary = (() => {
      if (preferAI && typeof themeColor2 === 'string' && themeColor2) return themeColor2;
      if (typeof tk.secondary === 'string') return tk.secondary;
      if (!preferAI && typeof styleTokens.secondary === 'string') return styleTokens.secondary;
      return themeColor2 || '#00B0FF';
    })();
    const primary = allowOverride && typeof themeColor1 === 'string' && themeColor1 ? themeColor1 : resolvedPrimary;
    const secondary = allowOverride && typeof themeColor2 === 'string' && themeColor2 ? themeColor2 : resolvedSecondary;
    const accent = typeof tk.accent === 'string' ? tk.accent : (typeof styleTokens.accent === 'string' ? styleTokens.accent : '#FFC107');
    const cornerRadius = typeof tk.cornerRadius === 'number' ? Math.max(0, Math.min(16, tk.cornerRadius)) : (typeof styleTokens.cornerRadius === 'number' ? Math.max(0, Math.min(16, styleTokens.cornerRadius)) : 12);
    const outlineColor = typeof tk.outlineColor === 'string' ? tk.outlineColor : (typeof styleTokens.outlineColor === 'string' ? styleTokens.outlineColor : '#FFFFFF');
    const spacingBase = typeof tk.spacingBaseUnit === 'number' ? Math.max(0.1, Math.min(1.0, tk.spacingBaseUnit)) : (typeof styleTokens.spacingBaseUnit === 'number' ? Math.max(0.1, Math.min(1.0, styleTokens.spacingBaseUnit)) : 1.0);
    const shadowPreset = ((): 'none'|'soft'|'strong' => {
      const v = (tk.shadowPreset as any) ?? (styleTokens.shadowPreset as any);
      return v === 'none' || v === 'soft' || v === 'strong' ? v : 'soft';
    })();
    const presenterDir = config.presentationsDir;
    const filePath = path.join(presenterDir, `${fileName}.pptx`);

    logger.info({ filePath, slideCount: slides.length }, 'Creating PowerPoint presentation');

    try {
        // --- Fail-fast template validation (template-driven rendering) ---
        const validateTemplateForSlides = (tpl: any, slidesIn: any[]): { ok: boolean; errors: string[] } => {
          const errors: string[] = [];
          const layouts = tpl?.layouts || {};
          const getVisualElements = (layoutKey: string): any[] => {
            const els = layouts?.[layoutKey]?.elements;
            if (!Array.isArray(els)) return [];
            return els.filter((e: any) => String(e?.type) === 'visual' && (String(e?.recipeRef || '') === 'visual_recipe'));
          };
          for (let i = 0; i < slidesIn.length; i++) {
            const s: any = slidesIn[i] || {};
            const layoutKey: string = String(s?.layout || 'content_only');
            const layoutExists = !!layouts?.[layoutKey];
            if (!layoutExists) {
              errors.push(`[slide ${i+1}] layout '${layoutKey}' not found in template.layouts`);
              continue;
            }
            const needsVisual = !!s?.visual_recipe;
            if (needsVisual) {
              const vEls = getVisualElements(layoutKey);
              if (!vEls.length) {
                errors.push(`[slide ${i+1}] layout '${layoutKey}' has no elements visual (recipeRef: visual_recipe)`);
              } else {
                const areas = layouts?.[layoutKey]?.areas || {};
                for (const ve of vEls) {
                  const areaName = String(ve?.area || '');
                  if (!areaName || !areas[areaName]) {
                    errors.push(`[slide ${i+1}] layout '${layoutKey}' visual element area '${areaName || '(missing)'}' not found in areas`);
                    break;
                  }
                }
              }
            }
          }
          return { ok: errors.length === 0, errors };
        };
        const templateValidation = validateTemplateForSlides(templateConfig, slides as any[]);
        if (!templateValidation.ok) {
          const line = templateValidation.errors[0] || 'Template validation failed.';
          logger.error({ error: line }, 'Template validation failed');
          return { success: false, message: line } as const;
        }
        await fs.mkdir(presenterDir, { recursive: true });
        // Ensure charts support by preferring a build that includes Charts
        let Pptx: any = PptxGenJS;
        let chartsBuild: string | null = null;
        const importCandidates: string[] = [];
        try {
          // Prefer CJS build explicitly (most reliable for charts on Node)
          const cjsPath = require.resolve('pptxgenjs/dist/pptxgen.cjs.js');
          importCandidates.push(cjsPath);
        } catch {}
        importCandidates.push('pptxgenjs/dist/pptxgen.bundle.js');
        importCandidates.push('pptxgenjs/dist/pptxgen.bundle.min.js');
        importCandidates.push('pptxgenjs/dist/pptxgen.es.js');
        try {
          if (!(Pptx as any).ChartType) {
            for (const spec of importCandidates) {
              try {
                const mod: any = await import(spec);
                const cls = (mod && (mod.default || mod));
                if (cls) {
                  Pptx = cls;
                  chartsBuild = spec;
                }
                if ((Pptx as any).ChartType) break;
              } catch {}
            }
            // No further side-load. v4.0.1 places ChartType on instance, not class.
          }
        } catch {}
        const pres = new Pptx();
        
        // Ensure 16:9 slide size
        try {
            (pres as any).defineLayout({ name: 'WIDE_16x9', width: 13.33, height: 7.5 });
            (pres as any).layout = 'WIDE_16x9';
        } catch {}

        // Set the default theme fonts with template override
        const headFont = templateConfig?.typography?.fontFamily?.head || JPN_FONT;
        const bodyFont = templateConfig?.typography?.fontFamily?.body || JPN_FONT;
        pres.theme = {
            bodyFontFace: bodyFont,
            headFontFace: headFont,
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

        // Master slide is no longer used; background/branding are handled per slide

        // Track temporary images to delete after PPTX is written
        const imagePathsToDelete = new Set<string>();

        const tokensShadowPresets = (templateConfig?.tokens?.shadowPresets || templateConfig?.shadowPresets) as any;
        const normalizeShadow = (obj: any): any => {
          if (!obj || typeof obj !== 'object') return undefined;
          const type = (obj.type === 'outer' || obj.type === 'inner') ? obj.type : 'outer';
          const color = typeof obj.color === 'string' ? obj.color.replace('#','').toUpperCase() : '000000';
          const opacity = Number.isFinite(obj.opacity) ? Math.max(0, Math.min(1, Number(obj.opacity))) : 0.45;
          const blur = Number.isFinite(obj.blur) ? Math.max(0, Number(obj.blur)) : 12;
          const offset = Number.isFinite(obj.offset) ? Math.max(0, Number(obj.offset)) : 4;
          const angle = Number.isFinite(obj.angle) ? Number(obj.angle) : 45;
          return { type, color, opacity, blur, offset, angle } as any;
        };
        const shadowOf = (value: any, defaultPreset: 'none'|'soft'|'strong' = 'soft'): any => {
          if (value === 'none') return undefined;
          if (typeof value === 'string') {
            const tpl = tokensShadowPresets && tokensShadowPresets[value];
            if (tpl) return normalizeShadow(tpl);
            // built-in fallback presets
            if (value === 'strong') return { type: 'outer', color: '000000', opacity: 0.55, blur: 16, offset: 5, angle: 45 } as any;
            if (value === 'soft') return { type: 'outer', color: '000000', opacity: 0.45, blur: 12, offset: 4, angle: 45 } as any;
            return undefined;
          }
          if (value && typeof value === 'object') {
            return normalizeShadow(value);
          }
          const tpl = tokensShadowPresets && tokensShadowPresets[defaultPreset];
          if (tpl) return normalizeShadow(tpl);
          // default fallback
          return defaultPreset === 'strong' ? { type: 'outer', color: '000000', opacity: 0.55, blur: 16, offset: 5, angle: 45 } : undefined;
        };

        // Per-visual shadow override via template visualStyles
        const resolveVisualShadow = (type: string): any => {
          const s = templateConfig?.visualStyles?.[type]?.shadow;
          return (s !== undefined) ? s : shadowPreset;
        };

        // Resolve themed color tokens used by templates for table styling
        const resolveThemedColorToken = (val?: string): string | undefined => {
          if (!val) return undefined;
          const s = String(val).trim();
          const map = (hex: string) => hex.replace('#','').toUpperCase();
          const toHex = (h: string) => h.startsWith('#') ? h.slice(1).toUpperCase() : h.toUpperCase();
          const norm = normalizeColorToPptxHex(s);
          if (norm) return norm;
          const key = s.toLowerCase();
          if (key === 'primary') return map(primary);
          if (key === 'secondary') return map(secondary);
          if (key === 'white') return 'FFFFFF';
          if (key === 'black') return '000000';
          if (key === 'primarylight') return map(lightenHex(primary, 60));
          if (key === 'primarylighter') return map(lightenHex(primary, 100));
          if (key === 'primaryultralight') return map(lightenHex(primary, 120));
          if (key === 'secondarylight') return map(lightenHex(secondary, 60));
          if (key === 'secondarylighter') return map(lightenHex(secondary, 100));
          if (key === 'secondaryultralight') return map(lightenHex(secondary, 120));
          // Fallback try parse rgba/#RRGGBBAA
          const parsed = parseColorWithAlpha(s);
          if (parsed) return parsed.hex;
          return toHex(s);
        };

        // --- Visual categorical palette (for richer color variety) ---
        const ensureHash = (c: string): string => (c && c.startsWith('#')) ? c : (c ? `#${c}` : '#000000');
        const paletteColors: string[] = (() => {
          try {
            const tplPalette = (templateConfig?.visualStyles?.palette?.colors);
            if (Array.isArray(tplPalette) && tplPalette.length) {
              return tplPalette.map((c: any) => ensureHash(String(c))).filter(Boolean);
            }
          } catch {}
          // Build dynamic palette from AI colors according to paletteStrategy
          const strategy: any = (templateConfig?.rules?.paletteStrategy) || {};
          const useMode: 'template'|'prefer_ai'|'ai_overrides' = (strategy.use === 'ai_overrides' ? 'ai_overrides' : (strategy.use === 'template' ? 'template' : 'prefer_ai'));
          const distribution: 'cycle'|'shufflePerVisual'|'shufflePerSlide' = (['cycle','shufflePerVisual','shufflePerSlide'].includes(String(strategy.distribution)) ? strategy.distribution : 'cycle') as any;
          const maxColors = Number.isFinite(Number(strategy.maxColors)) ? Math.max(3, Number(strategy.maxColors)) : 8;
          // Source base colors: prefer AI based on aiColorPolicy + paletteStrategy.use
          const policy: 'template'|'prefer_ai'|'ai_overrides'|'disabled' = aiColorPolicy;
          const preferAI = (useMode === 'ai_overrides') || (useMode === 'prefer_ai') || (policy === 'ai_overrides') || (policy === 'prefer_ai');
          const aiOverride = (useMode === 'ai_overrides') || (policy === 'ai_overrides');
          const baseSeeds: string[] = aiOverride
            ? [resolvedPrimary, resolvedSecondary]
            : (preferAI ? [resolvedPrimary, resolvedSecondary, accent] : [primary, secondary, accent]);
          // Generate a balanced palette: rotate hues and vary lightness/saturation to avoid same-hue clustering
          const toHsl = (hex: string) => {
            const h = ensureHash(hex).replace('#','');
            const r = parseInt(h.slice(0,2),16)/255, g = parseInt(h.slice(2,4),16)/255, b = parseInt(h.slice(4,6),16)/255;
            const max = Math.max(r,g,b), min = Math.min(r,g,b);
            let hDeg = 0; const l = (max+min)/2; const d = max-min;
            if (d !== 0) {
              const s = d / (1 - Math.abs(2*l - 1));
              if (max === r) hDeg = 60 * (((g-b)/d) % 6);
              else if (max === g) hDeg = 60 * (((b-r)/d) + 2);
              else hDeg = 60 * (((r-g)/d) + 4);
              return { h: (hDeg+360)%360, s, l };
            }
            return { h: 0, s: 0, l };
          };
          const fromHsl = (h:number,s:number,l:number) => {
            const c = (1 - Math.abs(2*l - 1)) * s; const x = c*(1-Math.abs(((h/60)%2)-1)); const m = l - c/2;
            let r=0,g=0,b=0;
            if (0<=h && h<60) { r=c; g=x; b=0; }
            else if (60<=h && h<120) { r=x; g=c; b=0; }
            else if (120<=h && h<180) { r=0; g=c; b=x; }
            else if (180<=h && h<240) { r=0; g=x; b=c; }
            else if (240<=h && h<300) { r=x; g=0; b=c; }
            else { r=c; g=0; b=x; }
            const R = Math.round((r+m)*255).toString(16).padStart(2,'0');
            const G = Math.round((g+m)*255).toString(16).padStart(2,'0');
            const B = Math.round((b+m)*255).toString(16).padStart(2,'0');
            return `#${R}${G}${B}`;
          };
          const seedsHsl = baseSeeds.map(toHsl);
          const out: string[] = [];
          for (let i=0; i<maxColors; i++) {
            const baseIdx = i % seedsHsl.length;
            const base = seedsHsl[baseIdx];
            let h: number;
            if (aiOverride) {
              // Keep within same hue family (±6°) to maintain brand/AI color feel
              const delta = (i % 2 === 0) ? 6 : -6;
              h = (base.h + delta) % 360;
            } else {
              // Balanced spectrum when not strictly overriding with AI
              const golden = 137.5; // degrees
              h = (base.h + i*golden) % 360;
            }
            // Lightness/Saturation gentle zig-zag for variety while staying in family
            const s = Math.min(0.85, Math.max(0.35, base.s + ((i%2===0)? 0.08 : -0.04)));
            const l = Math.min(0.72, Math.max(0.28, base.l + ((i%3===0)? 0.06 : (i%3===1? -0.05 : 0.02))));
            out.push(fromHsl(h,s,l));
          }
          return out;
        })();
        const getPaletteColor = (index: number): string => {
          if (!Array.isArray(paletteColors) || paletteColors.length === 0) return secondary;
          const strategy: any = (templateConfig?.rules?.paletteStrategy) || {};
          const distribution: 'cycle'|'shufflePerVisual'|'shufflePerSlide' = (['cycle','shufflePerVisual','shufflePerSlide'].includes(String(strategy.distribution)) ? strategy.distribution : 'cycle') as any;
          // seed per visual/slide: we approximate by using index with simple hash drift
          let offset = 0;
          if (distribution === 'shufflePerVisual') {
            offset = (index * 3 + 5) % paletteColors.length;
          } else if (distribution === 'shufflePerSlide') {
            offset = (Math.floor(index/10) * 7 + 3) % paletteColors.length;
          }
          const i = Math.max(0, (index + offset) % paletteColors.length);
          return paletteColors[i];
        };

        // Normalize icon image to white background (avoid black background when alpha is present)
        const normalizeIconBackground = async (iconPath: string): Promise<string> => {
          try {
            const sharpMod: any = await import('sharp');
            const sharp = (sharpMod && sharpMod.default) ? sharpMod.default : sharpMod;
            const img = sharp(iconPath).flatten({ background: { r: 255, g: 255, b: 255 } });
            await img.toFile(iconPath);
          } catch {
            // ignore normalization failures; use original
          }
          return iconPath;
        };

        // Sanitize icon name and provide simple synonyms for common keywords
        const sanitizeIconKeyword = (raw: string): string => {
          const base = String(raw || '').trim().toLowerCase();
          const simple = base.replace(/[_\-]+/g, ' ').replace(/\s+/g, ' ').trim();
          const map: Record<string, string> = {
            'globe alt': 'globe',
            'shopping cart': 'shopping cart',
            'arrow trending up': 'upward trending arrow',
            'chart pie': 'pie chart',
            'building office': 'office building',
            'dollar sign': 'dollar',
            'trending up': 'upward trending arrow',
            'cpu': 'processor',
            'building': 'office building'
          };
          return map[simple] || simple;
        };

        const buildIconPrompt = (keyword: string, style: string, monochrome: boolean, glyphColor?: 'white'|'black', bgColor?: 'white'|'transparent'): string => {
          const k = sanitizeIconKeyword(keyword);
          const hints: string[] = [];
          hints.push(`minimal ${style} icon of ${k}`);
          if (monochrome) hints.push('monochrome');
          if (glyphColor) hints.push(`${glyphColor} glyph`);
          if (bgColor === 'white') {
            hints.push('solid white square background, no gradients');
          } else {
            hints.push('transparent background only, alpha transparency');
          }
          hints.push('no border, no text');
          hints.push('flat, vector-like, centered, high-contrast');
          if (bgColor !== 'white') hints.push('do not include any background rectangle or filled shape');
          return hints.join(', ');
        };

        // --- Unified visual placement decision (right panel vs bottom band) ---
        const shouldPlaceVisualBottom = (typeStrRaw: string, payload: any): boolean => {
          try {
            const typeStr = String(typeStrRaw || '').toLowerCase();
            const vp = (templateConfig?.rules?.visualPlacement) || {};
            const forceBottomTypes: Set<string> = new Set(vp.forceBottomTypes || ['process','roadmap','gantt','timeline','funnel','waterfall','heatmap']);
            if (forceBottomTypes.has(typeStr)) return true;

            // KPI: fallback by items count
            if (typeStr === 'kpi') {
              const itemsLen = Array.isArray(payload?.items) ? payload.items.length : 0;
              const kpiMaxRight = Number(vp.kpiMaxRightPanelItems ?? 3);
              if (itemsLen > kpiMaxRight) return true;
            }
            // Checklist: fallback by items count and rough height estimate
            if (typeStr === 'checklist') {
              const itemsLen = Array.isArray(payload?.items) ? payload.items.length : 0;
              const checklistMaxRight = Number(vp.checklistMaxRightPanelItems ?? 4);
              if (itemsLen > checklistMaxRight) return true;
            }
            // Timeline dense steps
            if (typeStr === 'timeline') {
              const stepsLen = Array.isArray(payload?.steps) ? payload.steps.length : 0;
              if (stepsLen >= 4) return true;
            }
          } catch {}
          return false;
        };

        // --- Generic style resolution helpers ---
        const getByPath = (obj: any, pathStr?: string): any => {
          if (!obj || !pathStr || typeof pathStr !== 'string') return undefined;
          return pathStr.split('.').reduce((acc: any, key: string) => (acc && typeof acc === 'object' ? acc[key] : undefined), obj);
        };
        const resolveStyle = (...sources: any[]): any => {
          const out: any = {};
          for (const src of sources) {
            if (!src || typeof src !== 'object') continue;
            for (const k of Object.keys(src)) out[k] = src[k];
          }
          return out;
        };
        // Use string shape types to avoid enum availability differences across builds
        const shapeTypeMap: Record<string, any> = {
          rect: 'rect',
          roundRect: 'roundRect',
          ellipse: 'ellipse',
          line: 'line',
          chevron: 'chevron',
          triangle: 'triangle',
          trapezoid: 'trapezoid',
          pie: 'pie',
        } as any;
        const renderElementsFromTemplate = async (slideObj: any, layoutKey: string, elements: any[], areaOverrides?: Record<string, { x: number; y: number; w: number; h: number }>) => {
          if (!Array.isArray(elements) || !elements.length) return;
          for (const el of elements) {
            const areaName = String(el?.area || '');
            if (!areaName) continue;
            const a = (areaOverrides && areaOverrides[areaName]) || (templateConfig?.layouts?.[layoutKey]?.areas || {})[areaName];
            if (!a) {
              try { logger.warn({ layout: layoutKey, area: areaName }, 'Template element skipped: area not defined in template.'); } catch {}
              continue;
            }
            const ref = typeof (a as any)?.ref === 'string' ? (a as any).ref : '';
            const refSize = ref && templateConfig?.geometry?.regionDefs && templateConfig.geometry.regionDefs[ref];
            const w = Number((a as any)?.w) || Number(refSize?.w) || 1;
            const h = Number((a as any)?.h) || Number(refSize?.h) || 1;
            const x = Number((a as any)?.x) || 0;
            const y = Number((a as any)?.y) || 0;
            const styleRefs = Array.isArray(el?.styleRef) ? el.styleRef : (el?.styleRef ? [el.styleRef] : []);
            const styleRefObjsAll: Array<{ p: string; v: any }> = styleRefs.map((p: string) => ({ p, v: getByPath(templateConfig, p) }));
            const styleRefObjs = styleRefObjsAll.map((o: { p: string; v: any }) => o.v).filter(Boolean);
            const missingStyleRefs = styleRefObjsAll.filter((o: { p: string; v: any }) => !o.v).map((o: { p: string; v: any }) => o.p);
            if (missingStyleRefs.length) {
              try { logger.warn({ layout: layoutKey, missingStyleRefs }, 'Template styleRef paths not found.'); } catch {}
            }
            const style = resolveStyle(...styleRefObjs, el?.style);
            const type = String(el?.type || '');
            if (type === 'shape') {
              const shpName = String(el?.shapeType || style?.shapeType || 'rect');
              const shp = shapeTypeMap[shpName] || 'rect';
              const allowedDash = new Set(['solid','dash','dot','lgDash','sysDash']);
              const dashType = typeof style?.lineDash === 'string' && allowedDash.has(style.lineDash) ? style.lineDash : undefined;
              const opts: any = { x, y, w, h, fill: buildFill(style?.fill), line: { color: normalizeColorToPptxHex(style?.lineColor) || (normalizeColorToPptxHex(style?.fill) || 'FFFFFF'), width: Number(style?.lineWidth) || 0 } , rectRadius: Number(style?.cornerRadius) || cornerRadius, shadow: shadowOf(style?.shadow, shadowPreset) };
              if (dashType) opts.line.dashType = dashType as any;
              if (Number.isFinite(style?.rotate)) opts.rotate = Number(style.rotate);
              if (shp === 'pie' && Number.isFinite(style?.angle)) opts.angle = Number(style.angle);
              slideObj.addShape(shp, opts);
              continue;
            }
            if (type === 'text') {
              const contentPath = typeof el?.contentRef === 'string' ? el.contentRef : '';
              let textVal: string = '';
              if (contentPath) {
                const fromData = getByPath((slideObj as any).__data || {}, contentPath);
                if (Array.isArray(fromData)) textVal = fromData.map((s: any)=>String(s||'')).join('\n');
                else if (fromData != null) textVal = String(fromData);
              }
              if (!textVal) textVal = String(el?.text || '');
              if (!textVal) continue;
              try { logger.info({ layoutKey, contentPath, sample: textVal.slice(0,64), length: textVal.length }, 'render:text:prepare'); } catch {}
              const textOptions: any = { x, y, w, h, fontFace: String(style?.fontFace || headFont), fontSize: Number(style?.fontSize) || 20, bold: !!style?.bold, color: normalizeColorToPptxHex(style?.color) || '000000', align: style?.align || 'left', valign: style?.valign || 'top', shadow: shadowOf(style?.shadow, shadowPreset) };
              // Special layout adjustment: in comparison_cards, push bullets below the title within the card area
              if (layoutKey === 'comparison_cards' && (contentPath === 'bulletsA' || contentPath === 'bulletsB')) {
                const titleReserve = 0.6; // inches reserved for card title within the card
                textOptions.y = y + titleReserve;
                textOptions.h = Math.max(0.2, h - titleReserve);
                try { logger.info({ contentPath, textLen: textVal.length, box: { x, y: textOptions.y, w, h: textOptions.h } }, 'comparison_cards bullets box'); } catch {}
                try {
                  (slideObj as any).__renderedFlags = (slideObj as any).__renderedFlags || {};
                  (slideObj as any).__renderedFlags[`comparison_cards_${contentPath}`] = true;
                } catch {}
              }
              // bullets
              const isCompCardsBullets = (layoutKey === 'comparison_cards' && (contentPath === 'bulletsA' || contentPath === 'bulletsB'));
              const wantsBullets = !!(style && (style.bullet === true || typeof style.bulletType === 'string'));
              if (wantsBullets && !isCompCardsBullets) {
                textOptions.bullet = style.bullet === true ? true : { type: String(style.bulletType) };
                if (style.autoFit !== undefined) textOptions.autoFit = !!style.autoFit; else textOptions.autoFit = true;
              } else if (style && style.autoFit !== undefined) {
                textOptions.autoFit = !!style.autoFit;
              }
              if (Number.isFinite(style?.paraSpaceAfter)) textOptions.paraSpaceAfter = Number(style.paraSpaceAfter);
              // background and outline
              if (style?.fill) textOptions.fill = buildFill(style.fill);
              if (style?.lineColor || Number.isFinite(style?.lineWidth)) textOptions.line = { color: normalizeColorToPptxHex(style?.lineColor) || (normalizeColorToPptxHex(style?.fill) || 'FFFFFF'), width: Number(style?.lineWidth) || 0 };
              // When bullets are requested, pass plain string; for comparison_cards bullets force plain (no bullet dots)
              if (wantsBullets && !isCompCardsBullets) {
                try { logger.info({ contentPath, options: { x: textOptions.x, y: textOptions.y, w: textOptions.w, h: textOptions.h, fontSize: textOptions.fontSize } }, 'render:text:addText:bullets'); } catch {}
                slideObj.addText(textVal, textOptions);
              } else {
                try { logger.info({ contentPath, options: { x: textOptions.x, y: textOptions.y, w: textOptions.w, h: textOptions.h, fontSize: textOptions.fontSize } }, 'render:text:addText:plain'); } catch {}
                slideObj.addText(toBoldRunsFromMarkdown(textVal) as any, textOptions);
              }
              try { logger.info({ contentPath }, 'render:text:done'); } catch {}
              continue;
            }
            if (type === 'image') {
              const pathStr = String(el?.path || '');
              if (pathStr) {
                slideObj.addImage({ path: pathStr, x, y, w, h, sizing: { type: style?.sizing || 'contain', w, h } as any, shadow: shadowOf(style?.shadow, shadowPreset) });
              }
              continue;
            }
            if (type === 'table') {
              // Build rows from data object (label/value pairs) or string
              const contentPath = typeof el?.contentRef === 'string' ? el.contentRef : '';
              let data: any = contentPath ? getByPath((slideObj as any).__data || {}, contentPath) : undefined;
              if (data === undefined) {
                // fallback to common fields
                data = (slideObj as any).__data?.companyOverview ?? (slideObj as any).__data?.body;
              }
              const rows: any[] = [];
              if (data && typeof data === 'object' && !Array.isArray(data)) {
                const pairs: Array<{ label: string; value: string }> = [];
                const ov = data as any;
                const pushIf = (k: string, label: string) => { if (ov[k]) pairs.push({ label, value: String(ov[k]) }); };
                // Known fields in intended order
                pushIf('company_name','会社名');
                pushIf('address','所在地');
                pushIf('founded','設立');
                pushIf('representative','代表者');
                pushIf('vision','ビジョン');
                if (Array.isArray(ov.business) && ov.business.length) pairs.push({ label: '事業内容', value: ov.business.join(' / ') });
                pushIf('homepage','HomePage');
                pushIf('contact','問い合わせ');
                // Fallback: include any other enumerable string fields
                for (const k of Object.keys(ov)) {
                  if (['company_name','address','founded','representative','vision','business','homepage','contact'].includes(k)) continue;
                  const v = ov[k];
                  if (v == null) continue;
                  if (typeof v === 'string' && v.trim()) pairs.push({ label: k, value: v });
                }
                const labelFill = resolveThemedColorToken(style?.labelFill) || undefined;
                const valueFill = resolveThemedColorToken(style?.valueFill) || undefined;
                const altRowFill = resolveThemedColorToken(style?.altRowFill) || undefined;
                const labelColor = resolveThemedColorToken(style?.labelColor) || 'FFFFFF';
                const valueColor = resolveThemedColorToken(style?.valueColor) || '333333';
                const fontSize = Number(style?.fontSize) || 14;
                rows.push(...pairs.map((p, idx) => {
                  const isAlt = !!altRowFill && (idx % 2 === 1);
                  const baseRowFill = valueFill || undefined;
                  const rowFillHex = isAlt ? altRowFill : baseRowFill;
                  const leftFill = rowFillHex ? { color: rowFillHex } : undefined;
                  const rightFill = rowFillHex ? { color: rowFillHex } : undefined;
                  const leftTextColor = valueColor;
                  const rightTextColor = valueColor;
                  return [
                    { text: p.label, options: { bold: style?.labelBold !== false, color: leftTextColor, fill: leftFill, fontFace: JPN_FONT, fontSize, valign: 'middle' } },
                    { text: p.value, options: { color: rightTextColor, fill: rightFill, fontFace: JPN_FONT, fontSize, valign: 'middle' } }
                  ];
                }));
              } else {
                const text = data != null ? String(data) : '';
                if (text) rows.push([{ text, options: { fontFace: JPN_FONT, fontSize: Number(style?.fontSize) || 14, color: normalizeColorToPptxHex(style?.color) || '333333', valign: 'top' } }]);
              }
              if (rows.length) {
                const borderColor = resolveThemedColorToken(style?.borderColor) || 'E6E6E6';
                const borderWidth = Number(style?.borderWidth) || 1;
                const colW: number[] | undefined = Array.isArray(style?.colW) ? style.colW.map((n: any)=>Number(n)).filter((n: number)=>Number.isFinite(n)) : undefined;
                slideObj.addTable(rows, { x, y, w, h, colW: colW && colW.length ? colW : undefined, border: { type: 'solid', color: borderColor, pt: borderWidth } as any });
              }
              continue;
            }
            if (type === 'visual') {
              // Quote layout intentionally avoids visuals unless explicitly provided; ignore silently
              if (layoutKey === 'quote') {
                try { logger.info({ layout: layoutKey, area: { x, y, w, h } }, 'Quote layout: ignoring template visual element by design.'); } catch {}
                continue;
              }
              const recipe = typeof el?.recipeRef === 'string' ? getByPath((slideObj as any).__data || {}, el.recipeRef) : ((slideObj as any).__data?.visual_recipe);
              try { logger.info({ layout: layoutKey, hasRecipe: !!recipe, recipeType: recipe?.type, area: { x, y, w, h } }, 'Template visual element encountered'); } catch {}
              // Prevent overlap with reserved bottom branding area
              let vy = y, vh = h;
              const reservedBottom = typeof templateConfig?.branding?.reservedBottom === 'number' ? Math.max(0, templateConfig.branding.reservedBottom) : 0.8;
              if ((vy + vh) > (pageH - reservedBottom)) {
                const minY = contentTopY + 0.7;
                vy = Math.max(minY, (pageH - reservedBottom) - vh);
              }
              // no-op; rely on fallback warnings when needed
              if (recipe && typeof recipe === 'object') {
                try { logger.info({ type: String(recipe.type||'') }, 'drawInfographic(start)'); } catch {}
                await drawInfographic(slideObj, String(recipe.type || ''), recipe, { x, y: vy, w, h: vh });
                try { logger.info('drawInfographic(done)'); } catch {}
              } else if ((slideObj as any).__data?.imagePath) {
                slideObj.addImage({ path: (slideObj as any).__data.imagePath, x, y: vy, w, h: vh, sizing: { type: style?.sizing || 'contain', w, h: vh } as any, shadow: shadowOf(style?.shadow, shadowPreset) });
              } else {
                try { logger.warn({ layout: layoutKey, area: { x, y: vy, w, h: vh } }, 'Template visual element has no recipe or image; nothing rendered.'); } catch {}
              }
              continue;
            }
          }
        };

        // bullets area style from template
        const bulletsBg = typeof templateConfig?.areaStyles?.bullets?.bg === 'string' ? templateConfig.areaStyles.bullets.bg : undefined;
        const bulletsShadowValue: any = templateConfig?.areaStyles?.bullets?.shadow;

        // Draw infographic primitives on the given slide
        const ChartType: any = (pres as any).ChartType;
        async function drawInfographic(targetSlide: any, type: string, payload: any, region?: { x: number; y: number; w: number; h: number }) {
            const rx = region?.x ?? 0.8;
            const ry = region?.y ?? 3.6;
            const rw = region?.w ?? 8.4;
            const rh = region?.h ?? 2.2;
            const renderChartImage = async (ct: 'bar'|'pie'|'line', labels: string[], values: number[], titleText?: string): Promise<string | null> => {
              try {
                const mod = await import('./generateChart');
                const tool: any = (mod as any).generateChartTool;
                if (!tool || typeof tool.execute !== 'function') return null;
                const safeName = `pptchart-${Date.now()}-${Math.floor(Math.random()*1e6)}`;
                const res = await tool.execute({ context: { chartType: ct, title: String(titleText || payload?.title || ''), labels, data: values, fileName: safeName } });
                if (res && res.success === true && res.data && res.data.imagePath) return res.data.imagePath as string;
                return null;
              } catch (e) {
                try { logger.warn({ error: String(e) }, 'generateChart invocation failed'); } catch {}
                return null;
              }
            };
            switch (type) {
                case 'bar_chart': {
                    try {
                        const labels: string[] = Array.isArray(payload?.labels) ? payload.labels : (Array.isArray(payload?.items) ? payload.items.map((it: any)=>String(it?.label||'')) : (Array.isArray(payload?.values) ? payload.values.map((_:any,i:number)=>`V${i+1}`) : ['A','B','C']));
                        const seriesArr: any[] = Array.isArray(payload?.series) ? payload.series : [];
                        const values: number[] = seriesArr.length > 0 ? (Array.isArray(seriesArr[0]?.data) ? seriesArr[0].data.map((n:any)=>Number(n)||0) : []) : (Array.isArray(payload?.values) ? payload.values.map((n:any)=>Number(n)||0) : (Array.isArray(payload?.items) ? payload.items.map((it:any)=>Number(it?.value||0)) : [10,20,15]));
                        if (seriesArr.length > 1) { try { logger.warn({ seriesCount: seriesArr.length }, 'Multiple series detected in bar_chart; using the first series for PNG generation'); } catch {} }
                        const imgPath = await renderChartImage('bar', labels, values, payload?.title);
                        if (imgPath) {
                          targetSlide.addImage({ path: imgPath, x: rx, y: ry, w: rw, h: rh, sizing: { type: 'contain', w: rw, h: rh } as any, shadow: shadowOf(resolveVisualShadow('image')) });
                          try { imagePathsToDelete.add(imgPath); } catch {}
                        } else {
                          targetSlide.addText('Bar Chart', { x: rx, y: ry, w: rw, h: 0.3, fontSize: 12, bold: true, fontFace: JPN_FONT });
                        }
                    } catch (e) {
                        try { logger.warn({ error: String(e) }, 'Bar chart PNG generation failed'); } catch {}
                        targetSlide.addText('Bar Chart', { x: rx, y: ry, w: rw, h: 0.3, fontSize: 12, bold: true, fontFace: JPN_FONT });
                    }
                    break;
                }
                case 'pie_chart': {
                    try {
                        const items: any[] = Array.isArray(payload?.items) ? payload.items : [];
                        const labels: string[] = items.length ? items.map((it:any)=>String(it?.label||'')) : (Array.isArray(payload?.labels)? payload.labels : ['A','B','C']);
                        const values: number[] = items.length ? items.map((it:any)=>Number(it?.value||0)) : (Array.isArray(payload?.values) ? payload.values.map((n:any)=>Number(n)||0) : [30,40,30]);
                        const imgPath = await renderChartImage('pie', labels, values, payload?.title);
                        if (imgPath) {
                          targetSlide.addImage({ path: imgPath, x: rx, y: ry, w: rw, h: rh, sizing: { type: 'contain', w: rw, h: rh } as any, shadow: shadowOf(resolveVisualShadow('image')) });
                          try { imagePathsToDelete.add(imgPath); } catch {}
                        } else {
                          targetSlide.addText('Pie Chart', { x: rx, y: ry, w: rw, h: 0.3, fontSize: 12, bold: true, fontFace: JPN_FONT });
                        }
                    } catch {
                        targetSlide.addText('Pie Chart', { x: rx, y: ry, w: rw, h: 0.3, fontSize: 12, bold: true, fontFace: JPN_FONT });
                    }
                    break;
                }
                case 'line_chart': {
                    try {
                        const labels: string[] = Array.isArray(payload?.labels) ? payload.labels : ['A','B','C','D'];
                        const seriesArr: any[] = Array.isArray(payload?.series) ? payload.series : [];
                        const values: number[] = seriesArr.length > 0 ? (Array.isArray(seriesArr[0]?.data) ? seriesArr[0].data.map((n:any)=>Number(n)||0) : []) : [10,20,15,25];
                        if (seriesArr.length > 1) { try { logger.warn({ seriesCount: seriesArr.length }, 'Multiple series detected in line_chart; using the first series for PNG generation'); } catch {} }
                        const imgPath = await renderChartImage('line', labels, values, payload?.title);
                        if (imgPath) {
                          targetSlide.addImage({ path: imgPath, x: rx, y: ry, w: rw, h: rh, sizing: { type: 'contain', w: rw, h: rh } as any, shadow: shadowOf(resolveVisualShadow('image')) });
                          try { imagePathsToDelete.add(imgPath); } catch {}
                        } else {
                          targetSlide.addText('Line Chart', { x: rx, y: ry, w: rw, h: 0.3, fontSize: 12, bold: true, fontFace: JPN_FONT });
                        }
                    } catch (e) {
                        targetSlide.addText('Line Chart', { x: rx, y: ry, w: rw, h: 0.3, fontSize: 12, bold: true, fontFace: JPN_FONT });
                    }
                    break;
                }
                case 'kpi_grid': {
                    const items = Array.isArray(payload?.items) ? payload.items : [];
                    // Template-driven style for kpi_grid
                    const kgStyle: any = (templateConfig?.visualStyles?.kpi_grid) || {};
                    const labelFsTpl = Number(kgStyle.labelFontSize);
                    const valueFsTpl = Number(kgStyle.valueFontSize);
                    const gap = Number.isFinite(kgStyle.gap) ? Number(kgStyle.gap) : 0.4;
                    const borderW = Number.isFinite(kgStyle.borderWidth) ? Number(kgStyle.borderWidth) : 0.5;
                    const borderCol = normalizeColorToPptxHex(kgStyle.borderColor) || 'FFFFFF';
                    const labelColTpl = normalizeColorToPptxHex(kgStyle.labelColor);
                    const valueColTpl = normalizeColorToPptxHex(kgStyle.valueColor);
                    const cardW = Math.min( (rw - 0.8) / 2, 2.6 );
                    const cardH = Math.min( rh / 2 - 0.2, 1.35 );
                    items.slice(0, 4).forEach((it: any, idx: number) => {
                        const row = Math.floor(idx / 2), col = idx % 2;
                        const x = rx + 0.2 + col * (cardW + gap);
                        const y = ry + 0.2 + row * (cardH + gap);
                        const __box = getPaletteColor(idx).replace('#','');
                        const autoTxt = pickTextColorForBackground(`#${__box}`).toString();
                        const valueFs = Number.isFinite(valueFsTpl) ? Number(valueFsTpl) : 18;
                        const labelFs = Number.isFinite(labelFsTpl) ? Number(labelFsTpl) : 11.5;
                        const valueCol = valueColTpl || autoTxt;
                        const labelCol = labelColTpl || autoTxt;
                        targetSlide.addShape('rect', { x, y, w: cardW, h: cardH, fill: { color: __box }, line: { color: borderCol, width: borderW }, rectRadius: Math.min(cornerRadius, 6), shadow: shadowOf(resolveVisualShadow('kpi_grid')) });
                        targetSlide.addText(String(it?.value ?? ''), { x: x + 0.2, y: y + 0.2, w: cardW - 0.4, h: cardH * 0.55, fontSize: valueFs, bold: true, color: valueCol, align: 'center', fontFace: JPN_FONT });
                        targetSlide.addText(String(it?.label ?? ''), { x: x + 0.2, y: y + cardH * 0.65, w: cardW - 0.4, h: cardH * 0.3, fontSize: labelFs, color: labelCol, align: 'center', fontFace: JPN_FONT });
                    });
                    break;
                }
                case 'kpi_donut': {
                    const items = Array.isArray(payload?.items) ? payload.items : [];
                        const labels = items.map((it: any) => String(it?.label ?? ''));
                    const values = items.map((it: any) => Number(it?.value ?? 0)).map((v: number) => Math.max(0, Math.min(100, v)));
                    const total = values.reduce((a: number, b: number) => a + b, 0) || 1;
                    const kdStyle: any = (templateConfig?.visualStyles?.kpi_donut) || {};
                    // Layout: donut chart on top, legend below
                    const chartH = Math.min(rh * 0.65, 1.6);
                    const legendH = Math.max(0.4, rh - chartH - 0.1);
                    let chartRendered = false;
                    try {
                        if ((ChartType as any) && (ChartType as any).doughnut && typeof (targetSlide as any).addChart === 'function') {
                            const doughnutType = (ChartType as any).doughnut;
                            const data = [{ name: 'CAGR', labels, values }];
                            const chartColors = labels.map((_: string, i: number) => getPaletteColor(i)).map((c: string)=>c.replace('#',''));
                            (targetSlide as any).addChart(doughnutType, data, { x: rx, y: ry, w: rw, h: chartH, showLegend: false, chartColors } as any);
                            chartRendered = true;
                            try { logger.info('kpi_donut: charts'); } catch {}
                        }
                    } catch {}
                    if (!chartRendered) {
                        // Fallback: render pie chart image via generateChart tool
                        try {
                            const imgPath = await (async () => {
                                try { return await renderChartImage('pie', labels, values, payload?.title || ''); } catch { return null; }
                            })();
                            if (imgPath) {
                                targetSlide.addImage({ path: imgPath, x: rx, y: ry, w: rw, h: chartH, sizing: { type: 'contain', w: rw, h: chartH } as any, shadow: shadowOf(resolveVisualShadow('image')) });
                                try { imagePathsToDelete.add(imgPath); } catch {}
                                chartRendered = true;
                                try { logger.info('kpi_donut: image-fallback'); } catch {}
                            }
                        } catch {}
                    }
                    if (!chartRendered) {
                        // Fallback 2: draw donut using shapes (pie wedges + inner hole)
                        const cx = rx + rw / 2;
                        const cy = ry + chartH / 2;
                        const diameter = Math.min(rw, chartH);
                        const x0 = cx - diameter / 2;
                        const y0 = cy - diameter / 2;
                        let startAngle = -90; // start from top
                        for (let i = 0; i < values.length; i++) {
                            const v = Math.max(0, Number(values[i] || 0));
                            if (v <= 0) continue;
                            const ratio = v / (total || 1);
                            const span = Math.max(0.1, Math.min(359.9, ratio * 360));
                            const col = getPaletteColor(i);
                            targetSlide.addShape('pie', { x: x0, y: y0, w: diameter, h: diameter, fill: { color: col }, line: { color: col.replace('#',''), width: 0 }, angle: span, rotate: startAngle } as any);
                            startAngle += span;
                        }
                        // inner hole
                        const holeScale = (Number(kdStyle.holeScale) && Number(kdStyle.holeScale) > 0 && Number(kdStyle.holeScale) < 0.95) ? Number(kdStyle.holeScale) : 0.6; // default 60%
                        const holeW = diameter * holeScale;
                        const holeH = diameter * holeScale;
                        const hx = cx - holeW / 2;
                        const hy = cy - holeH / 2;
                        targetSlide.addShape('ellipse', { x: hx, y: hy, w: holeW, h: holeH, fill: { color: 'FFFFFF' }, line: { color: 'FFFFFF', width: 0 } });
                        chartRendered = true;
                        try { logger.info('kpi_donut: shape-fallback'); } catch {}
                    }
                    if (!chartRendered) {
                        targetSlide.addText('CAGR', { x: rx, y: ry, w: rw, h: 0.3, fontSize: 12, bold: true, fontFace: JPN_FONT });
                    }
                    // Overlay labels on the donut (instead of bottom legend)
                    const cx = rx + rw / 2;
                    const cy = ry + chartH / 2;
                    const radius = Math.min(rw, chartH) / 2;
                    const labelR = radius * 0.78;
                    let angleCursor = -90; // start at top
                    for (let i = 0; i < labels.length; i++) {
                        const v = Math.max(0, Number(values[i] || 0));
                        const span = (total > 0) ? (v / total) * 360 : 0;
                        const mid = angleCursor + span / 2;
                        const rad = (mid * Math.PI) / 180;
                        const lx = cx + Math.cos(rad) * labelR;
                        const ly = cy + Math.sin(rad) * labelR;
                        const w = Math.min(1.8, Math.max(1.1, rw * 0.22));
                        const h = 0.38;
                        const text = `${labels[i]} ${v}%`;
                        const segColor = getPaletteColor(i);
                        const autoTextColor = pickTextColorForBackground(segColor).toString();
                        // leader line from donut edge to label
                        const edgeR = radius * 0.92;
                        const ax = cx + Math.cos(rad) * edgeR;
                        const ay = cy + Math.sin(rad) * edgeR;
                        const leaderWidth = Number.isFinite(Number(kdStyle.leaderLineWidth)) ? Math.max(0.5, Number(kdStyle.leaderLineWidth)) : 1;
                        targetSlide.addShape('line', { x: Math.min(ax, lx), y: Math.min(ay, ly), w: Math.max(0.02, Math.abs(lx - ax)), h: Math.max(0.02, Math.abs(ly - ay)), line: { color: segColor.replace('#',''), width: leaderWidth } });
                        // overlay text with subtle shadow as outline
                        const lblFs = Number.isFinite(Number(kdStyle.labelFontSize)) ? Number(kdStyle.labelFontSize) : 11;
                        targetSlide.addText(text, { x: lx - w / 2, y: ly - h / 2, w, h, fontSize: lblFs, align: 'center', fontFace: JPN_FONT, valign: 'middle', color: autoTextColor, shadow: { type: 'outer', color: '000000', opacity: 0.35, blur: 1, offset: 0, angle: 0 } as any });
                        angleCursor += span;
                    }
                    break;
                }
                case 'progress': {
                    const items = Array.isArray(payload?.items) ? payload.items : [];
                    const prStyle: any = (templateConfig?.visualStyles?.progress) || {};
                    const labelAlign = (String(prStyle.labelAlign||'right').startsWith('r') ? 'right' : 'left') as 'left'|'right';
                    const labelFs = Number(prStyle.labelFontSize) || 14;
                    const labelGap = Number.isFinite(Number(prStyle.labelGap)) ? Number(prStyle.labelGap) : 0.08;
                    const barCfg = (prStyle.bar || {}) as any;
                    const barHeightMax = Math.min(0.6, Number(barCfg.heightMax)||0.4);
                    const barBg = normalizeColorToPptxHex(barCfg.bg) || 'EEEEEE';
                    const barBgLine = normalizeColorToPptxHex(barCfg.bgLine) || 'DDDDDD';
                    const valCfg = (prStyle.value || {}) as any;
                    const showVal = (valCfg.show !== false);
                    const valSuffix = (typeof valCfg.suffix === 'string') ? valCfg.suffix : '%';
                    const valFs = Number(valCfg.fontSize) || 12;
                    const valAlignRight = String(valCfg.align||'right').startsWith('r');
                    const valOffset = Number.isFinite(Number(valCfg.offset)) ? Number(valCfg.offset) : 0.04;
                    const barAreaX = rx + rw * 0.40;
                    const barAreaW = rw * 0.55;
                    const labelW = rw * 0.35;
                    const barH = Math.min(barHeightMax, rh / Math.max(1, items.length) - 0.1);
                    items.slice(0, 8).forEach((it: any, i: number) => {
                        const y = ry + i * (barH + 0.12);
                        // label (right aligned by default)
                        targetSlide.addText(String(it?.label ?? ''), { x: rx, y, w: labelW - labelGap, h: barH, fontSize: labelFs, fontFace: JPN_FONT, align: labelAlign, valign: 'middle' });
                        // bar background
                        targetSlide.addShape('rect', { x: barAreaX, y, w: barAreaW, h: barH, fill: { color: barBg }, line: { color: barBgLine, width: 0.5 } });
                        const v = Math.max(0, Math.min(100, Number(it?.value ?? 0)));
                        const __c = getPaletteColor(i).replace('#','');
                        const filledW = barAreaW * (v / 100);
                        // bar filled
                        targetSlide.addShape('rect', { x: barAreaX, y, w: filledW, h: barH, fill: { color: __c }, line: { color: __c, width: 0 } });
                        // value text
                        if (showVal) {
                            const valText = `${v}${valSuffix}`;
                            const tx = valAlignRight ? (barAreaX + filledW - valOffset) : (barAreaX + filledW + valOffset);
                            const tw = Math.max(0.5, rw * 0.12);
                            const color = '111111';
                            targetSlide.addText(valText, { x: tx - (valAlignRight? tw : 0), y, w: tw, h: barH, fontSize: valFs, fontFace: JPN_FONT, align: valAlignRight ? 'right' : 'left', valign: 'middle', color });
                        }
                    });
                    break;
                }
                case 'gantt': {
                    const tasks = Array.isArray(payload?.tasks) ? payload.tasks : [];
                    const visibleTasks = tasks.slice(0, 10);
                    const barH = Math.min(0.35, rh / Math.max(1, visibleTasks.length) - 0.08);

                    // Parse dates; support ISO YYYY-MM-DD. If missing end but duration provided, derive end.
                    type TaskWithDates = { label: string; start?: Date; end?: Date };
                    const parsed: TaskWithDates[] = visibleTasks.map((t: any) => {
                        const label = String(t?.label ?? '');
                        const startStr = typeof t?.start === 'string' ? t.start : undefined;
                        const endStr = typeof t?.end === 'string' ? t.end : undefined;
                        const duration = Number(t?.duration);
                        let start: Date | undefined = startStr ? new Date(startStr) : undefined;
                        let end: Date | undefined = endStr ? new Date(endStr) : undefined;
                        if (!end && start && Number.isFinite(duration) && duration > 0) {
                            const e = new Date(start.getTime());
                            e.setDate(e.getDate() + Math.floor(duration));
                            end = e;
                        }
                        return { label, start, end };
                    });

                    // Compute min/max dates among valid tasks
                    const valid = parsed.filter(p => p.start instanceof Date && !isNaN(p.start.getTime()) && p.end instanceof Date && !isNaN(p.end.getTime()) && p.end.getTime() >= p.start.getTime());
                    if (valid.length) {
                        const minStart = new Date(Math.min(...valid.map(v => v.start!.getTime())));
                        const maxEnd = new Date(Math.max(...valid.map(v => v.end!.getTime())));
                        const spanMs = Math.max(1, maxEnd.getTime() - minStart.getTime());
                        const scale = (d: Date) => (rw * 0.65) * ((d.getTime() - minStart.getTime()) / spanMs);
                        const barX0 = rx + rw * 0.28;

                        // Grid lines by span unit (month/week/day/hour)
                        const dayMs = 24 * 60 * 60 * 1000;
                        const spanDays = spanMs / dayMs;
                        type Unit = 'month' | 'week' | 'day' | 'hour';
                        const unit: Unit = spanDays >= 60 ? 'month' : spanDays >= 14 ? 'week' : spanDays >= 2 ? 'day' : 'hour';
                        const lines: Date[] = [];
                        const clamp = (d: Date) => new Date(Math.max(minStart.getTime(), Math.min(maxEnd.getTime(), d.getTime())));
                        if (unit === 'month') {
                            const start = new Date(minStart.getFullYear(), minStart.getMonth(), 1);
                            for (let y = start.getFullYear(), m = start.getMonth(); ; ) {
                                const d = new Date(y, m, 1);
                                if (d.getTime() > maxEnd.getTime()) break;
                                lines.push(clamp(d));
                                m += 1; if (m > 11) { m = 0; y += 1; }
                            }
                        } else if (unit === 'week') {
                            const start = new Date(minStart);
                            const dow = start.getDay();
                            const toMon = (dow + 6) % 7; // Monday=0
                            start.setDate(start.getDate() - toMon);
                            start.setHours(0,0,0,0);
                            for (let d = new Date(start); d.getTime() <= maxEnd.getTime(); d.setDate(d.getDate() + 7)) {
                                lines.push(clamp(new Date(d)));
                            }
                        } else if (unit === 'day') {
                            const start = new Date(minStart); start.setHours(0,0,0,0);
                            for (let d = new Date(start); d.getTime() <= maxEnd.getTime(); d.setDate(d.getDate() + 1)) {
                                lines.push(clamp(new Date(d)));
                            }
                        } else {
                            const start = new Date(minStart); start.setMinutes(0,0,0);
                            for (let d = new Date(start); d.getTime() <= maxEnd.getTime(); d.setHours(d.getHours() + 1)) {
                                lines.push(clamp(new Date(d)));
                            }
                        }
                        const ganttStyle: any = (templateConfig?.visualStyles?.gantt) || {};
                        const gridColor = (typeof ganttStyle.gridColor === 'string' && ganttStyle.gridColor.trim()) ? String(ganttStyle.gridColor).trim() : '#9AA3AF';
                        const gridWidth = Number.isFinite(Number(ganttStyle.gridWidth)) ? Math.max(0.5, Number(ganttStyle.gridWidth)) : 1.2;
                        for (const d of lines) {
                            const gx = barX0 + scale(d);
                            targetSlide.addShape('line', { x: gx, y: ry, w: 0, h: rh, line: { color: gridColor, width: gridWidth } });
                        }

                        // Bars + per-task start/end date labels
                        const barMaxX = barX0 + rw * 0.65;
                        valid.forEach((t, i) => {
                            const y = ry + i * (barH + 0.12);
                            // Task label on the left
                            targetSlide.addText(String(t.label), { x: rx, y, w: rw * 0.25, h: barH, fontSize: 10, fontFace: JPN_FONT, align: 'right', valign: 'middle' });
                            // Bar geometry
                            const w = Math.max(0.05, scale(t.end!) - scale(t.start!));
                            const x = barX0 + scale(t.start!);
                            const barColor = getPaletteColor(i).replace('#','');
                            targetSlide.addShape('rect', { x, y, w, h: barH, fill: { color: barColor }, line: { color: barColor, width: 0.5 } });
                            // Per-phase start date label (above the bar)
                            const ganttStyleLocal: any = (templateConfig?.visualStyles?.gantt) || {};
                            const dateFs = Number.isFinite(Number(ganttStyleLocal.labelFontSize)) ? Math.max(6, Number(ganttStyleLocal.labelFontSize)) : 12;
                            const dateH = 0.2;
                            // Place label slightly above the bar without clamping to region top
                            const dateY = y - 0.18;
                            const startStr = t.start!.toISOString().slice(0, 10);
                            // Start label: align x with bar start, place above the bar (left-aligned)
                            const startBoxW = 1.6; // enough for YYYY-MM-DD
                            const startX = x;
                            targetSlide.addText(startStr, { x: startX, y: dateY, w: startBoxW, h: dateH, fontSize: dateFs, fontFace: JPN_FONT, color: '666666', align: 'left', valign: 'bottom' });
                            // Duration text inside bar (centered)
                            const durationDays = Math.max(1, Math.round((t.end!.getTime() - t.start!.getTime()) / dayMs));
                            const durText = `${durationDays}日`;
                            const textColor = pickTextColorForBackground(`#${barColor}`).toString();
                            targetSlide.addText(durText, { x, y, w, h: barH, fontSize: 10, fontFace: JPN_FONT, color: textColor, align: 'center', valign: 'middle' });
                        });
                    } else {
                        // Fallback: index-based if dates are unusable
                        visibleTasks.forEach((t: any, i: number) => {
                            const y = ry + i * (barH + 0.12);
                            targetSlide.addText(String(t?.label ?? ''), { x: rx, y, w: rw * 0.25, h: barH, fontSize: 10, fontFace: JPN_FONT });
                            const barColor = getPaletteColor(i).replace('#','');
                            targetSlide.addShape('rect', { x: rx + rw * 0.28, y, w: rw * 0.65, h: barH, fill: { color: barColor }, line: { color: barColor, width: 0.5 } });
                        });
                    }
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
                            targetSlide.addShape('rect', { x: cx, y: cy, w: cellW, h: cellH, fill: { color }, line: { color: '#EAEAEA', width: 0.75 } });
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
                    // Semi-transparent fills to visualize overlap clearly
                    const aFill = { color: lightenHex(primary, 20), transparency: 40 } as any;
                    const bFill = { color: lightenHex(secondary, 20), transparency: 40 } as any;
                    targetSlide.addShape('ellipse', { x: cx1 - r, y: cy - r, w: 2 * r, h: 2 * r, fill: aFill, line: { color: primary, width: 1 } });
                    targetSlide.addShape('ellipse', { x: cx2 - r, y: cy - r, w: 2 * r, h: 2 * r, fill: bFill, line: { color: secondary, width: 1 } });
                    // Optional: emphasize overlap percentage text if provided
                    if (Number.isFinite(overlap) && overlap > 0) {
                        targetSlide.addText(`${overlap}%`, { x: (cx1+cx2)/2 - 0.4, y: cy - 0.15, w: 0.8, h: 0.3, fontSize: 14, align: 'center', fontFace: JPN_FONT, color: '333333' });
                    }
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
                        targetSlide.addShape('triangle', { x: rx + (rw - width)/2, y, w: width, h: rh / layers - 0.05, fill: { color: layerBg }, line: { color: '#FFFFFF', width: 0.5 } });
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
                    const wfStyle: any = (templateConfig?.visualStyles?.waterfall) || {};
                    const maxBarH = rh * 0.85; // leave some top/bottom padding
                    const scale = maxBarH / maxAbs;
                    const minBarH = Math.min(0.15, rh * 0.25);
                    // baseline position (0..1 of region height), default 0.55
                    const baselineRatio = Number.isFinite(Number(wfStyle.baselineRatio)) ? Math.max(0.05, Math.min(0.95, Number(wfStyle.baselineRatio))) : 0.55;
                    const baseline = ry + rh * baselineRatio;
                    // optional grid lines (horizontal)
                    const showGrid = wfStyle.grid === true || String(wfStyle.grid).toLowerCase() === 'true';
                    if (showGrid) {
                        const gridColor = (typeof wfStyle.gridColor === 'string' && wfStyle.gridColor.trim()) ? normalizeColorToPptxHex(wfStyle.gridColor) : 'DDE3EA';
                        const gridWidth = Number.isFinite(Number(wfStyle.gridWidth)) ? Math.max(0.5, Number(wfStyle.gridWidth)) : 1.0;
                        const levels = Math.max(2, Math.min(6, Number.isFinite(Number(wfStyle.gridLevels)) ? Number(wfStyle.gridLevels) : 4));
                        for (let i = 0; i < levels; i++) {
                            const y = ry + (i / (levels - 1)) * rh;
                            targetSlide.addShape('line', { x: rx, y, w: rw, h: 0, line: { color: gridColor, width: gridWidth } });
                        }
                        // baseline line emphasized
                        targetSlide.addShape('line', { x: rx, y: baseline, w: rw, h: 0, line: { color: gridColor, width: gridWidth + 0.4 } });
                    }
                    let x = rx;
                    sliced.forEach((it: any) => {
                        const v = Number(it?.delta || 0);
                        let h = Math.max(minBarH, Math.abs(v) * scale);
                        // Clamp to region
                        if (h > maxBarH) h = maxBarH;
                        let y = v >= 0 ? (baseline - h) : baseline;
                        if (y < ry) y = ry;
                        if (y + h > ry + rh) h = (ry + rh) - y;
                        targetSlide.addShape('rect', { x, y, w: barW, h, fill: { color: v >= 0 ? secondary : primary }, line: { color: '#FFFFFF', width: 0.5 } });
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
                    // Style from template (overridable)
                    const bStyle: any = (templateConfig?.visualStyles?.bullet) || {};
                    const labelFs = Number.isFinite(Number(bStyle.labelFontSize)) ? Number(bStyle.labelFontSize) : 14;
                    const labelAlign: 'left'|'right' = (String(bStyle.labelAlign||'right').toLowerCase().startsWith('r') ? 'right' : 'left');
                    const valueFs = Number.isFinite(Number(bStyle.valueFontSize)) ? Number(bStyle.valueFontSize) : 12;
                    const targetFs = Number.isFinite(Number(bStyle.targetFontSize)) ? Number(bStyle.targetFontSize) : 11;
                    const valueBoxW = Number.isFinite(Number(bStyle.valueBoxWidth)) ? Math.max(0.4, Number(bStyle.valueBoxWidth)) : 0.8;
                    const valueOutsidePad = Number.isFinite(Number(bStyle.valueOutsidePad)) ? Math.max(0, Number(bStyle.valueOutsidePad)) : 0.05;
                    const targetOffsetY = Number.isFinite(Number(bStyle.targetOffsetY)) ? Math.max(0.05, Number(bStyle.targetOffsetY)) : 0.18;
                    const valueTextColorOverride = typeof bStyle.valueTextColor === 'string' && bStyle.valueTextColor ? normalizeColorToPptxHex(bStyle.valueTextColor) : undefined;

                    items.slice(0, 5).forEach((it: any, i: number) => {
                        const y = ry + i * (rowH + 0.12);
                        // label: align from template, larger font
                        targetSlide.addText(String(it?.label ?? ''), { x: rx + 0.1, y, w: rw * 0.25 - 0.1, h: rowH, fontSize: labelFs, fontFace: JPN_FONT, align: labelAlign, valign: 'middle' });
                        const baseX = rx + rw * 0.30;
                        targetSlide.addShape('rect', { x: baseX, y, w: rw * 0.58, h: rowH, fill: { color: '#EEEEEE' }, line: { color: '#DDDDDD', width: 0.5 } });
                        const val = Number(it?.value ?? 0), tgt = Number(it?.target ?? 0);
                        const denom = Math.max(1, Math.max(val, tgt, 100));
                        const valW = Math.max(0, Math.min(rw * 0.58, (rw * 0.58) * (val / denom)));
                        const tgtX = baseX + Math.max(0, Math.min(rw * 0.58, (rw * 0.58) * (tgt / denom)));
                        const __bar = getPaletteColor(i).replace('#','');
                        targetSlide.addShape('rect', { x: baseX, y, w: valW, h: rowH, fill: { color: __bar }, line: { color: __bar, width: 0 } });
                        targetSlide.addShape('line', { x: tgtX, y, w: 0, h: rowH, line: { color: '#333333', width: 2 } });
                        // value and target labels on the bar
                        const valueLabel = `${val}`;
                        const targetLabel = `${tgt}`;
                        const textColor = (valueTextColorOverride || pickTextColorForBackground(`#${__bar}`).toString());
                        // Value text: inside filled bar, right-aligned near the end
                        if (valW > valueBoxW) {
                            targetSlide.addText(valueLabel, { x: baseX + Math.max(0, valW - valueBoxW), y, w: valueBoxW, h: rowH, fontSize: valueFs, fontFace: JPN_FONT, color: textColor, align: 'right', valign: 'middle' });
                        } else {
                            // If very short, place just to the right of the bar start
                            targetSlide.addText(valueLabel, { x: baseX + valW + valueOutsidePad, y, w: valueBoxW, h: rowH, fontSize: valueFs, fontFace: JPN_FONT, color: '#333333', align: 'left', valign: 'middle' });
                        }
                        // Target text: above the target marker
                        targetSlide.addText(targetLabel, { x: tgtX - valueBoxW/2, y: y - targetOffsetY, w: valueBoxW, h: 0.2, fontSize: targetFs, fontFace: JPN_FONT, color: '#333333', align: 'center', valign: 'bottom' });
                    });
                    break;
                }
                case 'map_markers': {
                    const markers = Array.isArray(payload?.markers) ? payload.markers : [];
                    // draw a simple placeholder map rect
                    targetSlide.addShape('rect', { x: rx, y: ry, w: rw, h: rh, fill: { color: '#F2F6FA' }, line: { color: '#DDE3EA', width: 1 } });
                    markers.slice(0, 8).forEach((m: any) => {
                        const px = rx + Math.max(0, Math.min(1, Number(m?.x || 0))) * rw;
                        const py = ry + Math.max(0, Math.min(1, Number(m?.y || 0))) * rh;
                        targetSlide.addShape('ellipse', { x: px - 0.06, y: py - 0.06, w: 0.12, h: 0.12, fill: { color: accent }, line: { color: '#FFFFFF', width: 0.8 } });
                        targetSlide.addText(String(m?.label ?? ''), { x: px + 0.1, y: py - 0.06, w: 1.6, h: 0.24, fontSize: 10, fontFace: JPN_FONT });
                    });
                    break;
                }
                case 'callouts': {
                    const items = Array.isArray(payload?.items) ? payload.items : [];
                    // Template-driven icon config
                    const calloutStyle: any = (templateConfig?.visualStyles?.callouts) || {};
                    const iconCfg: any = calloutStyle.icon || {};
                    const iconEnabled: boolean = (iconCfg.enabled !== false);
                    const iconSize: number = Number(iconCfg.size) || 0.36; // inches
                    const iconPad: number = Number(iconCfg.padding) || 0.08; // inches
                    const iconStyle: string = String(iconCfg.style || 'line');
                    const iconMonochrome: boolean = true; // fixed monochrome (request)
                    const fixedGlyph: 'white'|'black' = (String(iconCfg?.fixed?.glyph || 'black').toLowerCase() === 'white') ? 'white' : 'black';
                    const fixedBg: 'white'|'transparent' = (String(iconCfg?.fixed?.background || 'white').toLowerCase() === 'white') ? 'white' : 'transparent';

                    for (let i = 0; i < Math.min(4, items.length); i++) {
                        const it: any = items[i] || {};
                        const x = rx + (i % 2) * (rw/2) + 0.1;
                        const y = ry + Math.floor(i/2) * (rh/2) + 0.1;
                        const boxW = rw/2 - 0.2;
                        const boxH = rh/2 - 0.2;
                        const calloutBg = lightenHex(getPaletteColor(i), 60);
                        targetSlide.addShape('rect', { x, y, w: boxW, h: boxH, fill: { color: calloutBg }, line: { color: secondary, width: 0.5 }, shadow: shadowOf(resolveVisualShadow('callouts')) });
                        const calloutColor = pickTextColorForBackground(calloutBg).toString();

                        // Resolve icon image path: if provided path use it; else if provided name/keyword, generate via genarateImage
                        let iconPath: string | null = null;
                        if (iconEnabled) {
                            const rawIcon = (it?.iconPath || it?.icon || it?.iconName || '').toString().trim();
                            if (rawIcon) {
                                if (/\\|\//.test(rawIcon) || /\.(png|jpg|jpeg)$/i.test(rawIcon)) {
                                    iconPath = rawIcon;
                                } else {
                                    try {
                                        const { genarateImage } = await import('./genarateImage');
                                        const prompt = buildIconPrompt(rawIcon, iconStyle, iconMonochrome, fixedGlyph, fixedBg);
                                        const out = await genarateImage({ prompt, aspectRatio: '1:1' });
                                        if (out && out.success && out.path) {
                                            iconPath = out.path;
                                            try { imagePathsToDelete.add(out.path); } catch {}
                                        }
                                    } catch {}
                                }
                            }
                        }

                        // If icon exists, reserve space on the left; else, full width for text
                        const textLeftX = iconPath ? (x + iconPad + iconSize + iconPad) : (x + 0.1);
                        const textWidth = iconPath ? (boxW - (textLeftX - x) - 0.1) : (boxW - 0.2);

                        if (iconPath) {
                            try { iconPath = await normalizeIconBackground(iconPath); } catch {}
                            // Place icon square within box, top pad
                            const ix = x + iconPad;
                            const iy = y + iconPad;
                            const iw = Math.min(iconSize, boxW * 0.3);
                            const ih = Math.min(iconSize, boxH * 0.5);
                            targetSlide.addImage({ path: iconPath, x: ix, y: iy, w: iw, h: ih, sizing: { type: 'contain', w: iw, h: ih } as any, shadow: shadowOf(resolveVisualShadow('image')) });
                        }

                        // Title (label)
                        targetSlide.addText(String(it?.label ?? ''), { x: textLeftX, y: y + 0.1, w: textWidth, h: 0.4, fontSize: 12, bold: true, fontFace: JPN_FONT, color: calloutColor });
                        // Body (value)
                        if (it?.value) {
                            targetSlide.addText(String(it.value), { x: textLeftX, y: y + 0.55, w: textWidth, h: 0.4, fontSize: 14, fontFace: JPN_FONT, color: calloutColor });
                        }
                    }
                    break;
                }
                case 'kpi': {
                    const items = Array.isArray(payload?.items) ? payload.items : [];
                    try { logger.info({ count: Array.isArray(items)?items.length:0 }, 'render:kpi'); } catch {}
                    const count = Math.min(4, items.length);
                    if (!count) { break; }
                    // Layout: up to 3 items -> 1列。4件は2x2。
                    const columns = (count <= 3) ? 1 : 2;
                    const rows = Math.ceil(count / columns);
                    const kpiLayout: any = (templateConfig?.visualStyles?.kpi?.layout) || {};
                    const gap = (columns === 1) ? (Number(kpiLayout.gap1Col) || 0.24) : (Number(kpiLayout.gap2Col) || 0.30);
                    const outerMargin = (columns === 1) ? (Number(kpiLayout.outerMargin1Col) || 0.02) : (Number(kpiLayout.outerMargin2Col) || 0.06);
                    const innerPadX = Number(kpiLayout.innerPadX) || 0.2;
                    const innerPadY = (columns === 1) ? (Number(kpiLayout.innerPadY1Col) || 0.12) : (Number(kpiLayout.innerPadY2Col) || 0.16);
                    const cardW = Math.max(0.8, (rw - (columns - 1) * gap - outerMargin * 2) / columns);
                    const cardH = (rh - (rows - 1) * gap - outerMargin * 2) / rows;
                    // resolve template-driven style for KPI
                    const kpiStyle: any = (templateConfig?.visualStyles?.kpi) || {};
                    const tplLabelColor = normalizeColorToPptxHex(kpiStyle.labelColor);
                    const tplValueColor = normalizeColorToPptxHex(kpiStyle.valueColor);
                    const unifyKpiFonts: boolean = (kpiStyle.unifyLabelAndValueFontSize !== false);
                    const tplLabelFsNum = Number(kpiStyle.labelFontSize);
                    const tplValueFsNum = Number(kpiStyle.valueFontSize);
                    const hasFixedLabelFs = Number.isFinite(tplLabelFsNum);
                    const hasFixedValueFs = Number.isFinite(tplValueFsNum);
                    const fixedCommonFs: number | undefined = unifyKpiFonts ? (hasFixedLabelFs ? tplLabelFsNum : (hasFixedValueFs ? tplValueFsNum : undefined)) : undefined;
                    const baseWrap = (w: number, factor: number) => Math.max(16, Math.floor(w * factor));
                    for (let idx = 0; idx < count; idx++) {
                        const it: any = items[idx] || {};
                        const row = Math.floor(idx / columns);
                        const col = idx % columns;
                        const x = rx + outerMargin + col * (cardW + gap);
                        const y = ry + outerMargin + row * (cardH + gap);
                        // Card background color from palette
                        const boxColor = getPaletteColor(idx).replace('#','');
                        targetSlide.addShape('rect', { x, y, w: cardW, h: cardH, fill: { color: boxColor }, line: { color: outlineColor, width: 0.5 }, rectRadius: Math.min(cornerRadius, 6), shadow: shadowOf(resolveVisualShadow('kpi')) });
                        // Icon (optional, top-left)
                        let iconPath: string | null = null;
                        try {
                            const calloutStyle: any = (templateConfig?.visualStyles?.callouts) || {};
                            const iconCfg: any = calloutStyle.icon || {};
                            const iconEnabled: boolean = (iconCfg.enabled !== false);
                            const iconSize: number = Number(iconCfg.size) || 0.36;
                            const iconPad: number = Number(iconCfg.padding) || 0.08;
                            const iconStyle: string = String(iconCfg.style || 'line');
                            const iconMonochrome: boolean = true; // fixed monochrome
                            const fixedGlyph: 'white'|'black' = (String((kpiStyle as any)?.icon?.fixed?.glyph || iconCfg?.fixed?.glyph || 'black').toLowerCase() === 'white') ? 'white' : 'black';
                            const fixedBg: 'white'|'transparent' = (String((kpiStyle as any)?.icon?.fixed?.background || iconCfg?.fixed?.background || 'white').toLowerCase() === 'white') ? 'white' : 'transparent';
                            if (iconEnabled && (it?.icon || it?.iconName || it?.iconPath)) {
                                const rawIcon = (it?.iconPath || it?.icon || it?.iconName || '').toString().trim();
                                if (rawIcon) {
                                    if (/\\|\//.test(rawIcon) || /\.(png|jpg|jpeg)$/i.test(rawIcon)) {
                                        iconPath = rawIcon;
                                    } else {
                                        try {
                                            const { genarateImage } = await import('./genarateImage');
                                            const prompt = buildIconPrompt(rawIcon, iconStyle, iconMonochrome, fixedGlyph as any, fixedBg as any);
                                            const out = await genarateImage({ prompt, aspectRatio: '1:1' });
                                            if (out && out.success && out.path) {
                                                iconPath = out.path;
                                                try { imagePathsToDelete.add(out.path); } catch {}
                                            }
                                        } catch {}
                                    }
                                }
                            }
                            if (iconPath) {
                                try { iconPath = await normalizeIconBackground(iconPath); } catch {}
                                // Protrude half of icon outside the top-left corner of the card box (no white circle)
                                const ix = x - iconSize / 2;
                                const iy = y - iconSize / 2;
                                targetSlide.addImage({ path: iconPath, x: ix, y: iy, w: iconSize, h: iconSize, sizing: { type: 'contain', w: iconSize, h: iconSize } as any, shadow: shadowOf(resolveVisualShadow('image')) });
                            }
                        } catch {}
                        // Text areas and fitting (Label top, Value below)
                        const rawLabel = String(it?.label ?? '');
                        const rawValue = String(it?.value ?? '');
                        // Adjust text box start X/W if icon placed
                        const iconOverlapInside = (iconPath ? ((Number((templateConfig?.visualStyles?.callouts?.icon?.size)) || 0.36) * 0.5 + (Number((templateConfig?.visualStyles?.callouts?.icon?.padding)) || 0.08)) : 0);
                        const textX = x + innerPadX + iconOverlapInside;
                        const textW = Math.max(0.5, cardW - (textX - x) - innerPadX);
                        // Font size policy: respect template fixed sizes if provided; otherwise auto-fit
                        const initialFs = (columns === 1) ? (Number(kpiLayout.initialFs1Col) || 20) : (Number(kpiLayout.initialFs2Col) || 16);
                        const minFs = (columns === 1) ? (Number(kpiLayout.minFs1Col) || 11) : (Number(kpiLayout.minFs2Col) || 9); // allow a bit smaller fonts to avoid overlap
                        const targetLabelFs = (fixedCommonFs ?? (hasFixedLabelFs ? tplLabelFsNum : undefined));
                        const targetValueFs = (fixedCommonFs ?? (hasFixedValueFs ? tplValueFsNum : undefined));
                        const labelFit0 = typeof targetLabelFs === 'number'
                          ? fitTextToLines(rawLabel, /*initial*/targetLabelFs, /*min*/targetLabelFs, /*baseWrap*/baseWrap(textW, 10.5), /*lines*/2, /*hard*/30)
                          : fitTextToLines(rawLabel, /*initial*/initialFs, /*min*/minFs, /*baseWrap*/baseWrap(textW, 10.5), /*lines*/2, /*hard*/30);
                        const valueFit0 = typeof targetValueFs === 'number'
                          ? fitTextToLines(rawValue, /*initial*/targetValueFs, /*min*/targetValueFs, /*baseWrap*/baseWrap(textW, 11.5), /*lines*/2, /*hard*/30)
                          : fitTextToLines(rawValue, /*initial*/initialFs, /*min*/minFs, /*baseWrap*/baseWrap(textW, 11.5), /*lines*/2, /*hard*/30);
                        const commonFs = typeof fixedCommonFs === 'number' ? fixedCommonFs : (unifyKpiFonts ? Math.min(labelFit0.fontSize, valueFit0.fontSize) : labelFit0.fontSize);
                        const labelFit = typeof targetLabelFs === 'number'
                          ? fitTextToLines(rawLabel, /*initial*/targetLabelFs, /*min*/targetLabelFs, /*baseWrap*/baseWrap(textW, 10.5), /*lines*/2, /*hard*/30)
                          : fitTextToLines(rawLabel, /*initial*/commonFs, /*min*/minFs, /*baseWrap*/baseWrap(textW, 10.5), /*lines*/2, /*hard*/30);
                        const valueFit = typeof targetValueFs === 'number'
                          ? fitTextToLines(rawValue, /*initial*/targetValueFs, /*min*/targetValueFs, /*baseWrap*/baseWrap(textW, 11.5), /*lines*/2, /*hard*/30)
                          : fitTextToLines(rawValue, /*initial*/commonFs, /*min*/minFs, /*baseWrap*/baseWrap(textW, 11.5), /*lines*/2, /*hard*/30);
                        const labelLines = Math.max(1, labelFit.text.split('\n').length);
                        const valueLines = Math.max(1, valueFit.text.split('\n').length);
                        // Allocate card height to balance label/value vertically
                        const labelH = (columns === 1)
                          ? Math.min(cardH * 0.34, (cardH * 0.20) + 0.08 * (labelLines - 1))
                          : Math.min(cardH * 0.42, (cardH * 0.22) + 0.09 * (labelLines - 1));
                        const minGap = Number.isFinite(Number(kpiLayout.minGap)) ? Number(kpiLayout.minGap) : 0.08; // slightly larger gap to avoid visual collision
                        const valueH = Math.max((columns === 1 ? cardH * 0.50 : cardH * 0.42), cardH - labelH - innerPadY * 2 - minGap);
                        const defaultTextColor = pickTextColorForBackground(`#${boxColor}`).toString();
                        const labelColor = tplLabelColor || defaultTextColor;
                        const valueColor = tplValueColor || defaultTextColor;
                        targetSlide.addText(labelFit.text, { x: textX, y: y + innerPadY, w: textW, h: labelH, fontSize: labelFit.fontSize, bold: true, color: labelColor, align: 'center', fontFace: JPN_FONT, valign: 'top', paraSpaceAfter: 0 });
                        targetSlide.addText(valueFit.text, { x: textX, y: y + innerPadY + labelH + minGap, w: textW, h: Math.max(0, valueH - minGap), fontSize: valueFit.fontSize, bold: false, color: valueColor, align: 'center', fontFace: JPN_FONT, valign: 'top', paraSpaceAfter: 0 });
                    }
                    break;
                }
                case 'checklist': {
                    const items = Array.isArray(payload?.items) ? payload.items : [];
                    const maxItems = Math.min(10, items.length || 0) || 0;
                    if (!maxItems) break;
                    const clStyle: any = (templateConfig?.visualStyles?.checklist) || {};
                    const gapY = Number.isFinite(Number(clStyle.gapY)) ? Number(clStyle.gapY) : 0.18; // larger gap to avoid overlap when wrapped
                    const markSize = Number.isFinite(Number(clStyle.markSize)) ? Number(clStyle.markSize) : 0.28;
                    const padLeft = markSize + 0.3;
                    const textW = Math.max(0.5, rw - padLeft);
                    // First pass: estimate required height per item based on wrapped lines
                    const estHeights: number[] = [];
                    const fittedTexts: { text: string; fontSize: number }[] = [];
                    for (let i = 0; i < Math.min(items.length, 10); i++) {
                        const label = String(items[i]?.label ?? '');
                        const fit = fitTextToLines(label, /*initial*/(Number(clStyle.fontSizeInitial)||18), /*min*/(Number(clStyle.fontSizeMin)||11), /*baseWrap*/Math.max(18, Math.floor(textW * 10)), /*lines*/(Number(clStyle.maxLines)||3), /*hard*/48);
                        const lines = Math.max(1, fit.text.split('\n').length);
                        const base = Number.isFinite(Number(clStyle.baseRowHeight)) ? Number(clStyle.baseRowHeight) : 0.42; // base height per row
                        const extra = (Number.isFinite(Number(clStyle.extraPerWrappedLine)) ? Number(clStyle.extraPerWrappedLine) : 0.20) * (lines - 1); // more room per wrapped line
                        const h = Math.min(0.95, base + extra);
                        estHeights.push(h);
                        fittedTexts.push({ text: fit.text, fontSize: fit.fontSize });
                    }
                    // Normalize total height to fit region (rh)
                    const totalNeeded = estHeights.reduce((a, b) => a + b, 0) + gapY * (Math.min(items.length, 10) - 1);
                    const scale = totalNeeded > rh ? Math.max(0.75, rh / totalNeeded) : 1;
                    let yCursor = ry;
                    for (let i = 0; i < Math.min(items.length, 10); i++) {
                        const h = estHeights[i] * scale;
                        const labelFit = fittedTexts[i];
                        // leading check mark (rounded rect background + tick)
                        const boxX = rx;
                        const boxY = yCursor + (h - markSize) / 2;
                        targetSlide.addShape('rect', { x: boxX, y: boxY, w: markSize, h: markSize, fill: { color: lightenHex(primary, 10) }, line: { color: primary, width: 1 }, rectRadius: 4, shadow: shadowOf(resolveVisualShadow('callouts')) });
                        targetSlide.addShape('chevron', { x: boxX + 0.04, y: boxY + 0.06, w: markSize - 0.08, h: markSize - 0.12, fill: { color: 'FFFFFF' }, line: { color: 'FFFFFF', width: 0 } } as any);
                        // text with dynamic height and font size
                        const txtColor = (typeof clStyle.textColor === 'string' && clStyle.textColor) ? normalizeColorToPptxHex(clStyle.textColor) : '111111';
                        targetSlide.addText(labelFit.text, { x: rx + padLeft, y: yCursor, w: textW, h, fontSize: labelFit.fontSize, bold: true, fontFace: JPN_FONT, color: txtColor, valign: 'middle' });
                        yCursor += h + gapY;
                        if (yCursor > ry + rh - 0.05) break;
                    }
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
                    targetSlide.addShape('rect', { x: gridX, y: gridY, w: gridW, h: gridH, fill: { color: 'FFFFFF' }, line: { color: primary, width: 1 } });
                    targetSlide.addShape('line', { x: gridX + gridW/2, y: gridY, w: 0, h: gridH, line: { color: primary, width: 1 } });
                    targetSlide.addShape('line', { x: gridX, y: gridY + gridH/2, w: gridW, h: 0, line: { color: primary, width: 1 } });
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
                        targetSlide.addShape('ellipse', { x: cx - 0.08, y: cy - 0.08, w: 0.16, h: 0.16, fill: { color: accent }, line: { color: outlineColor, width: 0.75 } });
                        targetSlide.addText(String(it?.label ?? ''), { x: cx + 0.12, y: cy - 0.12, w: Math.min(1.8, gridW/2 - 0.3), h: 0.3, fontSize: 10, fontFace: JPN_FONT });
                    });
                    break;
                }
                case 'table': {
                    try {
                        const headers: string[] | undefined = Array.isArray((payload as any)?.headers) ? (payload as any).headers.map((s:any)=>String(s||'')) : undefined;
                        const rows2d: string[][] = Array.isArray((payload as any)?.rows) ? (payload as any).rows.map((r:any)=>Array.isArray(r)?r.map((s:any)=>String(s||'')):[String(r||'')]) : [];
                        const tableRows: any[] = [];
                        const headerFillHex = (templateConfig?.visualStyles?.tables?.headerFill && normalizeColorToPptxHex(templateConfig.visualStyles.tables.headerFill)) || normalizeColorToPptxHex(lightenHex(primary, 40)) || 'CCCCCC';
                        const headerTextHex = (templateConfig?.visualStyles?.tables?.headerColor && normalizeColorToPptxHex(templateConfig.visualStyles.tables.headerColor)) || 'FFFFFF';
                        const rowFillA = (templateConfig?.visualStyles?.tables?.rowFillA && normalizeColorToPptxHex(templateConfig.visualStyles.tables.rowFillA)) || normalizeColorToPptxHex(lightenHex(secondary, 120)) || 'FFFFFF';
                        const rowFillB = (templateConfig?.visualStyles?.tables?.rowFillB && normalizeColorToPptxHex(templateConfig.visualStyles.tables.rowFillB)) || normalizeColorToPptxHex(lightenHex(primary, 120)) || 'F7F7F7';
                        if (headers && headers.length) {
                            tableRows.push(headers.map(h => ({ text: String(h), options: { bold: true, fontFace: JPN_FONT, fontSize: 12, align: 'center', color: headerTextHex, fill: { color: headerFillHex } } })));
                        }
                        for (let i = 0; i < rows2d.length; i++) {
                            const r = rows2d[i];
                            const isAlt = (i % 2 === 1);
                            const fillHex = isAlt ? rowFillB : rowFillA;
                            tableRows.push(r.map(cell => ({ text: String(cell), options: { fontFace: JPN_FONT, fontSize: 12, fill: { color: fillHex } } })));
                        }
                        if (tableRows.length) {
                            targetSlide.addTable(tableRows, { x: rx, y: ry, w: rw, h: rh, border: { type: 'solid', color: 'E6E6E6', pt: 1 } as any });
                        }
                    } catch (e) {
                        targetSlide.addText('Table', { x: rx, y: ry, w: rw, h: 0.3, fontSize: 12, bold: true, fontFace: JPN_FONT });
                    }
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
                        const __layer = getPaletteColor(i).replace('#','');
                        targetSlide.addShape('trapezoid', { x: startX + (topW - tW)/2, y, w: tW, h: height / layers - 0.04, fill: { color: __layer }, line: { color: outlineColor, width: 0.5 }, shadow: shadowOf(resolveVisualShadow('funnel')) } as any);
                        targetSlide.addText(String(steps[i]?.label ?? ''), { x: startX + 0.15, y: y + 0.04, w: topW - 0.3, h: (height / layers) - 0.12, fontSize: 12, color: 'FFFFFF', align: 'center', valign: 'middle', fontFace: JPN_FONT });
                    }
                    break;
                }
                case 'process': {
                    try {
                    const steps = Array.isArray(payload?.steps) ? payload.steps : [];
                    const y = ry + rh * 0.20;
                    const maxSteps = Math.min(4, steps.length);
                    const gap = 0.5;
                    const totalGap = gap * Math.max(0, maxSteps - 1);
                    const stepW = Math.min(1.6, (rw - totalGap) / Math.max(1, maxSteps));
                    const stepH = Math.min( rh * 0.6, 0.9 );
                    const groupWidth = stepW * Math.max(1, maxSteps) + gap * Math.max(0, maxSteps - 1);
                    const startX = rx + Math.max(0, (rw - groupWidth) / 2);
                    steps.slice(0, maxSteps).forEach((s: any, i: number) => {
                        const x = startX + i * (stepW + gap);
                            const __step = getPaletteColor(i).replace('#','');
                            targetSlide.addShape('rect', { x, y, w: stepW, h: stepH, fill: { color: __step }, line: { color: outlineColor, width: 0.5 }, shadow: shadowOf(resolveVisualShadow('process')) });
                        targetSlide.addText(String(s?.label ?? `Step ${i+1}`), { x: x + 0.08, y: y + 0.14, w: stepW - 0.16, h: stepH - 0.28, fontSize: 11, color: 'FFFFFF', align: 'center', valign: 'middle', fontFace: JPN_FONT });
                        if (i < maxSteps - 1) {
                                targetSlide.addShape('chevron', { x: x + stepW + (gap - 0.4) / 2, y: y + (stepH - 0.4) / 2, w: 0.4, h: 0.4, fill: { color: secondary }, line: { color: secondary, width: 0 } } as any);
                        }
                    });
                    } catch (e) {
                        targetSlide.addText('Process', { x: rx, y: ry, w: rw, h: 0.3, fontSize: 12, bold: true, fontFace: JPN_FONT });
                    }
                    break;
                }
                case 'roadmap': {
                    const milestones = Array.isArray(payload?.milestones) ? payload.milestones : [];
                    // no-op debug removed
                    // Add horizontal padding to avoid labels overflowing slide edges
                    const innerPadX = Math.min(0.6, rw * 0.08);
                    const startX = rx + innerPadX;
                    const startY = ry + rh / 2;
                    const totalW = Math.max(0, rw - innerPadX * 2);
                    targetSlide.addShape('line', { x: startX, y: startY, w: totalW, h: 0, line: { color: outlineColor, width: 1.2 } });
                    milestones.slice(0, 6).forEach((m: any, i: number) => {
                        const cx = startX + (i * (totalW / Math.max(1, milestones.length - 1)));
                        // no-op debug removed
                        // Milestone dot
                        const __ms = getPaletteColor(i).replace('#','');
                        targetSlide.addShape('ellipse', { x: cx - 0.08, y: startY - 0.08, w: 0.16, h: 0.16, fill: { color: __ms }, line: { color: outlineColor, width: 0.8 } });
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
                    const aLabel = String(a?.label ?? 'A');
                    const aValue = String(a?.value ?? '');
                    const bLabel = String(b?.label ?? 'B');
                    const bValue = String(b?.value ?? '');
                    
                    // Resolve comparison style from template (with sane defaults)
                    const compStyle: any = (templateConfig?.visualStyles?.comparison) || {};
                    const labelColorHex = normalizeColorToPptxHex(compStyle.labelColor) || 'EEEEEE';
                    const valueColorHex = normalizeColorToPptxHex(compStyle.valueColor) || 'FFFFFF';
                    const unifyFonts: boolean = (compStyle.unifyLabelAndValueFontSize !== false);
                    const labelAlign: 'left' | 'center' | 'right' = (['left','center','right'].includes(String(compStyle.labelAlign)) ? String(compStyle.labelAlign) as any : 'right');
                    const layoutPolicy: any = compStyle.layoutPolicy || {};
                    const preferVerticalIfCrowded: boolean = (layoutPolicy.preferVerticalIfCrowded !== false);
                    const horizontalMinBoxWidth: number = Number(layoutPolicy.horizontalMinBoxWidth) || 2.4;
                    // Try horizontal side-by-side first. If too tight, fall back to vertical stacking.
                    const gapX = Number((compStyle?.layoutPolicy?.gapX)) || 0.3;
                    // Use a slightly smaller gap to maximize label/value width
                    const effGapX = Math.min(gapX, 0.12);
                    const padX = Number((compStyle?.layoutPolicy?.padX)) || 0.15;
                    // Reduce horizontal padding for wider text area
                    const labelPadX = Math.max(0.06, padX * 0.4);
                    const padY = Number((compStyle?.layoutPolicy?.padY)) || 0.12;
                    const valueOffsetY = Number(compStyle?.valueOffsetY) || 0;
                    const horizontalBoxW = Math.max(2.2, (rw - effGapX) / 2);
                    const horizontalBoxH = Math.max(1.2, rh - 0.2);
                    const hLeftX = rx;
                    const hRightX = rx + horizontalBoxW + effGapX;
                    const baseWrap = (w: number, factor: number) => Math.max(16, Math.floor(w * factor));
                    
                    // Fit for horizontal layout
                    // First pass fits (same initial/min so that common size can be enforced)
                    const aLabelHFit0 = fitTextToLines(aLabel, /*initial*/16, /*min*/16, /*baseWrap*/baseWrap(horizontalBoxW, 8.5), /*lines*/2, /*hard*/30);
                    const aValueHFit0 = fitTextToLines(aValue, /*initial*/16, /*min*/16, /*baseWrap*/baseWrap(horizontalBoxW, 10.5), /*lines*/5, /*hard*/44);
                    const bLabelHFit0 = fitTextToLines(bLabel, /*initial*/16, /*min*/16, /*baseWrap*/baseWrap(horizontalBoxW, 8.5), /*lines*/2, /*hard*/30);
                    const bValueHFit0 = fitTextToLines(bValue, /*initial*/16, /*min*/16, /*baseWrap*/baseWrap(horizontalBoxW, 10.5), /*lines*/5, /*hard*/44);
                    // Enforce same font size per box (label/value equal) if enabled
                    const aCommonH = 16;
                    const bCommonH = 16;
                    const aLabelHFit = fitTextToLines(aLabel, /*initial*/16, /*min*/16, /*baseWrap*/baseWrap(horizontalBoxW, 8.5), /*lines*/2, /*hard*/30);
                    const aValueHFit = fitTextToLines(aValue, /*initial*/16, /*min*/16, /*baseWrap*/baseWrap(horizontalBoxW, 10.5), /*lines*/5, /*hard*/44);
                    const bLabelHFit = fitTextToLines(bLabel, /*initial*/16, /*min*/16, /*baseWrap*/baseWrap(horizontalBoxW, 8.5), /*lines*/2, /*hard*/30);
                    const bValueHFit = fitTextToLines(bValue, /*initial*/16, /*min*/16, /*baseWrap*/baseWrap(horizontalBoxW, 10.5), /*lines*/5, /*hard*/44);
                    const aLabelHLines = aLabelHFit.text.split('\n').length;
                    const bLabelHLines = bLabelHFit.text.split('\n').length;
                    const aValueHLines = aValueHFit.text.split('\n').length;
                    const bValueHLines = bValueHFit.text.split('\n').length;
                    // Tighter line spacing and guard to avoid overlap into value area
                    const hLabelH = Math.min(0.7, 0.28 + 0.12 * Math.max(aLabelHLines, bLabelHLines));
                    const hValueH = horizontalBoxH - hLabelH - padY * 2 - 0.04;
                    // Heuristic: decide if horizontal is too crowded
                    const horizontalCrowded = preferVerticalIfCrowded && ((
                      aValueHFit.fontSize <= 12 && aValueHLines >= 3
                    ) || (
                      bValueHFit.fontSize <= 12 && bValueHLines >= 3
                    ) || (horizontalBoxW < horizontalMinBoxWidth && (aValue.length + bValue.length) > 40));
                    
                    const useVertical = horizontalCrowded;
                    
                    if (!useVertical) {
                    const y = ry + 0.1;
                        // Determine color mode for box fills
                        const colorMode: 'primarySecondary'|'palettePair'|'aiPair' = (String(compStyle.colorMode||'primarySecondary') as any);
                        const leftFill = (() => {
                          if (colorMode === 'palettePair') return getPaletteColor(0).replace('#','');
                          if (colorMode === 'aiPair') return ensureHash(resolvedPrimary).replace('#','');
                          return ensureHash(primary).replace('#','');
                        })();
                        const rightFill = (() => {
                          if (colorMode === 'palettePair') return getPaletteColor(1).replace('#','');
                          if (colorMode === 'aiPair') return ensureHash(resolvedSecondary).replace('#','');
                          return ensureHash(secondary).replace('#','');
                        })();
                        // left box
                        targetSlide.addShape('rect', { x: hLeftX, y, w: horizontalBoxW, h: horizontalBoxH, fill: { color: leftFill }, line: { color: outlineColor, width: 0.5 }, rectRadius: Math.min(cornerRadius, 6), shadow: shadowOf(resolveVisualShadow('comparison')) });
                        // label background (semi-transparent white)
                        targetSlide.addShape('rect', { x: hLeftX + labelPadX, y: y + padY, w: horizontalBoxW - labelPadX * 2, h: hLabelH, fill: { color: 'FFFFFF', transparency: 50 }, line: { color: 'FFFFFF', width: 0 } } as any);
                        targetSlide.addText(aLabelHFit.text, { x: hLeftX + labelPadX, y: y + padY, w: horizontalBoxW - labelPadX * 2, h: hLabelH, fontSize: aLabelHFit.fontSize, bold: true, color: labelColorHex, fontFace: JPN_FONT, align: labelAlign, valign: 'middle' });
                        targetSlide.addText(aValueHFit.text, { x: hLeftX + labelPadX, y: y + padY + hLabelH + valueOffsetY, w: horizontalBoxW - labelPadX * 2, h: hValueH, fontSize: aValueHFit.fontSize, bold: false, color: valueColorHex, fontFace: JPN_FONT, align: 'center', valign: 'top' });
                        // right box
                        targetSlide.addShape('rect', { x: hRightX, y, w: horizontalBoxW, h: horizontalBoxH, fill: { color: rightFill }, line: { color: outlineColor, width: 0.5 }, rectRadius: Math.min(cornerRadius, 6), shadow: shadowOf(resolveVisualShadow('comparison')) });
                        // label background (semi-transparent white)
                        targetSlide.addShape('rect', { x: hRightX + labelPadX, y: y + padY, w: horizontalBoxW - labelPadX * 2, h: hLabelH, fill: { color: 'FFFFFF', transparency: 50 }, line: { color: 'FFFFFF', width: 0 } } as any);
                        targetSlide.addText(bLabelHFit.text, { x: hRightX + labelPadX, y: y + padY, w: horizontalBoxW - labelPadX * 2, h: hLabelH, fontSize: bLabelHFit.fontSize, bold: true, color: labelColorHex, fontFace: JPN_FONT, align: labelAlign, valign: 'middle' });
                        targetSlide.addText(bValueHFit.text, { x: hRightX + labelPadX, y: y + padY + hLabelH + valueOffsetY, w: horizontalBoxW - labelPadX * 2, h: hValueH, fontSize: bValueHFit.fontSize, bold: false, color: valueColorHex, fontFace: JPN_FONT, align: 'center', valign: 'top' });
                        break;
                    }
                    
                    // Vertical stacking fallback: each box gets full width, half height
                    const vGapY = 0.2;
                    const vBoxW = rw;
                    const vBoxH = (rh - vGapY) / 2;
                    const vTopY = ry + 0.05;
                    const vBottomY = vTopY + vBoxH + vGapY;
                    
                    const aLabelVFit0 = fitTextToLines(aLabel, /*initial*/16, /*min*/16, /*baseWrap*/baseWrap(vBoxW, 7), /*lines*/2, /*hard*/30);
                    const aValueVFit0 = fitTextToLines(aValue, /*initial*/16, /*min*/16, /*baseWrap*/baseWrap(vBoxW, 10), /*lines*/6, /*hard*/52);
                    const bLabelVFit0 = fitTextToLines(bLabel, /*initial*/16, /*min*/16, /*baseWrap*/baseWrap(vBoxW, 7), /*lines*/2, /*hard*/30);
                    const bValueVFit0 = fitTextToLines(bValue, /*initial*/16, /*min*/16, /*baseWrap*/baseWrap(vBoxW, 10), /*lines*/6, /*hard*/52);
                    const aLabelVFit = aLabelVFit0;
                    const aValueVFit = aValueVFit0;
                    const bLabelVFit = bLabelVFit0;
                    const bValueVFit = bValueVFit0;
                    const aLabelVLines = aLabelVFit.text.split('\n').length;
                    const bLabelVLines = bLabelVFit.text.split('\n').length;
                    const aLabelVH = Math.min(0.9, 0.32 + 0.16 * aLabelVLines);
                    const bLabelVH = Math.min(0.9, 0.32 + 0.16 * bLabelVLines);
                    const aValueVH = vBoxH - aLabelVH - padY * 2;
                    const bValueVH = vBoxH - bLabelVH - padY * 2;
                    
                    // Determine color mode for vertical boxes as well
                    const colorModeV: 'primarySecondary'|'palettePair'|'aiPair' = (String(compStyle.colorMode||'primarySecondary') as any);
                    const topFill = (() => {
                      if (colorModeV === 'palettePair') return getPaletteColor(0).replace('#','');
                      if (colorModeV === 'aiPair') return ensureHash(resolvedPrimary).replace('#','');
                      return ensureHash(primary).replace('#','');
                    })();
                    const bottomFill = (() => {
                      if (colorModeV === 'palettePair') return getPaletteColor(1).replace('#','');
                      if (colorModeV === 'aiPair') return ensureHash(resolvedSecondary).replace('#','');
                      return ensureHash(secondary).replace('#','');
                    })();
                    // Top box (A)
                    targetSlide.addShape('rect', { x: rx, y: vTopY, w: vBoxW, h: vBoxH, fill: { color: topFill }, line: { color: outlineColor, width: 0.5 }, rectRadius: Math.min(cornerRadius, 6), shadow: shadowOf(resolveVisualShadow('comparison')) });
                    // label background (semi-transparent white)
                    targetSlide.addShape('rect', { x: rx + labelPadX, y: vTopY + padY, w: vBoxW - labelPadX * 2, h: aLabelVH, fill: { color: 'FFFFFF', transparency: 50 }, line: { color: 'FFFFFF', width: 0 } } as any);
                    targetSlide.addText(aLabelVFit.text, { x: rx + labelPadX, y: vTopY + padY, w: vBoxW - labelPadX * 2, h: aLabelVH, fontSize: aLabelVFit.fontSize, bold: true, color: labelColorHex, fontFace: JPN_FONT, align: labelAlign, valign: 'middle' });
                    targetSlide.addText(aValueVFit.text, { x: rx + labelPadX, y: vTopY + padY + aLabelVH + valueOffsetY, w: vBoxW - labelPadX * 2, h: aValueVH, fontSize: aValueVFit.fontSize, bold: false, color: valueColorHex, fontFace: JPN_FONT, align: 'center', valign: 'top' });
                    
                    // Bottom box (B)
                    targetSlide.addShape('rect', { x: rx, y: vBottomY, w: vBoxW, h: vBoxH, fill: { color: bottomFill }, line: { color: outlineColor, width: 0.5 }, rectRadius: Math.min(cornerRadius, 6), shadow: shadowOf(resolveVisualShadow('comparison')) });
                    // label background (semi-transparent white)
                    targetSlide.addShape('rect', { x: rx + labelPadX, y: vBottomY + padY, w: vBoxW - labelPadX * 2, h: bLabelVH, fill: { color: 'FFFFFF', transparency: 50 }, line: { color: 'FFFFFF', width: 0 } } as any);
                    targetSlide.addText(bLabelVFit.text, { x: rx + labelPadX, y: vBottomY + padY, w: vBoxW - labelPadX * 2, h: bLabelVH, fontSize: bLabelVFit.fontSize, bold: true, color: labelColorHex, fontFace: JPN_FONT, align: labelAlign, valign: 'middle' });
                    targetSlide.addText(bValueVFit.text, { x: rx + labelPadX, y: vBottomY + padY + bLabelVH + valueOffsetY, w: vBoxW - labelPadX * 2, h: bValueVH, fontSize: bValueVFit.fontSize, bold: false, color: valueColorHex, fontFace: JPN_FONT, align: 'center', valign: 'top' });
                    break;
                }
                case 'timeline': {
                    try {
                    const steps = Array.isArray(payload?.steps) ? payload.steps : [];
                    const startX = rx;
                    const startY = ry + rh * 0.4;
                    const totalW = rw;
                    const segW = totalW / Math.max(1, steps.length);
                        targetSlide.addShape('line', { x: startX, y: startY, w: totalW, h: 0, line: { color: outlineColor, width: 1.2 } });
                    steps.slice(0, 6).forEach((s: any, i: number) => {
                        const cx = startX + i * segW + segW / 2;
                            
                            const __dot2 = getPaletteColor(i).replace('#','');
                            targetSlide.addShape('ellipse', { x: cx - 0.08, y: startY - 0.08, w: 0.16, h: 0.16, fill: { color: __dot2 }, line: { color: outlineColor, width: 0.8 } });
                        targetSlide.addText(String(s?.label ?? `Step ${i+1}`), { x: cx - 0.9, y: startY + 0.18, w: 1.8, h: 0.32, fontSize: 11, align: 'center', fontFace: JPN_FONT });
                    });
                    } catch (e) {
                        targetSlide.addText('Timeline', { x: rx, y: ry, w: rw, h: 0.3, fontSize: 12, bold: true, fontFace: JPN_FONT });
                        
                    }
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
            const slide = pres.addSlide();
            let visualRendered = false;

            // Background: prioritize title image; otherwise themed flat color.
            if (index === 0) {
                const isTitleSlide = String((slideData as any)?.layout || '') === 'title_slide';
                if (isTitleSlide && titleSlideImagePath) {
                    try {
                    await fs.access(titleSlideImagePath);
                    slide.background = { path: titleSlideImagePath };
                        
                } catch (error) {
                        logger.warn({ path: titleSlideImagePath, error }, 'Could not access title slide image file. Using default background.');
                        slide.background = { color: lightenHex(primary, 80).replace('#', '') } as any;
                    }
                } else if (isTitleSlide && ((slides[0] as any)?.titleSlideImagePrompt || templateConfig?.layouts?.title_slide?.background?.source?.type === 'ai')) {
                    // Generate title background via new genarateImage using slide title and executive summary context; respect negativePrompt
                    try {
                        const { genarateImage } = await import('./genarateImage');
                        const tplBgSrc: any = templateConfig?.layouts?.title_slide?.background?.source || {};
                        const slide0: any = (slides[0] as any) || {};
                        // Abstract, textless background prompt (no raw title/keywords)
                        const paletteHint = (primary && secondary) ? `palette: primary=${primary}, secondary=${secondary}` : '';
                        const composedPrompt = [
                            'Abstract corporate background. Do not render any words, letters, numbers, symbols, or logos.',
                            'Express the slide theme as visual metaphors using shapes, gradients, light, depth, and rhythm — not text.',
                            'Design cues: clean geometric patterns, subtle gradient layers, soft light streaks, particle networks, depth-of-field bokeh, tasteful contrast.',
                            paletteHint,
                            'Minimal, elegant, high-resolution, professional. No text overlay.'
                        ].filter(Boolean).join(' ');
                        const negativePrompt: string | undefined = String(slide0.titleSlideImageNegativePrompt || tplBgSrc.negativePrompt || '').trim() || undefined;
                        logger.info({ prompt: composedPrompt, negativePrompt }, 'Title background image: sending prompt to generator');
                        const out = await genarateImage({ prompt: composedPrompt, negativePrompt, aspectRatio: '16:9' });
                        if (out.success && out.path) {
                            slide.background = { path: out.path } as any;
                            (slide as any).__tempImages = (slide as any).__tempImages || [];
                            (slide as any).__tempImages.push(out.path);
                            try { imagePathsToDelete.add(out.path); } catch {}
            } else {
                            slide.background = { color: lightenHex(primary, 80).replace('#', '') } as any;
                        }
                    } catch (e) {
                        logger.warn({ error: e }, 'Failed to generate title background. Falling back to color.');
                        slide.background = { color: lightenHex(primary, 80).replace('#', '') } as any;
                    }
                } else if (isTitleSlide) {
                    slide.background = { color: lightenHex(primary, 80).replace('#', '') } as any;
                } else {
                    // Non-title first slide: use normal non-title background policy
                    slide.background = { color: lightenHex(secondary, 80).replace('#', '') } as any;
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
                    const maxH = 0.9;
                    const minH = 0.3;
                    const dim = await readImageDimensions(companyLogoPath);
                    const naturalW = Math.max(1, Number(dim?.width) || 1);
                    const naturalH = Math.max(1, Number(dim?.height) || 1);
                    const aspect = naturalW > 0 ? (naturalH / naturalW) : 1;
                    // First fit to maxW, then clamp by maxH
                    let w = maxW;
                    let h = w * aspect;
                    if (h > maxH) {
                        h = maxH;
                        w = h / aspect;
                    }
                    if (h < minH) {
                        h = minH;
                        w = h / aspect;
                    }
                    const x = pageW - marginX - w;
                    const y = pageH - h - 0.25;
                    slide.addImage({ path: companyLogoPath, x, y, w, h, shadow: { type: 'outer', color: '000000', opacity: 0.3, blur: 6, offset: 2, angle: 45 } as any });
                    appliedLogoCount++;
                } catch (e) {
                    logger.warn({ error: e }, 'Failed to add company logo on a slide.');
                }
            }

            // (top-right logo removed)

            const ctxRecipe = Array.isArray((context as any).visualRecipes) ? (context as any).visualRecipes[index] : null;
            const perSlideRecipeHere = (slideData as any).visual_recipe || ctxRecipe || null;
            const isBottomVisual = perSlideRecipeHere && (['process','roadmap','gantt','timeline'].includes(String(perSlideRecipeHere.type)));
            const titleTextShadowValue: any = templateConfig?.components?.title?.shadow;
            // Helper: decide whether a visual should be placed in the bottom band instead of right panel
            const shouldPlaceVisualBottom = (typeStrIn: string, recipeIn: any): boolean => {
                const t = String(typeStrIn || '').toLowerCase();
                const vp = (templateConfig?.rules?.visualPlacement) || {};
                const forceBottomTypes: string[] = Array.isArray(vp.forceBottomTypes) ? vp.forceBottomTypes.map((s: any)=>String(s||'').toLowerCase()) : [];
                if (forceBottomTypes.includes(t)) return true;
                const checklistMax = Number.isFinite(Number(vp.checklistMaxRightPanelItems)) ? Number(vp.checklistMaxRightPanelItems) : 4;
                const kpiMax = Number.isFinite(Number(vp.kpiMaxRightPanelItems)) ? Number(vp.kpiMaxRightPanelItems) : 3;
                const items = Array.isArray((recipeIn||{}).items) ? recipeIn.items : [];
                if (t === 'checklist') {
                    return items.length > checklistMax;
                }
                if (t === 'kpi' || t === 'kpi_grid') {
                    return items.length > kpiMax;
                }
                // Default: keep in right panel
                return false;
            };
            // Prepare layout area resolver early to avoid TDZ in case blocks
            let layout = (slideData as any).layout || 'content_only';
            // Degrade layout to content_only when no visual exists to render
            if ((layout === 'content_with_visual' || layout === 'content_with_bottom_visual') && !perSlideRecipeHere && !(slideData as any).imagePath) {
                layout = 'content_only';
            }
            const layoutKey = layout as string;
            const layoutAreas = (templateConfig?.layouts?.[layoutKey]?.areas) || null;
            const resolveArea = (areaName: string, defaultX: number, defaultY: number, defaultW: number, defaultH: number) => {
                if (!layoutAreas || !layoutAreas[areaName]) return { x: defaultX, y: defaultY, w: defaultW, h: defaultH };
                const a = layoutAreas[areaName] as any;
                const ref = typeof a?.ref === 'string' ? a.ref : '';
                const refSize = ref && templateConfig?.geometry?.regionDefs && templateConfig.geometry.regionDefs[ref];
                const w = Number(a?.w) || Number(refSize?.w) || defaultW;
                const h = Number(a?.h) || Number(refSize?.h) || defaultH;
                const x = Number(a?.x); const y = Number(a?.y);
                return { x: Number.isFinite(x) ? x : defaultX, y: Number.isFinite(y) ? y : defaultY, w, h };
            };
            const titleBarAreaStyle = (templateConfig?.areaStyles?.titleBar || {}) as any;

            // Track template usage for this layout to decide on global fallbacks later
            let __templateHasElementsForLayout = false;
            let __templateHasVisualElForLayout = false;
            switch (layout) {
                case 'title_slide':
                    // Render centered title only (no global title bar)
                    {
                        const tmplElements = templateConfig?.layouts?.title_slide?.elements;
                        if (Array.isArray(tmplElements) && tmplElements.length) {
                            __templateHasElementsForLayout = true;
                            try { logger.info({ layout: 'title_slide' }, 'Template elements present: skipping code-rendered defaults for title_slide'); } catch {}
                            (slide as any).__data = { title: slideData.title, bullets: slideData.bullets };
                            await renderElementsFromTemplate(slide as any, 'title_slide', tmplElements);
                            delete (slide as any).__data;
                            break;
                        }
                        const fittedTitle = fitTextToLines(slideData.title || '', /*initial*/36, /*min*/22, /*baseWrap*/28, /*lines*/1, /*hard*/28);
                        slide.addText(toBoldRunsFromMarkdown(fittedTitle.text) as any, {
                            x: 0.8, y: 1.2, w: pageW - 1.6, h: 1.2,
                            align: 'center', valign: 'middle', fontSize: fittedTitle.fontSize, bold: true, fontFace: JPN_FONT, color: bgTextColor,
                            shadow: shadowOf(templateConfig?.components?.title?.shadow, shadowPreset)
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
                        const tmplElements = templateConfig?.layouts?.section_header?.elements;
                        if (Array.isArray(tmplElements) && tmplElements.length) {
                            __templateHasElementsForLayout = true;
                            try { logger.info({ layout: 'section_header' }, 'Template elements present: skipping code-rendered defaults for section_header'); } catch {}
                            (slide as any).__data = { title: slideData.title, bullets: slideData.bullets };
                            await renderElementsFromTemplate(slide as any, 'section_header', tmplElements);
                            delete (slide as any).__data;
                            break;
                        }
                        const fitted = fitTextToLines(slideData.title, /*initial*/36, /*min*/20, /*baseWrap*/28, /*lines*/1, /*hard*/24);
                        slide.addText(toBoldRunsFromMarkdown(fitted.text) as any, {
                        x: 0, y: 0, w: '100%', h: '100%',
                        align: 'center', valign: 'middle',
                            fontSize: fitted.fontSize, bold: true, fontFace: JPN_FONT, color: bgTextColor,
                            shadow: shadowOf(templateConfig?.components?.title?.shadow, shadowPreset)
                    });
                    }
                    break;
                case 'quote':
                    // Title bar at the standard position (like other layouts)
                    {
                        const tmplElements = templateConfig?.layouts?.quote?.elements;
                        if (Array.isArray(tmplElements) && tmplElements.length) {
                            __templateHasElementsForLayout = true;
                            try { logger.info({ layout: 'quote' }, 'Template elements present: skipping code-rendered defaults for quote'); } catch {}
                            (slide as any).__data = { title: slideData.title, bullets: slideData.bullets, special_content: (slideData as any).special_content };
                            await renderElementsFromTemplate(slide as any, 'quote', tmplElements);
                            delete (slide as any).__data;
                            break;
                        }
                        const fitted = fitTextToLines(slideData.title, /*initial*/28, /*min*/20, /*baseWrap*/36, /*lines*/1, /*hard*/24);
                        const layoutKeyLocal = 'quote';
                        const chosenColor = chooseTitleBarColor(slideData.title, primary, (slideData as any).accent_color);
                        const bgColor = (templateConfig?.layouts?.[layoutKeyLocal]?.titleBar?.color) || (titleBarAreaStyle?.fill) || chosenColor;
                        const textColor = pickTextColorForBackground(bgColor).toString();
                        // shape background for title bar
                        slide.addShape('rect', { x: twoColTextX, y: contentTopY - 0.35, w: contentW, h: 0.6, fill: buildFill(bgColor), line: { color: normalizeColorToPptxHex(bgColor) || 'FFFFFF', width: 0 }, shadow: shadowOf(titleBarAreaStyle?.shadow, shadowPreset) } as any);
                        // title text over the bar
                        slide.addText(toBoldRunsFromMarkdown(fitted.text) as any, { x: twoColTextX, y: contentTopY - 0.35, w: contentW, h: 0.6, fontSize: fitted.fontSize, bold: true, fontFace: JPN_FONT, color: textColor, shadow: shadowOf(templateConfig?.components?.title?.shadow, shadowPreset) });
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
                        const tmplElements = templateConfig?.layouts?.content_with_visual?.elements;
                        if (Array.isArray(tmplElements) && tmplElements.length) {
                            __templateHasElementsForLayout = true;
                            try { logger.info({ layout: 'content_with_visual' }, 'Template elements present: skipping code-rendered defaults for content_with_visual'); } catch {}
                            // Decide if visual should go to bottom band instead of right panel
                            // Use unified per-slide recipe (from slide or context)
                            const typeStr = String((perSlideRecipeHere as any)?.type || '').toLowerCase();
                            const preferBottom = shouldPlaceVisualBottom(typeStr, perSlideRecipeHere);
                            // Render template elements; when preferBottom is true, skip template visual element
                            const elementsToRender = preferBottom ? (tmplElements.filter((e: any) => String(e?.type) !== 'visual')) : tmplElements;
                            // Provide slide data to renderer
                            (slide as any).__data = { title: slideData.title, bullets: slideData.bullets, visual_recipe: perSlideRecipeHere, imagePath: slideData.imagePath };
                            await renderElementsFromTemplate(slide as any, 'content_with_visual', elementsToRender);
                            delete (slide as any).__data;
                            // If template doesn't include a visual element or we intentionally skipped it, render either right-panel or bottom-band
                            const templateHadVisualEl = Array.isArray(tmplElements) && tmplElements.some((e: any) => String(e?.type) === 'visual');
                            __templateHasVisualElForLayout = __templateHasVisualElForLayout || templateHadVisualEl;
                            if (!preferBottom && templateHadVisualEl) {
                                // Respect template rendering only (no code-side duplication)
                                visualRendered = true;
                            } else {
                            if (preferBottom) {
                                    // Use explicit bottom band rectangle to avoid content_with_visual template area override
                                    const va = { x: marginX, y: bottomBandY, w: contentW, h: bottomBandH };
                                    const bulletsBottom = (contentTopY + 0.5) + Math.max(2.5, twoColTextH - 0.5);
                                    (va as any).y = Math.max(va.y, bulletsBottom + 0.2);
                                    const reservedBottom = typeof templateConfig?.branding?.reservedBottom === 'number' ? Math.max(0, templateConfig.branding.reservedBottom) : 0.8;
                                    if ((va.y + va.h) > (pageH - reservedBottom)) {
                                        const minY = contentTopY + 0.7;
                                        (va as any).y = Math.max(minY, (pageH - reservedBottom) - va.h);
                                    }
                                    if (perSlideRecipeHere && typeof perSlideRecipeHere === 'object') {
                                        await drawInfographic(slide as any, String(typeStr), perSlideRecipeHere, va);
                                        visualRendered = true;
                                    } else if (slideData.imagePath) {
                                        slide.addImage({ path: slideData.imagePath, x: va.x, y: va.y, w: va.w, h: va.h, sizing: { type: 'contain', w: va.w, h: va.h } as any, shadow: shadowOf(resolveVisualShadow('image')) });
                                        visualRendered = true;
                                    }
                                } else {
                                    const vArea = resolveArea('visual', twoColVisualX, contentTopY + 0.6, twoColVisualW, 3.4);
                                    logger.warn({ layout: 'content_with_visual', area: vArea, recipeType: (slideData as any)?.visual_recipe?.type || null }, 'Template elements missing visual. Falling back to code-rendered visual region');
                                    if ((slideData as any).visual_recipe) {
                                        await drawInfographic(slide as any, String(((slideData as any).visual_recipe?.type) || ''), (slideData as any).visual_recipe, vArea);
                                        visualRendered = true;
                                    } else if (slideData.imagePath) {
                                        slide.addImage({ path: slideData.imagePath, x: vArea.x, y: vArea.y, w: vArea.w, h: vArea.h, sizing: { type: 'contain', w: vArea.w, h: vArea.h } as any, shadow: shadowOf(resolveVisualShadow('image')) });
                                        visualRendered = true;
                                    }
                                }
                            }
                            break;
                        }
                        const fitted = fitTextToLines(slideData.title, /*initial*/32, /*min*/22, /*baseWrap*/36, /*lines*/1, /*hard*/24);
                        const layoutKeyLocal = 'content_with_visual';
                        const resolved = resolveTitleBarColorFromTemplate(templateConfig, layoutKeyLocal, primary, (slideData as any).accent_color);
                        const bgColor = (templateConfig?.layouts?.[layoutKeyLocal]?.titleBar?.color) || (titleBarAreaStyle?.fill) || resolved;
                        const textColor = pickTextColorForBackground(bgColor).toString();
                        const tArea = resolveArea('title', twoColTextX, contentTopY - 0.35, contentW, 0.6);
                        // shape background for title bar
                        slide.addShape('rect', { x: tArea.x, y: tArea.y, w: tArea.w, h: tArea.h, fill: buildFill(bgColor), line: { color: normalizeColorToPptxHex(bgColor) || 'FFFFFF', width: 0 }, shadow: shadowOf(titleBarAreaStyle?.shadow, shadowPreset) } as any);
                        // text over the bar
                        slide.addText(toBoldRunsFromMarkdown(fitted.text) as any, { x: tArea.x, y: tArea.y, w: tArea.w, h: tArea.h, fontSize: fitted.fontSize, bold: true, fontFace: headFont, color: textColor, shadow: shadowOf(titleTextShadowValue, shadowPreset) });
                    }
                    {
                        const bArea = resolveArea('bullets', twoColTextX, contentTopY + 0.5, twoColTextW, Math.max(2.5, twoColTextH - 0.5));
                    const cleanedBulletsCv = (slideData.bullets || []).map((b: any) => String(b || '').replace(/\n[ \t　]*/g, ' ').trim());
                    const bulletTextCv = cleanedBulletsCv.join('\n').replace(/\*\*([^*]+)\*\*/g, '$1');
                        slide.addText(bulletTextCv, { x: bArea.x, y: bArea.y, w: bArea.w, h: bArea.h, fontSize: 18, bullet: { type: 'bullet' }, fontFace: bodyFont, valign: 'top', paraSpaceAfter: 12, autoFit: true, fill: bulletsBg ? buildFill(bulletsBg) : undefined, line: bulletsBg ? { color: normalizeColorToPptxHex(bulletsBg) || 'FFFFFF', width: 0 } : undefined, shadow: shadowOf(bulletsShadowValue, shadowPreset) });
                    }
                    // Non-template path: if visual exists and is crowded for right-panel, draw into bottom band instead
                    if (perSlideRecipeHere) {
                        const typeStr = String((perSlideRecipeHere as any)?.type || '').toLowerCase();
                        const preferBottom = shouldPlaceVisualBottom(typeStr, perSlideRecipeHere);
                        if (preferBottom) {
                            const va = resolveArea('visual', marginX, bottomBandY, contentW, bottomBandH);
                            const bulletsBottom = (contentTopY + 0.5) + Math.max(2.5, twoColTextH - 0.5);
                            (va as any).y = Math.max(va.y, bulletsBottom + 0.2);
                            const reservedBottom = typeof templateConfig?.branding?.reservedBottom === 'number' ? Math.max(0, templateConfig.branding.reservedBottom) : 0.8;
                            if ((va.y + va.h) > (pageH - reservedBottom)) {
                                const minY = contentTopY + 0.7;
                                (va as any).y = Math.max(minY, (pageH - reservedBottom) - va.h);
                            }
                            await drawInfographic(slide as any, typeStr, perSlideRecipeHere as any, va);
                            visualRendered = true;
                        } else if (!isBottomVisual) {
                            const vArea = resolveArea('visual', twoColVisualX, contentTopY + 0.6, twoColVisualW, 3.4);
                            await drawInfographic(slide as any, typeStr, perSlideRecipeHere as any, vArea);
                            visualRendered = true;
                        }
                    } else if (!isBottomVisual && slideData.imagePath) {
                        const vArea = resolveArea('visual', twoColVisualX, contentTopY + 0.6, twoColVisualW, 3.4);
                        slide.addImage({ path: slideData.imagePath, x: vArea.x, y: vArea.y, w: vArea.w, h: vArea.h, sizing: { type: 'contain', w: vArea.w, h: vArea.h } as any, shadow: shadowOf(resolveVisualShadow('image')) });
                    }
                    break;
                case 'content_with_bottom_visual':
                    {
                        const tmplElements = templateConfig?.layouts?.content_with_bottom_visual?.elements;
                        if (Array.isArray(tmplElements) && tmplElements.length) {
                            __templateHasElementsForLayout = true;
                            try { logger.info({ layout: 'content_with_bottom_visual' }, 'Template elements present: skipping code-rendered defaults for content_with_bottom_visual'); } catch {}
                            (slide as any).__data = { title: slideData.title, bullets: slideData.bullets, visual_recipe: perSlideRecipeHere, imagePath: slideData.imagePath };
                            await renderElementsFromTemplate(slide as any, 'content_with_bottom_visual', tmplElements);
                            // Fallback render only if template lacks a visual element
                            const hasVisualEl = Array.isArray(tmplElements) && tmplElements.some((e: any) => String(e?.type) === 'visual');
                            __templateHasVisualElForLayout = __templateHasVisualElForLayout || hasVisualEl;
                            if (hasVisualEl) {
                                // Template already rendered the visual; avoid duplicate drawing
                                visualRendered = true;
                            } else {
                                const va = resolveArea('visual', marginX, bottomBandY, contentW, bottomBandH);
                                logger.warn({ layout: 'content_with_bottom_visual', area: va, recipeType: (slideData as any)?.visual_recipe?.type || null }, 'Template elements missing visual. Falling back to code-rendered bottom visual region');
                                if ((slideData as any).visual_recipe) {
                                    await drawInfographic(slide as any, String(((slideData as any).visual_recipe?.type) || ''), (slideData as any).visual_recipe, va);
                                    visualRendered = true;
                                } else if (slideData.imagePath) {
                                    slide.addImage({ path: slideData.imagePath, x: va.x, y: va.y, w: va.w, h: va.h, sizing: { type: 'contain', w: va.w, h: va.h } as any, shadow: shadowOf(resolveVisualShadow('image')) });
                                    visualRendered = true;
                                }
                            }
                            delete (slide as any).__data;
                            break;
                        }
                        const fitted = fitTextToLines(slideData.title, /*initial*/32, /*min*/22, /*baseWrap*/36, /*lines*/1, /*hard*/24);
                        const layoutKeyLocal = 'content_with_bottom_visual';
                        const resolved = resolveTitleBarColorFromTemplate(templateConfig, layoutKeyLocal, primary, (slideData as any).accent_color);
                        const bgColor = (templateConfig?.layouts?.[layoutKeyLocal]?.titleBar?.color) || (titleBarAreaStyle?.fill) || resolved;
                        const textColor = pickTextColorForBackground(bgColor).toString();
                        const tArea = resolveArea('title', twoColTextX, contentTopY - 0.35, contentW, 0.6);
                        slide.addShape('rect', { x: tArea.x, y: tArea.y, w: tArea.w, h: tArea.h, fill: buildFill(bgColor), line: { color: normalizeColorToPptxHex(bgColor) || 'FFFFFF', width: 0 }, shadow: shadowOf(titleBarAreaStyle?.shadow, shadowPreset) } as any);
                        slide.addText(toBoldRunsFromMarkdown(fitted.text) as any, { x: tArea.x, y: tArea.y, w: tArea.w, h: tArea.h, fontSize: fitted.fontSize, bold: true, fontFace: headFont, color: textColor, shadow: shadowOf(titleTextShadowValue, shadowPreset) });
                    }
                    {
                        const bArea = resolveArea('bullets', twoColTextX, contentTopY + 0.5, contentW, 2.4);
                        const cleanedBullets = mergeQuotedContinuations((slideData.bullets || []).map((b: any) => String(b || '').replace(/\n[ \t　]*/g, ' ').trim()));
                        const bulletText = cleanedBullets.join('\n').replace(/\*\*([^*]+)\*\*/g, '$1');
                        slide.addText(bulletText, { x: bArea.x, y: bArea.y, w: bArea.w, h: bArea.h, fontSize: 20, bullet: { type: 'bullet' }, align: 'left', fontFace: bodyFont, valign: 'top', paraSpaceAfter: 12, color: bgTextColor, autoFit: true, fill: bulletsBg ? buildFill(bulletsBg) : undefined, line: bulletsBg ? { color: normalizeColorToPptxHex(bulletsBg) || 'FFFFFF', width: 0 } : undefined, shadow: shadowOf(bulletsShadowValue, shadowPreset) });
                    }
                    {
                        const aVisual = resolveArea('visual', marginX, bottomBandY, contentW, bottomBandH);
                        const reservedBottom = typeof templateConfig?.branding?.reservedBottom === 'number' ? Math.max(0, templateConfig.branding.reservedBottom) : 0.8;
                        if ((aVisual.y + aVisual.h) > (pageH - reservedBottom)) {
                            const minY = contentTopY + 0.7;
                            (aVisual as any).y = Math.max(minY, (pageH - reservedBottom) - aVisual.h);
                        }
                        const perSlideRecipeHere = (slideData as any).visual_recipe;
                        if (perSlideRecipeHere && typeof perSlideRecipeHere === 'object') {
                            await drawInfographic(slide as any, String(perSlideRecipeHere.type || ''), perSlideRecipeHere, aVisual);
                        } else if (slideData.imagePath) {
                            slide.addImage({ path: slideData.imagePath, x: aVisual.x, y: aVisual.y, w: aVisual.w, h: aVisual.h, sizing: { type: 'contain', w: aVisual.w, h: aVisual.h } as any, shadow: shadowOf(resolveVisualShadow('image')) });
                        }
                    }
                    break;
                case 'content_with_image':
                    {
                        const tmplElements = templateConfig?.layouts?.content_with_image?.elements;
                        if (Array.isArray(tmplElements) && tmplElements.length) {
                            __templateHasElementsForLayout = true;
                            try { logger.info({ layout: 'content_with_image' }, 'Template elements present: skipping code-rendered defaults for content_with_image'); } catch {}
                            (slide as any).__data = { title: slideData.title, bullets: slideData.bullets, imagePath: slideData.imagePath };
                            await renderElementsFromTemplate(slide as any, 'content_with_image', tmplElements);
                            delete (slide as any).__data;
                            break;
                        }
                        // Title bar
                        const fitted = fitTextToLines(slideData.title, /*initial*/32, /*min*/22, /*baseWrap*/36, /*lines*/1, /*hard*/24);
                        const layoutKeyLocal = 'content_with_image';
                        const resolved = resolveTitleBarColorFromTemplate(templateConfig, layoutKeyLocal, primary, (slideData as any).accent_color);
                        const bgColor = (templateConfig?.layouts?.[layoutKeyLocal]?.titleBar?.color) || (titleBarAreaStyle?.fill) || resolved;
                        const textColor = pickTextColorForBackground(bgColor).toString();
                        const tArea = resolveArea('title', twoColTextX, contentTopY - 0.35, contentW, 0.6);
                        slide.addShape('rect', { x: tArea.x, y: tArea.y, w: tArea.w, h: tArea.h, fill: buildFill(bgColor), line: { color: normalizeColorToPptxHex(bgColor) || 'FFFFFF', width: 0 }, shadow: shadowOf(titleBarAreaStyle?.shadow, shadowPreset) } as any);
                        slide.addText(toBoldRunsFromMarkdown(fitted.text) as any, { x: tArea.x, y: tArea.y, w: tArea.w, h: tArea.h, fontSize: fitted.fontSize, bold: true, fontFace: headFont, color: textColor, shadow: shadowOf(titleTextShadowValue, shadowPreset) });
                        // Areas: left image, right bullets
                        const imgArea = resolveArea('image', marginX, contentTopY + 0.5, Math.max(5.4, contentW * 0.45), Math.max(3.6, twoColTextH));
                        const bulletsArea = resolveArea('bullets', imgArea.x + imgArea.w + gap, contentTopY + 0.5, Math.max(4.5, contentW - imgArea.w - gap), Math.max(2.5, twoColTextH - 0.2));
                        // Ensure image is available or generate via AI if context_for_visual provided
                        let imagePath = (slideData as any).imagePath as (string|undefined);
                        if (!imagePath && typeof (slideData as any).context_for_visual === 'string' && (slideData as any).context_for_visual.trim()) {
                            try {
                                const paletteHint = primary && secondary ? `palette: primary=${primary}, secondary=${secondary}` : '';
                                const prompt = [
                                    'Photorealistic/product or scene image for presentation (no text).',
                                    `Context: ${(slideData as any).context_for_visual.trim()}`,
                                    'Style: modern, clean, high-resolution, professional.',
                                    paletteHint
                                ].filter(Boolean).join(' ');
                                const { genarateImage } = await import('./genarateImage');
                                const res = await genarateImage({ prompt, aspectRatio: '4:3' });
                                if (res?.success && res.path) imagePath = res.path;
                            } catch {}
                        }
                        if (imagePath) {
                            slide.addImage({ path: imagePath, x: imgArea.x, y: imgArea.y, w: imgArea.w, h: imgArea.h, sizing: { type: 'cover', w: imgArea.w, h: imgArea.h } as any, shadow: shadowOf(resolveVisualShadow('image')) });
                        }
                        // Bullets on the right
                        const bulletsText = (slideData.bullets || []).map((b:any)=>String(b||'').replace(/\n[ \t　]*/g,' ').trim()).join('\n').replace(/\*\*([^*]+)\*\*/g,'$1');
                        slide.addText(bulletsText, { x: bulletsArea.x, y: bulletsArea.y, w: bulletsArea.w, h: bulletsArea.h, fontSize: 18, bullet: { type: 'bullet' }, align: 'left', fontFace: bodyFont, valign: 'top', paraSpaceAfter: 12, autoFit: true, fill: bulletsBg ? buildFill(bulletsBg) : undefined, line: bulletsBg ? { color: normalizeColorToPptxHex(bulletsBg) || 'FFFFFF', width: 0 } : undefined, shadow: shadowOf(bulletsShadowValue, shadowPreset) });
                    }
                    break;
                case 'visual_only':
                    {
                        const tmplElements = templateConfig?.layouts?.visual_only?.elements;
                        if (Array.isArray(tmplElements) && tmplElements.length) {
                            __templateHasElementsForLayout = true;
                            try { logger.info({ layout: 'visual_only' }, 'Template elements present: skipping code-rendered defaults for visual_only'); } catch {}
                            (slide as any).__data = { title: slideData.title, bullets: slideData.bullets, visual_recipe: perSlideRecipeHere, imagePath: slideData.imagePath };
                            await renderElementsFromTemplate(slide as any, 'visual_only', tmplElements);
                            delete (slide as any).__data;
                            break;
                        }
                        // Fallback: use full canvas for visual
                        const vArea = { x: marginX, y: contentTopY - 0.1, w: contentW, h: pageH - (contentTopY - 0.1) - 0.6 };
                        if (perSlideRecipeHere && typeof perSlideRecipeHere === 'object') {
                            await drawInfographic(slide as any, String(perSlideRecipeHere.type || ''), perSlideRecipeHere, vArea);
                        } else if (slideData.imagePath) {
                            slide.addImage({ path: slideData.imagePath, x: vArea.x, y: vArea.y, w: vArea.w, h: vArea.h, sizing: { type: 'cover', w: vArea.w, h: vArea.h } as any, shadow: shadowOf(resolveVisualShadow('image')) });
                        }
                    }
                    break;
                case 'visual_hero_split':
                    {
                        const tmplElements = templateConfig?.layouts?.visual_hero_split?.elements;
                        if (Array.isArray(tmplElements) && tmplElements.length) {
                            __templateHasElementsForLayout = true;
                            try { logger.info({ layout: 'visual_hero_split' }, 'Rendering from template elements'); } catch {}
                            (slide as any).__data = { title: slideData.title, bullets: slideData.bullets, imagePath: slideData.imagePath };
                            await renderElementsFromTemplate(slide as any, 'visual_hero_split', tmplElements);
                            delete (slide as any).__data;
                            break;
                        }
                        // No explicit code fallback; rely on template
                    }
                    break;
                case 'comparison_cards':
                    {
                        const tmplElements = templateConfig?.layouts?.comparison_cards?.elements;
                        if (Array.isArray(tmplElements) && tmplElements.length) {
                            __templateHasElementsForLayout = true;
                            try { logger.info({ layout: 'comparison_cards' }, 'Rendering from template elements'); } catch {}
                            // Build bulletsA/B with fallbacks: if missing, split common bullets array into two halves
                            const rawA: any = (slideData as any).bulletsA;
                            const rawB: any = (slideData as any).bulletsB;
                            const common: any = (slideData as any).bullets;
                            let aList: string[] | undefined = Array.isArray(rawA) ? rawA.map((s:any)=>String(s||'')) : undefined;
                            let bList: string[] | undefined = Array.isArray(rawB) ? rawB.map((s:any)=>String(s||'')) : undefined;
                            if ((!aList || aList.length === 0 || !bList || bList.length === 0) && Array.isArray(common) && common.length) {
                              const mid = Math.ceil(common.length / 2);
                              const left = common.slice(0, mid).map((s:any)=>String(s||''));
                              const right = common.slice(mid).map((s:any)=>String(s||''));
                              if (!aList || aList.length === 0) aList = left;
                              if (!bList || bList.length === 0) bList = right.length ? right : left; // if odd, mirror left
                              try { logger.warn({ fallbackFromCommon: true, commonLen: common.length, aLen: aList.length, bLen: bList.length }, 'comparison_cards: bullets fallback applied'); } catch {}
                            }
                            (slide as any).__data = { title: slideData.title, bullets: slideData.bullets, bulletsA: aList, bulletsB: bList } as any;
                            try { logger.info({ hasA: Array.isArray(aList), hasB: Array.isArray(bList), aLen: Array.isArray(aList)?aList.length:0, bLen: Array.isArray(bList)?bList.length:0 }, 'comparison_cards: __data bullets presence'); } catch {}
                            await renderElementsFromTemplate(slide as any, 'comparison_cards', tmplElements);
                            // Manual fallback draw if template bullets did not render but data exists
                            try {
                              const flags = (slide as any).__renderedFlags || {};
                              const aList = (slide as any).__data?.bulletsA as string[] | undefined;
                              const bList = (slide as any).__data?.bulletsB as string[] | undefined;
                              const needA = Array.isArray(aList) && aList.length > 0 && !flags['comparison_cards_bulletsA'];
                              const needB = Array.isArray(bList) && bList.length > 0 && !flags['comparison_cards_bulletsB'];
                              const areas = (templateConfig?.layouts?.comparison_cards?.areas) || {};
                              const reg = templateConfig?.geometry?.regionDefs || {};
                              const getBox = (areaName: string) => {
                                const a: any = areas[areaName] || {};
                                const ref = typeof a?.ref === 'string' ? a.ref : '';
                                const refSize: any = ref && reg[ref] ? reg[ref] : {};
                                const w = Number(a?.w) || Number(refSize?.w) || 3.8;
                                const h = Number(a?.h) || Number(refSize?.h) || 2.4;
                                const x = Number(a?.x) || 0.8;
                                const y = Number(a?.y) || 1.6;
                                return { x, y, w, h };
                              };
                              const titleReserve = 0.6;
                              if (needA) {
                                const box = getBox('cardA');
                                const y = box.y + titleReserve;
                                const h = Math.max(0.2, box.h - titleReserve);
                                const txt = aList.join('\n');
                                slide.addText(txt, { x: box.x + 0.2, y, w: box.w - 0.4, h, fontSize: 16, fontFace: JPN_FONT, bullet: { type: 'bullet' }, color: '333333', valign: 'top' });
                                logger.warn({ manual:true, len:aList.length, box:{x:box.x,y,h,w:box.w} }, 'comparison_cards: manual render bulletsA');
                              }
                              if (needB) {
                                const box = getBox('cardB');
                                const y = box.y + titleReserve;
                                const h = Math.max(0.2, box.h - titleReserve);
                                const txt = bList.join('\n');
                                slide.addText(txt, { x: box.x + 0.2, y, w: box.w - 0.4, h, fontSize: 16, fontFace: JPN_FONT, bullet: { type: 'bullet' }, color: '333333', valign: 'top' });
                                logger.warn({ manual:true, len:bList.length, box:{x:box.x,y,h,w:box.w} }, 'comparison_cards: manual render bulletsB');
                              }
                            } catch {}
                            delete (slide as any).__data;
                            break;
                        }
                        // No explicit code fallback; rely on template
                    }
                    break;
                case 'checklist_top_bullets_bottom':
                    {
                        const tmplElements = templateConfig?.layouts?.checklist_top_bullets_bottom?.elements;
                        if (Array.isArray(tmplElements) && tmplElements.length) {
                            __templateHasElementsForLayout = true;
                            try { logger.info({ layout: 'checklist_top_bullets_bottom' }, 'Rendering from template elements'); } catch {}
                            (slide as any).__data = { title: slideData.title, bullets: slideData.bullets, visual_recipe: perSlideRecipeHere };
                            await renderElementsFromTemplate(slide as any, 'checklist_top_bullets_bottom', tmplElements);
                            delete (slide as any).__data;
                            break;
                        }
                        // No explicit code fallback; rely on template
                    }
                    break;
                case 'content_only':
                default:
                    {
                        const tmplElements = templateConfig?.layouts?.content_only?.elements;
                        const hasTemplate = Array.isArray(tmplElements) && tmplElements.length > 0;
                        // expose to outer scope via locals
                        var __hasTemplate_co = hasTemplate;
                        var __hasBulletsEl_co = Array.isArray(tmplElements) && tmplElements.some((e: any) => String(e?.type) === 'text' && (String(e?.area) === 'bullets' || String(e?.contentRef) === 'bullets'));
                        // If this slide actually has a visual, prefer rendering via an appropriate layout template
                        if (perSlideRecipeHere && typeof perSlideRecipeHere === 'object') {
                            const typeStrCO = String((perSlideRecipeHere as any)?.type || '').toLowerCase();
                            const preferBottom = isBottomVisual || shouldPlaceVisualBottom(typeStrCO, perSlideRecipeHere);
                            const targetLayout = preferBottom ? 'content_with_bottom_visual' : 'content_with_visual';
                            const targetElems = templateConfig?.layouts?.[targetLayout]?.elements;
                            if (Array.isArray(targetElems) && targetElems.length) {
                                __templateHasElementsForLayout = true;
                                try { logger.info({ from: 'content_only', to: targetLayout }, 'Redirecting rendering to target layout to avoid overlap.'); } catch {}
                                (slide as any).__data = { title: slideData.title, bullets: slideData.bullets, visual_recipe: perSlideRecipeHere };
                                await renderElementsFromTemplate(slide as any, targetLayout, targetElems);
                                const hasVisualEl = Array.isArray(targetElems) && targetElems.some((e: any) => String(e?.type) === 'visual');
                                if (hasVisualEl) { visualRendered = true; __templateHasVisualElForLayout = true; }
                                delete (slide as any).__data;
                                break;
                            }
                        }
                        if (hasTemplate) {
                            __templateHasElementsForLayout = true;
                            try { logger.info({ layout: 'content_only' }, 'Template elements present: skipping code-rendered defaults for content_only'); } catch {}
                            (slide as any).__data = { title: slideData.title, bullets: slideData.bullets, visual_recipe: perSlideRecipeHere, imagePath: slideData.imagePath };
                            await renderElementsFromTemplate(slide as any, 'content_only', tmplElements);
                            // Mark visual presence to prevent fallback duplication
                            const hasVisualEl = Array.isArray(tmplElements) && tmplElements.some((e: any) => String(e?.type) === 'visual');
                            if (hasVisualEl) { visualRendered = true; __templateHasVisualElForLayout = true; }
                            delete (slide as any).__data;
                        }
                        const fitted = fitTextToLines(slideData.title, /*initial*/32, /*min*/20, /*baseWrap*/40, /*lines*/1, /*hard*/24);
                        const layoutKeyLocal = 'content_only';
                        const resolved = resolveTitleBarColorFromTemplate(templateConfig, layoutKeyLocal, primary, (slideData as any).accent_color);
                        const bgColor = (templateConfig?.layouts?.[layoutKeyLocal]?.titleBar?.color) || (titleBarAreaStyle?.fill) || resolved;
                        const textColor = pickTextColorForBackground(bgColor).toString();
                        if (!hasTemplate) {
                            slide.addShape('rect', { x: twoColTextX, y: contentTopY - 0.35, w: contentW, h: 0.6, fill: buildFill(bgColor), line: { color: normalizeColorToPptxHex(bgColor) || 'FFFFFF', width: 0 }, shadow: shadowOf(titleBarAreaStyle?.shadow, shadowPreset) } as any);
                            slide.addText(toBoldRunsFromMarkdown(fitted.text) as any, { x: twoColTextX, y: contentTopY - 0.35, w: contentW, h: 0.6, fontSize: fitted.fontSize, bold: true, fontFace: headFont, color: textColor, shadow: shadowOf(titleTextShadowValue, shadowPreset) });
                        }
                    }
                    // Allow a bit more content on content-only slides: target 4 lines per bullet
                    const cleanedBulletsCo = mergeQuotedContinuations((slideData.bullets || []).map((b: any) => String(b || '').replace(/\n[ \t　]*/g, ' ').trim()));
                    const bulletTextCo = cleanedBulletsCo.join('\n').replace(/\*\*([^*]+)\*\*/g, '$1');
                    // Shift text down to avoid overlapping title
                    const textYContentOnly = contentTopY + 0.5;
                    let textHContentOnly = 4.0;
                    // If visual exists and is bottom-type or will be placed at bottom, shorten bullets area to avoid overlap
                    if (perSlideRecipeHere) {
                        const typeStrCO = String((perSlideRecipeHere as any)?.type || '').toLowerCase();
                        const willBottom = isBottomVisual || shouldPlaceVisualBottom(typeStrCO, perSlideRecipeHere);
                        if (willBottom) {
                            textHContentOnly = Math.min(textHContentOnly, 2.6);
                        }
                    }
                    // If template already rendered bullets, or we redirected to another layout above, skip fallback bullets
                    if (!(__hasTemplate_co && __hasBulletsEl_co) && !__templateHasVisualElForLayout) {
                    if (perSlideRecipeHere) {
                        const typeStrCO2 = String((perSlideRecipeHere as any)?.type || '').toLowerCase();
                        const willBottom2 = isBottomVisual || shouldPlaceVisualBottom(typeStrCO2, perSlideRecipeHere);
                        // If the recipe should be placed at bottom, use full-width text; otherwise two-column
                        if (willBottom2) {
                                slide.addText(bulletTextCo, { x: twoColTextX, y: textYContentOnly, w: contentW, h: textHContentOnly, fontSize: 20, bullet: { type: 'bullet' }, align: 'left', fontFace: bodyFont, valign: 'top', paraSpaceAfter: 12, color: bgTextColor, autoFit: true, fill: bulletsBg ? buildFill(bulletsBg) : undefined, line: bulletsBg ? { color: normalizeColorToPptxHex(bulletsBg) || 'FFFFFF', width: 0 } : undefined, shadow: shadowOf(bulletsShadowValue, shadowPreset) });
                        } else {
                            // Right-panel recipe → two-column
                                slide.addText(bulletTextCo, { x: twoColTextX, y: textYContentOnly, w: twoColTextW, h: twoColTextH, fontSize: 20, bullet: { type: 'bullet' }, align: 'left', fontFace: bodyFont, valign: 'top', paraSpaceAfter: 12, color: bgTextColor, autoFit: true, fill: bulletsBg ? buildFill(bulletsBg) : undefined, line: bulletsBg ? { color: normalizeColorToPptxHex(bulletsBg) || 'FFFFFF', width: 0 } : undefined, shadow: shadowOf(bulletsShadowValue, shadowPreset) });
                        }
                    } else {
                        // No recipe → full-width text
                            slide.addText(bulletTextCo, { x: twoColTextX, y: textYContentOnly, w: contentW, h: textHContentOnly, fontSize: 20, bullet: { type: 'bullet' }, align: 'left', fontFace: bodyFont, valign: 'top', paraSpaceAfter: 12, color: bgTextColor, autoFit: true, fill: bulletsBg ? buildFill(bulletsBg) : undefined, line: bulletsBg ? { color: normalizeColorToPptxHex(bulletsBg) || 'FFFFFF', width: 0 } : undefined, shadow: shadowOf(bulletsShadowValue, shadowPreset) });
                        }
                    }
                    break;
            }

            // If a per-slide visual recipe exists, choose optimal layout to avoid overlap
            if (perSlideRecipeHere && (layout === 'content_with_visual' || layout === 'content_only') && !visualRendered) {
                const typeStr = String(perSlideRecipeHere.type || '');
                // Decide placement dynamically for content_only
                if (layout === 'content_only') {
                    const preferBottom = shouldPlaceVisualBottom(typeStr, perSlideRecipeHere);
                    layout = preferBottom ? 'content_with_bottom_visual' : 'content_with_visual';
                }
                const isBottom = (layout === 'content_with_bottom_visual') || isBottomVisual || typeStr === 'gantt' || typeStr === 'timeline';
                // If an image chart exists on the right panel for content_with_visual,
                // move recipe to bottom band to avoid overlap.
                const hasImageForSlide = !!(slideData as any).imagePath;
                const forceBottomForRecipe = (layout === 'content_with_visual') && hasImageForSlide;
                // Right panel and bottom band regions (absolute, 16:9)
                // For content_only, place band under bullets area to avoid overlap
                const bulletsBottomY = contentTopY + 0.5 +  (layout === 'content_only' ? 2.6 : 2.4); // content_only uses shortened bullets when bottom visual
                const dynamicBottomY = layout === 'content_only' ? Math.max(bottomBandY, bulletsBottomY + 0.2) : bottomBandY;
                let region = (isBottom || forceBottomForRecipe)
                  ? { x: marginX, y: dynamicBottomY, w: contentW, h: bottomBandH }
                  : { x: twoColVisualX, y: contentTopY + 0.7, w: twoColVisualW, h: twoColVisualH };
                // Avoid overlapping bottom branding/footer by reserving space at the very bottom (template override)
                const reservedBottom = typeof templateConfig?.branding?.reservedBottom === 'number' ? Math.max(0, templateConfig.branding.reservedBottom) : 0.8;
                if ((region.y + region.h) > (pageH - reservedBottom)) {
                    const minY = contentTopY + 0.7; // keep within content area
                    region.y = Math.max(minY, (pageH - reservedBottom) - region.h);
                }
                logger.warn({ layout, area: region, recipeType: String(perSlideRecipeHere.type || '') }, 'Fallback visual rendering invoked');
                await drawInfographic(slide as any, String(perSlideRecipeHere.type || ''), perSlideRecipeHere, region);
            }
            // Copyright (template-driven)
            try {
                const crCfg: any = templateConfig?.branding?.copyright;
                const companyName: string = String((context as any)?.companyName || (context as any)?.companyOverview?.company_name || '').trim();
                const year = new Date().getFullYear();
                const formatText = (fmt: string): string => fmt.replace(/<companyName>/g, companyName).replace(/<year>/g, String(year));
                if (crCfg && typeof crCfg === 'object') {
                    const show = (crCfg.enabled === true || crCfg.show === true);
                    const skipOnTitle = !!crCfg?.skipOnTitleSlide;
                    if (show && !(skipOnTitle && index === 0)) {
                        const fmt: string = typeof crCfg.format === 'string' && crCfg.format.trim() ? crCfg.format.trim() : '<companyName>';
                        const text = formatText(fmt);
                        const area = (crCfg.area || {}) as any;
                        const ref = typeof area?.ref === 'string' ? area.ref : '';
                        const refSize = ref && templateConfig?.geometry?.regionDefs && templateConfig.geometry.regionDefs[ref];
                        const w = Number(area?.w) || Number(refSize?.w) || (pageW - 0.8);
                        const h = Number(area?.h) || Number(refSize?.h) || 0.3;
                        const x = Number(area?.x); const y = Number(area?.y);
                        const px = Number.isFinite(x) ? x : 0.4;
                        const py = Number.isFinite(y) ? y : (pageH - 0.35);
                        const styleRefs = Array.isArray(crCfg?.styleRef) ? crCfg.styleRef : (crCfg?.styleRef ? [crCfg.styleRef] : []);
                        const styleRefObjs = styleRefs.map((p: string) => getByPath(templateConfig, p)).filter(Boolean);
                        const style = resolveStyle(...styleRefObjs, crCfg?.style);
                        const align = (style?.align || area?.align || 'center');
                        const opts: any = {
                            x: px,
                            y: py,
                            w,
                            h,
                            align,
                            fontFace: String(style?.fontFace || bodyFont),
                            fontSize: Number(style?.fontSize) || 10,
                            bold: !!style?.bold,
                            color: normalizeColorToPptxHex(style?.color) || '666666',
                            shadow: shadowOf(style?.shadow, shadowPreset)
                        };
                        if (style?.fill) opts.fill = buildFill(style.fill);
                        if (style?.lineColor || Number.isFinite(style?.lineWidth)) opts.line = { color: normalizeColorToPptxHex(style?.lineColor) || (normalizeColorToPptxHex(style?.fill) || 'FFFFFF'), width: Number(style?.lineWidth) || 0 };
                        slide.addText(text, opts);
                    appliedCopyrightCount++;
                    }
                } else if (typeof crCfg === 'string' && crCfg.trim()) {
                    slide.addText(crCfg.trim(), { x: 0.4, y: pageH - 0.35, w: pageW - 0.8, h: 0.3, align: 'center', fontSize: 10, color: '666666', fontFace: bodyFont });
                    appliedCopyrightCount++;
                } else if (companyCopyright) {
                    slide.addText(companyCopyright, { x: 0.4, y: pageH - 0.35, w: pageW - 0.8, h: 0.3, align: 'center', fontSize: 10, color: '666666', fontFace: bodyFont });
                    appliedCopyrightCount++;
                }
                } catch (e) {
                    logger.warn({ error: e }, 'Failed to add copyright text on a slide.');
                }

            // Page number (template-driven)
            try {
                const pageNumCfg: any = templateConfig?.branding?.pageNumber;
                const showPageNo = !!(pageNumCfg && (pageNumCfg.enabled === true || pageNumCfg.show === true));
                const skipOnTitle = !!pageNumCfg?.skipOnTitleSlide;
                if (showPageNo && !(skipOnTitle && index === 0)) {
                    const fmt: string = typeof pageNumCfg.format === 'string' && pageNumCfg.format.trim() ? pageNumCfg.format.trim() : '<pageNo>';
                    const pageNoText = fmt.replace(/<pageNo>/g, String(index + 1));
                    const area = (pageNumCfg.area || {}) as any;
                    const ref = typeof area?.ref === 'string' ? area.ref : '';
                    const refSize = ref && templateConfig?.geometry?.regionDefs && templateConfig.geometry.regionDefs[ref];
                    const w = Number(area?.w) || Number(refSize?.w) || 1.5;
                    const h = Number(area?.h) || Number(refSize?.h) || 0.3;
                    const x = Number(area?.x); const y = Number(area?.y);
                    const px = Number.isFinite(x) ? x : marginX;
                    const py = Number.isFinite(y) ? y : (pageH - 0.35);
                    const styleRefs = Array.isArray(pageNumCfg?.styleRef) ? pageNumCfg.styleRef : (pageNumCfg?.styleRef ? [pageNumCfg.styleRef] : []);
                    const styleRefObjs = styleRefs.map((p: string) => getByPath(templateConfig, p)).filter(Boolean);
                    const style = resolveStyle(...styleRefObjs, pageNumCfg?.style);
                    const align = (style?.align || area?.align || 'left');
                    const opts: any = {
                        x: px,
                        y: py,
                        w,
                        h,
                        align,
                        fontFace: String(style?.fontFace || bodyFont),
                        fontSize: Number(style?.fontSize) || 10,
                        bold: !!style?.bold,
                        color: normalizeColorToPptxHex(style?.color) || '666666',
                        shadow: shadowOf(style?.shadow, shadowPreset)
                    };
                    if (style?.fill) opts.fill = buildFill(style.fill);
                    if (style?.lineColor || Number.isFinite(style?.lineWidth)) opts.line = { color: normalizeColorToPptxHex(style?.lineColor) || (normalizeColorToPptxHex(style?.fill) || 'FFFFFF'), width: Number(style?.lineWidth) || 0 };
                    slide.addText(pageNoText, opts);
                }
            } catch (e) {
                try { logger.warn({ error: e }, 'Failed to render page number'); } catch {}
            }
        }
        logger.info({ appliedLogoCount, appliedCopyrightCount }, 'Applied branding to slides.');
        
        // Charts diagnostics page has been removed per requirements.

        // Add company about slide at the end if available (render using pptxgenjs table)
        if (companyAbout || (context as any).companyOverview) {
            try {
                const aboutSlide = pres.addSlide();
                aboutSlide.background = { color: lightenHex(secondary, 85).replace('#', '') } as any;
                const tmplElements = templateConfig?.layouts?.company_about?.elements;
                if (Array.isArray(tmplElements) && tmplElements.length) {
                    (aboutSlide as any).__data = { companyOverview: (context as any).companyOverview, body: companyAbout };
                    await renderElementsFromTemplate(aboutSlide as any, 'company_about', tmplElements);
                    delete (aboutSlide as any).__data;
                } else {
                    logger.warn('Template elements missing for company_about. Falling back to simple table rendering.');
                    // Fallback to existing simple table approach if template not present
                const titleRuns = toBoldRunsFromMarkdown('会社概要') as any;
                const titleFit = fitTextToLines('会社概要', /*initial*/28, /*min*/20, /*baseWrap*/16, /*lines*/1, /*hard*/22);
                    const bgColor = lightenHex(primary, 70);
                    const textColor = pickTextColorForBackground(bgColor).toString();
                    aboutSlide.addText(titleRuns, { x: marginX, y: 0.6, w: contentW, h: 0.6, fontSize: titleFit.fontSize, bold: true, fontFace: JPN_FONT, color: textColor, fill: { color: bgColor }, line: { color: bgColor, width: 0 } });
                const ov = (context as any).companyOverview as any;
                    const tableX = marginX;
                    const tableY = 1.6;
                    const col1W = Math.min(2.2, contentW * 0.22);
                    const col2W = contentW - col1W;
                    if (ov && typeof ov === 'object') {
                        const pairs: Array<{label: string; value: string}> = [];
                        if (ov.company_name) pairs.push({ label: '会社名', value: String(ov.company_name) });
                        if (ov.address) pairs.push({ label: '所在地', value: String(ov.address) });
                        if (ov.founded) pairs.push({ label: '設立', value: String(ov.founded) });
                        if (ov.representative) pairs.push({ label: '代表者', value: String(ov.representative) });
                        if (ov.vision) pairs.push({ label: 'ビジョン', value: String(ov.vision) });
                        if (Array.isArray(ov.business) && ov.business.length) pairs.push({ label: '事業内容', value: ov.business.join(' / ') });
                        if (ov.homepage) pairs.push({ label: 'HomePage', value: String(ov.homepage) });
                        if (ov.contact) pairs.push({ label: '問い合わせ', value: String(ov.contact) });
                        const baseFill = 'FFFFFF';
                        const altFill = lightenHex(secondary, 110).replace('#','');
                        const rows: any[] = pairs.map((p, idx) => {
                            const isAlt = (idx % 2 === 1);
                            const rowFill = isAlt ? altFill : baseFill;
                            return [
                                { text: p.label, options: { bold: true, color: '333333', fill: { color: rowFill }, fontFace: JPN_FONT, fontSize: 14, valign: 'middle' } },
                                { text: p.value, options: { color: '333333', fill: { color: rowFill }, fontFace: JPN_FONT, fontSize: 14, valign: 'middle' } }
                            ];
                        });
                        const borderColor = lightenHex(primary, 120).replace('#','');
                        aboutSlide.addTable(rows, { x: tableX, y: tableY, w: contentW, colW: [col1W, col2W], border: { type: 'solid', color: borderColor, pt: 1 } as any });
                } else {
                        const text = String(companyAbout || '').replace(/\r?\n/g, '\n');
                        const rows: any[] = [[{ text, options: { fontFace: JPN_FONT, fontSize: 14, color: '333333', valign: 'top' } }]];
                        aboutSlide.addTable(rows, { x: tableX, y: tableY, w: contentW, colW: [contentW] });
                    }
                }
                if (companyLogoPath) {
                    const maxW = 1.2; const maxH = 0.9; const minH = 0.3;
                    const dim = await readImageDimensions(companyLogoPath);
                    const naturalW = Math.max(1, Number(dim?.width) || 1);
                    const naturalH = Math.max(1, Number(dim?.height) || 1);
                    const aspect = naturalW > 0 ? (naturalH / naturalW) : 1;
                    let w = maxW, h = w * aspect;
                    if (h > maxH) { h = maxH; w = h / aspect; }
                    if (h < minH) { h = minH; w = h / aspect; }
                    const x = pageW - marginX - w; const y = pageH - h - 0.25;
                    aboutSlide.addImage({ path: companyLogoPath, x, y, w, h });
                }
                if (companyCopyright) {
                    aboutSlide.addText(companyCopyright, { x: 0.4, y: pageH - 0.35, w: pageW - 0.8, h: 0.3, align: 'center', fontSize: 10, color: '666666', fontFace: JPN_FONT });
                }
                
            } catch (e) {
                logger.warn({ error: e }, 'Failed to add company about slide.');
            }
        }
        // drawInfographic defined earlier; ensure not duplicated here

        // Removed automatic extra slide for raw visual_recipe preview to keep flow simple and avoid duplication
        
        await pres.writeFile({ fileName: filePath });

        // Collect unique image paths to delete (charts + images under temp/public)
        const tempImagesCollected: string[] = [];
                const chartsDir = path.join(config.tempDir, 'charts');
        const imagesDir = path.join(config.tempDir, 'images');
        const publicBase = config.publicDir ? path.resolve(config.publicDir) : null;
        const publicChartsDir = publicBase ? path.join(publicBase, 'temp', 'charts') : null;
        const publicImagesDir = publicBase ? path.join(publicBase, 'temp', 'images') : null;
        for (const slideData of slides as any[]) {
            if (slideData.imagePath) {
                const dir = path.resolve(path.dirname(slideData.imagePath));
                const approvedDirs = [chartsDir, imagesDir, publicChartsDir, publicImagesDir].filter(Boolean).map((d:any)=>path.resolve(String(d)));
                if (approvedDirs.includes(dir)) {
                    imagePathsToDelete.add(slideData.imagePath);
                }
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
                const approvedDirs = [chartsDir, imagesDir, publicChartsDir, publicImagesDir].filter(Boolean).map((d:any)=>path.resolve(String(d)));
                if (approvedDirs.includes(dir)) {
                await fs.unlink(imagePath);
                } else {
                    logger.warn({ imagePath }, 'Skip deletion: not under approved temp dir');
                }
            } catch (unlinkError) {
                logger.warn({ error: unlinkError, imagePath }, 'Could not delete temporary image.');
            }
        }

        // Best-effort: sweep leftover files under temp image/chart directories
        const sweepDirs = [chartsDir, imagesDir, publicChartsDir, publicImagesDir].filter(Boolean) as string[];
        for (const d of sweepDirs) {
            try {
                const resolved = path.resolve(d);
                const entries = await (await import('node:fs/promises')).readdir(resolved, { withFileTypes: true });
                for (const ent of entries) {
                    if (ent.isFile()) {
                        try { await fs.unlink(path.join(resolved, ent.name)); } catch {}
                    }
                }
            } catch {}
        }

        
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