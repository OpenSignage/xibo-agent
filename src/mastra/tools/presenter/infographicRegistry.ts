/*
 * Copyright (C) 2025 Open Source Digital Signage Initiative.
 *
 * Elastic License 2.0 (ELv2)
 */

import { getVisualStyle, asNumber, asBoolean, asAlign, normalizeHex, asString } from './styleResolver';

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

export function register(type: string, renderer: Renderer) {
  registry[type] = renderer;
}

export async function render(args: Parameters<Renderer>[0]): Promise<boolean> {
  const r = registry[args.type];
  if (!r) return false;
  return await r(args);
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
  items.slice(0, 5).forEach((it: any, i: number) => {
    const y = ry + i * (rowH + 0.12);
    slide.addText(String(it?.label ?? ''), { x: rx + 0.1, y, w: rw * 0.25 - 0.1, h: rowH, fontSize: labelFs as number, fontFace: 'Noto Sans JP', align: labelAlign, valign: 'middle' });
    const baseX = rx + rw * 0.30;
    // Background bar only if style provided
    const barBg = normalizeHex(style.barBgColor);
    const barBorder = normalizeHex(style.barBorderColor);
    if (barBg || barBorder) {
      slide.addShape('rect', { x: baseX, y, w: rw * 0.58, h: rowH, fill: barBg ? { color: barBg } : undefined, line: (barBorder ? { color: barBorder, width: Number(style.barBorderWidth) || 0.5 } : { width: 0 }) });
    }
    const val = Number(it?.value ?? 0), tgt = Number(it?.target ?? 0);
    const denom = Math.max(1, Math.max(val, tgt, 100));
    const valW = Math.max(0, Math.min(rw * 0.58, (rw * 0.58) * (val / denom)));
    const tgtX = baseX + Math.max(0, Math.min(rw * 0.58, (rw * 0.58) * (tgt / denom)));
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
      slide.addText(valueLabel, { x: baseX + Math.max(0, valW - (valueBoxW as number)), y, w: valueBoxW as number, h: rowH, fontSize: valueFs as number, fontFace: 'Noto Sans JP', color: textColor, align: 'right', valign: 'middle' });
    } else {
      slide.addText(valueLabel, { x: baseX + valW + (valueOutsidePad as number), y, w: valueBoxW as number, h: rowH, fontSize: valueFs as number, fontFace: 'Noto Sans JP', color: '#333333', align: 'left', valign: 'middle' });
    }
    slide.addText(targetLabel, { x: tgtX - (valueBoxW as number)/2, y: y - (targetOffsetY as number), w: valueBoxW as number, h: 0.2, fontSize: targetFs as number, fontFace: 'Noto Sans JP', color: '#333333', align: 'center', valign: 'bottom' });
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

register('venn2', ({ slide, payload, region, templateConfig }) => {
  const rx = region.x, ry = region.y, rw = region.w, rh = region.h;
  const a = payload?.a, b = payload?.b, overlap = Math.max(0, Number(payload?.overlap ?? 0));
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
  if (Number.isFinite(overlap) && overlap > 0 && (st.showOverlapPercent === true)) {
    const ovFs = Number(st.overlapFontSize);
    const ovColor = normalizeHex(st.overlapTextColor);
    if (Number.isFinite(ovFs) && ovColor) {
      slide.addText(`${overlap}%`, { x: (cx1+cx2)/2 - 0.4, y: cy - 0.15, w: 0.8, h: 0.3, fontSize: ovFs, align: 'center', fontFace: 'Noto Sans JP', color: `#${ovColor}` });
    }
  }
  const labFs = Number(st.labelFontSize); const labColor = normalizeHex(st.labelTextColor);
  if (Number.isFinite(labFs) && labColor) {
    slide.addText(String(a?.label ?? ''), { x: cx1 - r, y: cy + r + 0.05, w: 2*r, h: 0.25, fontSize: labFs, align: 'center', fontFace: 'Noto Sans JP', color: `#${labColor}` });
    slide.addText(String(b?.label ?? ''), { x: cx2 - r, y: cy + r + 0.05, w: 2*r, h: 0.25, fontSize: labFs, align: 'center', fontFace: 'Noto Sans JP', color: `#${labColor}` });
  }
  return true;
});

// Heatmap
register('heatmap', ({ slide, payload, region, templateConfig }) => {
  const rx = region.x, ry = region.y, rw = region.w, rh = region.h;
  const xLabels: string[] = Array.isArray(payload?.x) ? payload.x : [];
  const yLabels: string[] = Array.isArray(payload?.y) ? payload.y : [];
  const z: number[][] = Array.isArray(payload?.z) ? payload.z : [];
  const cols = Math.max(1, xLabels.length);
  const rows = Math.max(1, yLabels.length);
  const style = getVisualStyle(templateConfig, 'heatmap');
  const baseHex = normalizeHex(style.baseColor);
  const borderHex = normalizeHex(style.borderColor);
  const gridPadLeft = Number(style.padLeft);
  const gridPadTop = Number(style.padTop);
  const labelFs = Number(style.labelFontSize);
  if (!baseHex || !borderHex || !Number.isFinite(gridPadLeft) || !Number.isFinite(gridPadTop) || !Number.isFinite(labelFs)) {
    try { console.warn('heatmap: missing style values in template'); } catch {}
    return false;
  }
  const gridX = rx + gridPadLeft;
  const gridY = ry + gridPadTop;
  const gridW = Math.max(0.1, rw - gridPadLeft);
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
  for (let c = 0; c < cols; c++) {
    slide.addText(String(xLabels[c] ?? ''), { x: gridX + c * cellW, y: ry + 0.05, w: cellW, h: 0.35, fontSize: labelFs, align: 'center', fontFace: 'Noto Sans JP' });
  }
  for (let r = 0; r < rows; r++) {
    slide.addText(String(yLabels[r] ?? ''), { x: rx + 0.05, y: gridY + r * cellH + (cellH - 0.3)/2, w: gridPadLeft - 0.1, h: 0.3, fontSize: labelFs, align: 'right', fontFace: 'Noto Sans JP' });
  }
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const vv = Number((z[r] || [])[c] ?? 0);
      const t = (vv - minZ) / (maxZ - minZ);
      const color = blend(`#${baseHex}`, t);
      const cx = gridX + c * cellW, cy = gridY + r * cellH;
      slide.addShape('rect', { x: cx, y: cy, w: cellW, h: cellH, fill: { color }, line: { color: `#${borderHex}`, width: 0.75 } });
    }
  }
  return true;
});

