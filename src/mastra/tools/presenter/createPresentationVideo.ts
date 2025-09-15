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

import { createTool } from '@mastra/core';
import { z } from 'zod';
import { execFile } from 'child_process';
import { promisify } from 'util';
import path from 'path';
import { promises as fs } from 'fs';
import { logger } from '../../logger';
import { googleTextToSpeechTool } from '../audio/googleTextToSpeech';
import { getSpeechConfigByGender } from './speachConfig';
import { config } from '../xibo-agent/config';
import { genarateImage } from './genarateImage';
import { genarateVideo } from './genarateVideo';

const execFileAsync = promisify(execFile);

/**
 * Tool to generate video from PowerPoint files
 * Combines PNG images and WAV audio to create video
 */
export const createPresentationVideoTool = createTool({
  id: 'create-presentation-video',
  description: 'Generate video from PowerPoint files by combining PNG images and WAV audio',
  inputSchema: z.object({
    fileName: z.string().describe('File name under persistent_data/generated/presentations (e.g., presentation.pptx)'),
    gender: z.enum(['male', 'female']).optional().default('male').describe('Voice gender (default: male)'),
  }),
  outputSchema: z.object({
    success: z.boolean(),
    fileName: z.string().optional().describe('File name of generated video file'),
    message: z.string().optional(),
    error: z.string().optional(),
  }),
  execute: async ({ context }) => {
    const { 
      fileName, 
      gender = 'male'
    } = context;

    const baseDir = path.join(config.projectRoot, 'persistent_data', 'generated', 'presentations');
    const pptxPath = path.join(baseDir, fileName);
    const baseName = path.basename(fileName, '.pptx');
    const outputVideoPath = path.join(baseDir, `${baseName}.mp4`);

    try {
      // Check input file exists
      await fs.access(pptxPath);
      logger.info({ pptxPath }, 'PowerPoint file confirmed');

      // Create temporary directory
      const tempDir = path.join(config.projectRoot, 'public', 'temp', 'images');
      await fs.mkdir(tempDir, { recursive: true });

      try {
        // Step 1: Generate PNG images from PPTX
        logger.info('Generating PNG images from PowerPoint...');
        const pngFiles = await generatePngFromPptx(pptxPath, tempDir, 'medium');
        logger.info({ count: pngFiles.length }, `Generated ${pngFiles.length} PNG images`);

        // Step 2: Generate WAV audio from PPTX
        logger.info('Generating WAV audio from PowerPoint...');
        const { wavPath, slideDurations } = await generateWavFromPptx(pptxPath, tempDir, gender);
        logger.info({ wavPath }, 'Generated WAV audio');

        // Step 3: Generate opening and closing content
        logger.info('Generating opening and closing content...');
        const { openingContent, closingContent } = await generateOpeningAndClosingContent(tempDir, baseName);
        logger.info('Generated opening and closing content');

        // Step 4: Prepare audio files
        const assetsDir = path.join(config.projectRoot, 'persistent_data', 'assets', 'audios');
        const openingAudio = path.join(assetsDir, 'Presentation.wav');
        const bgmAudio = path.join(assetsDir, 'bgm001.wav');
        const closingAudio = path.join(assetsDir, 'presentation_long.wav');

        // Step 5: Generate video with opening, main content, and closing
        logger.info('Generating video...');
        
        // Check ffmpeg command exists
        try {
          await execFileAsync('ffmpeg', ['-version']);
        } catch (ffmpegError) {
          throw new Error('ffmpeg command not found.\nInstallation: brew install ffmpeg');
        }

        // Video quality settings (medium fixed)
        const crf = 23;
        const preset = 'medium';

        // Get opening and closing audio durations
        const openingAudioDuration = await getAudioDuration(openingAudio);
        const closingAudioDuration = await getAudioDuration(closingAudio);
        
        logger.info({ 
          openingAudioDuration, 
          closingAudioDuration 
        }, 'Audio durations detected');

        // Create image list file with opening, main slides, and closing
        const imageListPath = path.join(tempDir, 'images.txt');
        let imageListContent = '';

        // Add opening content with duration based on opening audio
        const actualOpeningDuration = openingAudioDuration > 0 ? openingAudioDuration : 5.0;
        imageListContent += `file '${openingContent.path.replace(/'/g, "'\\''")}'\nduration ${actualOpeningDuration}\n`;

        // Add main slides as images
        pngFiles.forEach((pngFile, index) => {
          const narrationDuration = slideDurations[index] || 1.0;
          const totalDuration = narrationDuration + 2.0 + 1.0;
          imageListContent += `file '${pngFile.replace(/'/g, "'\\''")}'\nduration ${totalDuration}\n`;
        });

        // Add closing content with duration based on closing audio
        const actualClosingDuration = closingAudioDuration > 0 ? closingAudioDuration : 5.0;
        imageListContent += `file '${closingContent.path.replace(/'/g, "'\\''")}'\nduration ${actualClosingDuration}\n`;

        await fs.writeFile(imageListPath, imageListContent, 'utf-8');

        // Create audio mix with BGM
        const mixedAudioPath = path.join(tempDir, 'mixed_audio.wav');
        await mixAudioWithBGM(wavPath, bgmAudio, mixedAudioPath);

        // Create final audio with opening, main, and closing
        const finalAudioPath = path.join(tempDir, 'final_audio.wav');
        await createFinalAudio(openingAudio, mixedAudioPath, closingAudio, finalAudioPath);
        
        // Log final audio duration for debugging
        const finalAudioDuration = await getAudioDuration(finalAudioPath);
        logger.info({ finalAudioDuration }, 'Final audio duration');

        // Generate video with ffmpeg
        const ffmpegArgs = [
          '-y', // Overwrite without confirmation
          '-f', 'concat',
          '-safe', '0',
          '-i', imageListPath, // Image list
          '-i', finalAudioPath, // Final audio file
          '-vf', 'scale=trunc(iw/2)*2:trunc(ih/2)*2', // Resize to even dimensions
          '-c:v', 'libx264', // Video codec
          '-c:a', 'aac', // Audio codec
          '-crf', crf.toString(), // Quality setting
          '-preset', preset, // Encoding speed setting
          '-r', '30', // Frame rate
          '-pix_fmt', 'yuv420p', // Pixel format (for compatibility)
          outputVideoPath
        ];

        await execFileAsync('ffmpeg', ffmpegArgs);

        // Clean up temporary directory
        await fs.rm(tempDir, { recursive: true, force: true });

        logger.info({ outputVideoPath }, 'Video generation completed');

        return {
          success: true,
          fileName: `${baseName}.mp4`,
          message: `Video generated: ${outputVideoPath}`
        };

      } catch (conversionError) {
        // Clean up temporary directory
        await fs.rm(tempDir, { recursive: true, force: true });
        throw conversionError;
      }

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      logger.error({ error, pptxPath }, 'Video generation failed');
      
      return {
        success: false,
        error: errorMessage
      };
    }
  },
});

