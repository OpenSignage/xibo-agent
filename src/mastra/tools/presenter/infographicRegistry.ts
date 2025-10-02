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
 * Module: infographicRegistry
 * Summary:
 *   Central registry of code-driven infographic renderers (gantt, timeline, heatmap, etc.).
 *   Each renderer reads visual styles from the template (`visualStyles.*`) and draws directly
 *   to the pptxgenjs slide.
 * Notes:
 *   - Keep renderers stateless; derive everything from `payload`, `region`, and `templateConfig`.
 *   - Favor small helper functions and clear variable names for maintainability.
 */

import { getVisualStyle, asNumber, asBoolean, asAlign, normalizeHex, asString } from './styleResolver';
import { logger } from '../../logger';

export type RenderRegion = { x: number; y: number; w: number; h: number };

export type Renderer = (args: {
  slide: any;
  type: string;
  payload: any;
  region: RenderRegion;
  templateConfig: any;
  helpers: {
    pickTextColorForBackground: (hex: string)=>string;
    getPaletteColor: (i: number)=>string;
  }
}) => Promise<boolean> | boolean;

const registry: Record<string, Renderer> = Object.create(null);

/**
 * Register a renderer function for a given infographic `type`.
 * Renderers should be pure (derive everything from args) and return `true`
 * when they handled drawing, or `false` when they prefer fallback.
 */
export function register(type: string, renderer: Renderer) {
  registry[type] = renderer;
}

/**
 * Dispatch drawing to a previously registered renderer.
 * @returns true if a renderer exists and handled the request; false otherwise.
 */
export async function render(args: Parameters<Renderer>[0]): Promise<boolean> {
  const r = registry[args.type];
  try { logger.debug({ type: args.type }, 'infographicRegistry.render dispatch'); } catch {}
  if (!r) return false;
  return await r(args);
}

// --- Shared helpers (label width / padding estimators) ---
function estimateEffectiveTextLength(text: string): number {
  // Full-width chars ~1.0, half-width (ASCIIなど) ~0.5
  let eff = 0; for (const ch of String(text || '')) eff += (/[^\u0000-\u00FF]/.test(ch) ? 1 : 0.5);
  return eff;
}

function computeMaxEffectiveLength(labels: string[]): number {
  let maxEff = 0; for (const s of (labels || [])) maxEff = Math.max(maxEff, estimateEffectiveTextLength(s));
  return maxEff;
}

// 共通: ラベル列から左パディングを算出（heatmap等）
function computeDynamicPadLeft(labels: string[], basePadIn: number, fontPt: number, options?: { fudge?: number; extra?: number; maxRatio?: number; containerW?: number }): number {
  const fudge = Number(options?.fudge) || 1.15;
  const approxCharIn = 0.14 * (fontPt / 10); // full-width char width (in)
  const extra = Number(options?.extra) || 0.3; // 左の余白
  const maxEff = computeMaxEffectiveLength(labels);
  const proposed = maxEff * approxCharIn * fudge + extra;
  const base = Math.max(0, Number(basePadIn) || 0);
  const raw = Math.max(base, proposed);
  if (options?.containerW && options?.maxRatio) {
    const cap = Math.max(0.1, options.containerW * options.maxRatio);
    return Math.min(raw, cap);
  }
  return raw;
}

// 共通: ラベル列の左カラム幅（in）を算出
function computeLabelColumnWidth(labels: string[], fontPt: number, containerW: number, opts?: { minRatio?: number; maxRatio?: number; fudge?: number; pad?: number; minIn?: number; fontFace?: string; dpi?: number }): number {
  const fudge = Number(opts?.fudge) || 1.00;         // 余裕最小限
  const pad = Number(opts?.pad) || 0.04;             // サイドパディング極小
  const minRatio = Number(opts?.minRatio) || 0;      // 0 なら比率下限を適用しない
  const maxRatio = Number(opts?.maxRatio) || 0.25;   // 上限比率（狭め）
  const minIn = Number(opts?.minIn) || 0.12;         // 絶対最小（さらにタイト）
  const fontFace = String(opts?.fontFace || 'Noto Sans JP');
  const dpi = Number(opts?.dpi) || 96;
  let maxW = 0;
  // Try high-precision width via node-canvas when available
  let measured = false;
  try {
    // Dynamic require per project guideline
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const { createCanvas } = require('canvas');
    const ctx = createCanvas(10, 10).getContext('2d');
    ctx.font = `${fontPt}px ${fontFace}`;
    for (const s of (labels || [])) {
      const m = ctx.measureText(String(s || ''));
      const wIn = (Number(m?.width) || 0) / dpi;
      if (wIn > maxW) maxW = wIn;
    }
    measured = true;
  } catch {}
  if (!measured) {
    // Fallback heuristic tuned for JP: full-width≈0.60em, half-width≈0.35em, space≈0.20em
    const heightIn = Math.max(0, fontPt) / 72;
    const widthHalf = heightIn * 0.35;
    const widthFull = heightIn * 0.60;
    const widthSpace = heightIn * 0.20;
    for (const s of (labels || [])) {
      let w = 0;
      for (const ch of String(s || '')) {
        const code = ch.codePointAt(0) || 0;
        // Basic half-width detection
        const isHalf = (code <= 0x007F) || (code >= 0xFF61 && code <= 0xFF9F);
        if (ch === ' ') w += widthSpace; else w += isHalf ? widthHalf : widthFull;
      }
      if (w > maxW) maxW = w;
    }
  }
  const proposed = maxW * fudge + pad;
  const floorByRatio = (minRatio > 0) ? Math.max(minIn, containerW * minRatio) : minIn;
  const capByRatio = Math.max(minIn, containerW * maxRatio);
  return Math.min(Math.max(floorByRatio, proposed), capByRatio);
}

// 共通: プログレス等のラベル領域幅を算出
function computeLabelAreaWidth(labels: string[], fontPt: number, gapIn: number, containerW: number, options?: { min?: number; maxRatio?: number; fudge?: number }): number {
  const minW = Number(options?.min) || 0.8;
  const maxRatio = Number(options?.maxRatio) || 0.62;
  const fudge = Number(options?.fudge) || 1.25;
  const approxCharIn = 0.14 * (fontPt / 10);
  const maxEff = computeMaxEffectiveLength(labels);
  const estimated = maxEff * approxCharIn * fudge + (gapIn || 0);
  return Math.max(minW, Math.min(containerW * maxRatio, estimated));
}

function parseNumeric(value: any): number {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  const s = String(value ?? '').trim();
  if (!s) return 0;
  const m = s.replace(/[^0-9+\-.]/g, '');
  const n = Number(m);
  return Number.isFinite(n) ? n : 0;
}

// --- Local helpers ---
function parseColorWithAlpha(input?: any): { hex: string; alpha: number } | null {
  if (!input) return null;
  const s = String(input).trim();
  if (!s) return null;
  // #RRGGBBAA
  if (/^#?[0-9a-fA-F]{8}$/.test(s)) {
    const h = s.replace('#','');
    const rgb = h.slice(0,6).toUpperCase();
    const aa = h.slice(6,8);
    const alpha = Math.max(0, Math.min(255, parseInt(aa,16))) / 255;
    return { hex: rgb, alpha };
  }
  // #RRGGBB
  if (/^#?[0-9a-fA-F]{6}$/.test(s)) {
    return { hex: s.replace('#','').toUpperCase(), alpha: 1 };
  }
  // rgba(r,g,b,a)
  const m = s.match(/^rgba?\(\s*(\d{1,3})\s*,\s*(\d{1,3})\s*,\s*(\d{1,3})(?:\s*,\s*(0|1|0?\.\d+))?\s*\)$/i);
  if (m) {
    const toHex = (n: number) => Math.max(0, Math.min(255, n)).toString(16).padStart(2,'0').toUpperCase();
    const r = toHex(parseInt(m[1],10));
    const g = toHex(parseInt(m[2],10));
    const b = toHex(parseInt(m[3],10));
    const a = m[4] !== undefined ? Math.max(0, Math.min(1, parseFloat(m[4]))) : 1;
    return { hex: `${r}${g}${b}`, alpha: a };
  }
  return null;
}

// --- Built-in renderers (bullet, waterfall, venn2) ---

register('bullet', ({ slide, payload, region, templateConfig, helpers }) => {
  const rx = region.x, ry = region.y, rw = region.w, rh = region.h;
  const items = Array.isArray(payload?.items) ? payload.items : [];
  const rowH = Math.min(0.45, rh / Math.max(1, items.length) - 0.08);
  const style = getVisualStyle(templateConfig, 'bullet');
  const labelFs = Number(style.labelFontSize);
  const labelAlign = asAlign(style.labelAlign, 'right');
  const valueFs = Number(style.valueFontSize);
  const targetFs = Number(style.targetFontSize);
  const valueBoxW = Number(style.valueBoxWidth);
  const valueOutsidePad = Number(style.valueOutsidePad);
  const targetOffsetY = Number(style.targetOffsetY);
  const valueTextColorOverride = normalizeHex(style.valueTextColor);
  if (![labelFs, valueFs, targetFs, valueBoxW, valueOutsidePad, targetOffsetY].every(Number.isFinite)) {
    try { console.warn('bullet: missing required style numbers in template (default.json should define all)'); } catch {}
    return false;
  }
  // 可変ラベル幅: progress と同様に最長ラベル長から見積り
  const estLabelW = computeLabelAreaWidth(items.map((it:any)=>String(it?.label ?? '')), labelFs, 0.08, rw, { min: 0.8, maxRatio: 0.62, fudge: 1.25 });
  const labelW = estLabelW;
  const barAreaX = rx + labelW;
  const barAreaW = Math.max(0.6, rw - labelW);
  items.slice(0, 5).forEach((it: any, i: number) => {
    const y = ry + i * (rowH + 0.12);
    slide.addText(String(it?.label ?? ''), { x: rx + 0.1, y, w: labelW - 0.1, h: rowH, fontSize: labelFs as number, fontFace: 'Noto Sans JP', align: labelAlign, valign: 'middle', fit: 'resize', wrap: false });
    const baseX = barAreaX;
    // Background bar only if style provided
    const barBg = normalizeHex(style.barBgColor);
    const barBorder = normalizeHex(style.barBorderColor);
    if (barBg || barBorder) {
      slide.addShape('rect', { x: baseX, y, w: barAreaW, h: rowH, fill: barBg ? { color: barBg } : undefined, line: (barBorder ? { color: barBorder, width: Number(style.barBorderWidth) || 0.5 } : { width: 0 }) });
    }
    const val = Number(it?.value ?? 0), tgt = Number(it?.target ?? 0);
    const denom = Math.max(1, Math.max(val, tgt, 100));
    const valW = Math.max(0, Math.min(barAreaW, barAreaW * (val / denom)));
    const tgtX = baseX + Math.max(0, Math.min(barAreaW, barAreaW * (tgt / denom)));
    const barHex = helpers.getPaletteColor(i).replace('#','');
    slide.addShape('rect', { x: baseX, y, w: valW, h: rowH, fill: { color: barHex }, line: { color: barHex, width: 0 } });
    const tgtLineColor = normalizeHex(style.targetLineColor);
    const tgtLineWidth = Number(style.targetLineWidth);
    if (tgtLineColor && Number.isFinite(tgtLineWidth)) {
      slide.addShape('line', { x: tgtX, y, w: 0, h: rowH, line: { color: tgtLineColor, width: tgtLineWidth } });
    }
    const valueLabel = `${val}`; const targetLabel = `${tgt}`;
    const textColor = (valueTextColorOverride || helpers.pickTextColorForBackground(`#${barHex}`));
    if (valW > (valueBoxW as number)) {
      slide.addText(valueLabel, { x: baseX + Math.max(0, valW - (valueBoxW as number)), y, w: valueBoxW as number, h: rowH, fontSize: valueFs as number, fontFace: 'Noto Sans JP', color: textColor, align: 'right', valign: 'middle', fit: 'resize', wrap: false });
    } else {
      slide.addText(valueLabel, { x: baseX + valW + (valueOutsidePad as number), y, w: valueBoxW as number, h: rowH, fontSize: valueFs as number, fontFace: 'Noto Sans JP', color: '#333333', align: 'left', valign: 'middle', fit: 'resize', wrap: false });
    }
    // Target text INSIDE bar area near the right side of target marker
    const tgtTextW = Math.max(0.36, valueBoxW as number);
    // Place inside bar near the right side of target marker, left-aligned
    const tgtTextX = Math.min(baseX + barAreaW - tgtTextW, Math.max(baseX + 0.04, tgtX + 0.04));
    slide.addText(targetLabel, { x: tgtTextX, y, w: tgtTextW, h: rowH, fontSize: targetFs as number, fontFace: 'Noto Sans JP', color: '#333333', align: 'left', valign: 'middle', fit: 'resize', wrap: false });
  });
  return true;
});