// Progress bars list
register('progress', ({ slide, payload, region, templateConfig }) => {
  const rx = region.x, ry = region.y, rw = region.w, rh = Math.max(0.2, region.h - 0.05);
  const items = Array.isArray(payload?.items) ? payload.items : [];
  const style = getVisualStyle(templateConfig, 'progress');
  const labelAlign = asAlign(style.labelAlign, 'right');
  const labelFs = Number(style.labelFontSize);
  const labelGap = Number(style.labelGap);
  const barCfg: any = style.bar || {};
  const barHMax = Number(barCfg.heightMax);
  const barBg = normalizeHex(barCfg.bg);
  const barBgLine = normalizeHex(barCfg.bgLine);
  const valCfg: any = style.value || {};
  const showVal = (valCfg.show === true);
  const valSuffix = typeof valCfg.suffix === 'string' ? valCfg.suffix : '%';
  const valFs = Number(valCfg.fontSize);
  const valAlignRight = asAlign(valCfg.align, 'right') === 'right';
  const valOffset = Number(valCfg.offset);
  if (![labelFs, labelGap, barHMax, valFs, valOffset].every(Number.isFinite) || !barBg || !barBgLine || !Number.isFinite(barHMax)) {
    try { console.warn('progress: missing style values in template'); } catch {}
    return false;
  }
  const barAreaX = rx + rw * 0.40;
  const barAreaW = rw * 0.55;
  const labelW = rw * 0.35;
  const rows = Math.max(1, Math.min(8, items.length));
  const barH = Math.min(barHMax as number, (rh - 0.12 * (rows - 1)) / rows);
  items.slice(0, 8).forEach((it: any, i: number) => {
    const y = ry + i * (barH + 0.12);
    slide.addText(String(it?.label ?? ''), { x: rx, y, w: labelW - (labelGap as number), h: barH, fontSize: labelFs as number, fontFace: 'Noto Sans JP', align: labelAlign, valign: 'middle' });
    slide.addShape('rect', { x: barAreaX, y, w: barAreaW, h: barH, fill: { color: `#${barBg}` }, line: { color: `#${barBgLine}`, width: 0.5 } });
    const v = Math.max(0, Math.min(100, Number(it?.value ?? 0)));
    const filledW = barAreaW * (v / 100);
    const col = normalizeHex(style.fillColor);
    if (!col) { try { console.warn('progress: missing fillColor'); } catch {} return false; }
    slide.addShape('rect', { x: barAreaX, y, w: filledW, h: barH, fill: { color: `#${col}` }, line: { color: `#${col}`, width: 0 } });
    if (showVal) {
      const valText = `${v}${valSuffix}`;
      const tx = valAlignRight ? (barAreaX + filledW - (valOffset as number)) : (barAreaX + filledW + (valOffset as number));
      const tw = Math.max(0.5, rw * 0.12);
      const color = normalizeHex(valCfg.color);
      if (color) slide.addText(valText, { x: tx - (valAlignRight? tw : 0), y, w: tw, h: barH, fontSize: valFs as number, fontFace: 'Noto Sans JP', align: valAlignRight ? 'right' : 'left', valign: 'middle', color: `#${color}` });
    }
  });
  return true;
});

// Gantt (lightweight)
register('gantt', ({ slide, payload, region, templateConfig }) => {
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
  const scale = (d: Date) => (rw * 0.65) * ((d.getTime() - minStart.getTime()) / spanMs);
  const barX0 = rx + rw * 0.28;
  const st = getVisualStyle(templateConfig, 'gantt');
  const labelFs = Number(st.labelFontSize);
  const gridColor = normalizeHex(st.gridColor);
  const gridWidth = Number(st.gridWidth);
  if (!Number.isFinite(labelFs) || !gridColor || !Number.isFinite(gridWidth)) { try { console.warn('gantt: missing style values in template'); } catch {} return false; }
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
  const barMaxX = barX0 + rw * 0.65;
  valid.forEach((t, i) => {
    const y = ry + i*(rowH + 0.12);
    slide.addText(String(t.label), { x: rx, y, w: rw*0.25, h: rowH, fontSize: labelFs as number, fontFace: 'Noto Sans JP', align: 'right', valign: 'middle' });
    const w = Math.max(Number(st.minBarWidth), scale(t.end!) - scale(t.start!));
    const x = barX0 + scale(t.start!);
    const barColor = normalizeHex(st.barColor);
    const barLine = normalizeHex(st.barLineColor);
    if (!barColor || !barLine) { try { console.warn('gantt: missing bar colors'); } catch {} return false; }
    slide.addShape('rect', { x, y, w, h: rowH, fill: { color: `#${barColor}` }, line: { color: `#${barLine}`, width: 0.5 } });
    // Start date above bar
    const startStr = t.start!.toISOString().slice(0,10);
    const dateFs = Number(st.dateLabelFontSize);
    const dateColor = normalizeHex(st.dateLabelColor);
    if (Number.isFinite(dateFs) && dateColor) {
      slide.addText(startStr, { x, y: y - Number(st.dateLabelOffsetY || 0.18), w: Number(st.dateLabelWidth || 1.6), h: Number(st.dateLabelHeight || 0.2), fontSize: dateFs, fontFace: 'Noto Sans JP', color: `#${dateColor}`, align: 'left', valign: 'bottom' });
    }
  });
  return true;
});

