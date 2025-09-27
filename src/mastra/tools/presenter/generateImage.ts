/*
 * Lightweight image generator for PowerPoint rendering (no history, temp-only)
 */
import { GoogleGenAI, Modality } from '@google/genai';
import * as fs from 'node:fs';
import * as fsp from 'node:fs/promises';
import * as path from 'node:path';
import { v4 as uuidv4 } from 'uuid';
import { config } from '../xibo-agent/config';
import { logger } from '../../logger';

export type Aspect = '1:1' | '3:4' | '4:3' | '16:9' | '9:16';

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

export async function generateImage(params: {
  prompt: string;
  aspectRatio: Aspect;
  negativePrompt?: string;
}): Promise<{ success: boolean; path?: string; width?: number; height?: number; message?: string }>{
  try {
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
      model: 'gemini-2.0-flash-preview-image-generation',
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