/**
 * Generate PNG images from PPTX file
 */
async function generatePngFromPptx(pptxPath: string, outputDir: string, videoQuality: string): Promise<string[]> {
  const tempDir = path.join(outputDir, 'temp_pptx_to_png');
  await fs.mkdir(tempDir, { recursive: true });

  try {
    // Convert PPTX to PDF using LibreOffice
    const libreOfficeCmd = process.platform === 'darwin' ? '/Applications/LibreOffice.app/Contents/MacOS/soffice' : 'libreoffice';
    
    try {
      await fs.access(libreOfficeCmd);
    } catch (accessError) {
      throw new Error(`LibreOffice not found at: ${libreOfficeCmd}\nInstall: brew install --cask libreoffice`);
    }
    
    await execFileAsync(libreOfficeCmd, [
      '--headless',
      '--convert-to', 'pdf',
      '--outdir', tempDir,
      pptxPath
    ]);

    // Verify PDF conversion
    const baseName = path.basename(pptxPath, '.pptx');
    const actualPdfPath = path.join(tempDir, `${baseName}.pdf`);
    
    try {
      await fs.access(actualPdfPath);
    } catch (pdfAccessError) {
      const tempFiles = await fs.readdir(tempDir);
      throw new Error(`PDF conversion failed. Expected: ${actualPdfPath}, Found: ${tempFiles.join(', ')}`);
    }

    // Convert PDF to PNG using poppler-utils
    try {
      await execFileAsync('pdftoppm', ['-h']);
    } catch (pdftoppmError) {
      throw new Error('pdftoppm command not found.\nInstall: brew install poppler');
    }

    const dpi = videoQuality === 'high' ? 300 : videoQuality === 'medium' ? 200 : 150;
    await execFileAsync('pdftoppm', [
      '-png',
      '-r', dpi.toString(),
      actualPdfPath,
      path.join(tempDir, 'slide')
    ]);

    // Rename and move generated PNG files
    const tempFiles = await fs.readdir(tempDir);
    const pngTempFiles = tempFiles.filter(file => file.startsWith('slide-') && file.endsWith('.png'));
    
    const pngFiles: string[] = [];
    for (let i = 0; i < pngTempFiles.length; i++) {
      const tempPngPath = path.join(tempDir, pngTempFiles[i]);
      const finalPngPath = path.join(outputDir, `${baseName}_slide_${i + 1}.png`);
      await fs.rename(tempPngPath, finalPngPath);
      pngFiles.push(finalPngPath);
    }

    // Clean up temporary directory
    await fs.rm(tempDir, { recursive: true, force: true });

    return pngFiles.sort((a, b) => {
      const aNum = parseInt(a.match(/_slide_(\d+)\.png$/)?.[1] || '0');
      const bNum = parseInt(b.match(/_slide_(\d+)\.png$/)?.[1] || '0');
      return aNum - bNum;
    });

  } catch (error) {
    // Clean up temporary directory
    await fs.rm(tempDir, { recursive: true, force: true });
    throw error;
  }
}