// Checklist
register('checklist', ({ slide, payload, region, templateConfig }) => {
  const rx = region.x, ry = region.y, rw = region.w, rh = region.h;
  const items = Array.isArray(payload?.items) ? payload.items : [];
  const st = getVisualStyle(templateConfig, 'checklist');
  const gapY = Number(st.gapY);
  const markSize = Number(st.markSize);
  const fontSize = Number(st.fontSize);
  const rowHBase = Number(st.baseRowHeight);
  const markLine = normalizeHex(st.markLineColor);
  const markFill = normalizeHex(st.markFillColor);
  const textColor = normalizeHex(st.textColor);
  if (![gapY, markSize, fontSize, rowHBase].every(Number.isFinite) || !markLine || !markFill || !textColor) { try { console.warn('checklist: missing style values'); } catch {} return false; }
  let y = ry;
  items.slice(0, 10).forEach((it: any) => {
    const h = rowHBase;
    slide.addShape('rect', { x: rx, y: y + (h - markSize)/2, w: markSize, h: markSize, fill: { color: '#FFFFFF' }, line: { color: `#${markLine}`, width: 1 }, rectRadius: 4 });
    slide.addShape('chevron', { x: rx + 0.04, y: y + (h - markSize)/2 + 0.06, w: markSize - 0.08, h: markSize - 0.12, fill: { color: `#${markFill}` }, line: { color: `#${markFill}`, width: 0 } } as any);
    slide.addText(String(it?.label ?? ''), { x: rx + markSize + 0.2, y, w: rw - (markSize + 0.4), h, fontSize: fontSize as number, fontFace: 'Noto Sans JP', color: `#${textColor}` });
    y += h + gapY;
  });
  return true;
});

// Matrix (2x2)
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
  slide.addShape('rect', { x: rx, y: ry, w: rw, h: rh, fill: { color: '#FFFFFF' }, line: { color: `#${frameLine}`, width: 1 } });
  slide.addShape('line', { x: rx + rw/2, y: ry, w: 0, h: rh, line: { color: `#${axisLine}`, width: 1 } });
  slide.addShape('line', { x: rx, y: ry + rh/2, w: rw, h: 0, line: { color: `#${axisLine}`, width: 1 } });
  slide.addText(String(xL[0] || ''), { x: rx + 0.1, y: ry - 0.3, w: rw/2 - 0.2, h: 0.25, fontSize: axisFontSize, align: 'left', fontFace: 'Noto Sans JP' });
  slide.addText(String(xL[1] || ''), { x: rx + rw/2 + 0.1, y: ry - 0.3, w: rw/2 - 0.2, h: 0.25, fontSize: axisFontSize, align: 'right', fontFace: 'Noto Sans JP' });
  slide.addText(String(yL[0] || ''), { x: rx - 0.45, y: ry + 0.1, w: 0.45, h: rh/2 - 0.1, fontSize: axisFontSize, valign: 'top', fontFace: 'Noto Sans JP' });
  slide.addText(String(yL[1] || ''), { x: rx - 0.45, y: ry + rh/2 + 0.1, w: 0.45, h: rh/2 - 0.1, fontSize: axisFontSize, valign: 'top', fontFace: 'Noto Sans JP' });
  const items = Array.isArray(payload?.items) ? payload.items : [];
  items.slice(0, 6).forEach((it: any) => {
    const cx = rx + (it?.x === 1 ? 3*rw/4 : rw/4);
    const cy = ry + (it?.y === 1 ? 3*rh/4 : rh/4);
    slide.addShape('ellipse', { x: cx - (pointSize/2), y: cy - (pointSize/2), w: pointSize, h: pointSize, fill: { color: `#${pointFill}` }, line: { color: `#${pointLine}`, width: 0.75 } });
    slide.addText(String(it?.label ?? ''), { x: cx + 0.12, y: cy - 0.12, w: Math.min(1.8, rw/2 - 0.3), h: 0.3, fontSize: labelFontSize, fontFace: 'Noto Sans JP' });
  });
  return true;
});