register('waterfall', ({ slide, payload, region, templateConfig, helpers }) => {
  // Prepare base box; margins will be computed dynamically from label widths
  const baseX = region.x, ry = region.y, baseW = region.w, rh = region.h;
  let rx = baseX; let rw = baseW; let innerLeft = 0.6; const innerRight = 0.4;
  const items = Array.isArray(payload?.items) ? payload.items : [];
  const st = getVisualStyle(templateConfig, 'waterfall');
  const maxItems = Number((st as any).maxItems);
  const sliced = Number.isFinite(maxItems) && maxItems > 0 ? items.slice(0, maxItems) : items;
  const count = Math.max(1, sliced.length);
  const gap = 0.2; const totalGap = gap * Math.max(0, count - 1);
  let barW = 0; // will be computed after margins are known
  // Build cumulative series starting at 0
  const cum: number[] = [0];
  const steps: Array<{ start: number; end: number; v: number; label: string; isTotal: boolean }>=[];
  for (let i = 0; i < sliced.length; i++) {
    const it: any = sliced[i] || {};
    const start = cum[cum.length - 1];
    const isTotal = it.isTotal === true || it.setAsTotal === true || String(it.type || '').toLowerCase() === 'total';
    let end: number;
    if (isTotal) {
      const totalVal = Number(it.total ?? it.delta ?? 0);
      end = totalVal;
    } else {
      const deltaVal = Number(it.delta || 0);
      end = start + deltaVal;
    }
    steps.push({ start, end, v: end - start, label: String(it?.label ?? ''), isTotal });
    cum.push(end);
  }
  const minCum = Math.min(...cum, 0);
  const maxCum = Math.max(...cum, 0);
  const margin = Math.min(0.2, rh * 0.08);
  const usableH = Math.max(0.4, rh - 2 * margin);
  const span = Math.max(1, maxCum - minCum);
  const yFor = (c: number) => ry + margin + (maxCum - c) * (usableH / span);
  const yZero = yFor(0);
  // Optional grid and baseline at cum=0 + y-axis/labels
  {
    const gridColor = normalizeHex(st.gridColor) || '9AA3AF';
    const gridWidth = Number(st.gridWidth);
    const levels = Number(st.gridLevels);
    const labelFs = Number(st.labelFontSize) || 10;
    const labelCol = normalizeHex(st.labelTextColor) || '333333';
    // First compute tick positions to estimate needed label width
    let ticks: number[] = [];
    if (st.grid === true) {
      // nice tick step: 1/2/5 * 10^k, targeting <= levels (fallback 5)
      const targetTicks = Number.isFinite(levels) && levels >= 2 ? levels : 5;
      const rawStep = span / Math.max(2, targetTicks - 1);
      const mag = Math.pow(10, Math.floor(Math.log10(rawStep)));
      const norm = rawStep / mag;
      let nice;
      if (norm <= 1) nice = 1;
      else if (norm <= 2) nice = 2;
      else if (norm <= 5) nice = 5;
      else nice = 10;
      const step = nice * mag;
      const startTick = Math.floor(minCum / step) * step;
      const endTick = Math.ceil(maxCum / step) * step;
      for (let c = startTick; c <= endTick + 1e-6; c += step) ticks.push(c);
    }
    // Estimate max label width (rough char width scaling with font size)
    const approxCharInch = 0.07 * (labelFs / 10);
    let maxLabelW = 0.45;
    for (const v of ticks) {
      const s = String(Math.round(v));
      maxLabelW = Math.max(maxLabelW, s.length * approxCharInch + 0.18);
    }
    innerLeft = Math.min(1.8, Math.max(0.8, maxLabelW + 0.2));
    rx = baseX + innerLeft; rw = Math.max(0.6, baseW - innerLeft - innerRight);
    if (st.grid === true) {
      for (const c of ticks) {
        const y = yFor(c);
        slide.addShape('line', { x: rx, y, w: rw, h: 0, line: { color: `#${gridColor}`, width: Number.isFinite(gridWidth) ? gridWidth : 1 } });
        // tick labels in reserved left area within the region
        const labW = Math.max(0.55, innerLeft - 0.10);
        slide.addText(String(Math.round(c)), { x: rx - labW - 0.06, y: Math.max(ry, y - 0.13), w: labW, h: 0.3, fontSize: labelFs, align: 'right', fontFace: 'Noto Sans JP', color: `#${labelCol}` });
      }
    }
    // baseline at 0
    slide.addShape('line', { x: rx, y: yZero, w: rw, h: 0, line: { color: `#${gridColor}`, width: (Number.isFinite(gridWidth) ? gridWidth : 1) + 0.4 } });
    // y-axis
    slide.addShape('line', { x: rx, y: ry + margin, w: 0, h: usableH, line: { color: `#${gridColor}`, width: (Number.isFinite(gridWidth) ? gridWidth : 1) } });
  }
  // Now that rx/rw are finalized, compute bar width
  barW = Math.max(0.2, (rw - totalGap) / count);
  let x = rx;
  // Decide if we need diagonal x-labels globally
  const estCharW = 0.08;
  const anyRotate = steps.some(s => (s.label || '').length * estCharW > (barW - 0.2));
  for (let i = 0; i < steps.length; i++) {
    const { v, start, end, label, isTotal } = steps[i];
    const refStart = isTotal ? 0 : start;
    const y = yFor(Math.max(refStart, end));
    const h = Math.max(0.12, Math.abs(yFor(refStart) - yFor(end)));
    const posCol = normalizeHex(st.positiveColor);
    const negCol = normalizeHex(st.negativeColor);
    const totalCol = normalizeHex((st as any).totalColor);
    const accentToken = normalizeHex(((templateConfig as any)?.tokens?.accent))
      || normalizeHex(((templateConfig as any)?.tokens?.palette?.accent?.base));
    const col = isTotal ? ((totalCol as string) || (accentToken as string) || (posCol as string))
                        : (v >= 0 ? (posCol as string) : (negCol as string));
    if (!col) { try { console.warn('waterfall: missing positiveColor/negativeColor in template'); } catch {} return false; }
    slide.addShape('rect', { x, y, w: barW, h, fill: { color: col }, line: { color: '#FFFFFF', width: 0.5 } });
    const valText = isTotal ? `${end}` : `${v >= 0 ? '+' : ''}${v}`;
    const valFs = Number(st.valueFontSize);
    const valY = v >= 0 || isTotal ? (y - 0.24) : (y + h + 0.06);
    slide.addText(valText, { x: x - 0.2, y: valY, w: barW + 0.4, h: 0.3, fontSize: Number.isFinite(valFs) ? valFs : 10, align: 'center', fontFace: 'Noto Sans JP', color: normalizeHex(st.valueTextColor) || '000000' });
    const labelFs = Number(st.labelFontSize);
    const labelText = label;
    const needRotate = anyRotate;
    // Place x-axis labels further below the baseline to avoid overlap with grid/bars
    const labY = Math.min(ry + rh - 0.3, yZero + 0.24);
    const textOpts: any = { x: x - 0.3, y: labY, w: barW + 0.6, h: needRotate ? 0.6 : 0.36, fontSize: Number.isFinite(labelFs) ? labelFs : 10, align: 'center', fontFace: 'Noto Sans JP', color: normalizeHex(st.labelTextColor) || '000000' };
    if (needRotate) textOpts.rotate = -30 as any; // tilt up-right when space is narrow
    slide.addText(labelText, textOpts);
    x += barW + gap;
  }
  return true;
});

register('venn2', ({ slide, payload, region, templateConfig, helpers }) => {
  const rx = region.x, ry = region.y, rw = region.w, rh = region.h;
  const a = payload?.a, b = payload?.b, overlap = Math.max(0, Number(payload?.overlap ?? 0));
  const overlapLabel: string | undefined = (typeof payload?.overlapLabel === 'string' && payload.overlapLabel.trim()) ? String(payload.overlapLabel).trim() : undefined;
  const r = Math.min(rw, rh) / 3;
  const cx1 = rx + rw / 2 - r * 0.6; const cx2 = rx + rw / 2 + r * 0.6; const cy = ry + rh / 2;
  const st = getVisualStyle(templateConfig, 'venn2');
  const aFillHex = normalizeHex(st.aFillColor); const bFillHex = normalizeHex(st.bFillColor);
  const aFillAlpha = Number(st.aFillAlpha); const bFillAlpha = Number(st.bFillAlpha);
  const aLine = normalizeHex(st.aLineColor); const bLine = normalizeHex(st.bLineColor);
  if (!aFillHex || !bFillHex || !Number.isFinite(aFillAlpha) || !Number.isFinite(bFillAlpha) || !aLine || !bLine) {
    try { console.warn('venn2: missing style values in template'); } catch {}
    return false;
  }
  const aFill = { color: aFillHex, transparency: Math.max(0, Math.min(100, aFillAlpha)) } as any;
  const bFill = { color: bFillHex, transparency: Math.max(0, Math.min(100, bFillAlpha)) } as any;
  slide.addShape('ellipse', { x: cx1 - r, y: cy - r, w: 2*r, h: 2*r, fill: aFill, line: { color: aLine, width: 1 } });
  slide.addShape('ellipse', { x: cx2 - r, y: cy - r, w: 2*r, h: 2*r, fill: bFill, line: { color: bLine, width: 1 } });
  const ovFs = Number(st.overlapFontSize);
  const ovColor = normalizeHex(st.overlapTextColor);
  if (Number.isFinite(ovFs) && ovColor) {
    if (overlapLabel) {
      // Prefer explicit overlap label when provided
      slide.addText(overlapLabel, { x: (cx1+cx2)/2 - 0.6, y: cy - 0.18, w: 1.2, h: 0.36, fontSize: ovFs, align: 'center', fontFace: 'Noto Sans JP', color: `#${ovColor}` });
    } else if (Number.isFinite(overlap) && overlap > 0 && (st.showOverlapPercent === true)) {
      slide.addText(`${overlap}%`, { x: (cx1+cx2)/2 - 0.4, y: cy - 0.15, w: 0.8, h: 0.3, fontSize: ovFs, align: 'center', fontFace: 'Noto Sans JP', color: `#${ovColor}` });
    }
  }
  const labFs = Number(st.labelFontSize);
  if (Number.isFinite(labFs)) {
    // Compute effective blended background over white for readable auto text color
    const blendOverWhite = (hex6: string, transparencyPercent: number): string => {
      const rC = parseInt(hex6.slice(0,2), 16), gC = parseInt(hex6.slice(2,4), 16), bC = parseInt(hex6.slice(4,6), 16);
      const alpha = 1 - Math.max(0, Math.min(100, transparencyPercent)) / 100; // 0..1 fill opacity
      const blend = (c:number)=> Math.round(alpha*c + (1-alpha)*255);
      const toHex2 = (n:number)=> n.toString(16).padStart(2,'0').toUpperCase();
      return `${toHex2(blend(rC))}${toHex2(blend(gC))}${toHex2(blend(bC))}`;
    };
    const effA = blendOverWhite(aFillHex, aFillAlpha);
    const effB = blendOverWhite(bFillHex, bFillAlpha);
    const colA = `#${helpers.pickTextColorForBackground(`#${effA}`)}`;
    const colB = `#${helpers.pickTextColorForBackground(`#${effB}`)}`;
    // Place labels INSIDE each circle, away from the overlap
    const aLabelX = cx1 - r * 0.35; const aLabelY = cy - labFs/200; // slight vertical tweak
    const bLabelX = cx2 + r * 0.35; const bLabelY = cy - labFs/200;
    slide.addText(String(a?.label ?? ''), { x: aLabelX - 0.6, y: aLabelY - 0.18, w: 1.2, h: 0.36, fontSize: labFs, align: 'center', fontFace: 'Noto Sans JP', color: colA });
    slide.addText(String(b?.label ?? ''), { x: bLabelX - 0.6, y: bLabelY - 0.18, w: 1.2, h: 0.36, fontSize: labFs, align: 'center', fontFace: 'Noto Sans JP', color: colB });
  }
  return true;
});

// Heatmap
/**
 * Heatmap renderer
 * Payload: { type: 'heatmap', x: string[], y: string[], z: number[][] }
 * Styles (visualStyles.heatmap): baseColor, negativeColor, borderColor, padLeft, padTop, labelFontSize
 */
register('heatmap', ({ slide, payload, region, templateConfig }) => {
  const rx = region.x, ry = region.y, rw = region.w, rh = region.h;
  const xLabels: string[] = Array.isArray(payload?.x) ? payload.x : [];
  const yLabels: string[] = Array.isArray(payload?.y) ? payload.y : [];
  const z: number[][] = Array.isArray(payload?.z) ? payload.z : [];
  const cols = Math.max(1, xLabels.length);
  const rows = Math.max(1, yLabels.length);
  const style = getVisualStyle(templateConfig, 'heatmap');
  const baseHex = normalizeHex(style.baseColor);
  const negHex = normalizeHex((style as any).negativeColor) || 'E67E22';
  const borderHex = normalizeHex(style.borderColor);
  const padLeftBase = Number(style.padLeft);
  const gridPadTop = Number(style.padTop);
  const labelFs = Number(style.labelFontSize);
  if (!baseHex || !borderHex || !Number.isFinite(padLeftBase) || !Number.isFinite(gridPadTop) || !Number.isFinite(labelFs)) {
    try { console.warn('heatmap: missing style values in template'); } catch {}
    return false;
  }
  // Dynamically widen left padding to fit longest Y label without wrap（共通ヘルパー使用）
  const dynamicPadLeft = computeDynamicPadLeft(yLabels, padLeftBase, labelFs, { fudge: 1.15, extra: 0.3, maxRatio: 0.4, containerW: rw });
  const gridX = rx + dynamicPadLeft;
  const gridY = ry + gridPadTop;
  const gridW = Math.max(0.1, rw - dynamicPadLeft);
  const gridH = Math.max(0.1, rh - gridPadTop);
  const cellW = gridW / Math.max(1, cols);
  const cellH = gridH / Math.max(1, rows);
  let minZ = Infinity, maxZ = -Infinity;
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const vv = Number((z[r] || [])[c] ?? 0);
      if (Number.isFinite(vv)) { minZ = Math.min(minZ, vv); maxZ = Math.max(maxZ, vv); }
    }
  }
  if (!Number.isFinite(minZ) || !Number.isFinite(maxZ) || minZ === maxZ) { minZ = 0; maxZ = 1; }
  const blend = (hex6: string, t: number) => {
    const clamp = Math.max(0, Math.min(1, t));
    const h = hex6.replace('#','');
    const r = parseInt(h.slice(0,2),16), g = parseInt(h.slice(2,4),16), b = parseInt(h.slice(4,6),16);
    const R = Math.round(255 + (r - 255) * clamp).toString(16).padStart(2,'0').toUpperCase();
    const G = Math.round(255 + (g - 255) * clamp).toString(16).padStart(2,'0').toUpperCase();
    const B = Math.round(255 + (b - 255) * clamp).toString(16).padStart(2,'0').toUpperCase();
    return `#${R}${G}${B}`;
  };
  const posMax = Math.max(0, maxZ);
  const negMin = Math.min(0, minZ);
  for (let c = 0; c < cols; c++) {
    slide.addText(String(xLabels[c] ?? ''), { x: gridX + c * cellW, y: ry + 0.05, w: cellW, h: 0.35, fontSize: labelFs, align: 'center', fontFace: 'Noto Sans JP' });
  }
  for (let r = 0; r < rows; r++) {
    slide.addText(String(yLabels[r] ?? ''), { x: rx + 0.05, y: gridY + r * cellH + (cellH - 0.3)/2, w: Math.max(0.2, dynamicPadLeft - 0.1), h: 0.3, fontSize: labelFs, align: 'right', fontFace: 'Noto Sans JP', fit: 'resize', wrap: false });
  }
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const vv = Number((z[r] || [])[c] ?? 0);
      let color: string;
      if (vv >= 0) {
        const tp = posMax > 0 ? (vv / posMax) : 0;
        color = blend(`#${baseHex}`, tp);
      } else {
        const tn = negMin < 0 ? (Math.abs(vv) / Math.abs(negMin)) : 0;
        color = blend(`#${negHex}`, tn);
      }
      const cx = gridX + c * cellW, cy = gridY + r * cellH;
      slide.addShape('rect', { x: cx, y: cy, w: cellW, h: cellH, fill: { color }, line: { color: `#${borderHex}`, width: 0.75 } });
    }
  }
  return true;
});

// Progress bars list
/**
 * Progress (horizontal bars) renderer
 * Payload: { type: 'progress', items: Array<{ label: string; value: number; target?: number }> }
 * Styles (visualStyles.progress): labelFontSize, labelGap, bar.{heightMax,bg,bgLine,showTrack}, value.{show,suffix,fontSize,align,offset}
 */
