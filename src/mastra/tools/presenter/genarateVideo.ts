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

import * as fs from 'node:fs';
import * as fsp from 'node:fs/promises';
import * as path from 'node:path';
import { v4 as uuidv4 } from 'uuid';
import { config } from '../xibo-agent/config';
import { logger } from '../../logger';
import { genarateImage } from './genarateImage';

export type VideoAspect = '16:9' | '9:16' | '1:1';

const aspectToDims: Record<VideoAspect, { width: number; height: number }> = {
  '16:9': { width: 1920, height: 1080 },
  '9:16': { width: 1080, height: 1920 },
  '1:1': { width: 1080, height: 1080 },
};

/**
 * Generate video using Google's Veo model
 */
export async function genarateVideo(params: {
  prompt: string;
  aspectRatio: VideoAspect;
  duration?: number; // in seconds, default 5
  negativePrompt?: string;
}): Promise<{ success: boolean; path?: string; width?: number; height?: number; message?: string }> {
  try {
    // Temporary fallback: Generate static image and convert to video with proper duration
    // TODO: Implement actual video generation when Vertex AI SDK is available
    logger.warn('genarateVideo: Using image fallback - video generation not yet implemented');
    
    const tempVideosDir = path.join(config.tempDir, 'videos');
    if (!fs.existsSync(tempVideosDir)) {
      await fsp.mkdir(tempVideosDir, { recursive: true });
    }

    const dims = aspectToDims[params.aspectRatio];
    const duration = params.duration || 5;
    
    // Generate image as fallback
    const imageResult = await genarateImage({
      prompt: `${params.prompt} (Static image for video placeholder, Aspect ratio: ${params.aspectRatio}, Resolution: ${dims.width}x${dims.height})`,
      negativePrompt: params.negativePrompt || 'text, watermark, logo, low quality, blurry',
      aspectRatio: params.aspectRatio
    });

    if (!imageResult.success || !imageResult.path) {
      return { success: false, message: 'Failed to generate fallback image' };
    }

    // Convert image to video with proper duration using ffmpeg
    const filename = `video-${uuidv4()}.mp4`;
    const fullPath = path.join(tempVideosDir, filename);
    
    // Use ffmpeg to create a video from the static image with the specified duration
    const { execFile } = await import('child_process');
    const { promisify } = await import('util');
    const execFileAsync = promisify(execFile);
    
    await execFileAsync('ffmpeg', [
      '-y', // Overwrite output file
      '-loop', '1', // Loop the input image
      '-i', imageResult.path, // Input image
      '-t', duration.toString(), // Duration in seconds
      '-c:v', 'libx264', // Video codec
      '-pix_fmt', 'yuv420p', // Pixel format for compatibility
      '-vf', `scale=${dims.width}:${dims.height}`, // Scale to exact dimensions
      '-r', '30', // Frame rate
      fullPath
    ]);
    
    logger.info(`genarateVideo: Generated fallback video at ${fullPath} (duration: ${duration}s)`);
    return { success: true, path: fullPath, width: dims.width, height: dims.height };
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    logger.error({ error: message }, 'genarateVideo failed');
    return { success: false, message };
  }
}