// Charts via generateChart tool
async function renderChartImage(
  kind: 'bar'|'pie'|'line'|'radar'|'polarArea'|'scatter'|'bubble'|'horizontalBar'|'stackedBar'|'area',
  labels: string[],
  values: number[],
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

register('bar_chart', async ({ slide, payload, region, templateConfig }) => {
  const labels: string[] = Array.isArray(payload?.labels) ? payload.labels : (Array.isArray(payload?.items) ? payload.items.map((it: any)=>String(it?.label||'')) : []);
  const values: number[] = Array.isArray(payload?.values) ? payload.values.map((n:any)=>Number(n)||0) : (Array.isArray(payload?.items) ? payload.items.map((it:any)=>Number(it?.value||0)) : []);
  const chartsStyle = (templateConfig?.visualStyles?.bar_chart) || {};
  const img = await renderChartImage('bar', labels, values, payload?.title, chartsStyle);
  if (img) slide.addImage({ path: img, x: region.x, y: region.y, w: region.w, h: region.h, sizing: { type: 'contain', w: region.w, h: region.h } as any, shadow: (chartsStyle.shadow ? { type: 'outer', color: '000000', opacity: 0.45, blur: 12, offset: 4, angle: 45 } as any : undefined) });
  return true;
});

register('pie_chart', async ({ slide, payload, region, templateConfig }) => {
  const labels: string[] = Array.isArray(payload?.labels) ? payload.labels : (Array.isArray(payload?.items) ? payload.items.map((it: any)=>String(it?.label||'')) : []);
  const values: number[] = Array.isArray(payload?.values) ? payload.values.map((n:any)=>Number(n)||0) : (Array.isArray(payload?.items) ? payload.items.map((it:any)=>Number(it?.value||0)) : []);
  const chartsStyle = (templateConfig?.visualStyles?.pie_chart) || {};
  const img = await renderChartImage('pie', labels, values, payload?.title, chartsStyle);
  if (img) slide.addImage({ path: img, x: region.x, y: region.y, w: region.w, h: region.h, sizing: { type: 'contain', w: region.w, h: region.h } as any, shadow: (chartsStyle.shadow ? { type: 'outer', color: '000000', opacity: 0.45, blur: 12, offset: 4, angle: 45 } as any : undefined) });
  return true;
});

register('line_chart', async ({ slide, payload, region, templateConfig }) => {
  const labels: string[] = Array.isArray(payload?.labels) ? payload.labels : (Array.isArray(payload?.items) ? payload.items.map((it: any)=>String(it?.label||'')) : []);
  const values: number[] = Array.isArray(payload?.values) ? payload.values.map((n:any)=>Number(n)||0) : (Array.isArray(payload?.items) ? payload.items.map((it:any)=>Number(it?.value||0)) : []);
  const chartsStyle = (templateConfig?.visualStyles?.line_chart) || {};
  const img = await renderChartImage('line', labels, values, payload?.title, chartsStyle);
  if (img) slide.addImage({ path: img, x: region.x, y: region.y, w: region.w, h: region.h, sizing: { type: 'contain', w: region.w, h: region.h } as any, shadow: (chartsStyle.shadow ? { type: 'outer', color: '000000', opacity: 0.45, blur: 12, offset: 4, angle: 45 } as any : undefined) });
  return true;
});

register('radar_chart', async ({ slide, payload, region, templateConfig }) => {
  const labels: string[] = Array.isArray(payload?.labels) ? payload.labels : (Array.isArray(payload?.items) ? payload.items.map((it: any)=>String(it?.label||'')) : []);
  const values: number[] = Array.isArray(payload?.values) ? payload.values.map((n:any)=>Number(n)||0) : (Array.isArray(payload?.items) ? payload.items.map((it:any)=>Number(it?.value||0)) : []);
  const chartsStyle = (templateConfig?.visualStyles?.radar_chart) || {};
  const img = await renderChartImage('radar', labels, values, payload?.title, chartsStyle);
  if (img) slide.addImage({ path: img, x: region.x, y: region.y, w: region.w, h: region.h, sizing: { type: 'contain', w: region.w, h: region.h } as any, shadow: (chartsStyle.shadow ? { type: 'outer', color: '000000', opacity: 0.45, blur: 12, offset: 4, angle: 45 } as any : undefined) });
  return true;
});

register('polar_area_chart', async ({ slide, payload, region, templateConfig }) => {
  const labels: string[] = Array.isArray(payload?.labels) ? payload.labels : (Array.isArray(payload?.items) ? payload.items.map((it: any)=>String(it?.label||'')) : []);
  const values: number[] = Array.isArray(payload?.values) ? payload.values.map((n:any)=>Number(n)||0) : (Array.isArray(payload?.items) ? payload.items.map((it:any)=>Number(it?.value||0)) : []);
  const chartsStyle = (templateConfig?.visualStyles?.polar_area_chart) || {};
  const img = await renderChartImage('polarArea', labels, values, payload?.title, chartsStyle);
  if (img) slide.addImage({ path: img, x: region.x, y: region.y, w: region.w, h: region.h, sizing: { type: 'contain', w: region.w, h: region.h } as any, shadow: (chartsStyle.shadow ? { type: 'outer', color: '000000', opacity: 0.45, blur: 12, offset: 4, angle: 45 } as any : undefined) });
  return true;
});

register('scatter_chart', async ({ slide, payload, region, templateConfig }) => {
  const labels: string[] = Array.isArray(payload?.labels) ? payload.labels : (Array.isArray(payload?.items) ? payload.items.map((_: any, i:number)=>`P${i+1}`) : []);
  const values: number[] = Array.isArray(payload?.values) ? payload.values.map((n:any)=>Number(n)||0) : (Array.isArray(payload?.items) ? payload.items.map((it:any)=>Number(it?.y||0)) : []);
  const chartsStyle = (templateConfig?.visualStyles?.scatter_chart) || {};
  const img = await renderChartImage('scatter', labels, values, payload?.title, chartsStyle);
  if (img) slide.addImage({ path: img, x: region.x, y: region.y, w: region.w, h: region.h, sizing: { type: 'contain', w: region.w, h: region.h } as any, shadow: (chartsStyle.shadow ? { type: 'outer', color: '000000', opacity: 0.45, blur: 12, offset: 4, angle: 45 } as any : undefined) });
  return true;
});

register('bubble_chart', async ({ slide, payload, region, templateConfig }) => {
  const labels: string[] = Array.isArray(payload?.labels) ? payload.labels : (Array.isArray(payload?.items) ? payload.items.map((_: any, i:number)=>`B${i+1}`) : []);
  const values: number[] = Array.isArray(payload?.values) ? payload.values.map((n:any)=>Number(n)||0) : (Array.isArray(payload?.items) ? payload.items.map((it:any)=>Number(it?.y||0)) : []);
  const chartsStyle = (templateConfig?.visualStyles?.bubble_chart) || {};
  const img = await renderChartImage('bubble', labels, values, payload?.title, chartsStyle);
  if (img) slide.addImage({ path: img, x: region.x, y: region.y, w: region.w, h: region.h, sizing: { type: 'contain', w: region.w, h: region.h } as any, shadow: (chartsStyle.shadow ? { type: 'outer', color: '000000', opacity: 0.45, blur: 12, offset: 4, angle: 45 } as any : undefined) });
  return true;
});

register('horizontal_bar_chart', async ({ slide, payload, region, templateConfig }) => {
  const labels: string[] = Array.isArray(payload?.labels) ? payload.labels : (Array.isArray(payload?.items) ? payload.items.map((it: any)=>String(it?.label||'')) : []);
  const values: number[] = Array.isArray(payload?.values) ? payload.values.map((n:any)=>Number(n)||0) : (Array.isArray(payload?.items) ? payload.items.map((it:any)=>Number(it?.value||0)) : []);
  const chartsStyle = (templateConfig?.visualStyles?.horizontal_bar_chart) || {};
  const img = await renderChartImage('horizontalBar', labels, values, payload?.title, chartsStyle);
  if (img) slide.addImage({ path: img, x: region.x, y: region.y, w: region.w, h: region.h, sizing: { type: 'contain', w: region.w, h: region.h } as any, shadow: (chartsStyle.shadow ? { type: 'outer', color: '000000', opacity: 0.45, blur: 12, offset: 4, angle: 45 } as any : undefined) });
  return true;
});

register('stacked_bar_chart', async ({ slide, payload, region, templateConfig }) => {
  const labels: string[] = Array.isArray(payload?.labels) ? payload.labels : (Array.isArray(payload?.items) ? payload.items.map((it: any)=>String(it?.label||'')) : []);
  const values: number[] = Array.isArray(payload?.values) ? payload.values.map((n:any)=>Number(n)||0) : (Array.isArray(payload?.items) ? payload.items.map((it:any)=>Number(it?.value||0)) : []);
  const chartsStyle = (templateConfig?.visualStyles?.stacked_bar_chart) || {};
  const img = await renderChartImage('stackedBar', labels, values, payload?.title, chartsStyle);
  if (img) slide.addImage({ path: img, x: region.x, y: region.y, w: region.w, h: region.h, sizing: { type: 'contain', w: region.w, h: region.h } as any, shadow: (chartsStyle.shadow ? { type: 'outer', color: '000000', opacity: 0.45, blur: 12, offset: 4, angle: 45 } as any : undefined) });
  return true;
});

register('area_chart', async ({ slide, payload, region, templateConfig }) => {
  const labels: string[] = Array.isArray(payload?.labels) ? payload.labels : (Array.isArray(payload?.items) ? payload.items.map((it: any)=>String(it?.label||'')) : []);
  const values: number[] = Array.isArray(payload?.values) ? payload.values.map((n:any)=>Number(n)||0) : (Array.isArray(payload?.items) ? payload.items.map((it:any)=>Number(it?.value||0)) : []);
  const chartsStyle = (templateConfig?.visualStyles?.area_chart) || {};
  const img = await renderChartImage('area', labels, values, payload?.title, chartsStyle);
  if (img) slide.addImage({ path: img, x: region.x, y: region.y, w: region.w, h: region.h, sizing: { type: 'contain', w: region.w, h: region.h } as any, shadow: (chartsStyle.shadow ? { type: 'outer', color: '000000', opacity: 0.45, blur: 12, offset: 4, angle: 45 } as any : undefined) });
  return true;
});

// Comparison (two boxes)
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
  // Left
  slide.addShape('rect', { x: rx, y: ry, w: boxW, h: boxH, fill: { color: `#${leftFill}` }, line: { color: `#${boxLine}`, width: 0.5 } });
  const labelColorLeft = labelColorTpl ? `#${labelColorTpl}` : (helpers.pickTextColorForBackground ? helpers.pickTextColorForBackground(`#${leftFill}`) : '#FFFFFF');
  const valueColorLeft = (helpers.pickTextColorForBackground ? helpers.pickTextColorForBackground(`#${leftFill}`) : '#FFFFFF');
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
  slide.addText(String(a?.label ?? ''), { x: rx + padX, y: ry + padY, w: boxW - padX*2, h: (Number.isFinite(labelHeight)? (labelHeight as number) : 0.36), fontSize: labelFs, bold: true, color: labelColorLeft, fontFace: 'Noto Sans JP', align: (labelAlign as any), valign: 'middle' });
  slide.addText(String(a?.value ?? ''), { x: rx + padX, y: ry + padY + (Number.isFinite(labelHeight)? (labelHeight as number) : 0.36), w: boxW - padX*2, h: boxH - (padY + (Number.isFinite(labelHeight)? (labelHeight as number) : 0.36)), fontSize: valueFs, color: valueColorLeft, fontFace: 'Noto Sans JP', align: 'center', valign: 'top' });
  // Right
  slide.addShape('rect', { x: rx + boxW + gapX, y: ry, w: boxW, h: boxH, fill: { color: `#${rightFill}` }, line: { color: `#${boxLine}`, width: 0.5 } });
  const labelColorRight = labelColorTpl ? `#${labelColorTpl}` : (helpers.pickTextColorForBackground ? helpers.pickTextColorForBackground(`#${rightFill}`) : '#FFFFFF');
  const valueColorRight = (helpers.pickTextColorForBackground ? helpers.pickTextColorForBackground(`#${rightFill}`) : '#FFFFFF');
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
  slide.addText(String(b?.label ?? ''), { x: rx + boxW + gapX + padX, y: ry + padY, w: boxW - padX*2, h: (Number.isFinite(labelHeight)? (labelHeight as number) : 0.36), fontSize: labelFs, bold: true, color: labelColorRight, fontFace: 'Noto Sans JP', align: (labelAlign as any), valign: 'middle' });
  slide.addText(String(b?.value ?? ''), { x: rx + boxW + gapX + padX, y: ry + padY + (Number.isFinite(labelHeight)? (labelHeight as number) : 0.36), w: boxW - padX*2, h: boxH - (padY + (Number.isFinite(labelHeight)? (labelHeight as number) : 0.36)), fontSize: valueFs, color: valueColorRight, fontFace: 'Noto Sans JP', align: 'center', valign: 'top' });
  return true;
});