register('progress', ({ slide, payload, region, templateConfig }) => {
  const rx = region.x, ry = region.y, rw = region.w, rh = Math.max(0.2, region.h - 0.05);
  const items = Array.isArray(payload?.items) ? payload.items : [];
  const style = getVisualStyle(templateConfig, 'progress');
  const labelAlign = asAlign(style.labelAlign, 'right');
  const labelFs = Number.isFinite(Number(style.labelFontSize)) ? Number(style.labelFontSize) : 14;
  const labelGap = Number.isFinite(Number(style.labelGap)) ? Number(style.labelGap) : 0.08;
  const barCfg: any = style.bar || {};
  const barHMax = Number.isFinite(Number(barCfg.heightMax)) ? Number(barCfg.heightMax) : 0.4;
  const barBg = normalizeHex(barCfg.bg) || 'EAEAEA';
  const barBgLine = normalizeHex(barCfg.bgLine) || 'DDDDDD';
  const showTrack = (barCfg.showTrack !== false);
  const valCfg: any = style.value || {};
  const showVal = (valCfg.show !== false);
  const valSuffix = typeof valCfg.suffix === 'string' ? valCfg.suffix : '%';
  const valFs = Number.isFinite(Number(valCfg.fontSize)) ? Number(valCfg.fontSize) : 12;
  const valAlignRight = asAlign(valCfg.align, 'right') === 'right';
  const valOffset = Number.isFinite(Number(valCfg.offset)) ? Number(valCfg.offset) : 0.04;
  // 共通ヘルパーで左ラベル幅を決定（テンプレ値で上書き可）
  const minRatioProg = Number.isFinite(Number((style as any).labelMinRatio)) ? Number((style as any).labelMinRatio) : 0.12;
  const maxRatioProg = Number.isFinite(Number((style as any).labelMaxRatio)) ? Number((style as any).labelMaxRatio) : 0.38;
  const fudgeProg = Number.isFinite(Number((style as any).labelFudge)) ? Number((style as any).labelFudge) : 1.06;
  const minInProg = Number.isFinite(Number((style as any).labelMinIn)) ? Number((style as any).labelMinIn) : 0.30;
  const labelW = computeLabelColumnWidth(
    items.map((it:any)=>String(it?.label??'')),
    labelFs as number,
    rw,
    { minRatio: Math.max(0, minRatioProg), maxRatio: maxRatioProg, fudge: fudgeProg, pad: Math.max(0.1, Number(labelGap)||0.08), minIn: minInProg }
  );
  const barAreaX = rx + labelW;
  const barAreaW = Math.max(0.6, rw - labelW);
  const rows = Math.max(1, Math.min(8, items.length));
  const barH = Math.min(barHMax as number, (rh - 0.12 * (rows - 1)) / rows);
  // Build vivid color palette (fills with alpha and solid borders)
  const alphaBar = Number((style as any)?.alpha?.barFill);
  const barFillA = Number.isFinite(alphaBar) ? (alphaBar as number) : 0.2;
  const hsvToRgb = (h: number, s: number, v: number) => {
    const i = Math.floor(h * 6); const f = h * 6 - i;
    const p = v * (1 - s); const q = v * (1 - f * s); const t = v * (1 - (1 - f) * s);
    let r=0,g=0,b=0; switch (i % 6) { case 0: r=v; g=t; b=p; break; case 1: r=q; g=v; b=p; break; case 2: r=p; g=v; b=t; break; case 3: r=p; g=q; b=v; break; case 4: r=t; g=p; b=v; break; case 5: r=v; g=p; b=q; break; }
    return { r: Math.round(r*255), g: Math.round(g*255), b: Math.round(b*255) };
  };
  const golden = 0.61803398875; let hSeed = 0.137; // deterministic but not tied to theme
  const toHex2 = (n: number) => n.toString(16).padStart(2,'0').toUpperCase();
  const fills: Array<{ hex: string; alpha: number }> = []; const borders: string[] = [];
  for (let i = 0; i < Math.max(1, items.length); i++) {
    hSeed = (hSeed + golden) % 1; const { r, g, b } = hsvToRgb(hSeed, 0.85, 0.95);
    const hex = `${toHex2(r)}${toHex2(g)}${toHex2(b)}`;
    fills.push({ hex, alpha: barFillA }); borders.push(hex);
  }
  // Determine a common scale by the maximum target (fallback 100)
  let maxTarget = 100;
  for (const it of items) {
    const t = Math.max(1, Number((it as any)?.target ?? 100));
    if (t > maxTarget) maxTarget = t;
  }
  items.slice(0, 8).forEach((it: any, i: number) => {
    const y = ry + i * (barH + 0.12);
    slide.addText(String(it?.label ?? ''), { x: rx, y, w: Math.max(0.2, labelW - (labelGap as number)), h: barH, fontSize: labelFs as number, fontFace: 'Noto Sans JP', align: labelAlign, valign: 'middle', fit: 'resize', wrap: false, paraSpaceAfter: 0 });
    // Full track (optional)
    if (showTrack) {
      slide.addShape('rect', { x: barAreaX, y, w: barAreaW, h: barH, fill: { color: `#${barBg}` }, line: { color: `#${barBgLine}`, width: 0.5 } });
    }
    const target = Math.max(1, Number(it?.target ?? 100));
    const valueRaw = Math.max(0, Number(it?.value ?? 0));
    const vClamped = Math.min(valueRaw, target);
    const targetW = barAreaW * (target / maxTarget);
    const valueW = barAreaW * (vClamped / maxTarget);
    // Colored fill + border (like bar_chart with framed color)
    const fillSpec = fills[i % fills.length];
    const borderCol = borders[i % borders.length];
    const transparency = Math.round((1 - Math.max(0, Math.min(1, fillSpec.alpha))) * 100);
    // Target box (outline)
    slide.addShape('rect', { x: barAreaX, y, w: targetW, h: barH, fill: { color: `#${barBg}` }, line: { color: `#${borderCol}`, width: 2 } });
    // Achieved fill inside target
    slide.addShape('rect', { x: barAreaX, y, w: valueW, h: barH, fill: { color: `#${fillSpec.hex}`, transparency }, line: { color: `#${borderCol}`, width: 1 } });
    // Remaining to target (light)
    if (targetW > valueW + 0.02) {
      const remX = barAreaX + valueW;
      const remW = Math.max(0, targetW - valueW);
      slide.addShape('rect', { x: remX, y, w: remW, h: barH, fill: { color: `#${fillSpec.hex}`, transparency: Math.min(100, transparency + 40) }, line: { color: `#${borderCol}`, width: 1 } });
    }
    if (showVal) {
      const pct = Math.round((valueRaw / Math.max(1, target)) * 100);
      const color = normalizeHex(valCfg.color) || '111111';
      // 1) Percent at left inside achieved bar
      if (valueW > 0.3) {
        slide.addText(`${pct}${valSuffix}`, { x: barAreaX + 0.06, y, w: Math.max(0.4, valueW - 0.12), h: barH, fontSize: valFs as number, fontFace: 'Noto Sans JP', align: 'left', valign: 'middle', color: `#${color}` });
      } else {
        // If filled is too short, show percent just at boundary
        slide.addText(`${pct}${valSuffix}`, { x: barAreaX + valueW + 0.04, y, w: 0.6, h: barH, fontSize: valFs as number, fontFace: 'Noto Sans JP', align: 'left', valign: 'middle', color: `#${color}` });
      }
      // 2) Raw value inside the bar at the right edge (right-aligned), with fallback
      const inset = 0.06;
      if (valueW > 0.4) {
        // Place inside filled area, right-aligned to its right edge
        const innerW = Math.max(0.36, valueW - inset * 2);
        slide.addText(`${Math.round(valueRaw)}`, { x: barAreaX + inset, y, w: innerW, h: barH, fontSize: valFs as number, fontFace: 'Noto Sans JP', align: 'right', valign: 'middle', color: `#${color}` });
      } else {
        // Too short to fit inside: place just outside to the right
        slide.addText(`${Math.round(valueRaw)}`, { x: barAreaX + valueW + 0.04, y, w: 0.6, h: barH, fontSize: valFs as number, fontFace: 'Noto Sans JP', align: 'left', valign: 'middle', color: `#${color}` });
      }
      // 3) Target value at the right end of the target box
      const targetBoxW = 0.8;
      const targetTextX = barAreaX + Math.max(0, targetW - targetBoxW - 0.04);
      slide.addText(`${Math.round(target)}`, { x: targetTextX, y, w: targetBoxW, h: barH, fontSize: valFs as number, fontFace: 'Noto Sans JP', align: 'right', valign: 'middle', color: `#${color}` });
    }
  });

  // Draw x-axis with ticks and labels below the bars
  const axisCfg: any = (style as any).axis || {};
  const axisShow = (axisCfg.show !== false);
  if (axisShow) {
    const axisColor = normalizeHex(axisCfg.color) || '666666';
    const gridColor = normalizeHex(axisCfg.gridColor) || 'E0E6ED';
    const tickFont = Number(axisCfg.fontSize) || 10;
    const desiredTicks = Number(axisCfg.ticks) || 6;
    // axis Y position just beneath last bar
    const lastY = ry + (rows - 1) * (barH + 0.12);
    let axisY = lastY + barH + 0.10;
    // keep inside region
    if (axisY > ry + rh - 0.24) axisY = ry + rh - 0.24;
    // nice step based on maxTarget
    const rawStep = maxTarget / Math.max(2, desiredTicks);
    const mag = Math.pow(10, Math.floor(Math.log10(rawStep)));
    const norm = rawStep / mag;
    let nice;
    if (norm <= 1) nice = 1; else if (norm <= 2) nice = 2; else if (norm <= 5) nice = 5; else nice = 10;
    const step = nice * mag;
    // baseline
    slide.addShape('line', { x: barAreaX, y: axisY, w: barAreaW, h: 0, line: { color: `#${axisColor}`, width: 1 } });
    for (let t = 0; t <= maxTarget + 1e-6; t += step) {
      const ratio = t / maxTarget;
      const x = barAreaX + barAreaW * Math.min(1, Math.max(0, ratio));
      // tick mark
      slide.addShape('line', { x, y: axisY, w: 0, h: 0.06, line: { color: `#${axisColor}`, width: 1 } });
      // optional light grid above axis to the top of bars area
      if (axisCfg.grid === true) {
        slide.addShape('line', { x, y: ry - 0.04, w: 0, h: (axisY - (ry - 0.04)), line: { color: `#${gridColor}`, width: 0.5 } });
      }
      // label under tick
      slide.addText(String(Math.round(t)), { x: x - 0.4, y: axisY + 0.06, w: 0.8, h: 0.24, fontSize: tickFont, align: 'center', fontFace: 'Noto Sans JP', color: `#${axisColor}` });
    }
  }
  return true;
});

/**
 * Gantt (lightweight) renderer
 * Payload: { type: 'gantt', tasks: Array<{ label: string; start: string; end?: string; duration?: number }> }
 * Styles (visualStyles.gantt): labelFontSize, gridColor, gridWidth, minBarWidth,
 *   barColor|'auto', barLineColor|'auto', dateLabel{FontSize,Color,OffsetY,Width,Height}
 */
// Gantt (lightweight)
register('gantt', ({ slide, payload, region, templateConfig, helpers }) => {
  const rx = region.x, ry = region.y, rw = region.w, rh = region.h;
  const tasks = Array.isArray(payload?.tasks) ? payload.tasks : [];
  const visible = tasks.slice(0, 10);
  const rowH = Math.min(0.35, rh / Math.max(1, visible.length) - 0.08);
  type T = { label: string; start?: Date; end?: Date };
  const parsed: T[] = visible.map((t: any) => {
    const startStr = typeof t?.start === 'string' ? t.start : undefined;
    const endStr = typeof t?.end === 'string' ? t.end : undefined;
    const duration = Number(t?.duration);
    let start = startStr ? new Date(startStr) : undefined;
    let end = endStr ? new Date(endStr) : undefined;
    if (!end && start && Number.isFinite(duration) && duration > 0) { const e=new Date(start.getTime()); e.setDate(e.getDate()+Math.floor(duration)); end=e; }
    return { label: String(t?.label ?? ''), start, end };
  });
  const valid = parsed.filter(p => p.start instanceof Date && !isNaN(p.start.getTime()) && p.end instanceof Date && !isNaN(p.end.getTime()) && p.end.getTime() >= p.start.getTime());
  if (!valid.length) return true;
  const minStart = new Date(Math.min(...valid.map(v => v.start!.getTime())));
  const maxEnd = new Date(Math.max(...valid.map(v => v.end!.getTime())));
  const spanMs = Math.max(1, maxEnd.getTime() - minStart.getTime());
  // Estimate label width (in) from text length and font size, then derive bar area dynamically
  const st = getVisualStyle(templateConfig, 'gantt');
  const labelFs = Number.isFinite(Number(st.labelFontSize)) ? Number(st.labelFontSize) : 12;
  const gridColor = normalizeHex(st.gridColor) || '9AA3AF';
  const gridWidth = Number.isFinite(Number(st.gridWidth)) ? Number(st.gridWidth) : 1.2;
  // ガントにも同じ共通ロジックを適用
  const minRatioG = Number.isFinite(Number((st as any).labelMinRatio)) ? Number((st as any).labelMinRatio) : 0.08;
  const maxRatioG = Number.isFinite(Number((st as any).labelMaxRatio)) ? Number((st as any).labelMaxRatio) : 0.34;
  const fudgeG = Number.isFinite(Number((st as any).labelFudge)) ? Number((st as any).labelFudge) : 1.06;
  const minInG = Number.isFinite(Number((st as any).labelMinIn)) ? Number((st as any).labelMinIn) : 0.36;
  const leftLabelW = computeLabelColumnWidth(valid.map(v=>String(v.label||'')), labelFs as number, rw, { minRatio: Math.max(0, minRatioG), maxRatio: maxRatioG, fudge: fudgeG, pad: 0.12, minIn: minInG });
  const gapLeftToBar = 0.06;
  const rightPad = Math.max(0.3, rw * 0.07);
  const barX0 = rx + leftLabelW + gapLeftToBar;
  const barAvailW = Math.max(0.2, rw - (leftLabelW + gapLeftToBar) - rightPad);
  const scale = (d: Date) => barAvailW * ((d.getTime() - minStart.getTime()) / spanMs);
  const dayMs = 24*60*60*1000; const spanDays = spanMs/dayMs;
  const unit: 'month'|'week'|'day'|'hour' = spanDays >= 60 ? 'month' : spanDays >= 14 ? 'week' : spanDays >= 2 ? 'day' : 'hour';
  const lines: Date[] = [];
  const clamp = (d: Date) => new Date(Math.max(minStart.getTime(), Math.min(maxEnd.getTime(), d.getTime())));
  if (unit==='month') {
    const s = new Date(minStart.getFullYear(), minStart.getMonth(), 1);
    for (let y=s.getFullYear(), m=s.getMonth();;){ const d=new Date(y,m,1); if (d>maxEnd) break; lines.push(clamp(d)); m++; if(m>11){m=0;y++;} }
  } else if (unit==='week') {
    const s = new Date(minStart); const dw = (s.getDay()+6)%7; s.setDate(s.getDate()-dw); s.setHours(0,0,0,0);
    for (let d=new Date(s); d<=maxEnd; d.setDate(d.getDate()+7)) lines.push(clamp(new Date(d)));
  } else if (unit==='day') {
    const s = new Date(minStart); s.setHours(0,0,0,0); for (let d=new Date(s); d<=maxEnd; d.setDate(d.getDate()+1)) lines.push(clamp(new Date(d)));
  } else {
    const s = new Date(minStart); s.setMinutes(0,0,0); for (let d=new Date(s); d<=maxEnd; d.setHours(d.getHours()+1)) lines.push(clamp(new Date(d)));
  }
  for (const d of lines) { const gx = barX0 + scale(d); slide.addShape('line',{x:gx,y:ry,w:0,h:rh,line:{color:`#${gridColor}`,width:gridWidth}}); }
  const barMaxX = barX0 + barAvailW;
  valid.forEach((t, i) => {
    const y = ry + i*(rowH + 0.12);
    slide.addText(String(t.label), { x: rx, y, w: leftLabelW, h: rowH, fontSize: labelFs as number, fontFace: 'Noto Sans JP', align: 'right', valign: 'middle', fit: 'resize', wrap: false });
    const w = Math.max(Number(st.minBarWidth), scale(t.end!) - scale(t.start!));
    const x = barX0 + scale(t.start!);
    // Bar colors: allow 'auto' to use palette; if line color missing, reuse fill color
    const rawBarColor: string = String((st as any).barColor ?? '').trim().toLowerCase();
    const useAuto = !rawBarColor || rawBarColor === 'auto';
    const paletteHex = (helpers && typeof helpers.getPaletteColor === 'function') ? String(helpers.getPaletteColor(i)).replace('#','') : undefined;
    const fillHex = useAuto ? (paletteHex || 'E6E6E6') : (normalizeHex((st as any).barColor) || 'E6E6E6');
    const lineHex = normalizeHex((st as any).barLineColor) || fillHex;
    slide.addShape('rect', { x, y, w, h: rowH, fill: { color: `#${fillHex}` }, line: { color: `#${lineHex}`, width: 0.5 } });
    // Start date above bar
    const startStr = t.start!.toISOString().slice(0,10);
    const dateFs = Number(st.dateLabelFontSize);
    const dateColor = normalizeHex(st.dateLabelColor);
    if (Number.isFinite(dateFs) && dateColor) {
      slide.addText(startStr, { x, y: y - Number(st.dateLabelOffsetY || 0.18), w: Number(st.dateLabelWidth || 1.6), h: Number(st.dateLabelHeight || 0.2), fontSize: dateFs, fontFace: 'Noto Sans JP', color: `#${dateColor}`, align: 'left', valign: 'bottom', fit: 'resize', wrap: false });
    }
  });
  return true;
});

// Checklist
/**
 * Checklist renderer
 * Payload: { type: 'checklist', items: Array<{ label: string }> }
 * Styles (visualStyles.checklist): gapY, markSize, markAspect, markLineColor, markFillColor, baseRowHeight, textColor
 */
