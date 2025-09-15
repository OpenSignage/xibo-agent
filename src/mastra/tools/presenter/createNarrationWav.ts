/*
 * Copyright (C) 2025 Open Source Digital Signage Initiative.
 */
import { createTool } from '@mastra/core/tools';
import { z } from 'zod';
import { logger } from '../../logger';
import path from 'path';
import { promises as fs } from 'fs';
import { config } from '../xibo-agent/config';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { googleTextToSpeechTool } from '../audio/googleTextToSpeech';
import { getSpeechConfigByGender } from './speachConfig';
const execFileAsync = promisify(execFile);

const inputSchema = z.object({
  fileName: z.string().describe('File name under persistent_data/generated/presentations (without directory), e.g., presentation.pptx'),
  gender: z.enum(['male','female']).optional().describe('Voice gender (default: female)'),
  interSlidePrompt: z.string().optional().describe('Text inserted between slides (default: 次のスライドをお願いします。)')
});

const successSchema = z.object({ success: z.literal(true), data: z.object({ filePath: z.string() }) });
const errorSchema = z.object({ success: z.literal(false), message: z.string() });

export const createNarrationWavTool = createTool({
  id: 'create-narration-wav',
  description: 'Generate a single WAV narration (Google TTS) from all slide notes in a PPTX under generated/presentations (by file name). Output .wav is written to the same directory.',
  inputSchema,
  outputSchema: z.union([successSchema, errorSchema]),
  execute: async ({ context }) => {
    const fileName = String((context as any).fileName);
    const gender = ((context as any).gender || 'female') as 'male'|'female';
    const outName = fileName.replace(/\.pptx$/i, '.wav');
    const interSlidePrompt = (context as any).interSlidePrompt ? String((context as any).interSlidePrompt) : '次のスライドをお願いします。';
    const speechCfg = getSpeechConfigByGender(gender);

    const outDir = path.join(config.projectRoot, 'persistent_data', 'generated', 'presentations');
    const tempDir = path.join(config.tempDir || path.join(config.projectRoot, 'public', 'temp'), `nar-${Date.now()}-${Math.floor(Math.random()*1e6)}`);
    const segDir = path.join(tempDir, 'segments');
    const outPath = path.join(outDir, outName);

    try { await fs.mkdir(outDir, { recursive: true }); } catch {}
    try { await fs.mkdir(segDir, { recursive: true }); } catch {}

    // Extract notes from PPTX
    const pptxPath = path.join(outDir, fileName);
    const extractDir = path.join(tempDir, 'extract');
    try { await fs.mkdir(extractDir, { recursive: true }); } catch {}
    try {
      await execFileAsync('unzip', ['-q', '-o', pptxPath, '-d', extractDir]);
    } catch (e) {
      return { success: false, message: 'Failed to read PPTX (unzip not available or file corrupted).' } as const;
    }
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
        // Extract only shapes that correspond to the notes body, excluding placeholders like slide number/date/footer/header
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
        // Fallback: if we couldn't find body blocks, use the entire xml but still exclude slide number/date/footer/header text containers
        const target = includedBlocks.length ? includedBlocks.join('\n') : xml;
        const texts = Array.from(target.matchAll(/<a:t>([\s\S]*?)<\/a:t>/g)).map(m => m[1]);
        const joined = texts.map(s => String(s || '').replace(/\s+/g, ' ').trim()).filter(Boolean).join('\n');
        slideNotes.push(joined);
      } catch { slideNotes.push(''); }
    }

    // Small helper to synthesize text to WAV segment via Google TTS
    const synth = async (text: string, outWav: string) => {
      const trimmed = String(text || '').trim();
      if (!trimmed) {
        // Skip empty segments
        return;
      }
      const res = await googleTextToSpeechTool.execute({ context: { text: trimmed, voiceName: speechCfg.voiceName, ssmlGender: (gender === 'female' ? 'FEMALE' : 'MALE'), languageCode: speechCfg.languageCode, speakingRate: speechCfg.speakingRate, pitch: speechCfg.pitch, format: 'wav', fileNameBase: path.basename(outWav, '.wav'), outDir: path.dirname(outWav), pronunciationDictPath: speechCfg.pronunciationDictPath } } as any);
      if (res.success && (res.data as any).filePath) {
        // Already in desired location/name; ensure final name is outWav
        const src = (res.data as any).filePath as string;
        if (src !== outWav) await fs.copyFile(src, outWav).catch(()=>{});
      } else {
        throw new Error('Google TTS failed to synthesize segment');
      }
    };

    // Helper to generate silence WAV of specified seconds at 44.1kHz mono
    const makeSilence = async (outWav: string, seconds: number) => {
      const dur = Math.max(0.1, Number(seconds) || 0);
      await execFileAsync('ffmpeg', ['-y', '-f', 'lavfi', '-i', 'anullsrc=r=44100:cl=mono', '-t', String(dur), '-ar', '44100', '-ac', '1', outWav]);
    };

    // Build segments: [notes1][prompt][notes2][prompt]...[notesN]
    const segPaths: string[] = [];
    for (let i = 0; i < slideNotes.length; i++) {
      const notes = String(slideNotes[i] || '').trim();
      if (notes) {
        const wav = path.join(segDir, `slide-${String(i+1).padStart(3,'0')}.wav`);
        await synth(notes, wav);
        segPaths.push(wav);
      }
      // Insert prompt between slides only if a next non-empty note exists (not after last), with longer pre/post silence
      if (i < slideNotes.length - 1) {
        let hasNextContent = false;
        for (let j = i + 1; j < slideNotes.length; j++) {
          if (String(slideNotes[j] || '').trim()) { hasNextContent = true; break; }
        }
        if (hasNextContent) {
          const preSil = path.join(segDir, `silence-pre-${String(i+1).padStart(3,'0')}.wav`);
          await makeSilence(preSil, 0.8);
          segPaths.push(preSil);
          const pwav = path.join(segDir, `prompt-after-${String(i+1).padStart(3,'0')}.wav`);
          await synth(interSlidePrompt, pwav);
          segPaths.push(pwav);
          const postSil = path.join(segDir, `silence-post-${String(i+1).padStart(3,'0')}.wav`);
          await makeSilence(postSil, 1.2);
          segPaths.push(postSil);
        }
      }
    }

    if (!segPaths.length) {
      return { success: false, message: 'No slides provided or no segments generated.' } as const;
    }

    // Concat all segments to final WAV using ffmpeg concat
    const listPath = path.join(tempDir, 'concat.txt');
    const listBody = segPaths.map(p => `file '${p.replace(/'/g, "'\\''")}'`).join('\n');
    await fs.writeFile(listPath, listBody, 'utf-8');
    await execFileAsync('ffmpeg', ['-y', '-f', 'concat', '-safe', '0', '-i', listPath, '-c', 'copy', outPath]);

    // Cleanup temp
    try { await fs.rm(tempDir, { recursive: true, force: true }); } catch {}

    logger.info({ outPath }, 'Narration WAV generated');
    return { success: true, data: { filePath: outPath } } as const;
  }
});