/**
 * Generate WAV audio from PPTX file
 */
async function generateWavFromPptx(pptxPath: string, outputDir: string, gender: 'male' | 'female'): Promise<{ wavPath: string, slideDurations: number[] }> {
  const baseName = path.basename(pptxPath, '.pptx');
  const wavPath = path.join(outputDir, `${baseName}.wav`);
  const tempDir = path.join(outputDir, 'temp_wav_generation');
  const segDir = path.join(tempDir, 'segments');
  
  await fs.mkdir(segDir, { recursive: true });

  try {
    // Extract notes from PPTX
    const extractDir = path.join(tempDir, 'extract');
    await fs.mkdir(extractDir, { recursive: true });
    
    await execFileAsync('unzip', ['-q', '-o', pptxPath, '-d', extractDir]);
    
    const notesDir = path.join(extractDir, 'ppt', 'notesSlides');
    let notesFiles: string[] = [];
    try {
      const all = await fs.readdir(notesDir);
      notesFiles = all.filter(n => /^notesSlide\d+\.xml$/i.test(n)).sort((a,b)=>{
        const an = parseInt(a.replace(/\D/g,''),10);
        const bn = parseInt(b.replace(/\D/g,''),10);
        return an - bn;
      });
    } catch {}
    
    const slideNotes: string[] = [];
    for (const f of notesFiles) {
      try {
        const xml = await fs.readFile(path.join(notesDir, f), 'utf-8');
        // Extract only shapes that correspond to the notes body, excluding placeholders
        const shapes = Array.from(xml.matchAll(/<p:sp[\s\S]*?<\/p:sp>/g)).map(m => m[0]);
        const includedBlocks: string[] = [];
        for (const block of shapes) {
          const hasPh = /<p:ph\b[^>]*>/i.test(block);
          if (!hasPh) continue;
          const ph = block.match(/<p:ph\b[^>]*>/i)?.[0] || '';
          const isSlideNum = /type="sldNum"/i.test(ph);
          const isDate = /type="dt"/i.test(ph);
          const isFooter = /type="ftr"/i.test(ph);
          const isHeader = /type="hdr"/i.test(ph);
          const isBody = /type="body"/i.test(ph) || /Notes Placeholder/i.test(block);
          if (isSlideNum || isDate || isFooter || isHeader) continue;
          if (isBody) includedBlocks.push(block);
        }
        const target = includedBlocks.length ? includedBlocks.join('\n') : xml;
        const texts = Array.from(target.matchAll(/<a:t>([\s\S]*?)<\/a:t>/g)).map(m => m[1]);
        const joined = texts.map(s => String(s || '').replace(/\s+/g, ' ').trim()).filter(Boolean).join('\n');
        slideNotes.push(joined);
      } catch { slideNotes.push(''); }
    }

    // Speech synthesis configuration
    const speechCfg = getSpeechConfigByGender(gender);
    logger.info({ gender, voiceName: speechCfg.voiceName, ssmlGender: gender === 'female' ? 'FEMALE' : 'MALE' }, 'TTS configuration');

    // Text-to-speech helper function
    const synth = async (text: string, outWav: string) => {
      const trimmed = String(text || '').trim();
      if (!trimmed) return;
      
      const ttsParams = { 
        text: trimmed, 
        voiceName: speechCfg.voiceName, 
        ssmlGender: (gender === 'female' ? 'FEMALE' : 'MALE'),
        languageCode: speechCfg.languageCode, 
        speakingRate: speechCfg.speakingRate, 
        pitch: speechCfg.pitch, 
        format: 'wav', 
        fileNameBase: path.basename(outWav, '.wav'), 
        outDir: path.dirname(outWav), 
        pronunciationDictPath: speechCfg.pronunciationDictPath 
      };
      
      logger.info({ ttsParams }, 'Calling Google TTS');
      
      const res = await googleTextToSpeechTool.execute({ 
        context: ttsParams
      } as any);
      
      if (res.success && (res.data as any).filePath) {
        const src = (res.data as any).filePath as string;
        if (src !== outWav) {
          // Normalize Google TTS output to 44.1kHz stereo PCM
          await execFileAsync('ffmpeg', [
            '-y',
            '-i', src,
            '-ar', '44100',
            '-ac', '2',
            '-c:a', 'pcm_s16le',
            outWav
          ]);
        }
      } else {
        throw new Error('Google TTS failed to synthesize segment');
      }
    };

    // Silence generation helper function
    const makeSilence = async (outWav: string, seconds: number) => {
      const dur = Math.max(0.1, Number(seconds) || 0);
      await execFileAsync('ffmpeg', ['-y', '-f', 'lavfi', '-i', 'anullsrc=r=44100:cl=stereo', '-t', String(dur), '-ar', '44100', '-ac', '2', outWav]);
    };

    // Build segments and record slide durations
    const segPaths: string[] = [];
    const slideDurations: number[] = [];
    
    for (let i = 0; i < slideNotes.length; i++) {
      const notes = String(slideNotes[i] || '').trim();
      
      // Image display start (2 seconds silence)
      const preSlideSilence = path.join(segDir, `pre-slide-${String(i+1).padStart(3,'0')}.wav`);
      await makeSilence(preSlideSilence, 2.0);
      segPaths.push(preSlideSilence);
      
      if (notes) {
        // Narration audio
        const wav = path.join(segDir, `slide-${String(i+1).padStart(3,'0')}.wav`);
        await synth(notes, wav);
        segPaths.push(wav);
        
        // Measure each slide's audio duration (narration only)
        const narrationDuration = await getAudioDuration(wav);
        slideDurations.push(narrationDuration);
      } else {
        // Empty slide with 5 seconds silence
        const emptySlideSilence = path.join(segDir, `empty-slide-${String(i+1).padStart(3,'0')}.wav`);
        await makeSilence(emptySlideSilence, 5.0);
        segPaths.push(emptySlideSilence);
        slideDurations.push(5.0);
      }
      
      // After narration ends (1 second silence)
      const postSlideSilence = path.join(segDir, `post-slide-${String(i+1).padStart(3,'0')}.wav`);
      await makeSilence(postSlideSilence, 1.0);
      segPaths.push(postSlideSilence);
    }

    if (!segPaths.length) {
      throw new Error('No slides provided or no segments generated.');
    }

    // Concatenate all segments
    const listPath = path.join(tempDir, 'concat.txt');
    const listBody = segPaths.map(p => `file '${p.replace(/'/g, "'\\''")}'`).join('\n');
    await fs.writeFile(listPath, listBody, 'utf-8');
    await execFileAsync('ffmpeg', ['-y', '-f', 'concat', '-safe', '0', '-i', listPath, '-c', 'copy', wavPath]);

    // Clean up temporary directory
    await fs.rm(tempDir, { recursive: true, force: true });

    return { wavPath, slideDurations };

  } catch (error) {
    // Clean up temporary directory
    await fs.rm(tempDir, { recursive: true, force: true });
    throw error;
  }
}