// Callouts (4 boxes)
register('callouts', async ({ slide, payload, region, templateConfig }) => {
  const rx = region.x, ry = region.y, rw = region.w, rh = region.h;
  const items = Array.isArray(payload?.items) ? payload.items : [];
  const st = getVisualStyle(templateConfig, 'callouts');
  const iconCfg: any = st.icon || {}; const iconEnabled = (iconCfg.enabled === true);
  const iconSize = Number(iconCfg.size); const iconPad = Number(iconCfg.padding);
  const bg = normalizeHex(st.boxBgColor);
  const line = normalizeHex(st.boxLineColor);
  const labelFs = Number(st.labelFontSize); const valueFs = Number(st.valueFontSize);
  const labelColor = normalizeHex(st.labelColor); const valueColor = normalizeHex(st.valueColor);
  if (!bg || !line || !Number.isFinite(labelFs) || !Number.isFinite(valueFs) || !labelColor || !valueColor || !Number.isFinite(iconSize) || !Number.isFinite(iconPad)) { try { console.warn('callouts: missing style values'); } catch {} return false; }
  for (let i = 0; i < Math.min(4, items.length); i++) {
    const it: any = items[i] || {}; const x = rx + (i % 2) * (rw/2) + 0.1; const y = ry + Math.floor(i/2) * (rh/2) + 0.1; const boxW = rw/2 - 0.2; const boxH = rh/2 - 0.2;
    slide.addShape('rect', { x, y, w: boxW, h: boxH, fill: { color: `#${bg}` }, line: { color: `#${line}`, width: 0.5 } });
    let iconPath: string | null = null;
    if (iconEnabled) {
      const rawIcon = (it?.iconPath || it?.icon || it?.iconName || '').toString().trim();
      if (rawIcon) {
        if (/\\|\//.test(rawIcon) || /\.(png|jpg|jpeg)$/i.test(rawIcon)) {
          iconPath = rawIcon;
        } else {
          try {
            const { generateImage } = await import('./generateImage');
            const prompt = `${rawIcon}, minimal line icon, monochrome`;
            const out = await generateImage({ prompt, aspectRatio: '1:1' });
            if (out && out.success && out.path) iconPath = out.path;
          } catch {}
        }
      }
    }
    const textLeftX = iconPath ? (x + iconPad + iconSize + iconPad) : (x + 0.1);
    const textWidth = iconPath ? (boxW - (textLeftX - x) - 0.1) : (boxW - 0.2);
    if (iconPath) {
      slide.addImage({ path: iconPath, x: x + iconPad, y: y + iconPad, w: Math.min(iconSize, boxW*0.3), h: Math.min(iconSize, boxH*0.5), sizing: { type: 'contain', w: iconSize, h: iconSize } as any });
    }
    slide.addText(String(it?.label ?? ''), { x: textLeftX, y: y + 0.1, w: textWidth, h: 0.4, fontSize: labelFs, bold: true, fontFace: 'Noto Sans JP', color: `#${labelColor}` });
    if (it?.value) slide.addText(String(it.value), { x: textLeftX, y: y + 0.55, w: textWidth, h: 0.4, fontSize: valueFs, fontFace: 'Noto Sans JP', color: `#${valueColor}` });
  }
  return true;
});

