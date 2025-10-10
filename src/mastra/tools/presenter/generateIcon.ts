/*
 * Copyright (C) 2025 Open Source Digital Signage Initiative.
 *
 * This file is licensed under the Elastic License 2.0 (ELv2).
 * You may not use this file except in compliance with the License.
 * You may obtain a copy of the License at:
 *   https://www.elastic.co/licensing/elastic-license
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

// NOTE: This helper focuses on generating UI icons for slides.
// It requests a transparent PNG at an exact size and returns a cached file path.
// The image is re-encoded losslessly to normalize metadata and ensure PPTX compatibility.

import * as fs from 'node:fs';
import * as fsp from 'node:fs/promises';
import * as path from 'node:path';
import { v4 as uuidv4 } from 'uuid';
import { GoogleGenAI, Modality } from '@google/genai';
import { config } from '../xibo-agent/config';
import { logger } from '../../logger';

/**
 * Generate a 256x256 transparent PNG icon with square 1:1 aspect, no resizing.
 * The prompt should describe a simple glyph (e.g., "sun", "expand", "building", "ruler").
 */
export async function generateIcon(params: { prompt: string; negativePrompt?: string }): Promise<{ success: boolean; path?: string; message?: string }>{
  try {
    const geminiApiKey = process.env.GEMINI_API_KEY || config.geminiApiKey;
    if (!geminiApiKey) return { success: false, message: 'GEMINI_API_KEY is not set' };

    const tempDir = path.join(config.tempDir, 'icons');
    if (!fs.existsSync(tempDir)) await fsp.mkdir(tempDir, { recursive: true });

    // Fixed icon size for predictable layout on slides.
    // If you need different sizes in future, prefer generating at the target
    // resolution to avoid post-processing that might affect compatibility.
    const size = { width: 256, height: 256 };
    const ai = new GoogleGenAI({ apiKey: geminiApiKey });
    const base = `${params.prompt} --transparent background --format png --size ${size.width}x${size.height} (Aspect ratio: 1:1, Dimensions: ${size.width}x${size.height})`;
    const prompt = params.negativePrompt ? `${base} --no ${params.negativePrompt}` : base;

    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash-image',
      contents: [{ role: 'user', parts: [{ text: prompt }] }] as any,
      config: { responseModalities: [Modality.TEXT, Modality.IMAGE] },
    });

    const parts = response?.candidates?.[0]?.content?.parts || [];
    for (const part of parts) {
      const data = (part as any)?.inlineData?.data;
      if (!data || typeof data !== 'string') continue;
      const raw = Buffer.from(data, 'base64');
      // Re-encode the PNG without resizing (transparent background preserved)
      // This normalizes color profiles/metadata so Office/PPTX readers load reliably.
      let output: Buffer = raw;
      try {
        const { createCanvas, loadImage } = await import('canvas');
        const img = await loadImage(`data:image/png;base64,${raw.toString('base64')}`);
        const w = Math.max(1, (img as any).width || 256);
        const h = Math.max(1, (img as any).height || 256);
        const canvas = createCanvas(w, h);
        const ctx = canvas.getContext('2d');
        ctx.clearRect(0, 0, w, h);
        ctx.drawImage(img as any, 0, 0, w, h);
        output = canvas.toBuffer('image/png');
      } catch {}
      const filename = `icon-${uuidv4()}.png`;
      const fullPath = path.join(tempDir, filename);
      await fsp.writeFile(fullPath, output);
      try { logger.info({ fullPath }, 'generateIcon: wrote'); } catch {}
      return { success: true, path: fullPath };
    }

    return { success: false, message: 'No inline image returned from Gemini' };
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    try { logger.error({ error: msg }, 'generateIcon failed'); } catch {}
    return { success: false, message: msg };
  }
}
