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
  // #RGB, #RRGGBB, #AARRGGBB
  if (/^#?[0-9a-fA-F]{3}$/.test(s)) {
    const h = s.replace('#', '');
    const r = h[0]; const g = h[1]; const b = h[2];
    return `${r}${r}${g}${g}${b}${b}`.toUpperCase();
  }
  if (/^#?[0-9a-fA-F]{6}$/.test(s)) {
    return s.replace('#', '').toUpperCase();
  }
  if (/^#?[0-9a-fA-F]{8}$/.test(s)) {
    // drop alpha
    const h = s.replace('#', '');
    return h.slice(2).toUpperCase();
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
  // Fallback: return as-is without '#'
  return s.replace('#', '').toUpperCase();
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
  layout: z.enum(['title_slide', 'section_header', 'content_with_visual', 'content_with_bottom_visual', 'content_only', 'quote']).optional().describe('The layout type for the slide.'),
  special_content: z.string().optional().nullable().describe('Special content for layouts like \'quote\'.'),
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
    const primary = typeof tk.primary === 'string' ? tk.primary : (typeof styleTokens.primary === 'string' ? styleTokens.primary : (themeColor1 || '#0B5CAB'));
    const secondary = typeof tk.secondary === 'string' ? tk.secondary : (typeof styleTokens.secondary === 'string' ? styleTokens.secondary : (themeColor2 || '#00B0FF'));
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
        await fs.mkdir(presenterDir, { recursive: true });
        // Ensure charts support by preferring a build that includes Charts
        let Pptx: any = PptxGenJS;
        let chartsBuild: string | null = null;
        const importCandidates = [
          'pptxgenjs/dist/pptxgen.bundle.js',
          'pptxgenjs/dist/pptxgen.bundle.min.js',
          'pptxgenjs/dist/pptxgen.es.js',
        ];
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

        // 1. Define the Master Slide (no static footer; branding handled per-slide)
        pres.defineSlideMaster({
            title: MASTER_SLIDE,
            // Background is now handled on each slide individually
            objects: [
                
            ],
        });

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
        const renderElementsFromTemplate = async (slideObj: any, layoutKey: string, elements: any[]) => {
          if (!Array.isArray(elements) || !elements.length) return;
          for (const el of elements) {
            const areaName = String(el?.area || '');
            if (!areaName) continue;
            const a = (templateConfig?.layouts?.[layoutKey]?.areas || {})[areaName];
            if (!a) continue;
            const ref = typeof a?.ref === 'string' ? a.ref : '';
            const refSize = ref && templateConfig?.geometry?.regionDefs && templateConfig.geometry.regionDefs[ref];
            const w = Number(a?.w) || Number(refSize?.w) || 1;
            const h = Number(a?.h) || Number(refSize?.h) || 1;
            const x = Number(a?.x) || 0;
            const y = Number(a?.y) || 0;
            const styleRefs = Array.isArray(el?.styleRef) ? el.styleRef : (el?.styleRef ? [el.styleRef] : []);
            const styleRefObjs = styleRefs.map((p: string) => getByPath(templateConfig, p)).filter(Boolean);
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
              const textOptions: any = { x, y, w, h, fontFace: String(style?.fontFace || headFont), fontSize: Number(style?.fontSize) || 20, bold: !!style?.bold, color: normalizeColorToPptxHex(style?.color) || '000000', align: style?.align || 'left', valign: style?.valign || 'top', shadow: shadowOf(style?.shadow, shadowPreset) };
              // bullets
              if (style && (style.bullet === true || typeof style.bulletType === 'string')) {
                textOptions.bullet = style.bullet === true ? true : { type: String(style.bulletType) };
                if (style.autoFit !== undefined) textOptions.autoFit = !!style.autoFit; else textOptions.autoFit = true;
              } else if (style && style.autoFit !== undefined) {
                textOptions.autoFit = !!style.autoFit;
              }
              if (Number.isFinite(style?.paraSpaceAfter)) textOptions.paraSpaceAfter = Number(style.paraSpaceAfter);
              // background and outline
              if (style?.fill) textOptions.fill = buildFill(style.fill);
              if (style?.lineColor || Number.isFinite(style?.lineWidth)) textOptions.line = { color: normalizeColorToPptxHex(style?.lineColor) || (normalizeColorToPptxHex(style?.fill) || 'FFFFFF'), width: Number(style?.lineWidth) || 0 };
              slideObj.addText(toBoldRunsFromMarkdown(textVal) as any, textOptions);
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
                const labelFill = normalizeColorToPptxHex(style?.labelFill) || undefined;
                const valueFill = normalizeColorToPptxHex(style?.valueFill) || undefined;
                const labelColor = normalizeColorToPptxHex(style?.labelColor) || 'FFFFFF';
                const valueColor = normalizeColorToPptxHex(style?.valueColor) || '333333';
                const fontSize = Number(style?.fontSize) || 14;
                rows.push(...pairs.map(p => [
                  { text: p.label, options: { bold: style?.labelBold !== false, color: labelColor, fill: labelFill ? { color: labelFill } : undefined, fontFace: JPN_FONT, fontSize, valign: 'middle' } },
                  { text: p.value, options: { color: valueColor, fill: valueFill ? { color: valueFill } : undefined, fontFace: JPN_FONT, fontSize, valign: 'middle' } }
                ]));
              } else {
                const text = data != null ? String(data) : '';
                if (text) rows.push([{ text, options: { fontFace: JPN_FONT, fontSize: Number(style?.fontSize) || 14, color: normalizeColorToPptxHex(style?.color) || '333333', valign: 'top' } }]);
              }
              if (rows.length) {
                const borderColor = normalizeColorToPptxHex(style?.borderColor) || 'E6E6E6';
                const borderWidth = Number(style?.borderWidth) || 1;
                const colW: number[] | undefined = Array.isArray(style?.colW) ? style.colW.map((n: any)=>Number(n)).filter((n: number)=>Number.isFinite(n)) : undefined;
                slideObj.addTable(rows, { x, y, w, h, colW: colW && colW.length ? colW : undefined, border: { type: 'solid', color: borderColor, pt: borderWidth } as any });
              }
              continue;
            }
            if (type === 'visual') {
              const recipe = typeof el?.recipeRef === 'string' ? getByPath((slideObj as any).__data || {}, el.recipeRef) : ((slideObj as any).__data?.visual_recipe);
              // Prevent overlap with reserved bottom branding area
              let vy = y, vh = h;
              const reservedBottom = typeof templateConfig?.branding?.reservedBottom === 'number' ? Math.max(0, templateConfig.branding.reservedBottom) : 0.8;
              if ((vy + vh) > (pageH - reservedBottom)) {
                const minY = contentTopY + 0.7;
                vy = Math.max(minY, (pageH - reservedBottom) - vh);
              }
              // no-op; rely on fallback warnings when needed
              if (recipe && typeof recipe === 'object') {
                await drawInfographic(slideObj, String(recipe.type || ''), recipe, { x, y: vy, w, h: vh });
              } else if ((slideObj as any).__data?.imagePath) {
                slideObj.addImage({ path: (slideObj as any).__data.imagePath, x, y: vy, w, h: vh, sizing: { type: style?.sizing || 'contain', w, h: vh } as any, shadow: shadowOf(style?.shadow, shadowPreset) });
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
                    const cardW = Math.min( (rw - 0.8) / 2, 2.6 );
                    const cardH = Math.min( rh / 2 - 0.2, 1.35 );
                    const gap = 0.4;
                    items.slice(0, 4).forEach((it: any, idx: number) => {
                        const row = Math.floor(idx / 2), col = idx % 2;
                        const x = rx + 0.2 + col * (cardW + gap);
                        const y = ry + 0.2 + row * (cardH + gap);
                        targetSlide.addShape('roundRect', { x, y, w: cardW, h: cardH, fill: { color: secondary }, line: { color: 'FFFFFF', width: 0.5 }, rectRadius: cornerRadius, shadow: shadowOf(resolveVisualShadow('kpi')) });
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
                            const doughnutType = (ChartType && ChartType.doughnut) || ('doughnut' as any);
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
                            targetSlide.addShape('ellipse', { x: cx - r, y: cy - r, w: 2 * r, h: 2 * r, line: { color: '#CCCCCC', width: 2 } });
                            // foreground arc approximation using pie slice (limited API)
                            const wedgeDeg = Math.max(0, Math.min(359.9, (v / 100) * 360));
                            targetSlide.addShape('pie', { x: cx - r, y: cy - r, w: 2 * r, h: 2 * r, fill: { color: i % 2 ? secondary : primary }, angle: wedgeDeg } as any);
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
                        targetSlide.addShape('rect', { x: rx + rw * 0.4, y, w: rw * 0.55, h: barH, fill: { color: '#EEEEEE' }, line: { color: '#DDDDDD', width: 0.5 } });
                        const v = Math.max(0, Math.min(100, Number(it?.value ?? 0)));
                        targetSlide.addShape('rect', { x: rx + rw * 0.4, y, w: (rw * 0.55) * (v / 100), h: barH, fill: { color: primary }, line: { color: primary, width: 0 } });
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
                        targetSlide.addShape('rect', { x: rx + rw * 0.28, y, w: rw * 0.65, h: barH, fill: { color: lightenHex(secondary, 20) }, line: { color: secondary, width: 0.5 } });
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
                    targetSlide.addShape('ellipse', { x: cx1 - r, y: cy - r, w: 2 * r, h: 2 * r, fill: { color: lightenHex(primary, 40) }, line: { color: primary, width: 1 } });
                    targetSlide.addShape('ellipse', { x: cx2 - r, y: cy - r, w: 2 * r, h: 2 * r, fill: { color: lightenHex(secondary, 40) }, line: { color: secondary, width: 1 } });
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
                    items.slice(0, 5).forEach((it: any, i: number) => {
                        const y = ry + i * (rowH + 0.12);
                        targetSlide.addText(String(it?.label ?? ''), { x: rx + 0.1, y, w: rw * 0.25 - 0.1, h: rowH, fontSize: 11, fontFace: JPN_FONT });
                        const baseX = rx + rw * 0.30;
                        targetSlide.addShape('rect', { x: baseX, y, w: rw * 0.58, h: rowH, fill: { color: '#EEEEEE' }, line: { color: '#DDDDDD', width: 0.5 } });
                        const val = Number(it?.value ?? 0), tgt = Number(it?.target ?? 0);
                        const denom = Math.max(1, Math.max(val, tgt, 100));
                        const valW = Math.max(0, Math.min(rw * 0.58, (rw * 0.58) * (val / denom)));
                        const tgtX = baseX + Math.max(0, Math.min(rw * 0.58, (rw * 0.58) * (tgt / denom)));
                        targetSlide.addShape('rect', { x: baseX, y, w: valW, h: rowH, fill: { color: primary }, line: { color: primary, width: 0 } });
                        targetSlide.addShape('line', { x: tgtX, y, w: 0, h: rowH, line: { color: '#333333', width: 2 } });
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
                    items.slice(0, 4).forEach((it: any, i: number) => {
                        const x = rx + (i % 2) * (rw/2) + 0.1;
                        const y = ry + Math.floor(i/2) * (rh/2) + 0.1;
                        const calloutBg = lightenHex(secondary, 60);
                        targetSlide.addShape('rect', { x, y, w: rw/2 - 0.2, h: rh/2 - 0.2, fill: { color: calloutBg }, line: { color: secondary, width: 0.5 }, shadow: shadowOf(resolveVisualShadow('callouts')) });
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
                        targetSlide.addShape('roundRect', { x, y, w: cardW, h: cardH, fill: { color: secondary }, line: { color: 'FFFFFF', width: 0.5 }, rectRadius: cornerRadius, shadow: shadowOf(resolveVisualShadow('kpi')) });
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
                        targetSlide.addShape('ellipse', { x: rx, y: y + (lineH - bulletW)/2, w: bulletW, h: bulletW, fill: { color: accent }, line: { color: 'FFFFFF', width: 0.5 } });
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
                        if (headers && headers.length) {
                            tableRows.push(headers.map(h => ({ text: String(h), options: { bold: true, fontFace: JPN_FONT, fontSize: 12, align: 'center' } })));
                        }
                        for (const r of rows2d) {
                            tableRows.push(r.map(cell => ({ text: String(cell), options: { fontFace: JPN_FONT, fontSize: 12 } })));
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
                        targetSlide.addShape('trapezoid', { x: startX + (topW - tW)/2, y, w: tW, h: height / layers - 0.04, fill: { color: i % 2 ? secondary : primary }, line: { color: outlineColor, width: 0.5 }, shadow: shadowOf(resolveVisualShadow('funnel')) } as any);
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
                            targetSlide.addShape('rect', { x, y, w: stepW, h: stepH, fill: { color: primary }, line: { color: outlineColor, width: 0.5 }, shadow: shadowOf(resolveVisualShadow('process')) });
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
                        targetSlide.addShape('ellipse', { x: cx - 0.08, y: startY - 0.08, w: 0.16, h: 0.16, fill: { color: accent }, line: { color: outlineColor, width: 0.8 } });
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
                    targetSlide.addShape('rect', { x: leftX, y, w: boxW, h: boxH, fill: { color: primary }, line: { color: outlineColor, width: 0.5 }, shadow: shadowOf(resolveVisualShadow('comparison')) });
                    targetSlide.addShape('rect', { x: rightX, y, w: boxW, h: boxH, fill: { color: secondary }, line: { color: outlineColor, width: 0.5 }, shadow: shadowOf(resolveVisualShadow('comparison')) });
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
                    try {
                    const steps = Array.isArray(payload?.steps) ? payload.steps : [];
                    const startX = rx;
                    const startY = ry + rh * 0.4;
                    const totalW = rw;
                    const segW = totalW / Math.max(1, steps.length);
                        targetSlide.addShape('line', { x: startX, y: startY, w: totalW, h: 0, line: { color: outlineColor, width: 1.2 } });
                    steps.slice(0, 6).forEach((s: any, i: number) => {
                        const cx = startX + i * segW + segW / 2;
                            
                            targetSlide.addShape('ellipse', { x: cx - 0.08, y: startY - 0.08, w: 0.16, h: 0.16, fill: { color: accent }, line: { color: outlineColor, width: 0.8 } });
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
            const slide = pres.addSlide({ masterName: MASTER_SLIDE });
            let visualRendered = false;

            // Background: prioritize title image; otherwise themed flat color.
            if (index === 0) {
                if (titleSlideImagePath) {
                    try {
                        await fs.access(titleSlideImagePath);
                        slide.background = { path: titleSlideImagePath };
                        
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
                            try { imagePathsToDelete.add(out.path); } catch {}
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
            const titleTextShadowValue: any = templateConfig?.components?.title?.shadow;
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

            switch (layout) {
                case 'title_slide':
                    // Render centered title only (no global title bar)
                    {
                        const tmplElements = templateConfig?.layouts?.title_slide?.elements;
                        if (Array.isArray(tmplElements) && tmplElements.length) {
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
                            // Provide slide data to renderer
                            (slide as any).__data = { title: slideData.title, bullets: slideData.bullets, visual_recipe: perSlideRecipeHere, imagePath: slideData.imagePath };
                            await renderElementsFromTemplate(slide as any, 'content_with_visual', tmplElements);
                            // If template doesn't include a visual element, fallback to recipe/image region
                            const hasVisualEl = Array.isArray(tmplElements) && tmplElements.some((e: any) => String(e?.type) === 'visual');
                            if (hasVisualEl) { visualRendered = true; }
                            if (!hasVisualEl) {
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
                            delete (slide as any).__data;
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
                    const bulletTextCv = cleanedBulletsCv.join('\n');
                        slide.addText(toBoldRunsFromMarkdown(bulletTextCv) as any, { x: bArea.x, y: bArea.y, w: bArea.w, h: bArea.h, fontSize: 18, bullet: { type: 'bullet' }, fontFace: bodyFont, valign: 'top', paraSpaceAfter: 12, autoFit: true, fill: bulletsBg ? buildFill(bulletsBg) : undefined, line: bulletsBg ? { color: normalizeColorToPptxHex(bulletsBg) || 'FFFFFF', width: 0 } : undefined, shadow: shadowOf(bulletsShadowValue, shadowPreset) });
                    }
                    if (!isBottomVisual && slideData.imagePath) {
                        const vArea = resolveArea('visual', twoColVisualX, contentTopY + 0.6, twoColVisualW, 3.4);
                        slide.addImage({ path: slideData.imagePath, x: vArea.x, y: vArea.y, w: vArea.w, h: vArea.h, sizing: { type: 'contain', w: vArea.w, h: vArea.h } as any, shadow: shadowOf(resolveVisualShadow('image')) });
                    }
                    break;
                case 'content_with_bottom_visual':
                    {
                        const tmplElements = templateConfig?.layouts?.content_with_bottom_visual?.elements;
                        if (Array.isArray(tmplElements) && tmplElements.length) {
                            (slide as any).__data = { title: slideData.title, bullets: slideData.bullets, visual_recipe: perSlideRecipeHere, imagePath: slideData.imagePath };
                            await renderElementsFromTemplate(slide as any, 'content_with_bottom_visual', tmplElements);
                            // Fallback render if no visual element present
                            const hasVisualEl = Array.isArray(tmplElements) && tmplElements.some((e: any) => String(e?.type) === 'visual');
                            if (hasVisualEl) { visualRendered = true; }
                            if (!hasVisualEl) {
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
                        const bulletText = cleanedBullets.join('\n');
                        slide.addText(toBoldRunsFromMarkdown(bulletText) as any, { x: bArea.x, y: bArea.y, w: bArea.w, h: bArea.h, fontSize: 20, bullet: { type: 'bullet' }, align: 'left', fontFace: bodyFont, valign: 'top', paraSpaceAfter: 12, color: bgTextColor, autoFit: true, fill: bulletsBg ? buildFill(bulletsBg) : undefined, line: bulletsBg ? { color: normalizeColorToPptxHex(bulletsBg) || 'FFFFFF', width: 0 } : undefined, shadow: shadowOf(bulletsShadowValue, shadowPreset) });
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
                case 'content_only':
                default:
                    {
                        const tmplElements = templateConfig?.layouts?.content_only?.elements;
                        const hasTemplate = Array.isArray(tmplElements) && tmplElements.length > 0;
                        if (hasTemplate) {
                            (slide as any).__data = { title: slideData.title, bullets: slideData.bullets, visual_recipe: perSlideRecipeHere, imagePath: slideData.imagePath };
                            await renderElementsFromTemplate(slide as any, 'content_only', tmplElements);
                            // If template doesn't include visual, we may still render recipe via fallback below (guarded later)
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
                    const bulletTextCo = cleanedBulletsCo.join('\n');
                    // Shift text down to avoid overlapping title
                    const textYContentOnly = contentTopY + 0.5;
                    const textHContentOnly = 4.0;
                    if (perSlideRecipeHere) {
                        // If the recipe is of bottom-band type, use full-width text
                        if (isBottomVisual) {
                            slide.addText(toBoldRunsFromMarkdown(bulletTextCo) as any, { x: twoColTextX, y: textYContentOnly, w: contentW, h: textHContentOnly, fontSize: 20, bullet: { type: 'bullet' }, align: 'left', fontFace: bodyFont, valign: 'top', paraSpaceAfter: 12, color: bgTextColor, autoFit: true, fill: bulletsBg ? buildFill(bulletsBg) : undefined, line: bulletsBg ? { color: normalizeColorToPptxHex(bulletsBg) || 'FFFFFF', width: 0 } : undefined, shadow: shadowOf(bulletsShadowValue, shadowPreset) });
                        } else {
                            // Right-panel recipe → two-column
                            slide.addText(toBoldRunsFromMarkdown(bulletTextCo) as any, { x: twoColTextX, y: textYContentOnly, w: twoColTextW, h: twoColTextH, fontSize: 20, bullet: { type: 'bullet' }, align: 'left', fontFace: bodyFont, valign: 'top', paraSpaceAfter: 12, color: bgTextColor, autoFit: true, fill: bulletsBg ? buildFill(bulletsBg) : undefined, line: bulletsBg ? { color: normalizeColorToPptxHex(bulletsBg) || 'FFFFFF', width: 0 } : undefined, shadow: shadowOf(bulletsShadowValue, shadowPreset) });
                        }
                    } else {
                        // No recipe → full-width text
                        slide.addText(toBoldRunsFromMarkdown(bulletTextCo) as any, { x: twoColTextX, y: textYContentOnly, w: contentW, h: textHContentOnly, fontSize: 20, bullet: { type: 'bullet' }, align: 'left', fontFace: bodyFont, valign: 'top', paraSpaceAfter: 12, color: bgTextColor, autoFit: true, fill: bulletsBg ? buildFill(bulletsBg) : undefined, line: bulletsBg ? { color: normalizeColorToPptxHex(bulletsBg) || 'FFFFFF', width: 0 } : undefined, shadow: shadowOf(bulletsShadowValue, shadowPreset) });
                    }
                    break;
            }

            // If a per-slide visual recipe exists, render it in a right panel (for content_* only)
            if (perSlideRecipeHere && (layout === 'content_with_visual' || layout === 'content_only') && !visualRendered) {
                // place process/roadmap/gantt/timeline at bottom band, others to right panel
                const typeStr = String(perSlideRecipeHere.type || '');
                const isBottom = isBottomVisual || typeStr === 'gantt' || typeStr === 'timeline';
                // If an image chart exists on the right panel for content_with_visual,
                // move recipe to bottom band to avoid overlap.
                const hasImageForSlide = !!(slideData as any).imagePath;
                const forceBottomForRecipe = (layout === 'content_with_visual') && hasImageForSlide;
                // Right panel and bottom band regions (absolute, 16:9)
                // For content_only, place band under bullets area to avoid overlap
                const bulletsBottomY = contentTopY + 0.5 + 2.4; // adjusted to avoid overlap with bottom band
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
                drawInfographic(slide as any, String(perSlideRecipeHere.type || ''), perSlideRecipeHere, region);
            }
            // Add per-slide copyright if provided
            if (typeof templateConfig?.branding?.copyright === 'string' && templateConfig.branding.copyright) {
                try {
                    slide.addText(String(templateConfig.branding.copyright), { x: 0.4, y: pageH - 0.35, w: pageW - 0.8, h: 0.3, align: 'center', fontSize: 10, color: '666666', fontFace: bodyFont });
                } catch {}
            } else if (companyCopyright) {
                try {
                    slide.addText(companyCopyright, { x: 0.4, y: pageH - 0.35, w: pageW - 0.8, h: 0.3, align: 'center', fontSize: 10, color: '666666', fontFace: bodyFont });
                    appliedCopyrightCount++;
                } catch (e) {
                    logger.warn({ error: e }, 'Failed to add copyright text on a slide.');
                }
            }
        }
        logger.info({ appliedLogoCount, appliedCopyrightCount }, 'Applied branding to slides.');
        
        // Optional charts diagnostics slide (enabled via templateConfig.debug.chartsDiagnostics === true)
        try {
            if ((templateConfig?.debug?.chartsDiagnostics) === true) {
                const diag = pres.addSlide({ masterName: MASTER_SLIDE });
                diag.background = { color: lightenHex(secondary, 90).replace('#','') } as any;
                diag.addText('Charts Diagnostics', { x: 0.8, y: 0.4, w: pageW - 1.6, h: 0.5, fontSize: 20, bold: true, fontFace: JPN_FONT });
                const hasAddChart = typeof (diag as any).addChart === 'function';
                const sampleLabels = ['A','B','C','D'];
                const sampleData = [{ name: 'Series', labels: sampleLabels, values: [10, 20, 15, 25] }];
                try {
                    (diag as any).addChart(((ChartType && ChartType.bar) || 'bar') as any, sampleData, { x: 0.8, y: 1.0, w: 5.8, h: 2.5 } as any);
                    (diag as any).addChart(((ChartType && ChartType.line) || 'line') as any, sampleData, { x: 6.8, y: 1.0, w: 5.8, h: 2.5 } as any);
                    (diag as any).addChart(((ChartType && ChartType.pie) || 'pie') as any, [{ name: 'Share', labels: sampleLabels, values: [40,30,20,10] }], { x: 0.8, y: 3.8, w: 5.8, h: 2.5 } as any);
                    
                } catch (e) {
                    logger.warn({ error: e }, 'Charts diagnostics: addChart failed, adding fallback markers.');
                    diag.addText('addChart failed in diagnostics', { x: 0.8, y: 1.0, w: pageW - 1.6, h: 0.3, fontSize: 12, fontFace: JPN_FONT });
                }
            }
        } catch {}

        // Add company about slide at the end if available (render using pptxgenjs table)
        if (companyAbout || (context as any).companyOverview) {
            try {
                const aboutSlide = pres.addSlide({ masterName: MASTER_SLIDE });
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
                        const rows: any[] = pairs.map(p => [
                            { text: p.label, options: { bold: true, color: 'FFFFFF', fill: { color: lightenHex(primary, 60).replace('#','') }, fontFace: JPN_FONT, fontSize: 14, valign: 'middle' } },
                            { text: p.value, options: { color: '333333', fill: { color: 'FFFFFF' }, fontFace: JPN_FONT, fontSize: 14, valign: 'middle' } }
                        ]);
                        aboutSlide.addTable(rows, { x: tableX, y: tableY, w: contentW, colW: [col1W, col2W], border: { type: 'solid', color: 'E6E6E6', pt: 1 } as any });
                } else {
                        const text = String(companyAbout || '').replace(/\r?\n/g, '\n');
                        const rows: any[] = [[{ text, options: { fontFace: JPN_FONT, fontSize: 14, color: '333333', valign: 'top' } }]];
                        aboutSlide.addTable(rows, { x: tableX, y: tableY, w: contentW, colW: [contentW] });
                    }
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
                
            } catch (e) {
                logger.warn({ error: e }, 'Failed to add company about slide.');
            }
        }
        // drawInfographic defined earlier; ensure not duplicated here

        // Try to render visual_recipe if supplied in slide payload
        for (const s of slides as any[]) {
            const recipe = (s as any).visual_recipe;
            if (recipe && typeof recipe === 'object') {
                try {
                const infoSlide = pres.addSlide({ masterName: MASTER_SLIDE });
                infoSlide.background = { color: secondary.replace('#', '') } as any;
                if (recipe.type) {
                    drawInfographic(infoSlide, String(recipe.type), recipe);
                    }
                } catch (e) {
                    logger.warn({ error: e }, 'Skipped visual_recipe slide due to rendering error.');
                }
            }
        }
        
        await pres.writeFile({ fileName: filePath });

        // Collect unique image paths to delete (charts + images under temp/public)
        const tempImagesCollected: string[] = [];
        const chartsDir = path.join(config.tempDir, 'charts');
        const imagesDir = path.join(config.tempDir, 'images');
        const publicChartsDir = path.join(config.publicDir || path.join(path.dirname(config.tempDir), 'public'), 'charts');
        const publicImagesDir = path.join(config.publicDir || path.join(path.dirname(config.tempDir), 'public'), 'temp', 'images');
        for (const slideData of slides as any[]) {
            if (slideData.imagePath) {
                const dir = path.resolve(path.dirname(slideData.imagePath));
                if (
                  dir === path.resolve(chartsDir) ||
                  dir === path.resolve(imagesDir) ||
                  dir === path.resolve(publicChartsDir) ||
                  dir === path.resolve(publicImagesDir)
                ) {
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
                if (dir === path.resolve(chartsDir) || dir === path.resolve(imagesDir) || dir === path.resolve(publicChartsDir) || dir === path.resolve(publicImagesDir)) {
                    await fs.unlink(imagePath);
                } else {
                    logger.warn({ imagePath }, 'Skip deletion: not under approved temp dir');
                }
            } catch (unlinkError) {
                logger.warn({ error: unlinkError, imagePath }, 'Could not delete temporary image.');
            }
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