// KPI cards (1〜4件)
register('kpi', ({ slide, payload, region, templateConfig, helpers }) => {
  const rx = region.x, ry = region.y, rw = region.w, rh = region.h;
  const items = Array.isArray(payload?.items) ? payload.items : [];
  const count = Math.min(4, items.length);
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
    const boxColor = helpers.getPaletteColor(idx).replace('#','');
    slide.addShape('rect', { x, y, w: cardW, h: cardH, fill: { color: boxColor }, line: { color: 'FFFFFF', width: 0.5 }, rectRadius: 6 });
    const txtX = x + innerPadX; const txtW = Math.max(0.5, cardW - innerPadX * 2);
    const label = String(it?.label ?? ''); const value = String(it?.value ?? '');
    const autoTxt = helpers.pickTextColorForBackground(`#${boxColor}`);
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
register('kpi_donut', async ({ slide, payload, region, templateConfig }) => {
  const items = Array.isArray(payload?.items) ? payload.items : [];
  const labels = items.map((it:any)=>String(it?.label ?? ''));
  const values = items.map((it:any)=>Number(it?.value ?? 0));
  // Forward charts style from template if present
  const chartsStyle = (templateConfig?.visualStyles?.charts) || undefined;
  const img = await renderChartImage('pie', labels, values, payload?.title || '', chartsStyle);
  if (img) slide.addImage({ path: img, x: region.x, y: region.y, w: region.w, h: region.h, sizing: { type: 'contain', w: region.w, h: region.h } as any });
  return true;
});

// Funnel
register('funnel', ({ slide, payload, region, templateConfig, helpers }) => {
  const rx = region.x, ry = region.y, rw = region.w, rh = Math.max(0.2, region.h - 0.05);
  const steps = Array.isArray(payload?.steps) ? payload.steps : [];
  const layers = Math.min(5, steps.length || 5);
  for (let i = 0; i < layers; i++) {
    const segH = (rh - 0.04 * (layers - 1)) / layers;
    const y = ry + i * (segH + 0.04); const tW = rw * (1 - i * 0.15); const bW = rw * (1 - (i + 1) * 0.15);
    const col = helpers.getPaletteColor(i).replace('#','');
    slide.addShape('trapezoid', { x: rx + (rw - tW)/2, y, w: tW, h: segH, fill: { color: col }, line: { color: 'FFFFFF', width: 0.5 } } as any);
    slide.addText(String(steps[i]?.label ?? ''), { x: rx + 0.15, y: y + 0.02, w: rw - 0.3, h: segH - 0.06, fontSize: 12, color: 'FFFFFF', align: 'center', valign: 'middle', fontFace: 'Noto Sans JP' });
  }
  return true;
});

// Timeline
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
  const labelColor = normalizeHex(st.labelColor);
  if (!axisLineColor || !Number.isFinite(axisLineWidth) || !pointFill || !pointLine || !Number.isFinite(pointSize) || !Number.isFinite(labelFs) || !labelColor) {
    try { console.warn('timeline: missing style values'); } catch {}
    return false;
  }
  slide.addShape('line', { x: rx, y: ry + rh/2, w: rw, h: 0, line: { color: `#${axisLineColor}`, width: axisLineWidth } });
  steps.slice(0, 6).forEach((s: any, i: number) => {
    const cx = rx + (i * (rw / Math.max(1, steps.length - 1)));
    slide.addShape('ellipse', { x: cx - (pointSize/2), y: ry + rh/2 - (pointSize/2), w: pointSize, h: pointSize, fill: { color: `#${pointFill}` }, line: { color: `#${pointLine}`, width: 0.8 } });
    slide.addText(String(s?.label ?? ''), { x: Math.max(rx, cx - 0.9), y: ry + rh/2 + 0.18, w: Math.min(1.8, rw), h: 0.32, fontSize: labelFs, align: 'center', fontFace: 'Noto Sans JP', color: `#${labelColor}` });
  });
  return true;
});