register('checklist', ({ slide, payload, region, templateConfig }) => {
  const rx = region.x, ry = region.y, rw = region.w, rh = region.h;
  const items = Array.isArray(payload?.items) ? payload.items : [];
  const st = getVisualStyle(templateConfig, 'checklist');
  const gapY = Number(st.gapY);
  const markSize = Number(st.markSize);
  const fontSize = Number.isFinite(Number((st as any).fontSize))
    ? Number((st as any).fontSize)
    : (Number.isFinite(Number((st as any).fontSizeInitial)) ? Number((st as any).fontSizeInitial) : 18);
  const rowHBase = Number(st.baseRowHeight);
  const markLine = normalizeHex(st.markLineColor);
  const markFill = normalizeHex(st.markFillColor);
  const textColor = normalizeHex(st.textColor);
  if (![gapY, markSize, fontSize, rowHBase].every(Number.isFinite) || !markLine || !markFill || !textColor) { try { console.warn('checklist: missing style values'); } catch {} return false; }
  let y = ry;
  items.slice(0, 10).forEach((it: any) => {
    const h = rowHBase;
    // custom image mark
    try {
      // Resolve projectRoot via runtime resolver used elsewhere
      const path = require('path');
      const fs = require('fs');
      const cfgMod = require('../xibo-agent/config');
      const cfg = (cfgMod && (cfgMod.config || cfgMod.default)) ? (cfgMod.config || cfgMod.default) : undefined;
      const root = cfg?.projectRoot || process.cwd();
      const imgPath = path.join(root, 'persistent_data', 'assets', 'images', 'checkBox.png');
      const exists = (fs && typeof fs.existsSync === 'function') ? fs.existsSync(imgPath) : false;
      if (exists) {
        // Preserve original aspect ratio by computing scaled width from template's expected aspect ratio if provided
        const asp = Number((st as any).markAspect);
        if (Number.isFinite(asp) && asp > 0) {
          // asp = originalWidth / originalHeight
          const targetH = markSize;
          const targetW = targetH * asp;
          const boxY = y + (h - targetH) / 2;
          slide.addImage({ path: imgPath, x: rx, y: boxY, w: targetW, h: targetH });
        } else {
          const boxY = y + (h - markSize) / 2;
          slide.addImage({ path: imgPath, x: rx, y: boxY, w: markSize, h: markSize, sizing: { type: 'contain', w: markSize, h: markSize } as any });
        }
      } else {
        throw new Error('checkBox.png not found');
      }
    } catch {
      slide.addShape('rect', { x: rx, y: y + (h - markSize)/2, w: markSize, h: markSize, fill: { color: '#FFFFFF' }, line: { color: `#${markLine}`, width: 1 }, rectRadius: 4 });
      slide.addShape('chevron', { x: rx + 0.04, y: y + (h - markSize)/2 + 0.06, w: markSize - 0.08, h: markSize - 0.12, fill: { color: `#${markFill}` }, line: { color: `#${markFill}`, width: 0 } } as any);
    }
    slide.addText(String(it?.label ?? ''), { x: rx + markSize + 0.2, y, w: rw - (markSize + 0.4), h, fontSize: fontSize as number, fontFace: 'Noto Sans JP', color: `#${textColor}` });
    y += h + gapY;
  });
  return true;
});

// Matrix (2x2)
/**
 * Matrix (2x2) renderer
 * Payload: { type: 'matrix', axes: { xLabels: [string,string], yLabels: [string,string] } }
 * Styles (visualStyles.matrix): frameLineColor, axisLineColor, axisFontSize, point{Fill,Line,Size}, labelFontSize
 */
register('matrix', ({ slide, payload, region, templateConfig }) => {
  const rx = region.x, ry = region.y, rw = region.w, rh = region.h;
  const xL = payload?.axes?.xLabels || [];
  const yL = payload?.axes?.yLabels || [];
  const st = getVisualStyle(templateConfig, 'matrix');
  const frameLine = normalizeHex(st.frameLineColor);
  const axisLine = normalizeHex(st.axisLineColor);
  const axisFontSize = Number(st.axisFontSize);
  const pointFill = normalizeHex(st.pointFill);
  const pointLine = normalizeHex(st.pointLine);
  const pointSize = Number(st.pointSize);
  const labelFontSize = Number(st.labelFontSize);
  if (!frameLine || !axisLine || !Number.isFinite(axisFontSize) || !pointFill || !pointLine || !Number.isFinite(pointSize) || !Number.isFinite(labelFontSize)) { try { console.warn('matrix: missing style values'); } catch {} return false; }
  // Reserve outside bands for axis labels, while keeping everything within region
  const band = Math.max(0.28, Math.min(0.6, axisFontSize / 18)); // rough mapping pt->in
  const padTop = band;
  const padBottom = band;
  const padLeft = band;
  const padRight = band;
  // Grid area inside the four bands
  const gx = rx + padLeft;
  const gy = ry + padTop;
  const gw = Math.max(0.2, rw - padLeft - padRight);
  const gh = Math.max(0.2, rh - padTop - padBottom);
  // Draw grid frame and axes inside grid area
  slide.addShape('rect', { x: gx, y: gy, w: gw, h: gh, fill: { color: '#FFFFFF' }, line: { color: `#${frameLine}`, width: 1 } });
  slide.addShape('line', { x: gx + gw/2, y: gy, w: 0, h: gh, line: { color: `#${axisLine}`, width: 1 } });
  slide.addShape('line', { x: gx, y: gy + gh/2, w: gw, h: 0, line: { color: `#${axisLine}`, width: 1 } });
  // Axis labels placed OUTSIDE the grid but INSIDE the overall region
  // y-axis labels: top center (yL[0]), bottom center (yL[1])
  slide.addText(String(yL[0] || ''), { x: gx, y: ry + Math.max(0, (padTop - 0.3) / 2), w: gw, h: padTop, fontSize: axisFontSize, align: 'center', valign: 'top', fontFace: 'Noto Sans JP' });
  slide.addText(String(yL[1] || ''), { x: gx, y: gy + gh + Math.max(0, (padBottom - 0.3) / 2), w: gw, h: padBottom, fontSize: axisFontSize, align: 'center', valign: 'bottom', fontFace: 'Noto Sans JP' });
  // x-axis labels: left middle (xL[0]), right middle (xL[1])
  slide.addText(String(xL[0] || ''), { x: rx + Math.max(0, (padLeft - 0.6) / 2), y: gy, w: padLeft, h: gh, fontSize: axisFontSize, align: 'left', valign: 'middle', fontFace: 'Noto Sans JP' });
  slide.addText(String(xL[1] || ''), { x: gx + gw + Math.max(0, (padRight - 0.6) / 2), y: gy, w: padRight, h: gh, fontSize: axisFontSize, align: 'right', valign: 'middle', fontFace: 'Noto Sans JP' });
  const clamp = (v:number, min:number, max:number)=>Math.min(max, Math.max(min, v));
  const sizeMin = pointSize * 0.6;
  const sizeMax = pointSize * 1.6;
  const toPx = (nz:number, a:number, b:number)=> a + nz * (b - a);
  const norm = (v:number)=> (v + 1) / 2; // [-1,1] -> [0,1]
  const items = Array.isArray(payload?.items) ? payload.items : [];
  items.slice(0, 12).forEach((it: any) => {
    const nx = clamp(Number(it?.x ?? 0), -1, 1);
    const ny = clamp(Number(it?.y ?? 0), -1, 1);
    const nzRaw = Number(it?.z);
    const nz = Number.isFinite(nzRaw) ? clamp(nzRaw, 0, 1) : NaN;
    const cx = gx + norm(nx) * gw;
    const cy = gy + norm(ny) * gh;
    const pSize = Number.isFinite(nz) ? toPx(nz, sizeMin, sizeMax) : pointSize;
    slide.addShape('ellipse', { x: cx - (pSize/2), y: cy - (pSize/2), w: pSize, h: pSize, fill: { color: `#${pointFill}` }, line: { color: `#${pointLine}`, width: 0.75 } });
    slide.addText(String(it?.label ?? ''), { x: cx + 0.12, y: cy - 0.12, w: Math.min(1.8, gw/2 - 0.3), h: 0.3, fontSize: labelFontSize, fontFace: 'Noto Sans JP' });
  });
  return true;
});

// Charts via generateChart tool
async function renderChartImage(
  kind: 'bar'|'pie'|'doughnut'|'line'|'radar'|'polarArea'|'scatter'|'bubble'|'horizontalBar'|'stackedBar'|'area',
  labels: string[],
  values: any,
  title?: string,
  chartsStyle?: any
): Promise<string|null> {
  try {
    const mod: any = await import('./generateChart');
    const tool: any = (mod && (mod.generateChartTool || mod.default));
    if (!tool || typeof tool.execute !== 'function') return null;
    const safeName = `pptchart-${Date.now()}-${Math.floor(Math.random()*1e6)}`;
    const res = await tool.execute({ context: { chartType: kind, title: String(title || ''), labels, data: values, fileName: safeName, chartsStyle } });
    if (res && res.success === true && res.data && res.data.imagePath) return String(res.data.imagePath);
    return null;
  } catch { return null; }
}

function addImageContain(slide: any, path: string, region: { x: number; y: number; w: number; h: number }, chartType: string, shadow?: any, valignTop?: boolean) {
  const imgW = 1200; const imgH = 1200; // unified canvas
  const scale = Math.min(region.w / imgW, region.h / imgH);
  const w = Math.max(0.1, imgW * scale);
  const h = Math.max(0.1, imgH * scale);
  const x = region.x + (region.w - w) / 2;
  const y = valignTop ? region.y : (region.y + (region.h - h) / 2);
  slide.addImage({ path, x, y, w, h, shadow });
}

register('bar_chart', async ({ slide, payload, region, templateConfig }) => {
  const labels: string[] = Array.isArray(payload?.labels) ? payload.labels : (Array.isArray(payload?.items) ? payload.items.map((it: any)=>String(it?.label||'')) : []);
  const values: number[] = Array.isArray(payload?.values) ? payload.values.map((n:any)=>Number(n)||0) : (Array.isArray(payload?.items) ? payload.items.map((it:any)=>Number(it?.value||0)) : []);
  const chartsStyle = (templateConfig?.visualStyles?.bar_chart) || {};
  const img = await renderChartImage('bar', labels, values, payload?.title, chartsStyle);
  if (img) addImageContain(slide, img, region, 'bar', (chartsStyle.shadow ? { type: 'outer', color: '000000', opacity: 0.45, blur: 12, offset: 4, angle: 45 } as any : undefined), true);
  return true;
});

register('pie_chart', async ({ slide, payload, region, templateConfig }) => {
  const labels: string[] = Array.isArray(payload?.labels) ? payload.labels : (Array.isArray(payload?.items) ? payload.items.map((it: any)=>String(it?.label||'')) : []);
  const values: number[] = Array.isArray(payload?.values) ? payload.values.map((n:any)=>Number(n)||0) : (Array.isArray(payload?.items) ? payload.items.map((it:any)=>Number(it?.value||0)) : []);
  const chartsStyle = (templateConfig?.visualStyles?.pie_chart) || {};
  const img = await renderChartImage('pie', labels, values, payload?.title, chartsStyle);
  if (img) addImageContain(slide, img, region, 'pie', (chartsStyle.shadow ? { type: 'outer', color: '000000', opacity: 0.45, blur: 12, offset: 4, angle: 45 } as any : undefined), true);
  return true;
});

register('line_chart', async ({ slide, payload, region, templateConfig }) => {
  const labels: string[] = Array.isArray(payload?.labels) ? payload.labels : (Array.isArray(payload?.items) ? payload.items.map((it: any)=>String(it?.label||'')) : []);
  const values: number[] = Array.isArray(payload?.values) ? payload.values.map((n:any)=>Number(n)||0) : (Array.isArray(payload?.items) ? payload.items.map((it:any)=>Number(it?.value||0)) : []);
  const chartsStyle = (templateConfig?.visualStyles?.line_chart) || {};
  const img = await renderChartImage('line', labels, values, payload?.title, chartsStyle);
  if (img) addImageContain(slide, img, region, 'line', (chartsStyle.shadow ? { type: 'outer', color: '000000', opacity: 0.45, blur: 12, offset: 4, angle: 45 } as any : undefined), true);
  return true;
});

register('radar_chart', async ({ slide, payload, region, templateConfig }) => {
  const labels: string[] = Array.isArray(payload?.labels) ? payload.labels : (Array.isArray(payload?.items) ? payload.items.map((it: any)=>String(it?.label||'')) : []);
  const values: number[] = Array.isArray(payload?.values) ? payload.values.map((n:any)=>Number(n)||0) : (Array.isArray(payload?.items) ? payload.items.map((it:any)=>Number(it?.value||0)) : []);
  const chartsStyle = (templateConfig?.visualStyles?.radar_chart) || {};
  const img = await renderChartImage('radar', labels, values, payload?.title, chartsStyle);
  if (img) addImageContain(slide, img, region, 'radar', (chartsStyle.shadow ? { type: 'outer', color: '000000', opacity: 0.45, blur: 12, offset: 4, angle: 45 } as any : undefined), true);
  return true;
});

register('polar_area_chart', async ({ slide, payload, region, templateConfig }) => {
  const labels: string[] = Array.isArray(payload?.labels) ? payload.labels : (Array.isArray(payload?.items) ? payload.items.map((it: any)=>String(it?.label||'')) : []);
  const values: number[] = Array.isArray(payload?.values) ? payload.values.map((n:any)=>Number(n)||0) : (Array.isArray(payload?.items) ? payload.items.map((it:any)=>Number(it?.value||0)) : []);
  const chartsStyle = (templateConfig?.visualStyles?.polar_area_chart) || {};
  const img = await renderChartImage('polarArea', labels, values, payload?.title, chartsStyle);
  if (img) addImageContain(slide, img, region, 'polarArea', (chartsStyle.shadow ? { type: 'outer', color: '000000', opacity: 0.45, blur: 12, offset: 4, angle: 45 } as any : undefined), true);
  return true;
});

register('scatter_chart', async ({ slide, payload, region, templateConfig }) => {
  const labels: string[] = Array.isArray(payload?.labels) ? payload.labels : (Array.isArray(payload?.items) ? payload.items.map((_: any, i:number)=>`P${i+1}`) : []);
  const values: any[] = Array.isArray(payload?.values) ? payload.values : (Array.isArray(payload?.items) ? payload.items : []);
  const chartsStyle = (templateConfig?.visualStyles?.scatter_chart) || {};
  try { logger.debug({ labelsCount: labels.length, valuesPreview: Array.isArray(values) ? values.slice(0, 5) : null }, 'scatter: before render'); } catch {}
  const img = await renderChartImage('scatter', labels, values, payload?.title, chartsStyle);
  if (!img) { /* no-op: scatter fallback disabled to reduce noise */ }
  if (img) addImageContain(slide, img, region, 'scatter', (chartsStyle.shadow ? { type: 'outer', color: '000000', opacity: 0.45, blur: 12, offset: 4, angle: 45 } as any : undefined), true);
  return true;
});

register('bubble_chart', async ({ slide, payload, region, templateConfig }) => {
  const labels: string[] = Array.isArray(payload?.labels) ? payload.labels : (Array.isArray(payload?.items) ? payload.items.map((_: any, i:number)=>`B${i+1}`) : []);
  const values: any[] = Array.isArray(payload?.values) ? payload.values : (Array.isArray(payload?.items) ? payload.items : []);
  const chartsStyle = (templateConfig?.visualStyles?.bubble_chart) || {};
  const img = await renderChartImage('bubble', labels, values, payload?.title, chartsStyle);
  if (img) addImageContain(slide, img, region, 'bubble', (chartsStyle.shadow ? { type: 'outer', color: '000000', opacity: 0.45, blur: 12, offset: 4, angle: 45 } as any : undefined), true);
  return true;
});

register('horizontal_bar_chart', async ({ slide, payload, region, templateConfig }) => {
  const labels: string[] = Array.isArray(payload?.labels) ? payload.labels : (Array.isArray(payload?.items) ? payload.items.map((it: any)=>String(it?.label||'')) : []);
  const values: number[] = Array.isArray(payload?.values) ? payload.values.map((n:any)=>Number(n)||0) : (Array.isArray(payload?.items) ? payload.items.map((it:any)=>Number(it?.value||0)) : []);
  const chartsStyle = (templateConfig?.visualStyles?.horizontal_bar_chart) || {};
  const img = await renderChartImage('horizontalBar', labels, values, payload?.title, chartsStyle);
  if (img) addImageContain(slide, img, region, 'horizontalBar', (chartsStyle.shadow ? { type: 'outer', color: '000000', opacity: 0.45, blur: 12, offset: 4, angle: 45 } as any : undefined), true);
  return true;
});

