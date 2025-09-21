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

const execFileAsync = promisify(execFile);

/**
 * Tool to generate video from PowerPoint files
 * Combines PNG images and WAV audio to create video
 */
export const createPresentationVideoTool = createTool({
  id: 'create-presentation-video',
  description: 'Generate video from PowerPoint files by combining PNG images and WAV audio with AI-generated opening and closing images',
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
      logger.info({ fileName }, '📄 Processing PowerPoint file');

      // Create temporary directory
      const tempDir = path.join(config.projectRoot, 'public', 'temp', 'images');
      await fs.mkdir(tempDir, { recursive: true });

      try {
        // Step 1: Generate PNG images from PPTX
        logger.info('📸 Step 1: Converting PowerPoint to PNG images...');
        const pngFiles = await generatePngFromPptx(pptxPath, tempDir, 'medium');
        logger.info({ count: pngFiles.length }, `✅ Generated ${pngFiles.length} PNG images`);

        // Step 2: Generate WAV audio from PPTX
        logger.info('🎤 Step 2: Generating speech audio from slide notes...');
        const { wavPath, slideDurations } = await generateWavFromPptx(pptxPath, tempDir, gender);
        logger.info({ slideCount: slideDurations.length }, '✅ Generated speech audio');

        // Step 3: Generate opening and closing content
        logger.info('🎨 Step 3: Creating opening and closing images...');
        const { openingContent, closingContent } = await generateOpeningAndClosingContent(tempDir, baseName);
        logger.info({ 
          openingType: openingContent.type, 
          closingType: closingContent.type 
        }, '✅ Generated opening and closing content');

        // Step 4: Prepare audio files
        logger.info('🎵 Step 4: Preparing audio assets...');
        const assetsDir = path.join(config.projectRoot, 'persistent_data', 'assets', 'audios');
        const openingAudio = path.join(assetsDir, 'Presentation.wav');
        const bgmAudio = path.join(assetsDir, 'bgm001.wav');
        const closingAudio = path.join(assetsDir, 'presentation_long.wav');

        // Step 5: Extract audio from opening and closing videos
        logger.info('🔊 Step 5: Processing opening and closing audio...');
        
        const openingVideoAudio = path.join(tempDir, 'opening_video_audio.wav');
        const closingVideoAudio = path.join(tempDir, 'closing_video_audio.wav');
        
        // Extract audio from opening video
        if (openingContent.type === 'video') {
          await execFileAsync('ffmpeg', [
            '-y',
            '-i', openingContent.path,
            '-vn', // No video
            '-acodec', 'pcm_s16le',
            '-ar', '44100',
            '-ac', '2',
            openingVideoAudio
          ]);
        } else {
          // If opening is image, use the original opening audio
          await fs.copyFile(openingAudio, openingVideoAudio);
        }
        
        // Extract audio from closing video
        if (closingContent.type === 'video') {
          await execFileAsync('ffmpeg', [
            '-y',
            '-i', closingContent.path,
            '-vn', // No video
            '-acodec', 'pcm_s16le',
            '-ar', '44100',
            '-ac', '2',
            closingVideoAudio
          ]);
        } else {
          // If closing is image, use the original closing audio
          await fs.copyFile(closingAudio, closingVideoAudio);
        }

        // Step 6: Generate video with opening, main content, and closing
        logger.info('🎬 Step 6: Generating final video...');
        
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
        const openingAudioDuration = await getAudioDuration(openingVideoAudio);
        const closingAudioDuration = await getAudioDuration(closingVideoAudio);
        
        logger.info({ 
          opening: Math.round(openingAudioDuration), 
          closing: Math.round(closingAudioDuration) 
        }, '⏱️ Audio durations detected (seconds)');

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
        
        logger.info({ 
          openingType: openingContent.type,
          closingType: closingContent.type,
          slideCount: pngFiles.length
        }, '📋 Image list created for video generation');

        // Create audio mix with BGM
        logger.info('🎼 Mixing speech with background music...');
        const mixedAudioPath = path.join(tempDir, 'mixed_audio.wav');
        await mixAudioWithBGM(wavPath, bgmAudio, mixedAudioPath);

        // Create final audio with opening, main, and closing
        logger.info('🔗 Combining all audio segments...');
        const finalAudioPath = path.join(tempDir, 'final_audio.wav');
        await createFinalAudio(openingVideoAudio, mixedAudioPath, closingVideoAudio, finalAudioPath);
        
        // Get final audio duration for validation
        const finalAudioDuration = await getAudioDuration(finalAudioPath);
        logger.info({ duration: Math.round(finalAudioDuration) }, '⏱️ Final audio duration (seconds)');

        // Generate video with ffmpeg
        const ffmpegArgs = [
          '-y', // Overwrite without confirmation
          '-f', 'concat',
          '-safe', '0',
          '-i', imageListPath, // Image/video list
          '-i', finalAudioPath, // Final audio file
          '-vf', 'scale=trunc(iw/2)*2:trunc(ih/2)*2', // Resize to even dimensions
          '-c:v', 'libx264', // Video codec
          '-c:a', 'aac', // Audio codec
          '-crf', crf.toString(), // Quality setting
          '-preset', preset, // Encoding speed setting
          '-r', '30', // Frame rate
          '-pix_fmt', 'yuv420p', // Pixel format (for compatibility)
          '-shortest', // End when shortest input ends
          outputVideoPath
        ];

        await execFileAsync('ffmpeg', ffmpegArgs);

        // Clean up temporary directory
        await fs.rm(tempDir, { recursive: true, force: true });

        logger.info({ outputVideoPath }, '🎉 Video generation completed successfully');

        return {
          success: true,
          fileName: `${baseName}.mp4`,
          message: `Video generated: ${outputVideoPath}`
        };

      } catch (conversionError) {
        // Clean up temporary directory
        await fs.rm(tempDir, { recursive: true, force: true });
        const errorMessage = conversionError instanceof Error ? conversionError.message : 'Unknown conversion error';
        logger.error({ error: errorMessage, fileName }, '❌ Video generation failed');
        return {
          success: false,
          error: errorMessage
        };
      }

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      logger.error({ error: errorMessage, fileName }, '❌ Video generation failed');
      
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
    const errorMessage = error instanceof Error ? error.message : 'Unknown PNG generation error';
    logger.error({ error: errorMessage }, '❌ PNG generation failed');
    throw new Error(errorMessage);
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
      
      const res = await googleTextToSpeechTool.execute({ 
        context: ttsParams
      } as any);
      
      if (res.success && (res.data as any).filePath) {
        const src = (res.data as any).filePath as string;
        
        // Always copy and normalize the file to ensure correct naming
        await execFileAsync('ffmpeg', [
          '-y',
          '-i', src,
          '-ar', '44100',
          '-ac', '2',
          '-c:a', 'pcm_s16le',
          outWav
        ]);
        
        // Verify the output file was created
        await fs.access(outWav);
      } else {
        throw new Error('Google TTS failed to synthesize segment');
      }
    };

    // Silence generation helper function
    const makeSilence = async (outWav: string, seconds: number) => {
      const dur = Math.max(0.1, Number(seconds) || 0);
      try {
        await execFileAsync('ffmpeg', ['-y', '-f', 'lavfi', '-i', 'anullsrc=r=44100:cl=stereo', '-t', String(dur), '-ar', '44100', '-ac', '2', outWav]);
        await fs.access(outWav);
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        logger.error({ error: errorMessage, outWav, duration: dur }, '❌ Failed to create silence file');
        throw new Error(`Silence file creation failed: ${errorMessage}`);
      }
    };

    // Build segments and record slide durations
    const segPaths: string[] = [];
    const slideDurations: number[] = [];
    
    for (let i = 0; i < slideNotes.length; i++) {
      const notes = String(slideNotes[i] || '').trim();
      
      try {
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
        
        // Progress logging every 5 slides
        if ((i + 1) % 5 === 0 || i === slideNotes.length - 1) {
          logger.info({ processed: i + 1, total: slideNotes.length }, '🎤 Processing speech synthesis');
        }
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        logger.error({ slideIndex: i + 1, error: errorMessage }, '❌ Failed to process slide');
        throw new Error(`Slide ${i + 1} processing failed: ${errorMessage}`);
      }
    }

    if (!segPaths.length) {
      throw new Error('No slides provided or no segments generated.');
    }

    // Concatenate all segments
    const listPath = path.join(tempDir, 'concat.txt');
    const listBody = segPaths.map(p => `file '${p.replace(/'/g, "'\\''")}'`).join('\n');
    await fs.writeFile(listPath, listBody, 'utf-8');
    
        logger.info({ segmentCount: segPaths.length }, '🔗 Concatenating audio segments');
    
    // Verify all segment files exist before concatenation
    for (const segPath of segPaths) {
      try {
        await fs.access(segPath);
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        logger.error({ missingFile: segPath, error: errorMessage }, '❌ Segment file does not exist');
        throw new Error(`Segment file does not exist: ${segPath}`);
      }
    }
    
    await execFileAsync('ffmpeg', ['-y', '-f', 'concat', '-safe', '0', '-i', listPath, '-c', 'copy', wavPath]);

    // Clean up temporary directory
    await fs.rm(tempDir, { recursive: true, force: true });

    return { wavPath, slideDurations };

  } catch (error) {
    // Clean up temporary directory
    await fs.rm(tempDir, { recursive: true, force: true });
    const errorMessage = error instanceof Error ? error.message : 'Unknown WAV generation error';
    logger.error({ error: errorMessage }, '❌ WAV generation failed');
    throw new Error(errorMessage);
  }
}


/**
 * Generate opening and closing content (images only)
 * This function generates AI images for opening and closing sequences
 */
async function generateOpeningAndClosingContent(
  tempDir: string, 
  baseName: string
): Promise<{ 
  openingContent: { path: string; type: 'image' | 'video' }; 
  closingContent: { path: string; type: 'image' | 'video' } 
}> {
  // Generate opening image
  const openingImage = await generateOpeningImage(tempDir, baseName);
  const openingContent = { path: openingImage, type: 'image' as const };
  logger.info('Opening image generated');

  // Generate closing image
  const closingImage = await generateClosingImage(tempDir, baseName);
  const closingContent = { path: closingImage, type: 'image' as const };
  logger.info('Closing image generated');
  
  return {
    openingContent,
    closingContent
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
    const errorMessage = `Failed to generate opening image: ${result.message}`;
    logger.error({ error: errorMessage }, '❌ Opening image generation failed');
    throw new Error(errorMessage);
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
    const errorMessage = `Failed to generate closing image: ${result.message}`;
    logger.error({ error: errorMessage }, '❌ Closing image generation failed');
    throw new Error(errorMessage);
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