// Process
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
  const labelColor = normalizeHex(st.labelColor);
  const arrowColor = normalizeHex(st.arrowColor);
  if (![maxSteps, gap, stepWMax, stepHMax, startYRatio, labelFs].every(Number.isFinite) || !labelColor || !arrowColor) { try { console.warn('process: missing style values'); } catch {} return false; }
  const totalGap = gap * Math.max(0, maxSteps - 1);
  const stepW = Math.min(stepWMax, (rw - totalGap) / Math.max(1, maxSteps));
  const stepH = Math.min(rh * 0.6, stepHMax); const startY = ry + rh * startYRatio;
  for (let i = 0; i < Math.min(maxSteps, steps.length || maxSteps); i++) {
    const x = rx + i * (stepW + gap); const col = helpers.getPaletteColor(i).replace('#','');
    slide.addShape('rect', { x, y: startY, w: stepW, h: stepH, fill: { color: col }, line: { color: '#FFFFFF', width: 0.5 } });
    slide.addText(String(steps[i]?.label ?? ''), { x: x + 0.08, y: startY + 0.14, w: stepW - 0.16, h: stepH - 0.28, fontSize: labelFs, color: `#${labelColor}`, align: 'center', valign: 'middle', fontFace: 'Noto Sans JP' });
    if (i < Math.min(maxSteps, steps.length || maxSteps) - 1) slide.addShape('chevron', { x: x + stepW + (gap - 0.4)/2, y: startY + (stepH - 0.4)/2, w: 0.4, h: 0.4, fill: { color: `#${arrowColor}` }, line: { color: `#${arrowColor}`, width: 0 } } as any);
  }
  return true;
});

