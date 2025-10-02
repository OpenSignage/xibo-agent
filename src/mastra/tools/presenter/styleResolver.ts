/*
 * Copyright (C) 2025 Open Source Digital Signage Initiative.
 *
 * You can redistribute it and/or modify
 * it under the terms of the Elastic License 2.0 (ELv2) as published by
 * the Search AI Company, either version 3 of the License, or
 * any later version.
 *
 * You should have received a copy of the Elastic License 2.0 (ELv2).
 * see <https://www.elastic.co/licensing/elastic-license>.
 */

/**
 * Lightweight helpers to read `visualStyles` from a template config with sane fallbacks.
 * All access is defensive to avoid throwing when a key is missing.
 */

export type Json = Record<string, any>;

/**
 * Safely get a visual style object by `type` from template config.
 * @param templateConfig Template JSON (may be undefined)
 * @param type           Visual type key (e.g., 'gantt', 'timeline')
 * @returns style object or empty object when absent
 */
export function getVisualStyle(templateConfig: Json | undefined, type: string): Json {
  try {
    return (templateConfig?.visualStyles?.[type]) ?? {};
  } catch {
    return {};
  }
}

/** Convert to number with fallback when not finite. */
export function asNumber(v: any, fallback: number): number {
  const n = Number(v);
  return Number.isFinite(n) ? n : fallback;
}

/** Convert typical truthy strings ("true"/"false") to boolean with fallback. */
export function asBoolean(v: any, fallback: boolean): boolean {
  if (v === true || v === false) return v;
  if (typeof v === 'string') {
    const s = v.toLowerCase();
    if (s === 'true') return true;
    if (s === 'false') return false;
  }
  return fallback;
}

/** Return trimmed string or fallback when empty/undefined. */
export function asString(v: any, fallback: string): string {
  const s = typeof v === 'string' ? v : '';
  return s && s.trim() ? s : fallback;
}

/** Normalize alignment strings to 'left' | 'right' | 'center'. */
export function asAlign(v: any, fallback: 'left'|'right'|'center'): 'left'|'right'|'center' {
  const s = String(v || '').toLowerCase();
  if (s.startsWith('l')) return 'left';
  if (s.startsWith('r')) return 'right';
  if (s.startsWith('c')) return 'center';
  return fallback;
}

/** Validate and normalize HEX color to 6-digit uppercase (without #). */
export function normalizeHex(input?: string): string | undefined {
  if (!input) return undefined;
  const s = String(input).trim();
  if (!s) return undefined;
  if (/^#?[0-9a-fA-F]{6}$/.test(s)) return s.replace('#','').toUpperCase();
  return undefined;
}