register('stacked_bar_chart', async ({ slide, payload, region, templateConfig }) => {
  const labels: string[] = Array.isArray(payload?.labels) ? payload.labels : (Array.isArray(payload?.items) ? payload.items.map((it: any)=>String(it?.label||'')) : []);
  // Support stacked series via payload.series or 2D values
  let values: any = [];
  if (Array.isArray(payload?.series)) {
    values = payload.series; // expect [{label, data:number[]}, ...]
  } else if (Array.isArray(payload?.values) && Array.isArray(payload?.values[0])) {
    values = payload.values; // 2D array
  } else if (Array.isArray(payload?.values)) {
    values = payload.values.map((n:any)=>Number(n)||0); // single series
  } else if (Array.isArray(payload?.items)) {
    values = payload.items.map((it:any)=>Number(it?.value||0));
  }
  const chartsStyle = (templateConfig?.visualStyles?.stacked_bar_chart) || {};
  const img = await renderChartImage('stackedBar', labels, values, payload?.title, chartsStyle);
  if (img) addImageContain(slide, img, region, 'stackedBar', (chartsStyle.shadow ? { type: 'outer', color: '000000', opacity: 0.45, blur: 12, offset: 4, angle: 45 } as any : undefined), true);
  return true;
});

register('area_chart', async ({ slide, payload, region, templateConfig }) => {
  const labels: string[] = Array.isArray(payload?.labels) ? payload.labels : (Array.isArray(payload?.items) ? payload.items.map((it: any)=>String(it?.label||'')) : []);
  const values: number[] = Array.isArray(payload?.values) ? payload.values.map((n:any)=>Number(n)||0) : (Array.isArray(payload?.items) ? payload.items.map((it:any)=>Number(it?.value||0)) : []);
  const chartsStyle = (templateConfig?.visualStyles?.area_chart) || {};
  const img = await renderChartImage('area', labels, values, payload?.title, chartsStyle);
  if (img) addImageContain(slide, img, region, 'area', (chartsStyle.shadow ? { type: 'outer', color: '000000', opacity: 0.45, blur: 12, offset: 4, angle: 45 } as any : undefined), true);
  return true;
});

// Comparison (two boxes)
/**
 * Comparison (two boxes) renderer
 * Payload: { type: 'comparison', a: { label: string, value: string }, b: { label: string, value: string } }
 * Styles (visualStyles.comparison): labelColor, valueColor, leftFill, rightFill, alpha.barFill,
 *   labelHeight, labelFontSize, valueFontSize, layoutPolicy.{gapX,padX,padY}
 */
register('comparison', ({ slide, payload, region, templateConfig, helpers }) => {
  const rx = region.x, ry = region.y, rw = region.w, rh = region.h;
  const a = payload?.a || {}, b = payload?.b || {};
  const st = getVisualStyle(templateConfig, 'comparison');
  const labelColorTpl = normalizeHex(st.labelColor);
  const valueColorTpl = normalizeHex(st.valueColor);
  const labelFs = Number(st.labelFontSize);
  const valueFs = Number(st.valueFontSize);
  const gapX = Number(st.layoutPolicy?.gapX);
  const padX = Number(st.layoutPolicy?.padX);
  const padY = Number(st.layoutPolicy?.padY);
  const leftFill = normalizeHex(st.leftFill);
  const rightFill = normalizeHex(st.rightFill);
  const boxLine = normalizeHex(st.boxLineColor);
  const labelHeight = Number(st.labelHeight);
  let labelAlign: 'left'|'right'|'center'|undefined;
  const la = typeof st.labelAlign === 'string' ? st.labelAlign.toLowerCase() : '';
  if (la === 'left' || la === 'right' || la === 'center') labelAlign = la as any;
  const rawLabelBg: any = (st as any).labelBackground ?? (st as any).labelBg;
  if (!Number.isFinite(labelFs) || !Number.isFinite(valueFs) || !Number.isFinite(gapX) || !Number.isFinite(padX) || !Number.isFinite(padY) || !leftFill || !rightFill || !boxLine) { try { console.warn('comparison: missing style values'); } catch {} return false; }
  const boxW = (rw - gapX)/2; const boxH = rh;
  // card underlay + pastel fill + solid border (match KPI)
  const fallbackBarAlpha = Number((templateConfig?.visualStyles?.bar_chart?.alpha?.barFill)) || 0.2;
  const kpiAlpha = Number((templateConfig?.visualStyles?.kpi as any)?.alpha?.barFill);
  const cmpAlpha = Number((st as any)?.alpha?.barFill);
  const fillAlpha = Number.isFinite(cmpAlpha)
    ? (cmpAlpha as number)
    : (Number.isFinite(kpiAlpha) ? (kpiAlpha as number) : fallbackBarAlpha);
  const toTransp = (a:number) => Math.round((1 - Math.max(0, Math.min(1, a))) * 100);
  // Left
  slide.addShape('rect', { x: rx, y: ry, w: boxW, h: boxH, fill: { color: 'FFFFFF' }, line: { color: 'FFFFFF', width: 0 }, rectRadius: 6 });
  slide.addShape('rect', { x: rx, y: ry, w: boxW, h: boxH, fill: { color: `#${leftFill}`, transparency: toTransp(fillAlpha) }, line: { color: `#${leftFill}`, width: 2 }, rectRadius: 6 });
  const labelColorLeft = labelColorTpl ? `#${labelColorTpl}` : (helpers.pickTextColorForBackground ? helpers.pickTextColorForBackground(`#${leftFill}`) : '#FFFFFF');
  // Compute effective background (semi-transparent fill over white) for value text contrast
  const leftR = parseInt(leftFill.slice(0,2),16), leftG = parseInt(leftFill.slice(2,4),16), leftB = parseInt(leftFill.slice(4,6),16);
  const aLeft = Math.max(0, Math.min(1, fillAlpha));
  const blendLeft = (c:number) => Math.round(aLeft*c + (1-aLeft)*255);
  const effLeftHex = `#${[blendLeft(leftR), blendLeft(leftG), blendLeft(leftB)].map(n=>n.toString(16).padStart(2,'0').toUpperCase()).join('')}`;
  const valueColorLeft = (helpers.pickTextColorForBackground ? helpers.pickTextColorForBackground(effLeftHex) : '#111111');
  if (rawLabelBg && Number.isFinite(labelHeight)) {
    const parsed = parseColorWithAlpha(String(rawLabelBg));
    if (parsed) {
      const transparency = Math.round((1 - parsed.alpha) * 100);
      slide.addShape('rect', { x: rx + padX, y: ry + padY, w: boxW - padX*2, h: labelHeight as number, fill: { color: parsed.hex, transparency }, line: { color: parsed.hex, width: 0 } } as any);
    } else {
      const hex = String(rawLabelBg).replace('#','');
      slide.addShape('rect', { x: rx + padX, y: ry + padY, w: boxW - padX*2, h: labelHeight as number, fill: { color: hex }, line: { color: hex, width: 0 } } as any);
    }
  }
  const labelBold = (st as any)?.labelBold === true;
  slide.addText(String(a?.label ?? ''), { x: rx + padX, y: ry + padY, w: boxW - padX*2, h: (Number.isFinite(labelHeight)? (labelHeight as number) : 0.36), fontSize: labelFs, bold: labelBold, color: labelColorLeft, fontFace: 'Noto Sans JP', align: (labelAlign as any), valign: 'middle', shadow: undefined });
  const valueOffsetY = Number((st as any).valueOffsetY);
  slide.addText(String(a?.value ?? ''), { x: rx + padX, y: ry + padY + (Number.isFinite(labelHeight)? (labelHeight as number) : 0.36) + (Number.isFinite(valueOffsetY) ? valueOffsetY : 0), w: boxW - padX*2, h: boxH - (padY + (Number.isFinite(labelHeight)? (labelHeight as number) : 0.36)), fontSize: valueFs, color: valueColorLeft, fontFace: 'Noto Sans JP', align: 'center', valign: 'top' });
  // Right
  slide.addShape('rect', { x: rx + boxW + gapX, y: ry, w: boxW, h: boxH, fill: { color: 'FFFFFF' }, line: { color: 'FFFFFF', width: 0 }, rectRadius: 6 });
  slide.addShape('rect', { x: rx + boxW + gapX, y: ry, w: boxW, h: boxH, fill: { color: `#${rightFill}`, transparency: toTransp(fillAlpha) }, line: { color: `#${rightFill}`, width: 2 }, rectRadius: 6 });
  const labelColorRight = labelColorTpl ? `#${labelColorTpl}` : (helpers.pickTextColorForBackground ? helpers.pickTextColorForBackground(`#${rightFill}`) : '#FFFFFF');
  const rightR = parseInt(rightFill.slice(0,2),16), rightG = parseInt(rightFill.slice(2,4),16), rightB = parseInt(rightFill.slice(4,6),16);
  const aRight = Math.max(0, Math.min(1, fillAlpha));
  const blendRight = (c:number) => Math.round(aRight*c + (1-aRight)*255);
  const effRightHex = `#${[blendRight(rightR), blendRight(rightG), blendRight(rightB)].map(n=>n.toString(16).padStart(2,'0').toUpperCase()).join('')}`;
  const valueColorRight = (helpers.pickTextColorForBackground ? helpers.pickTextColorForBackground(effRightHex) : '#111111');
  if (rawLabelBg && Number.isFinite(labelHeight)) {
    const parsedR = parseColorWithAlpha(String(rawLabelBg));
    if (parsedR) {
      const transparency = Math.round((1 - parsedR.alpha) * 100);
      slide.addShape('rect', { x: rx + boxW + gapX + padX, y: ry + padY, w: boxW - padX*2, h: labelHeight as number, fill: { color: parsedR.hex, transparency }, line: { color: parsedR.hex, width: 0 } } as any);
    } else {
      const hex = String(rawLabelBg).replace('#','');
      slide.addShape('rect', { x: rx + boxW + gapX + padX, y: ry + padY, w: boxW - padX*2, h: labelHeight as number, fill: { color: hex }, line: { color: hex, width: 0 } } as any);
    }
  }
  slide.addText(String(b?.label ?? ''), { x: rx + boxW + gapX + padX, y: ry + padY, w: boxW - padX*2, h: (Number.isFinite(labelHeight)? (labelHeight as number) : 0.36), fontSize: labelFs, bold: labelBold, color: labelColorRight, fontFace: 'Noto Sans JP', align: (labelAlign as any), valign: 'middle', shadow: undefined });
  slide.addText(String(b?.value ?? ''), { x: rx + boxW + gapX + padX, y: ry + padY + (Number.isFinite(labelHeight)? (labelHeight as number) : 0.36) + (Number.isFinite(valueOffsetY) ? valueOffsetY : 0), w: boxW - padX*2, h: boxH - (padY + (Number.isFinite(labelHeight)? (labelHeight as number) : 0.36)), fontSize: valueFs, color: valueColorRight, fontFace: 'Noto Sans JP', align: 'center', valign: 'top' });
  return true;
});

// Callouts (4 boxes)
/**
 * Callouts (4 boxes) renderer
 * Payload: { type: 'callouts', items: Array<{ label: string, value?: string }> }
 * Styles (visualStyles.callouts): boxBgColor, boxLineColor, labelFontSize, valueFontSize,
 *   labelColor, valueColor, cornerRadius, borderWidth, accentHeightRatio, accentAlpha
 */
register('callouts', async ({ slide, payload, region, templateConfig, helpers }) => {
  const rx = region.x, ry = region.y, rw = region.w, rh = region.h;
  const items = Array.isArray(payload?.items) ? payload.items : [];
  const st = getVisualStyle(templateConfig, 'callouts');
  const iconCfg: any = st.icon || {}; const iconEnabled = (iconCfg.enabled === true);
  const iconSize = Number(iconCfg.size); const iconPad = Number(iconCfg.padding);
  const bg = normalizeHex(st.boxBgColor);
  const line = normalizeHex(st.boxLineColor);
  const labelFs = Number(st.labelFontSize); const valueFs = Number(st.valueFontSize);
  const labelColor = normalizeHex(st.labelColor); const valueColor = normalizeHex(st.valueColor);
  const cornerRadius = Number(st.cornerRadius) || 10;
  const borderWidth = Number(st.borderWidth) || 3;
  const accentHeightRatio = Number(st.accentHeightRatio) || 0.28;
  const accentAlpha = Math.max(0, Math.min(1, Number(st.accentAlpha) || 0.25));
  // connectors are no longer used per user request
  if (!bg || !line || !Number.isFinite(labelFs) || !Number.isFinite(valueFs) || !Number.isFinite(iconSize) || !Number.isFinite(iconPad)) { try { console.warn('callouts: missing style values'); } catch {} return false; }
  const count = Math.max(0, items.length);
  if (count === 0) return true;
  // decide grid (columns x rows) dynamically
  let columns = 1; let rows = 1;
  if (count <= 2) { columns = count; rows = 1; }
  else if (count <= 4) { columns = 2; rows = Math.ceil(count / 2); }
  else { columns = 3; rows = Math.ceil(count / 3); }
  const outer = 0.08; const gapX = 0.16; const gapY = 0.16;
  const boxW = Math.max(0.6, (rw - outer * 2 - gapX * (columns - 1)) / columns);
  const boxH = Math.max(0.6, (rh - outer * 2 - gapY * (rows - 1)) / rows);
  for (let i = 0; i < count; i++) {
    const it: any = items[i] || {};
    const row = Math.floor(i / columns); const col = i % columns;
    const x = rx + outer + col * (boxW + gapX);
    const y = ry + outer + row * (boxH + gapY);
    // Resolve per-card accent/base color from palette (used for both border and triangle)
    const baseHex = helpers.getPaletteColor(i).replace('#','');
    // White card with rounded border; border uses same color as triangle
    slide.addShape('rect', { x, y, w: boxW, h: boxH, fill: { color: `#${bg}` }, line: { color: `#${baseHex}`, width: borderWidth }, rectRadius: cornerRadius });
    // Accent isosceles triangle at bottom-right within a square (equilateral-ish by size)
    const transparency = Math.round((1 - accentAlpha) * 100);
    // Right triangle (直角三角形) at bottom-right corner: legs along bottom and right edges
    const accSize = Math.max(0.2, Math.min(boxW, boxH) * accentHeightRatio);
    const triX = x + boxW - accSize;
    const triY = y + boxH - accSize;
    slide.addShape('rtTriangle', { x: triX, y: triY, w: accSize, h: accSize, fill: { color: `#${baseHex}`, transparency }, line: { color: `#${baseHex}`, width: 2 }, flipH: true, flipV: false } as any);
    let iconPath: string | null = null;
    if (iconEnabled) {
      const rawIcon = (it?.iconPath || it?.icon || it?.iconName || '').toString().trim();
      if (rawIcon) {
        if (/\\|\//.test(rawIcon) || /\.(png|jpg|jpeg)$/i.test(rawIcon)) {
          iconPath = rawIcon;
        } else {
          try {
            const { generateImage } = await import('./generateImage');
            const prompt = `${rawIcon}, minimal line icon, monochrome, transparent background`;
            const out = await generateImage({ prompt, aspectRatio: '1:1' });
            if (out && out.success && out.path) iconPath = out.path;
          } catch {}
        }
      }
    }
    // Attempt to enforce transparency for white backgrounds after generation
    const ensureTransparent = async (p: string | null): Promise<string | null> => {
      if (!p) return p;
      try {
        const sharp = (await import('sharp')).default;
        const img = sharp(p).png();
        // Replace near-white pixels with transparency using chroma key-like approach
        const { data, info } = await img.raw().toBuffer({ resolveWithObject: true });
        const out = Buffer.from(data);
        for (let i = 0; i < out.length; i += info.channels) {
          const r = out[i], g = out[i+1], b = out[i+2];
          const aIdx = i + (info.channels - 1);
          const nearWhite = r > 245 && g > 245 && b > 245;
          if (nearWhite) out[aIdx] = 0; // set alpha to 0
        }
        const outPath = p.replace(/\.(jpg|jpeg)$/i, '.png');
        await sharp(out, { raw: { width: info.width, height: info.height, channels: info.channels } }).png().toFile(outPath);
        return outPath;
      } catch { return p; }
    };
    if (iconPath) {
      try { iconPath = await ensureTransparent(iconPath); } catch {}
    }
    // Title centered at top
    const labelColorFinal = ((): string => {
      if (typeof (st as any)?.labelColor === 'string' && String((st as any).labelColor).trim().toLowerCase() !== 'auto') {
        const hex = normalizeHex((st as any).labelColor);
        if (hex) return `#${hex}`;
      }
      const autoTxtOnCard = (helpers && helpers.pickTextColorForBackground) ? helpers.pickTextColorForBackground(`#${bg}`) : '#111111';
      return autoTxtOnCard;
    })();
    slide.addText(String(it?.label ?? ''), { x: x + 0.16, y: y + 0.18, w: boxW - 0.32, h: 0.4, fontSize: labelFs, bold: true, fontFace: 'Noto Sans JP', color: labelColorFinal, align: 'center' });
    // Icon inside the right triangle near centroid
    if (iconPath) {
      const iconBox = accSize * 0.5;
      const cx = triX + (2 * accSize) / 3; // centroid x
      const cy = triY + (2 * accSize) / 3; // centroid y
      const iconX = cx - iconBox / 2;
      const iconY = cy - iconBox / 2;
      slide.addImage({ path: iconPath, x: iconX, y: iconY, w: iconBox, h: iconBox, sizing: { type: 'contain', w: iconBox, h: iconBox } as any });
    }
    // Body text area (full width minus margins). Use `value` for consistency across visuals.
    const bodyText = String((it as any)?.value ?? '');
    const valueColorFinal = ((): string => {
      if (typeof (st as any)?.valueColor === 'string' && String((st as any).valueColor).trim().toLowerCase() !== 'auto') {
        const hex = normalizeHex((st as any).valueColor);
        if (hex) return `#${hex}`;
      }
      const autoTxtOnCard = (helpers && helpers.pickTextColorForBackground) ? helpers.pickTextColorForBackground(`#${bg}`) : '#111111';
      return autoTxtOnCard;
    })();
    slide.addText(bodyText, { x: x + 0.22, y: y + 0.58, w: boxW - 0.44, h: boxH - 1.1, fontSize: valueFs, fontFace: 'Noto Sans JP', color: valueColorFinal, align: 'left', valign: 'top' });
  }
  return true;
});

