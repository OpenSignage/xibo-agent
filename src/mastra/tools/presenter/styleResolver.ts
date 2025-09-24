/*
 * Copyright (C) 2025 Open Source Digital Signage Initiative.
 *
 * Elastic License 2.0 (ELv2)
 */

/**
 * Lightweight helpers to read visualStyles from template config with sane fallbacks.
 */

export type Json = Record<string, any>;

export function getVisualStyle(templateConfig: Json | undefined, type: string): Json {
  try {
    return (templateConfig?.visualStyles?.[type]) ?? {};
  } catch {
    return {};
  }
}

export function asNumber(v: any, fallback: number): number {
  const n = Number(v);
  return Number.isFinite(n) ? n : fallback;
}

export function asBoolean(v: any, fallback: boolean): boolean {
  if (v === true || v === false) return v;
  if (typeof v === 'string') {
    const s = v.toLowerCase();
    if (s === 'true') return true;
    if (s === 'false') return false;
  }
  return fallback;
}

export function asString(v: any, fallback: string): string {
  const s = typeof v === 'string' ? v : '';
  return s && s.trim() ? s : fallback;
}

export function asAlign(v: any, fallback: 'left'|'right'|'center'): 'left'|'right'|'center' {
  const s = String(v || '').toLowerCase();
  if (s.startsWith('l')) return 'left';
  if (s.startsWith('r')) return 'right';
  if (s.startsWith('c')) return 'center';
  return fallback;
}

export function normalizeHex(input?: string): string | undefined {
  if (!input) return undefined;
  const s = String(input).trim();
  if (!s) return undefined;
  if (/^#?[0-9a-fA-F]{6}$/.test(s)) return s.replace('#','').toUpperCase();
  return undefined;
}