/**
 * Generate opening and closing content (images or videos)
 * This function provides a clean interface for generating opening/closing content
 * and can be easily switched between image and video generation
 */
async function generateOpeningAndClosingContent(
  tempDir: string, 
  baseName: string
): Promise<{ 
  openingContent: { path: string; type: 'image' | 'video' }; 
  closingContent: { path: string; type: 'image' | 'video' } 
}> {
  // For now, generate images (can be easily switched to videos later)
  const openingImage = await generateOpeningImage(tempDir, baseName);
  const closingImage = await generateClosingImage(tempDir, baseName);
  
  return {
    openingContent: { path: openingImage, type: 'image' },
    closingContent: { path: closingImage, type: 'image' }
  };
}

/**
 * Generate opening image
 */
async function generateOpeningImage(tempDir: string, baseName: string): Promise<string> {
  const openingImagePath = path.join(tempDir, `${baseName}_opening.png`);
  
  const result = await genarateImage({
    prompt: 'Professional presentation opening image, elegant curtain opening scene, stage with spotlight, microphone and podium, audience silhouettes, theatrical presentation setup, sophisticated business presentation scene, warm lighting, cinematic quality, 16:9 aspect ratio',
    negativePrompt: 'text, watermark, logo, low quality, blurry',
    aspectRatio: '16:9'
  });

  if (!result.success) {
    throw new Error(`Failed to generate opening image: ${result.message}`);
  }

  if (result.path) {
    await fs.copyFile(result.path, openingImagePath);
  }

  return openingImagePath;
}

