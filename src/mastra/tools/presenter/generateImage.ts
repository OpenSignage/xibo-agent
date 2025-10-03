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

// Lightweight image generator for PowerPoint rendering (no history, temp-only)
import { GoogleGenAI, Modality } from '@google/genai';
import * as fs from 'node:fs';
import * as fsp from 'node:fs/promises';
import * as path from 'node:path';
import { v4 as uuidv4 } from 'uuid';
import { config } from '../xibo-agent/config';
import { logger } from '../../logger';

export type Aspect = '1:1' | '3:4' | '4:3' | '16:9' | '9:16';

// Cost-saving hard switch
// true: always return a local dummy image without calling Gemini (callers変更不要)
const ALWAYS_SAVE_MODE = true;

const aspectToDims: Record<Aspect, { width: number; height: number }> = {
  '1:1': { width: 1024, height: 1024 },
  '3:4': { width: 768, height: 1024 },
  '4:3': { width: 1024, height: 768 },
  '16:9': { width: 1024, height: 576 },
  '9:16': { width: 576, height: 1024 },
};

async function cropToAspect(buffer: Buffer, target: Aspect): Promise<Buffer> {
  try {
    const { createCanvas, loadImage } = await import('canvas');
    const { width: outW, height: outH } = aspectToDims[target];
    const dataUrl = `data:image/png;base64,${buffer.toString('base64')}`;
    const img = await loadImage(dataUrl);
    const inW = img.width || outW;
    const inH = img.height || outH;
    // cover: scale to fill, center-crop
    const scale = Math.max(outW / Math.max(1, inW), outH / Math.max(1, inH));
    const drawW = Math.round(inW * scale);
    const drawH = Math.round(inH * scale);
    const dx = Math.round((outW - drawW) / 2);
    const dy = Math.round((outH - drawH) / 2);
    const canvas = createCanvas(outW, outH);
    const ctx = canvas.getContext('2d');
    ctx.drawImage(img as any, dx, dy, drawW, drawH);
    return canvas.toBuffer('image/png');
  } catch {
    return buffer;
  }
}

/**
 * Create a local dummy image (no AI call) honoring the requested aspect ratio.
 * Tries node-canvas; if unavailable, falls back to a 1x1 PNG.
 */
async function createDummyImage(aspect: Aspect): Promise<{ buffer: Buffer; width: number; height: number }>{
  const dims = aspectToDims[aspect];
  try {
    const { createCanvas } = await import('canvas');
    const canvas = createCanvas(dims.width, dims.height);
    const ctx = canvas.getContext('2d');
    // soft gray background
    ctx.fillStyle = '#EDEFF3';
    ctx.fillRect(0, 0, dims.width, dims.height);
    // diagonal stripes
    ctx.strokeStyle = '#D3D8E2';
    ctx.lineWidth = 4;
    for (let x = -dims.height; x < dims.width; x += 32) {
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x + dims.height, dims.height);
      ctx.stroke();
    }
    // caption
    ctx.fillStyle = '#6B7280';
    ctx.font = 'bold 28px sans-serif';
    const caption = 'DUMMY IMAGE (saveMode)';
    const tw = ctx.measureText(caption).width || 0;
    ctx.fillText(caption, Math.max(12, (dims.width - tw) / 2), Math.max(34, Math.floor(dims.height * 0.12)));
    return { buffer: canvas.toBuffer('image/png'), width: dims.width, height: dims.height };
  } catch {
    const base64Png = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR4nGNgYAAAAAMAASsJTYQAAAAASUVORK5CYII=';
    return { buffer: Buffer.from(base64Png, 'base64'), width: dims.width, height: dims.height };
  }
}

/**
 * Generate an image using Google Generative AI and save it under temp images.
 * The result is optionally center-cropped to the requested aspect ratio.
 *
 * @param params.prompt          Prompt for the image model.
 * @param params.aspectRatio     Target aspect ratio for slide placement.
 * @param params.negativePrompt  Optional negative prompt to exclude elements.
 * @param params.saveMode        If true, skip AI call and return a local dummy image.
 * @returns `{ success, path, width, height, message }` (path on success)
 */
export async function generateImage(params: {
  prompt: string;
  aspectRatio: Aspect;
  negativePrompt?: string;
  saveMode?: boolean;
}): Promise<{ success: boolean; path?: string; width?: number; height?: number; message?: string }>{
  try {
    // Cost-saving mode: return a local dummy without calling AI
    if (ALWAYS_SAVE_MODE || params.saveMode === true) {
      const tempImagesDir = path.join(config.tempDir, 'images');
      if (!fs.existsSync(tempImagesDir)) {
        await fsp.mkdir(tempImagesDir, { recursive: true });
      }
      const { buffer, width, height } = await createDummyImage(params.aspectRatio);
      const filename = `pptimg-dummy-${uuidv4()}.png`;
      const fullPath = path.join(tempImagesDir, filename);
      await fsp.writeFile(fullPath, buffer);
      logger.info({ fullPath, width, height }, 'generateImage: saveMode dummy');
      return { success: true, path: fullPath, width, height };
    }

    const geminiApiKey = process.env.GEMINI_API_KEY || config.geminiApiKey;
    if (!geminiApiKey) {
      return { success: false, message: 'GEMINI_API_KEY is not set' };
    }

    const tempImagesDir = path.join(config.tempDir, 'images');
    if (!fs.existsSync(tempImagesDir)) {
      await fsp.mkdir(tempImagesDir, { recursive: true });
    }

    const dims = aspectToDims[params.aspectRatio];
    let enhanced = `${params.prompt} (Aspect ratio: ${params.aspectRatio}, Dimensions: ${dims.width}x${dims.height})`;
    if (params.negativePrompt) enhanced += ` --no ${params.negativePrompt}`;

    const ai = new GoogleGenAI({ apiKey: geminiApiKey });
    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash-image',
      contents: [{ role: 'user', parts: [{ text: enhanced }] }] as any,
      config: { responseModalities: [Modality.TEXT, Modality.IMAGE] },
    });

    const parts = response?.candidates?.[0]?.content?.parts || [];
    for (const part of parts) {
      const data = (part as any)?.inlineData?.data;
      if (!data || typeof data !== 'string') continue;
      const raw = Buffer.from(data, 'base64');
      const cropped = await cropToAspect(raw, params.aspectRatio);
      const filename = `pptimg-${uuidv4()}.png`;
      const fullPath = path.join(tempImagesDir, filename);
      await fsp.writeFile(fullPath, cropped);
      logger.info(`generateImage: wrote ${fullPath}`);
      return { success: true, path: fullPath, width: dims.width, height: dims.height };
    }

    return { success: false, message: 'No inline image returned from Gemini' };
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    logger.error({ error: message }, 'generateImage failed');
    return { success: false, message };
  }
}