// KPI cards (1〜4件)
/**
 * KPI cards (1〜4件) renderer
 * Payload: { type: 'kpi', items: Array<{ label: string; value: string; trend?: 'up'|'down' }> }
 * Styles (visualStyles.kpi): cardFill, cardLine, labelFontSize, valueFontSize, gapX, gapY, cornerRadius
 */
register('kpi', ({ slide, payload, region, templateConfig, helpers }) => {
  const rx = region.x, ry = region.y, rw = region.w, rh = region.h;
  const items = Array.isArray(payload?.items) ? payload.items : [];
  const count = Math.min(6, items.length);
  if (!count) return true;
  const columns = (count <= 3) ? 1 : 2; const rows = Math.ceil(count / columns);
  const st = getVisualStyle(templateConfig, 'kpi');
  const gap = columns === 1 ? Number(st.layout?.gap1Col) : Number(st.layout?.gap2Col);
  const outerMargin = columns === 1 ? Number(st.layout?.outerMargin1Col) : Number(st.layout?.outerMargin2Col);
  const innerPadX = Number(st.layout?.innerPadX);
  const cardW = Math.max(0.8, (rw - (columns - 1) * gap - outerMargin * 2) / columns);
  const cardH = (rh - (rows - 1) * gap - outerMargin * 2) / rows;
  const labelFs = Number(st.labelFontSize);
  const valueFs = Number(st.valueFontSize);
  const labelTopOffset = Number(st.labelTopOffset);
  const labelHeight = Number(st.labelHeight);
  const valueTopOffset = Number(st.valueTopOffset);
  const valueBottomPad = Number(st.valueBottomPad);
  // Pastel fill alpha (align with bar_chart alpha.barFill)
  const fallbackBarAlpha = Number((templateConfig?.visualStyles?.bar_chart?.alpha?.barFill)) || 0.2;
  const barAlpha = Number((st as any)?.alpha?.barFill);
  const fillAlpha = Number.isFinite(barAlpha) ? (barAlpha as number) : fallbackBarAlpha;
  // Icon configuration (optional)
  const iconCfg: any = st.icon || {};
  const iconEnabled = iconCfg.enabled === true;
  const iconSize = Number(iconCfg.size) || 0.36;
  const iconPad = Number(iconCfg.padding) || 0.08;
  const glyphColorFixed = String((iconCfg.fixed && iconCfg.fixed.glyph) || 'black');
  const bgColorFixed = String((iconCfg.fixed && iconCfg.fixed.background) || 'white');
  if (![gap, outerMargin, innerPadX, labelFs, valueFs, labelTopOffset, labelHeight, valueTopOffset, valueBottomPad].every(Number.isFinite)) {
    try { console.warn('kpi: missing layout/offset styles in template'); } catch {}
    return false;
  }
  for (let idx = 0; idx < count; idx++) {
    const it = items[idx] || {}; const row = Math.floor(idx / columns); const col = idx % columns;
    const x = rx + outerMargin + col * (cardW + gap); const y = ry + outerMargin + row * (cardH + gap);
    // Generate pastel fill and solid border like bar_chart
    const baseHex = helpers.getPaletteColor(idx).replace('#','');
    const transparency = Math.round((1 - Math.max(0, Math.min(1, fillAlpha))) * 100);
    // 1) White underlay to avoid background mixing
    slide.addShape('rect', { x, y, w: cardW, h: cardH, fill: { color: 'FFFFFF' }, line: { color: 'FFFFFF', width: 0 }, rectRadius: 6 });
    // 2) Actual pastel card on top
    slide.addShape('rect', { x, y, w: cardW, h: cardH, fill: { color: baseHex, transparency }, line: { color: `#${baseHex}`, width: 2 }, rectRadius: 6 });
    const txtX = x + innerPadX; const txtW = Math.max(0.5, cardW - innerPadX * 2);
    const label = String(it?.label ?? ''); const value = String(it?.value ?? '');
    // Compute effective background color over white for contrast
    const r = parseInt(baseHex.slice(0,2),16), g = parseInt(baseHex.slice(2,4),16), b = parseInt(baseHex.slice(4,6),16);
    const a = Math.max(0, Math.min(1, fillAlpha));
    const blend = (c:number) => Math.round(a*c + (1-a)*255);
    const effHex = [blend(r), blend(g), blend(b)].map(n=>n.toString(16).padStart(2,'0').toUpperCase()).join('');
    const autoTxt = helpers.pickTextColorForBackground(`#${effHex}`);
    // Optional icon rendering
    let iconRendered = false;
    if (iconEnabled && (it?.icon || it?.iconPath || it?.iconName)) {
      let iconPath: string | null = null;
      const rawIcon = String((it?.iconPath || it?.icon || it?.iconName || '')).trim();
      if (rawIcon) {
        if (/\.|\//.test(rawIcon)) {
          iconPath = rawIcon;
        }
      }
      (async () => {
        try {
          if (!iconPath && rawIcon) {
            const { generateImage } = await import('./generateImage');
            const styleHint = (iconCfg.style ? String(iconCfg.style) : 'line');
            const monochrome = iconCfg.monochrome !== false;
            const prompt = `${rawIcon}, minimal ${styleHint} icon${monochrome? ', monochrome':''}, solid ${glyphColorFixed} glyph on ${bgColorFixed} square background, centered, no text`;
            const out = await generateImage({ prompt, aspectRatio: '1:1' });
            if (out && out.success && out.path) iconPath = out.path;
          }
        } catch {}
        try {
          if (iconPath) {
            const iw = Math.min(iconSize, cardW * 0.3);
            const ih = iw;
            // overlap top-left corner (50% outside the card)
            const ix = x - iw * 0.5;
            const iy = y - ih * 0.5;
            // background white behind icon to guarantee white background
            slide.addShape('rect', { x: ix, y: iy, w: iw, h: ih, fill: { color: 'FFFFFF' }, line: { color: 'FFFFFF', width: 0 } });
            slide.addImage({ path: iconPath, x: ix, y: iy, w: iw, h: ih, sizing: { type: 'contain', w: iw, h: ih } as any });
            iconRendered = true;
          }
        } catch {}
      })();
    }
    const safeLabelTop = iconRendered ? Math.max(labelTopOffset as number, iconPad + iconSize + 0.06) : (labelTopOffset as number);
    slide.addText(label, { x: txtX, y: y + safeLabelTop, w: txtW, h: labelHeight, fontSize: labelFs, bold: true, color: autoTxt, align: 'center', fontFace: 'Noto Sans JP', valign: 'top' });
    slide.addText(value, { x: txtX, y: y + valueTopOffset, w: txtW, h: Math.max(0.2, cardH - (valueTopOffset + valueBottomPad)), fontSize: valueFs, color: autoTxt, align: 'center', fontFace: 'Noto Sans JP', valign: 'top' });
  }
  return true;
});

// KPI donut（画像生成で代替）
/**
 * KPI donut renderer (image-based)
 * Payload: { type: 'kpi_donut', items: Array<{ label: string; value: number }> }
 * Styles (visualStyles.kpi_donut): ring{Thickness,Gap,Bg}, labelFontSize, valueFontSize
 */
register('kpi_donut', async ({ slide, payload, region, templateConfig }) => {
  const items = Array.isArray(payload?.items) ? payload.items : [];
  const labels = items.map((it:any)=>String(it?.label ?? ''));
  const values = items.map((it:any)=>Number(it?.value ?? 0));
  const chartsStyle = (templateConfig?.visualStyles?.kpi_donut) || {};
  // Align color alpha behavior with other pie-like charts (use alpha.pieDoughnut)
  const chartsStyleMerged = { ...chartsStyle };
  if (chartsStyleMerged.alpha == null && (templateConfig?.visualStyles?.pie_chart?.alpha)) {
    chartsStyleMerged.alpha = templateConfig.visualStyles.pie_chart.alpha;
  }
  const img = await renderChartImage('doughnut', labels, values, payload?.title || '', chartsStyleMerged);
  if (img) {
    // Use square placement to avoid ellipse distortion (PPTX stretch)
    const pad = Math.max(0, Number((chartsStyle as any)?.pad) || 0.12);
    const innerW = Math.max(0.2, region.w - pad * 2);
    const innerH = Math.max(0.2, region.h - pad * 2);
    const side = Math.min(innerW, innerH);
    const x = region.x + (region.w - side) / 2; // center horizontally
    const y = region.y + pad; // top-align vertically within padded region
    slide.addImage({
      path: img,
      x,
      y,
      w: side,
      h: side,
      shadow: ((chartsStyle as any)?.shadow ? { type: 'outer', color: '000000', opacity: 0.45, blur: 12, offset: 4, angle: 45 } as any : undefined)
    });
  }
  return true;
});

// Funnel
/**
 * Funnel renderer
 * Payload:
 *   {
 *     type: 'funnel',
 *     steps: Array<{ label: string; value: number }>
 *   }
 * Styles (visualStyles.funnel):
 *   - labelFontSize, valueFontSize, baseColor, gradient{MinRatio,MaxRatio,Gamma},
 *     alpha.barFill, borderColor, borderWidth
 */
register('funnel', ({ slide, payload, region, templateConfig, helpers }) => {
  // Draw proportional funnel based on steps[].value, with Y-axis labels on the left and value centered in each band
  const rx = region.x, ry = region.y, rw = region.w, rh = Math.max(0.2, region.h - 0.05);
  const steps = Array.isArray(payload?.steps) ? payload.steps : [];
  const n = Math.max(1, Math.min(steps.length || 1, 12));
  const st = getVisualStyle(templateConfig, 'funnel');
  const labelFsRaw = Number((st as any)?.labelFontSize) || 14;
  const labelFs = Math.max(labelFsRaw, 18); // make labels larger by default
  const valueFs = Math.max(Number((st as any)?.valueFontSize) || (labelFs + 2), 20); // value larger than label
  // Allocate left label area dynamically（折返し回避しつつ取りすぎない）
  const labels = steps.slice(0, n).map((s: any)=>String(s?.label ?? ''));
  let labelW = computeLabelAreaWidth(labels, labelFs, 0.10, rw, { min: 1.0, maxRatio: 0.25, fudge: 1.25 });
  const rightPad = 0.2;
  if (rw < 3) {
    // Safety for unexpectedly narrow regions
    labelW = Math.min(labelW, Math.max(0.8, rw * 0.2));
  }
  let chartX = rx + labelW; let chartW = Math.max(rw * 0.6, rw - labelW - rightPad);
  if (rw < 3) {
    chartW = Math.max(1.5, rw - labelW - rightPad);
    chartX = rx + (rw - chartW) / 2; // center visually if extremely narrow region
  }
  // Compute maxVal first for safe logging
  const normalizedValues: number[] = [];
  let maxVal = 0; for (let i = 0; i < n; i++) { const v = parseNumeric(steps[i]?.value ?? 0); normalizedValues.push(v); maxVal = Math.max(maxVal, v); }
  if (!Number.isFinite(maxVal) || maxVal <= 0) maxVal = 1;
  const segGap = 0.04; const segH = (rh - segGap * (n - 1)) / n;
  // Value scaling
  // maxVal already computed above
  // Determine base color (single hue), and top blend color (for bright top)
  const stBase = normalizeHex((st as any)?.baseColor);
  const themePrimary = normalizeHex((templateConfig?.tokens?.primary));
  const baseHex = (stBase || themePrimary || helpers.getPaletteColor(0).replace('#','')) as string;
  const topBlendHex = normalizeHex((st as any)?.gradientTopColor) || 'FFFFFF';
  // Shade function: make darker as index increases
  // Blend base toward white (or specified top color) for brighter top layers
  const hexToRgb = (h: string) => ({ r: parseInt(h.slice(0,2),16), g: parseInt(h.slice(2,4),16), b: parseInt(h.slice(4,6),16) });
  const toHex2 = (n:number)=>n.toString(16).padStart(2,'0').toUpperCase();
  const blendToward = (fromHex: string, toHex: string, t: number): string => {
    const a = hexToRgb(fromHex); const b = hexToRgb(toHex);
    const r = Math.round(a.r + (b.r - a.r) * t);
    const g = Math.round(a.g + (b.g - a.g) * t);
    const bl = Math.round(a.b + (b.b - a.b) * t);
    return `${toHex2(r)}${toHex2(g)}${toHex2(bl)}`;
  };
  // Resolve alpha for fill from template (semi-transparent fill, opaque border)
  const fillAlpha = (() => {
    const a = Number((st as any)?.alpha?.barFill);
    return Number.isFinite(a) ? Math.max(0, Math.min(1, a)) : 0.2;
  })();
  const toTransp = (a:number) => Math.round((1 - a) * 100);
  // Gradient shaping controls
  const minR = (() => { const r = Number((st as any)?.gradientMinRatio); return (r > 0 && r < 1) ? r : 0.1; })();
  const maxR = (() => { const r = Number((st as any)?.gradientMaxRatio); return (r > 0 && r <= 1) ? r : 1.0; })();
  const gamma = (() => { const g = Number((st as any)?.gradientGamma); return Number.isFinite(g) && g > 0 ? g : 1.0; })();
  for (let i = 0; i < n; i++) {
    const it: any = steps[i] || {};
    const y = ry + i * (segH + segGap);
    const v = Math.max(0, parseNumeric(it?.value ?? 0));
    const w = Math.max(0.2, chartW * (v / maxVal));
    const x = chartX + (chartW - w) / 2;
    // Top is lighter, bottom is darker
    const tLin = n <= 1 ? 1 : (1 - i / Math.max(1, n - 1));
    const t = Math.pow(tLin, gamma);
    const ratio = minR + (maxR - minR) * t; // range within 0..1
    // First brighten toward top color using (1 - ratio), then ensure base tone influence by ratio
    const col = blendToward(baseHex, topBlendHex, 1 - ratio);
    const txt = helpers.pickTextColorForBackground(col);
    // band trapezoid (centered), flipped vertically so top is wider than bottom
    // Border color/width: allow template override; default to subtle (0.5in) and same hue as fill
    const lineCol = normalizeHex((st as any)?.borderColor) || col;
    const lineW = Number.isFinite(Number((st as any)?.borderWidth)) ? Number((st as any)?.borderWidth) : 0.5;
    slide.addShape('trapezoid', { x, y, w, h: segH, fill: { color: col, transparency: toTransp(fillAlpha) }, line: { color: `#${lineCol}`, width: lineW }, flipV: true } as any);
    // value centered (larger) - auto contrast (black/white)
    slide.addText(String(v), { x, y, w, h: segH, fontSize: valueFs, fontFace: 'Noto Sans JP', align: 'center', valign: 'middle', color: `#${txt}`, fit: 'resize', wrap: false });
    // y-axis label at left（fitで折返し回避） - force black and larger
    slide.addText(String(it?.label ?? ''), { x: rx, y, w: Math.max(0.2, labelW - 0.1), h: segH, fontSize: labelFs, fontFace: 'Noto Sans JP', align: 'right', valign: 'middle', fit: 'resize', wrap: false, color: '#000000' });
  }
  return true;
});