// Roadmap
register('roadmap', ({ slide, payload, region, templateConfig, helpers }) => {
  const rx = region.x, ry = region.y, rw = region.w, rh = region.h;
  const milestones = Array.isArray(payload?.milestones) ? payload.milestones : [];
  const st = getVisualStyle(templateConfig, 'roadmap');
  const axisLineColor = normalizeHex(st.axisLineColor);
  const axisLineWidth = Number(st.axisLineWidth);
  const pointLine = normalizeHex(st.pointLine);
  const labelFs = Number(st.labelFontSize);
  const dateFs = Number(st.dateFontSize);
  const dateColor = normalizeHex(st.dateColor);
  if (!axisLineColor || !Number.isFinite(axisLineWidth) || !pointLine || !Number.isFinite(labelFs) || !Number.isFinite(dateFs) || !dateColor) { try { console.warn('roadmap: missing style values'); } catch {} return false; }
  slide.addShape('line', { x: rx, y: ry + rh/2, w: rw, h: 0, line: { color: `#${axisLineColor}`, width: axisLineWidth } });
  milestones.slice(0, 6).forEach((m: any, i: number) => {
    const cx = rx + (i * (rw / Math.max(1, milestones.length - 1)));
    const col = helpers.getPaletteColor(i).replace('#','');
    slide.addShape('ellipse', { x: cx - 0.08, y: ry + rh/2 - 0.08, w: 0.16, h: 0.16, fill: { color: col }, line: { color: `#${pointLine}`, width: 0.8 } });
    const labelW = 1.6; const dateW = 1.2; const labelX = Math.max(rx, Math.min(rx + rw - labelW, cx - labelW/2)); const dateX = Math.max(rx, Math.min(rx + rw - dateW, cx - dateW/2));
    slide.addText(String(m?.label ?? ''), { x: labelX, y: ry + rh/2 + 0.18, w: labelW, h: 0.36, fontSize: labelFs, align: 'center', fontFace: 'Noto Sans JP' });
    if (m?.date) slide.addText(String(m.date), { x: dateX, y: ry + rh/2 + 0.56, w: dateW, h: 0.25, fontSize: dateFs, align: 'center', color: `#${dateColor}`, fontFace: 'Noto Sans JP' });
  });
  return true;
});

// Pyramid
register('pyramid', ({ slide, payload, region, templateConfig, helpers }) => {
  const rx = region.x, ry = region.y, rw = region.w, rh = region.h;
  const steps = Array.isArray(payload?.steps) ? payload.steps : [];
  const st = getVisualStyle(templateConfig, 'pyramid');
  const maxLayers = Number(st.maxLayers);
  const shrink = Number(st.layerShrinkRatio);
  const labelFs = Number(st.labelFontSize);
  const labelColor = normalizeHex(st.labelColor);
  const borderColor = normalizeHex(st.borderColor);
  if (!Number.isFinite(maxLayers) || !Number.isFinite(shrink) || !Number.isFinite(labelFs) || !labelColor || !borderColor) { try { console.warn('pyramid: missing style values'); } catch {} return false; }
  const layers = Math.min(maxLayers, steps.length || maxLayers);
  for (let i = 0; i < layers; i++) {
    const y = ry + i * (rh / layers); const width = rw * (1 - i * shrink);
    const col = helpers.getPaletteColor(i).replace('#','');
    slide.addShape('triangle', { x: rx + (rw - width)/2, y, w: width, h: rh / layers - 0.05, fill: { color: col }, line: { color: `#${borderColor}`, width: 0.5 } });
    slide.addText(String(steps[i]?.label ?? ''), { x: rx, y: y + 0.02, w: rw, h: rh / layers - 0.09, fontSize: labelFs, color: `#${labelColor}`, align: 'center', valign: 'middle', fontFace: 'Noto Sans JP' });
  }
  return true;
});

// Map markers
register('map_markers', ({ slide, payload, region, templateConfig }) => {
  const rx = region.x, ry = region.y, rw = region.w, rh = region.h;
  const st = getVisualStyle(templateConfig, 'map_markers');
  const bg = normalizeHex(st.bgColor); const bgLine = normalizeHex(st.borderColor);
  const dotFill = normalizeHex(st.dotFill); const dotLine = normalizeHex(st.dotLine);
  const dotSize = Number(st.dotSize); const labelFs = Number(st.labelFontSize);
  if (!bg || !bgLine || !dotFill || !dotLine || !Number.isFinite(dotSize) || !Number.isFinite(labelFs)) { try { console.warn('map_markers: missing style values'); } catch {} return false; }
  slide.addShape('rect', { x: rx, y: ry, w: rw, h: rh, fill: { color: `#${bg}` }, line: { color: `#${bgLine}`, width: 1 } });
  const markers = Array.isArray(payload?.markers) ? payload.markers : [];
  markers.slice(0, 8).forEach((m: any) => {
    const px = rx + Math.max(0, Math.min(1, Number(m?.x || 0))) * rw;
    const py = ry + Math.max(0, Math.min(1, Number(m?.y || 0))) * rh;
    slide.addShape('ellipse', { x: px - (dotSize/2), y: py - (dotSize/2), w: dotSize, h: dotSize, fill: { color: `#${dotFill}` }, line: { color: `#${dotLine}`, width: 0.8 } });
    slide.addText(String(m?.label ?? ''), { x: px + 0.1, y: py - 0.06, w: 1.6, h: 0.24, fontSize: labelFs, fontFace: 'Noto Sans JP' });
  });
  return true;
});

// KPI grid (2x2 up to 4 items)
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