/**
 * Generate closing image
 */
async function generateClosingImage(tempDir: string, baseName: string): Promise<string> {
  const closingImagePath = path.join(tempDir, `${baseName}_closing.png`);
  
  const result = await genarateImage({
    prompt: 'Professional presentation closing image with thank you message, elegant curtain closing scene, stage with spotlight, audience applause, theatrical presentation ending, sophisticated business presentation scene, warm lighting, cinematic quality, 16:9 aspect ratio',
    negativePrompt: 'text, watermark, logo, low quality, blurry',
    aspectRatio: '16:9'
  });

  if (!result.success) {
    throw new Error(`Failed to generate closing image: ${result.message}`);
  }

  if (result.path) {
    await fs.copyFile(result.path, closingImagePath);
  }

  return closingImagePath;
}

/**
 * Mix narration audio with BGM
 */
async function mixAudioWithBGM(narrationPath: string, bgmPath: string, outputPath: string): Promise<void> {
  // Get narration duration
  const narrationDuration = await getAudioDuration(narrationPath);
  
  // First normalize both audio files to 44.1kHz stereo using PCM
  const normalizedNarration = path.join(path.dirname(outputPath), 'normalized_narration.wav');
  const normalizedBGM = path.join(path.dirname(outputPath), 'normalized_bgm.wav');
  
  // Normalize narration to PCM
  await execFileAsync('ffmpeg', [
    '-y',
    '-i', narrationPath,
    '-ar', '44100',
    '-ac', '2',
    '-c:a', 'pcm_s16le',
    normalizedNarration
  ]);
  
  // Normalize BGM to PCM and reduce volume to 10% (much lower for better narration clarity)
  await execFileAsync('ffmpeg', [
    '-y',
    '-i', bgmPath,
    '-ar', '44100',
    '-ac', '2',
    '-filter:a', 'volume=0.1',
    '-c:a', 'pcm_s16le',
    normalizedBGM
  ]);
  
  // Mix the normalized audio files with BGM loop
  await execFileAsync('ffmpeg', [
    '-y',
    '-i', normalizedNarration,
    '-stream_loop', '-1',
    '-i', normalizedBGM,
    '-filter_complex', 'amix=inputs=2:duration=first:dropout_transition=0',
    '-c:a', 'pcm_s16le',
    outputPath
  ]);
}

/**
 * Create final audio with opening, main, and closing
 */
async function createFinalAudio(openingPath: string, mainPath: string, closingPath: string, outputPath: string): Promise<void> {
  const audioListPath = path.join(path.dirname(outputPath), 'audio_list.txt');
  const audioListContent = [
    `file '${openingPath.replace(/'/g, "'\\''")}'`,
    `file '${mainPath.replace(/'/g, "'\\''")}'`,
    `file '${closingPath.replace(/'/g, "'\\''")}'`
  ].join('\n');

  await fs.writeFile(audioListPath, audioListContent, 'utf-8');

  // Normalize all audio files to 44.1kHz stereo before concatenation using PCM
  await execFileAsync('ffmpeg', [
    '-y',
    '-f', 'concat',
    '-safe', '0',
    '-i', audioListPath,
    '-c:a', 'pcm_s16le',
    '-ar', '44100',
    '-ac', '2',
    outputPath
  ]);
}



/**
 * Get audio file duration helper function
 */
async function getAudioDuration(audioPath: string): Promise<number> {
  try {
    const { stdout } = await execFileAsync('ffprobe', [
      '-v', 'quiet',
      '-show_entries', 'format=duration',
      '-of', 'csv=p=0',
      audioPath
    ]);
    
    const duration = parseFloat(stdout.trim());
    return isNaN(duration) ? 0 : duration;
  } catch (error) {
    logger.warn({ error, audioPath }, 'Failed to get audio duration, using default value');
    return 0;
  }
}