// Timeline
/**
 * Timeline renderer
 * Payload: { type: 'timeline', steps: Array<{ label: string; date?: string }> }
 * Styles (visualStyles.timeline): axisLineColor, axisLineWidth, pointFill, pointLine, pointSize, labelFontSize, labelColor
 */
register('timeline', ({ slide, payload, region, templateConfig }) => {
  const rx = region.x, ry = region.y, rw = region.w, rh = region.h;
  const steps = Array.isArray(payload?.steps) ? payload.steps : [];
  const st = getVisualStyle(templateConfig, 'timeline');
  const axisLineColor = normalizeHex(st.axisLineColor);
  const axisLineWidth = Number(st.axisLineWidth);
  const pointFill = normalizeHex(st.pointFill);
  const pointLine = normalizeHex(st.pointLine);
  const pointSize = Number(st.pointSize);
  const labelFs = Number(st.labelFontSize);
  const labelColorSpec = (st as any)?.labelColor;
  if (!axisLineColor || !Number.isFinite(axisLineWidth) || !pointFill || !pointLine || !Number.isFinite(pointSize) || !Number.isFinite(labelFs)) {
    try { console.warn('timeline: missing style values'); } catch {}
    return false;
  }
  slide.addShape('line', { x: rx, y: ry + rh/2, w: rw, h: 0, line: { color: `#${axisLineColor}`, width: axisLineWidth } });
  const nSteps = Math.max(1, steps.length);
  const seg = rw / nSteps;
  steps.slice(0, 6).forEach((s: any, i: number) => {
    const cx = rx + i * seg + seg / 2;
    slide.addShape('ellipse', { x: cx - (pointSize/2), y: ry + rh/2 - (pointSize/2), w: pointSize, h: pointSize, fill: { color: `#${pointFill}` }, line: { color: `#${pointLine}`, width: 0.8 } });
    const finalColor = ((): string => {
      if (typeof labelColorSpec === 'string' && labelColorSpec.trim().toLowerCase() !== 'auto') {
        const hex = normalizeHex(labelColorSpec);
        if (hex) return `#${hex}`;
      }
      return '#111111';
    })();
    slide.addText(String(s?.label ?? ''), { x: Math.max(rx, cx - 0.9), y: ry + rh/2 + 0.18, w: Math.min(1.8, rw), h: 0.32, fontSize: labelFs, align: 'center', fontFace: 'Noto Sans JP', color: finalColor, fit: 'resize', wrap: false });
  });
  return true;
});

// Process
/**
 * Process renderer (horizontal stages)
 * Payload: { type: 'process', steps: Array<{ label: string }> }
 * Styles (visualStyles.process): box{Fill,Line,Radius}, connector{LineColor,LineWidth}, labelFontSize
 */
register('process', ({ slide, payload, region, templateConfig, helpers }) => {
  const rx = region.x, ry = region.y, rw = region.w, rh = region.h;
  const steps = Array.isArray(payload?.steps) ? payload.steps : [];
  const st = getVisualStyle(templateConfig, 'process');
  const maxSteps = Number(st.maxSteps);
  const gap = Number(st.gapX);
  const stepWMax = Number(st.stepWidthMax);
  const stepHMax = Number(st.stepHeightMax);
  const startYRatio = Number(st.startYRatio);
  const labelFs = Number(st.labelFontSize);
  const labelColorSpec = (st as any)?.labelColor;
  const arrowColor = normalizeHex(st.arrowColor);
  if (![maxSteps, gap, stepWMax, stepHMax, startYRatio, labelFs].every(Number.isFinite) || !arrowColor) { try { console.warn('process: missing style values'); } catch {} return false; }
  const totalGap = gap * Math.max(0, maxSteps - 1);
  const stepW = Math.min(stepWMax, (rw - totalGap) / Math.max(1, maxSteps));
  const stepH = Math.min(rh * 0.6, stepHMax); const startY = ry + rh * startYRatio;
  for (let i = 0; i < Math.min(maxSteps, steps.length || maxSteps); i++) {
    const x = rx + i * (stepW + gap); const col = helpers.getPaletteColor(i).replace('#','');
    slide.addShape('rect', { x, y: startY, w: stepW, h: stepH, fill: { color: col }, line: { color: '#FFFFFF', width: 0.5 } });
    const procLabelColor = ((): string => {
      if (typeof labelColorSpec === 'string' && labelColorSpec.trim().toLowerCase() !== 'auto') {
        const hex = normalizeHex(labelColorSpec);
        if (hex) return `#${hex}`;
      }
      return '#111111';
    })();
    slide.addText(String(steps[i]?.label ?? ''), { x: x + 0.08, y: startY + 0.14, w: stepW - 0.16, h: stepH - 0.28, fontSize: labelFs, color: procLabelColor, align: 'center', valign: 'middle', fontFace: 'Noto Sans JP' });
    if (i < Math.min(maxSteps, steps.length || maxSteps) - 1) slide.addShape('chevron', { x: x + stepW + (gap - 0.4)/2, y: startY + (stepH - 0.4)/2, w: 0.4, h: 0.4, fill: { color: `#${arrowColor}` }, line: { color: `#${arrowColor}`, width: 0 } } as any);
  }
  return true;
});

// Roadmap
/**
 * Roadmap renderer
 * Payload: { type: 'roadmap', phases: Array<{ label: string; items?: string[] }> }
 * Styles (visualStyles.roadmap): lane{Fill,Line}, milestone{Fill,Line,Radius}, labelFontSize, itemFontSize
 */
register('roadmap', ({ slide, payload, region, templateConfig, helpers }) => {
  try { logger.info('roadmap: start'); } catch {}
  const rx = region.x, ry = region.y, rw = region.w, rh = region.h;
  const milestones = (Array.isArray(payload?.milestones) ? payload.milestones : []).slice(0, 8);
  if (!milestones.length) return true;
  const st = getVisualStyle(templateConfig, 'roadmap');
  const labelFs = Number(st.labelFontSize) || 16;
  const subFs = Number(st.dateFontSize) || 11;
  const gap = Number.isFinite(Number((st as any)?.gapX)) ? Number((st as any)?.gapX) : 0.0; // in
  const outerPad = 0.10; // fixed outer padding
  const chevronAlpha = (() => { const a = Number((st as any)?.alpha?.barFill); return Number.isFinite(a) ? Math.max(0, Math.min(1, a)) : 0.2; })();
  const toTransp = (a:number) => Math.round((1 - a) * 100);
  const boxH = Math.max(0.4, rh * 0.60);
  const y = ry + (rh - boxH) / 2;
  const n = milestones.length;
  // Fixed tip overlap ratio; gapのみで間隔を制御
  const tipRatio = 0.35;
  const avail = rw - outerPad * 2;
  // totalW = n*segW - (n-1)*(tipRatio*segW) + gap*(n-1)
  const denom = Math.max(0.1, n - tipRatio * (n - 1));
  const segW = Math.max(0.6, (avail - gap * (n - 1)) / denom);
  // 小さな見かけの隙間を吸収するため、gapX=0（または極小）のときは微小オーバーラップを入れる
  const epsilon = (gap <= 0.0001) ? Math.max(0.06, segW * 0.02) : 0; // in
  const step = segW * (1 - tipRatio) + gap - epsilon;
  // Precompute layout for all chevrons
  const items: Array<{ x: number; w: number; baseHex: string; txtColor: string; head: string; tail: string }>=[];
  for (let i = 0; i < n; i++) {
    const m: any = milestones[i] || {};
    const x = rx + outerPad + i * step;
    const baseHex = helpers.getPaletteColor(i).replace('#','');
    const rC = parseInt(baseHex.slice(0,2),16), gC = parseInt(baseHex.slice(2,4),16), bC = parseInt(baseHex.slice(4,6),16);
    const aC = Math.max(0, Math.min(1, chevronAlpha));
    const blend = (c:number)=> Math.round(aC*c + (1-aC)*255);
    const effHex = `#${[blend(rC),blend(gC),blend(bC)].map(n=>n.toString(16).padStart(2,'0').toUpperCase()).join('')}`;
    const txtColor = (helpers && helpers.pickTextColorForBackground) ? helpers.pickTextColorForBackground(effHex) : '#111111';
    const head = String(m?.label ?? '');
    const tail = ((): string => {
      if (m?.detail) return String(m.detail);
      if (m?.value) return String(m.value);
      if (m?.date) return String(m.date);
      return '';
    })();
    items.push({ x, w: segW, baseHex, txtColor, head, tail });
  }
  // 1st pass: draw all chevrons (bottom layer)
  for (const it of items) {
    slide.addShape('chevron', { x: it.x, y, w: it.w, h: boxH, fill: { color: `#${it.baseHex}`, transparency: toTransp(chevronAlpha) }, line: { color: `#${it.baseHex}`, width: 0 } });
  }
  // 2nd pass: draw all texts on top
  for (const it of items) {
    const headX = it.x + it.w * 0.46;
    const headW = Math.max(0.2, it.w - (headX - it.x) - 0.12);
    slide.addText(it.head, { x: headX, y: y + boxH * 0.26 - 0.1, w: headW, h: boxH * 0.36, fontSize: labelFs, bold: true, align: 'left', valign: 'middle', color: it.txtColor, fontFace: 'Noto Sans JP' });
    if (it.tail) {
      const tailX = it.x + it.w * 0.38;
      const tailW = Math.max(0.2, it.w - (tailX - it.x) - 0.12);
      slide.addText(it.tail, { x: tailX, y: y + boxH * 0.62 - 0.06, w: tailW, h: boxH * 0.28, fontSize: subFs, align: 'left', valign: 'top', color: it.txtColor, fontFace: 'Noto Sans JP' });
    }
  }
  try { logger.info('roadmap: done'); } catch {}
  return true;
});

// Pyramid
/**
 * Pyramid renderer
 * Payload: { type: 'pyramid', steps: Array<{ label: string; value: number }> }
 * Styles (visualStyles.pyramid): baseColor, gradient{MinRatio,MaxRatio,Gamma}, labelFontSize, valueFontSize
 */
register('pyramid', ({ slide, payload, region, templateConfig, helpers }) => {
  /* pyramid: start */
  const getCustomGeometryType = (_sl: any): any => {
    // Prefer canonical key used in gen-xml.ts ('custGeom') per upstream
    return 'custGeom';
  };
  const CUSTOM = getCustomGeometryType(slide);
  /* pyramid: custom-geometry-type resolved */

  // --- Render pyramid using customGeometry ---
  const rx = region.x, ry = region.y, rw = region.w, rh = region.h;
  const steps = Array.isArray(payload?.steps) ? payload.steps : [];
  const st = getVisualStyle(templateConfig, 'pyramid');
  const maxLayers = Number(st.maxLayers);
  const labelFs = Number(st.labelFontSize);
  const labelColorSpec = (st as any)?.labelColor;
  const borderW = Number(st.borderWidth);
  if (!Number.isFinite(maxLayers) || !Number.isFinite(labelFs)) { try { console.warn('pyramid: missing style values'); } catch {} return false; }

  // Determine layer count
  const layers = Math.min(Math.max(2, maxLayers), (steps.length || maxLayers));

  // Compute equilateral triangle that fits the region and is vertically centered
  const hForSide = (s:number)=> s * Math.sqrt(3) / 2;
  const sMaxByWidth = rw; // base side cannot exceed width
  const sMaxByHeight = rh * 2 / Math.sqrt(3);
  const side = Math.min(sMaxByWidth, sMaxByHeight);
  const height = hForSide(side);
  const triX = rx + (rw - side) / 2;
  const triY = ry + (rh - height) / 2; // vertical center
  /* geometry computed for pyramid */

  // (Outer border will be drawn AFTER layers using FREEFORM so it sits on top)

  // Draw colored layers as trapezoids sized to equilateral geometry
  const bandH = height / layers;
  const fillAlpha = (() => { const a = Number((st as any)?.alpha?.barFill); return Number.isFinite(a) ? Math.max(0, Math.min(1, a)) : 0.35; })();
  const transparency = Math.round((1 - fillAlpha) * 100);
  const blendOverWhite = (hex6: string): string => {
    const rC = parseInt(hex6.slice(0,2),16), gC = parseInt(hex6.slice(2,4),16), bC = parseInt(hex6.slice(4,6),16);
    const a = fillAlpha; const blend = (c:number)=> Math.round(a*c + (1-a)*255);
    const toHex2 = (n:number)=> n.toString(16).padStart(2,'0').toUpperCase();
    return `${toHex2(blend(rC))}${toHex2(blend(gC))}${toHex2(blend(bC))}`;
  };
  for (let i = 0; i < layers; i++) {
    const yTop = triY + bandH * i;
    const yBottom = yTop + bandH;
    const tTop = (i) / layers; const tBottom = (i + 1) / layers; // 0..1 from top
    const widthTop = Math.max(0, side * tTop);
    const widthBottom = Math.max(0.1, side * tBottom);
    const leftTop = triX + (side - widthTop) / 2;
    const leftBottom = triX + (side - widthBottom) / 2;
    const colHex = helpers.getPaletteColor(i).replace('#','');
    if (i === 0) {
      // Top layer: triangle — use local bbox and points relative to bbox
      const raw = [
        { x: triX + side / 2, y: yTop },
        { x: leftBottom + widthBottom, y: yBottom },
        { x: leftBottom, y: yBottom },
      ];
      const minX = Math.min(...raw.map(p=>p.x));
      const minY = Math.min(...raw.map(p=>p.y));
      const maxX = Math.max(...raw.map(p=>p.x));
      const maxY = Math.max(...raw.map(p=>p.y));
      const points = [
        { x: raw[0].x - minX, y: raw[0].y - minY, moveTo: true },
        { x: raw[1].x - minX, y: raw[1].y - minY },
        { x: raw[2].x - minX, y: raw[2].y - minY },
        { close: true } as any,
      ];
      /* pyramid: add top layer */
      slide.addShape(CUSTOM, { x: minX, y: minY, w: (maxX - minX) || 0.01, h: (maxY - minY) || 0.01, points: points as any, fill: { color: `#${colHex}`, transparency }, line: { color: `#${colHex}`, width: Number.isFinite(borderW) ? borderW : 1 } } as any);
    } else {
      // Trapezoid band — local bbox + relative points
      const raw = [
        { x: leftTop, y: yTop },
        { x: leftTop + widthTop, y: yTop },
        { x: leftBottom + widthBottom, y: yBottom },
        { x: leftBottom, y: yBottom },
      ];
      const minX = Math.min(...raw.map(p=>p.x));
      const minY = Math.min(...raw.map(p=>p.y));
      const maxX = Math.max(...raw.map(p=>p.x));
      const maxY = Math.max(...raw.map(p=>p.y));
      const points = [
        { x: raw[0].x - minX, y: raw[0].y - minY, moveTo: true },
        { x: raw[1].x - minX, y: raw[1].y - minY },
        { x: raw[2].x - minX, y: raw[2].y - minY },
        { x: raw[3].x - minX, y: raw[3].y - minY },
        { close: true } as any,
      ];
      /* pyramid: add band */
      slide.addShape(CUSTOM, { x: minX, y: minY, w: (maxX - minX) || 0.01, h: (maxY - minY) || 0.01, points: points as any, fill: { color: `#${colHex}`, transparency }, line: { color: `#${colHex}`, width: Number.isFinite(borderW) ? borderW : 1 } } as any);
    }
    // Label centered in the band (use generous width ~ bottom edge width to avoid wrapping on small top bands)
    const widthLabel = Math.max(widthTop, widthBottom) * 0.92; // generous width for readability
    const leftLabel = triX + (side - widthLabel) / 2;
    const label = String(steps[i]?.label ?? '');
    const effHex = blendOverWhite(colHex);
    const autoTxt = helpers.pickTextColorForBackground(`#${effHex}`);
    const useTplColor = ((): string | undefined => {
      if (typeof labelColorSpec === 'string' && labelColorSpec.trim()) {
        const s = labelColorSpec.trim();
        if (s.toLowerCase() === 'auto') return undefined;
        const hex = normalizeHex(s);
        return hex ? `#${hex}` : undefined;
      }
      return undefined;
    })();
    const finalTxt = useTplColor || autoTxt;
    slide.addText(label, { x: leftLabel, y: yTop + bandH * 0.22, w: Math.max(0.1, widthLabel), h: bandH * 0.56, fontSize: labelFs, color: finalTxt, align: 'center', valign: 'middle', fontFace: 'Noto Sans JP', fit: 'resize', wrap: false });
  }
  // Draw outer border on TOP using FREEFORM silhouette (transparent fill, opaque border)
  const outerPts = [
    { x: triX + side / 2, y: triY },
    { x: triX + side, y: triY + height },
    { x: triX, y: triY + height },
  ];
  const outerMinX = Math.min(...outerPts.map(p=>p.x));
  const outerMinY = Math.min(...outerPts.map(p=>p.y));
  const outerMaxX = Math.max(...outerPts.map(p=>p.x));
  const outerMaxY = Math.max(...outerPts.map(p=>p.y));
  // No overall outer border per requirements

  return true;
});

// Map markers
/**
 * Map markers renderer
 * Payload: { type: 'map_markers', markers: Array<{ label: string; lat: number; lng: number }> }
 * Styles (visualStyles.map_markers): pin{Fill,Line,Size}, labelFontSize, mapProvider
 */
register('map_markers', async ({ slide, payload, region, templateConfig }) => {
  const rx = region.x, ry = region.y, rw = region.w, rh = region.h;
  const st = getVisualStyle(templateConfig, 'map_markers');
  const markers: Array<{ label?: string; x?: number; y?: number; lon?: number; lat?: number }> = Array.isArray(payload?.markers) ? payload.markers : [];
  const apiKey = (process && process.env && process.env.GOOGLE_MAP_API_KEY) ? String(process.env.GOOGLE_MAP_API_KEY) : '';
  const hasLonLat = markers.some((m: { lon?: number; lat?: number }) => Number.isFinite(Number(m?.lon)) && Number.isFinite(Number(m?.lat)));
  try { logger.info('map_markers: start'); } catch {}
  if (apiKey && hasLonLat) {
    const pts = markers.map((m: { lon?: number; lat?: number; label?: string }) => ({ lon: Number(m.lon), lat: Number(m.lat), label: String(m.label || '') }));
    const lonMin = Math.min(...pts.map((p: { lon: number }) => p.lon)), lonMax = Math.max(...pts.map((p: { lon: number }) => p.lon));
    const latMin = Math.min(...pts.map((p: { lat: number }) => p.lat)), latMax = Math.max(...pts.map((p: { lat: number }) => p.lat));
    const centerLon = Number.isFinite(Number(payload?.center?.lon)) ? Number(payload.center.lon) : (lonMin + lonMax) / 2;
    const centerLat = Number.isFinite(Number(payload?.center?.lat)) ? Number(payload.center.lat) : (latMin + latMax) / 2;
    const pad = Math.max(1.0, Number((st as any)?.zoomPaddingKm) || 1.2);
    const spanLon = Math.max(0.0001, (lonMax - lonMin) * pad);
    const spanLat = Math.max(0.0001, (latMax - latMin) * pad);
    const zoom = (() => {
      if (Number.isFinite(Number(payload?.zoom))) return Math.max(3, Math.min(18, Number(payload.zoom)));
      const span = Math.max(spanLon, spanLat);
      const z = Math.floor(Math.log2(360 / Math.max(span, 0.0001)));
      return Math.max(3, Math.min(18, z - 1));
    })();
    const base = 'https://maps.googleapis.com/maps/api/staticmap';
    const size = { w: 640, h: 640, scale: 2 };
    const mtype = (st as any)?.google?.mapType || 'roadmap';
    const params: string[] = [];
    params.push(`center=${centerLat.toFixed(6)},${centerLon.toFixed(6)}`);
    params.push(`zoom=${zoom}`);
    params.push(`size=${size.w}x${size.h}`);
    params.push(`scale=${size.scale}`);
    params.push(`maptype=${encodeURIComponent(mtype)}`);
    const letters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
    pts.slice(0, 50).forEach((p: { lat: number; lon: number }, i: number) => {
      const L = letters[i % letters.length];
      params.push(`markers=color:red|label:${L}|${p.lat.toFixed(6)},${p.lon.toFixed(6)}`);
    });
    /* map_markers: request preview (removed) */
    params.push(`key=${encodeURIComponent(apiKey)}`);
    const url = `${base}?${params.join('&')}`;
    try {
      const httpsMod: any = await import('https');
      const { buf, status, ctype } = await new Promise((resolve, reject) => {
        httpsMod.get(url, (res: any) => {
          const chunks: any[] = [];
          res.on('data', (d: any) => chunks.push(d));
          res.on('end', () => resolve({ buf: Buffer.concat(chunks), status: res.statusCode || 0, ctype: String(res.headers['content-type'] || '') }));
          res.on('error', reject);
        }).on('error', reject);
      }) as { buf: Buffer; status: number; ctype: string };
      const isPng = buf && buf.length > 8 && buf[0] === 0x89 && buf[1] === 0x50 && buf[2] === 0x4E && buf[3] === 0x47;
      const isJpg = buf && buf.length > 2 && buf[0] === 0xFF && buf[1] === 0xD8;
      if (status >= 400 || !(isPng || isJpg) || !/image\/(png|jpeg)/i.test(ctype)) {
        try {
          const preview = buf.toString('utf8', 0, Math.min(200, buf.length));
          logger.warn({ status, ctype, bytes: buf.length, preview }, 'map_markers: non-image response from Google Static Maps');
        } catch {}
        throw new Error('non-image-response');
      }
      // Write to temp file and use path (more reliable than base64 data for pptxgen)
      const { config } = await import('../xibo-agent/config');
      const pathMod = await import('path');
      const fsPr = await import('fs/promises');
      const imgDir = pathMod.join(config.tempDir, 'images');
      try { await fsPr.mkdir(imgDir, { recursive: true }); } catch {}
      const ext = isJpg ? '.jpg' : '.png';
      const filePath = pathMod.join(imgDir, `gmap-${Date.now()}${ext}`);
      await fsPr.writeFile(filePath, buf);
      /* map_markers: google map saved (removed) */
      slide.addImage({ path: filePath, x: rx, y: ry, w: rw, h: rh, sizing: { type: 'cover', w: rw, h: rh } as any });
      return true;
    } catch (e) {
      try { console.warn({ error: e }, 'map_markers: google static map fetch failed; fallback to simple'); } catch {}
    }
  }
  // Fallback simple mode (x/y 0..1 normalized)
  const bg = normalizeHex(st.bgColor); const bgLine = normalizeHex(st.borderColor);
  const dotFill = normalizeHex(st.dotFill); const dotLine = normalizeHex(st.dotLine);
  const dotSize = Number(st.dotSize); const labelFs = Number(st.labelFontSize);
  if (!bg || !bgLine || !dotFill || !dotLine || !Number.isFinite(dotSize) || !Number.isFinite(labelFs)) { try { console.warn('map_markers: missing style values'); } catch {} return false; }
  /* map_markers: simple renderer (verbose log removed) */
  slide.addShape('rect', { x: rx, y: ry, w: rw, h: rh, fill: { color: `#${bg}` }, line: { color: `#${bgLine}`, width: 1 } });
  markers.slice(0, 50).forEach((m: any) => {
    let px: number; let py: number;
    if (Number.isFinite(Number(m?.lon)) && Number.isFinite(Number(m?.lat))) {
      // Rough global projection for fallback
      const lon = Number(m.lon); const lat = Number(m.lat);
      px = rx + ((lon + 180) / 360) * rw;
      py = ry + (1 - (lat + 90) / 180) * rh;
    } else {
      px = rx + Math.max(0, Math.min(1, Number(m?.x || 0))) * rw;
      py = ry + Math.max(0, Math.min(1, Number(m?.y || 0))) * rh;
    }
    slide.addShape('ellipse', { x: px - (dotSize/2), y: py - (dotSize/2), w: dotSize, h: dotSize, fill: { color: `#${dotFill}` }, line: { color: `#${dotLine}`, width: 0.8 } });
    if (m?.label) slide.addText(String(m.label), { x: px + 0.1, y: py - 0.06, w: 1.6, h: 0.24, fontSize: labelFs, fontFace: 'Noto Sans JP' });
  });
  try { logger.info('map_markers: done'); } catch {}
  return true;
});

// KPI grid (2x2 up to 4 items)
/**
 * KPI grid (2x2) renderer
 * Payload: { type: 'kpi_grid', items: Array<{ label: string; value: string }> }
 * Styles (visualStyles.kpi_grid): cell{Fill,Line}, gapX, gapY, labelFontSize, valueFontSize, cornerRadius
 */
register('kpi_grid', ({ slide, payload, region, templateConfig, helpers }) => {
  const rx = region.x, ry = region.y, rw = region.w, rh = region.h;
  const items = Array.isArray(payload?.items) ? payload.items : [];
  const st = getVisualStyle(templateConfig, 'kpi_grid');
  const labelFs = Number(st.labelFontSize);
  const valueFs = Number(st.valueFontSize);
  const borderW = Number(st.borderWidth);
  const borderColHex = normalizeHex(st.borderColor);
  const gap = Number(st.gap);
  if (!Number.isFinite(labelFs) || !Number.isFinite(valueFs) || !Number.isFinite(borderW) || !borderColHex || !Number.isFinite(gap)) { try { console.warn('kpi_grid: missing style values'); } catch {} return false; }
  const cardW = Math.min((rw - 0.8) / 2, 2.6);
  const cardH = Math.min(rh / 2 - 0.2, 1.35);
  items.slice(0, 4).forEach((it: any, idx: number) => {
    const row = Math.floor(idx / 2), col = idx % 2;
    const x = rx + 0.2 + col * (cardW + gap); const y = ry + 0.2 + row * (cardH + gap);
    const colHex = helpers.getPaletteColor(idx).replace('#','');
    slide.addShape('rect', { x, y, w: cardW, h: cardH, fill: { color: colHex }, line: { color: `#${borderColHex}`, width: borderW } });
    const autoTxt = helpers.pickTextColorForBackground(`#${colHex}`);
    slide.addText(String(it?.value ?? ''), { x: x + 0.2, y: y + 0.2, w: cardW - 0.4, h: cardH * 0.55, fontSize: valueFs, bold: true, color: autoTxt, align: 'center', fontFace: 'Noto Sans JP' });
    slide.addText(String(it?.label ?? ''), { x: x + 0.2, y: y + cardH * 0.65, w: cardW - 0.4, h: cardH * 0.3, fontSize: labelFs, color: autoTxt, align: 'center', fontFace: 'Noto Sans JP' });
  });
  return true;
});

// Simple image
/**
 * Image renderer
 * Payload: { type: 'image', url: string, fit?: 'cover'|'contain'|'stretch' }
 * Styles (visualStyles.image): borderColor, borderWidth, cornerRadius, bgColor
 */
register('image', async ({ slide, payload, region, templateConfig }) => {
  const st = getVisualStyle(templateConfig, 'image');
  const sizingType = typeof st.sizing === 'string' ? st.sizing : undefined;
  if (!sizingType) { try { console.warn('image: missing sizing in template'); } catch {} return false; }

  let explicitPath = (payload?.path ? String(payload.path) : '').trim();
  if (explicitPath) {
    const shadowSpec = (payload?.style && (payload as any).style.shadow !== undefined) ? (payload as any).style.shadow : st.shadow;
    try {
      // best-effort: if URL, attempt to download via presenter helper (optional import)
      const m = await import('./createPowerpoint');
      if (m && (m as any).downloadImageIfUrl) {
        explicitPath = await (m as any).downloadImageIfUrl(explicitPath);
      }
    } catch {}
    slide.addImage({ path: explicitPath, x: region.x, y: region.y, w: region.w, h: region.h, sizing: { type: sizingType, w: region.w, h: region.h } as any, shadow: (shadowSpec ? { type: 'outer', color: '000000', opacity: 0.45, blur: 12, offset: 4, angle: 45 } as any : undefined) });
    return true;
  }

  const prompt = (payload?.prompt ? String(payload.prompt) : '').trim();
  if (!prompt) { try { console.warn('image: neither path nor prompt provided'); } catch {} return false; }

  // Derive aspect ratio from region box
  const r = region.w / Math.max(0.0001, region.h);
  const aspect = r >= 1.55 ? '16:9'
               : r >= 1.20 ? '4:3'
               : r >= 0.85 ? '1:1'
               : r >= 0.60 ? '3:4'
               : '9:16';

  try {
    const { generateImage } = await import('./generateImage');
    const out = await generateImage({ prompt, aspectRatio: aspect as any, negativePrompt: (st as any)?.negativePrompt });
    if (out && out.success && out.path) {
      const shadowSpec = st.shadow;
      slide.addImage({ path: out.path, x: region.x, y: region.y, w: region.w, h: region.h, sizing: { type: sizingType, w: region.w, h: region.h } as any, shadow: (shadowSpec ? { type: 'outer', color: '000000', opacity: 0.45, blur: 12, offset: 4, angle: 45 } as any : undefined) });
      return true;
    }
    try { console.warn('image: generation failed', out?.message); } catch {}
    return false;
  } catch (e) {
    try { console.error('image: generateImage import/exec failed', e); } catch {}
    return false;
  }
});

// Simple table (headers + rows)
/**
 * Table renderer
 * Payload: { type: 'table', headers?: string[], rows: string[][] }
 * Styles (visualStyles.table): header{Fill,Line,FontSize,Color}, cell{Fill,Line,FontSize,Color}, zebraFill
 */
register('table', ({ slide, payload, region, templateConfig }) => {
  const headers: string[] | undefined = Array.isArray(payload?.headers) ? payload.headers.map((s:any)=>String(s||'')) : undefined;
  const rows2d: string[][] = Array.isArray(payload?.rows) ? payload.rows.map((r:any)=>Array.isArray(r)?r.map((s:any)=>String(s||'')):[String(r||'')]) : [];
  const st = getVisualStyle(templateConfig, 'tables') || getVisualStyle(templateConfig, 'table');
  const headerFillHex = normalizeHex(st.headerFill); const headerTextHex = normalizeHex(st.headerColor);
  const rowFillAHex = normalizeHex(st.rowFillA); const rowFillBHex = normalizeHex(st.rowFillB);
  if (!headerFillHex || !headerTextHex || !rowFillAHex || !rowFillBHex) { try { console.warn('table: missing style values'); } catch {} return false; }
  const headerFill = `#${headerFillHex}`; const headerText = `#${headerTextHex}`;
  const rowFillA = `#${rowFillAHex}`; const rowFillB = `#${rowFillBHex}`;
  const tableRows: any[] = [];
  if (headers && headers.length) tableRows.push(headers.map(h => ({ text: String(h), options: { bold: true, fontFace: 'Noto Sans JP', fontSize: 12, align: 'center', color: headerText, fill: { color: headerFill } } })));
  for (let i = 0; i < rows2d.length; i++) {
    const r = rows2d[i]; const fillHex = (i % 2 === 1) ? rowFillB : rowFillA;
    tableRows.push(r.map(cell => ({ text: String(cell), options: { fontFace: 'Noto Sans JP', fontSize: 12, fill: { color: fillHex } } })));
  }
  if (tableRows.length) slide.addTable(tableRows, { x: region.x, y: region.y, w: region.w, h: region.h, border: { type: 'solid', color: 'E6E6E6', pt: 1 } as any });
  return true;
});

