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
import { createWorkflow, createStep } from '@mastra/core/workflows';
import { z } from 'zod';
import path from 'path';
import { promises as fs } from 'fs';
import { logger } from '../../logger';
import { summarizeAndAnalyzeTool } from '../../tools/market-research/summarizeAndAnalyze';
import { googleTextToSpeechTool } from '../../tools/audio/googleTextToSpeech';
import { config } from '../../tools/xibo-agent/config';

/**
 * @module podcastPlannerWorkflow
 * @description Generates a two-caster podcast-style audio from a markdown report by drafting a dialogue script and synthesizing audio segments.
 */

// Remove stage-direction cues and handle laughter markers.
function sanitizeSpokenText(text: string, options?: { laughterMode?: 'replace' | 'mute' | 'audio' }): string {
  if (!text) return '';
  let s = text;
  // Remove stage directions like （♪ ジングル）, （BGM）, etc.
  const cueRegex = /[（(]\s*(?:♪|BGM|ジングル|効果音|SE)[^）)]*[）)]/gi;
  s = s.replace(cueRegex, '');
  // Remove bracket stage tokens like [OPENING_JINGLE], [OPENING_BGM], [JINGLE], [ENDING_BGM]
  const bracketTokenRegex = /\[(?:OPENING_JINGLE|OPENING_BGM|JINGLE|ENDING_BGM)\]/gi;
  s = s.replace(bracketTokenRegex, '');
  // Handle laughter markers （笑） /(笑)
  const laughRegex = /[（(]\s*笑\s*[）)]/g;
  if (options?.laughterMode === 'mute' || options?.laughterMode === 'audio') {
    s = s.replace(laughRegex, '');
  } else {
    // default 'replace'
    s = s.replace(laughRegex, ' わっはっは ');
  }
  // Remove leftover empty parentheses
  s = s.replace(/\s*[（(]\s*[）)]\s*/g, '');
  // Collapse excessive whitespace
  s = s.replace(/\s{2,}/g, ' ').trim();
  return s;
}

const successOutput = z.object({
  scriptMarkdown: z.string(),
  filePath: z.string(),
});
const errorOutput = z.object({ success: z.literal(false), message: z.string(), error: z.any().optional() });
const finalSchema = z.union([successOutput.extend({ success: z.literal(true) }), errorOutput]);

export const podcastPlannerWorkflow = createWorkflow({
  id: 'podcast-planner-workflow',
  description: 'Creates a two-caster podcast-style audio from a report markdown file.',
  inputSchema: z.object({
    reportFileName: z.string().describe('The report file name in persistent_data/reports.'),
    casterA: z.object({ name: z.string(), voiceName: z.string().optional().default('ja-JP-Neural2-B') }).describe('Caster A name and optional Google TTS voice name (e.g., ja-JP-Neural2-B).'),
    casterB: z.object({ name: z.string(), voiceName: z.string().optional().default('ja-JP-Neural2-C') }).describe('Caster B name and optional Google TTS voice name.'),
    languageCode: z.string().optional().default('ja-JP').describe('Google TTS language code (e.g., ja-JP).'),
    speakingRate: z.number().optional().default(1.05).describe('Speaking rate (0.25-4.0).'),
    pitch: z.number().optional().default(0.0).describe('Pitch (-20.0 to 20.0).'),
    format: z.enum(['mp3', 'wav']).optional().default('mp3'),
    insertOpeningBgm: z.boolean().optional().default(false),
    insertEndingBgm: z.boolean().optional().default(false),
    insertJingles: z.boolean().optional().default(false),
    laughterMode: z.enum(['replace', 'mute', 'audio']).optional().default('replace'),
  }),
  outputSchema: finalSchema,
})
.then(createStep({
  id: 'read-report',
  inputSchema: z.object({
    reportFileName: z.string(),
    casterA: z.object({ name: z.string(), voiceName: z.string().optional().default('ja-JP-Neural2-B') }),
    casterB: z.object({ name: z.string(), voiceName: z.string().optional().default('ja-JP-Neural2-C') }),
    languageCode: z.string().optional().default('ja-JP'),
    speakingRate: z.number().optional().default(1.05),
    pitch: z.number().optional().default(0.0),
    format: z.enum(['mp3','wav']).optional().default('mp3'),
    insertOpeningBgm: z.boolean().optional().default(false),
    insertEndingBgm: z.boolean().optional().default(false),
    insertJingles: z.boolean().optional().default(false),
    laughterMode: z.enum(['replace', 'mute', 'audio']).optional().default('replace'),
  }),
  outputSchema: z.object({
    reportText: z.string(),
    reportBaseName: z.string(),
    casterA: z.object({ name: z.string(), voiceName: z.string().optional().default('ja-JP-Neural2-B') }),
    casterB: z.object({ name: z.string(), voiceName: z.string().optional().default('ja-JP-Neural2-C') }),
    languageCode: z.string().optional().default('ja-JP'),
    speakingRate: z.number().optional().default(1.05),
    pitch: z.number().optional().default(0.0),
    format: z.enum(['mp3','wav']).optional().default('mp3'),
    insertOpeningBgm: z.boolean().optional().default(false),
    insertEndingBgm: z.boolean().optional().default(false),
    insertJingles: z.boolean().optional().default(false),
    laughterMode: z.enum(['replace', 'mute', 'audio']).optional().default('replace'),
  }),
  execute: async ({ inputData }) => {
    const filePath = path.join(config.reportsDir, inputData.reportFileName);
    logger.info({ filePath }, 'Reading report markdown for podcast...');
    try {
      await fs.access(filePath);
      const reportText = await fs.readFile(filePath, 'utf-8');
      const reportBaseName = path.parse(inputData.reportFileName).name;
      return { reportText, reportBaseName, casterA: inputData.casterA, casterB: inputData.casterB, languageCode: inputData.languageCode, speakingRate: inputData.speakingRate, pitch: inputData.pitch, format: inputData.format, insertOpeningBgm: inputData.insertOpeningBgm, insertEndingBgm: inputData.insertEndingBgm, insertJingles: inputData.insertJingles, laughterMode: inputData.laughterMode };
    } catch (error) {
      const message = 'Could not read report file.';
      logger.error({ error }, message);
      const reportBaseName = path.parse(inputData.reportFileName).name;
      return { reportText: '', reportBaseName, casterA: inputData.casterA, casterB: inputData.casterB, languageCode: inputData.languageCode, speakingRate: inputData.speakingRate, pitch: inputData.pitch, format: inputData.format, insertOpeningBgm: inputData.insertOpeningBgm, insertEndingBgm: inputData.insertEndingBgm, insertJingles: inputData.insertJingles, laughterMode: inputData.laughterMode };
    }
  },
}))
.then(createStep({
  id: 'draft-dialogue-script',
  inputSchema: z.object({
    reportText: z.string(),
    reportBaseName: z.string(),
    casterA: z.object({ name: z.string(), voiceName: z.string().optional().default('ja-JP-Neural2-B') }),
    casterB: z.object({ name: z.string(), voiceName: z.string().optional().default('ja-JP-Neural2-C') }),
    languageCode: z.string().optional().default('ja-JP'),
    speakingRate: z.number().optional().default(1.05),
    pitch: z.number().optional().default(0.0),
    format: z.enum(['mp3','wav']).optional().default('mp3'),
    insertOpeningBgm: z.boolean().optional().default(false),
    insertEndingBgm: z.boolean().optional().default(false),
    insertJingles: z.boolean().optional().default(false),
    laughterMode: z.enum(['replace', 'mute', 'audio']).optional().default('replace'),
  }),
  outputSchema: z.object({
    scriptMarkdown: z.string(),
    lines: z.array(z.object({ speaker: z.string(), text: z.string() })),
    reportBaseName: z.string(),
    casterA: z.object({ name: z.string(), voiceName: z.string().optional().default('ja-JP-Neural2-B') }),
    casterB: z.object({ name: z.string(), voiceName: z.string().optional().default('ja-JP-Neural2-C') }),
    languageCode: z.string().optional().default('ja-JP'),
    speakingRate: z.number().optional().default(1.05),
    pitch: z.number().optional().default(0.0),
    format: z.enum(['mp3','wav']).optional().default('mp3'),
    insertOpeningBgm: z.boolean().optional().default(false),
    insertEndingBgm: z.boolean().optional().default(false),
    insertJingles: z.boolean().optional().default(false),
    laughterMode: z.enum(['replace', 'mute', 'audio']).optional().default('replace'),
  }),
  execute: async ({ inputData, runtimeContext }) => {
    const { reportText, reportBaseName, casterA, casterB, languageCode, speakingRate, pitch, format, insertOpeningBgm, insertEndingBgm, insertJingles, laughterMode } = inputData;
    const objective = `以下のレポート内容を基に、${casterA.name} と ${casterB.name} の2人が掛け合いで解説するポッドキャスト風の台本をMarkdownで作成してください。楽しく、わかりやすく、具体例を交えつつ、5〜8分程度を想定し、セクション見出しと小休止も含めてください。各発話は「${casterA.name}: 〜」「${casterB.name}: 〜」の形式で、1発話は80〜160字程度で。見出しや箇条書きは自由に使って構いませんが、発話の行頭は必ず「話者名: 」で開始してください。

台本中のBGM/ジングルについては、以下のルールでステージ指示を明示してください（発話としては読み上げません）。必ず1行単独で、次の正確なトークンのみを使用してください。
- [OPENING_JINGLE] または [OPENING_BGM] を台本の冒頭に1回
- 必要に応じて途中で [JINGLE] を挿入（多用しない。概ね5〜7発話ごとを上限）
- 終了時に [ENDING_BGM] を1回
括弧や記号での表現（例： （♪ ジングル））は使わず、上記の角括弧トークンのみを使ってください。`;
    const combined = `# Report\n\n${reportText}`;
    const res = await summarizeAndAnalyzeTool.execute({ context: { text: combined, objective, temperature: 0.7, topP: 0.9 }, runtimeContext });
    if (!res.success) {
      const fallback = `${casterA.name}: レポートの読み込みに失敗しました。\n${casterB.name}: 別のファイルで試してみましょう。`;
      return { scriptMarkdown: fallback, lines: [{ speaker: casterA.name, text: 'レポートの読み込みに失敗しました。' }], reportBaseName, casterA, casterB, languageCode, speakingRate, pitch, format, insertOpeningBgm, insertEndingBgm, insertJingles, laughterMode };
    }
    const scriptMarkdown = res.data.summary.trim();
    const lines: Array<{ speaker: string; text: string }> = [];
    const speakerRegex = new RegExp(`^\\s*(?:\\*\\*|__)?(${casterA.name}|${casterB.name})(?:\\*\\*|__)?\\s*[:：]\\s*(.*)$`);
    const headingRegex = /^\s{0,3}#{1,6}\s/;
    const fenceRegex = /^\s*```/;
    const stageTokenRegex = /^\s*\[(OPENING_JINGLE|OPENING_BGM|JINGLE|ENDING_BGM)\]\s*$/i;
    let inFence = false;
    let current: { speaker: string; text: string } | null = null;
    for (const raw of scriptMarkdown.split(/\n/)) {
      const line = raw.replace(/\r$/, '');
      if (fenceRegex.test(line)) { inFence = !inFence; continue; }
      if (inFence) continue;
      if (headingRegex.test(line)) { continue; }
      if (stageTokenRegex.test(line)) { continue; }
      const m = line.match(speakerRegex);
      if (m) {
        if (current) { lines.push(current); }
        current = { speaker: m[1], text: (m[2] || '').trim() };
        continue;
      }
      // Continuation lines: append to current if present and not empty/bullet-only
      if (current) {
        const trimmed = line.trim();
        if (trimmed.length > 0 && !speakerRegex.test(trimmed)) {
          if (stageTokenRegex.test(trimmed)) { continue; }
          // Avoid adding lone bullet markers as content
          if (!/^[-*+]\s*$/.test(trimmed)) {
            current.text += (trimmed.startsWith('・') ? '' : ' ') + trimmed;
          }
        }
      }
    }
    if (current) { lines.push(current); }
    if (lines.length === 0) {
      lines.push({ speaker: casterA.name, text: '本日はレポートの要点をカジュアルに解説していきます。' });
      lines.push({ speaker: casterB.name, text: 'よろしくお願いします。まずは背景から見ていきましょう。' });
    }
    return { scriptMarkdown, lines, reportBaseName, casterA, casterB, languageCode, speakingRate, pitch, format, insertOpeningBgm, insertEndingBgm, insertJingles, laughterMode };
  },
}))
.then(createStep({
  id: 'synthesize-audio',
  inputSchema: z.object({
    scriptMarkdown: z.string(),
    lines: z.array(z.object({ speaker: z.string(), text: z.string() })),
    reportBaseName: z.string(),
    casterA: z.object({ name: z.string(), voiceName: z.string().optional().default('ja-JP-Neural2-B') }),
    casterB: z.object({ name: z.string(), voiceName: z.string().optional().default('ja-JP-Neural2-C') }),
    languageCode: z.string().optional().default('ja-JP'),
    speakingRate: z.number().optional().default(1.05),
    pitch: z.number().optional().default(0.0),
    format: z.enum(['mp3','wav']).optional().default('mp3'),
    cleanupSegments: z.boolean().optional().default(true),
    openingBgmPath: z.string().optional().default(path.join(config.projectRoot, 'persistent_data', 'assets', 'bgm', 'opening.mp3')),
    endingBgmPath: z.string().optional().default(path.join(config.projectRoot, 'persistent_data', 'assets', 'bgm', 'ending.mp3')),
    jinglePath: z.string().optional().default(path.join(config.projectRoot, 'persistent_data', 'assets', 'jingles', 'attention.mp3')),
    bgmPreviewSeconds: z.number().optional().default(4),
    jingleInterval: z.number().optional().default(6),
    insertOpeningBgm: z.boolean().optional().default(false),
    insertEndingBgm: z.boolean().optional().default(false),
    insertJingles: z.boolean().optional().default(false),
    laughterMode: z.enum(['replace', 'mute', 'audio']).optional().default('replace'),
    laughSfxPath: z.string().optional().default(path.join(config.projectRoot, 'persistent_data', 'assets', 'sfx', 'laugh.mp3')),
  }),
  outputSchema: successOutput.extend({ success: z.literal(true) }),
  execute: async ({ inputData, runtimeContext }) => {
    const { scriptMarkdown, lines, reportBaseName, casterA, casterB, languageCode, speakingRate, pitch, format, cleanupSegments } = inputData;
    // Resolve BGM/Jingle paths with local defaults (avoid relying solely on Zod defaults)
    const openingBgm = (inputData as any).openingBgmPath || path.join(config.projectRoot, 'persistent_data', 'assets', 'bgm', 'opening.mp3');
    const endingBgm = (inputData as any).endingBgmPath || path.join(config.projectRoot, 'persistent_data', 'assets', 'bgm', 'ending.mp3');
    const jingle = (inputData as any).jinglePath || path.join(config.projectRoot, 'persistent_data', 'assets', 'jingles', 'attention.mp3');
    const laughSfx = (inputData as any).laughSfxPath || path.join(config.projectRoot, 'persistent_data', 'assets', 'sfx', 'laugh.mp3');
    const bgmPreviewSeconds = (inputData as any).bgmPreviewSeconds ?? 4;
    const jingleInterval = (inputData as any).jingleInterval ?? 6;
    const tempDir = path.join(config.publicDir, 'temp', 'podcast');
    const outDir = path.join(config.generatedDir, 'podcast');
    await fs.mkdir(tempDir, { recursive: true });
    await fs.mkdir(outDir, { recursive: true });
    const segmentFiles: string[] = [];
    // Default Japanese neural voices if not provided
    const defaultA = 'ja-JP-Neural2-B';
    const defaultB = 'ja-JP-Neural2-C';
    // Helper to push an external audio as a segment
    const pushExternal = async (srcPath: string) => {
      try {
        if (typeof srcPath !== 'string' || srcPath.trim().length === 0) {
          logger.warn({ srcPath }, 'Invalid external audio path. Skipping.');
          return;
        }
        const absPath = path.isAbsolute(srcPath) ? srcPath : path.join(config.projectRoot, srcPath);
        try {
          await fs.access(absPath);
        } catch (e) {
          logger.warn({ absPath, e }, 'External audio not found. Skipping.');
          return;
        }
        const data = await fs.readFile(absPath);
        const ext = path.extname(absPath).toLowerCase();
        if (format === 'wav' && ext !== '.wav') {
          logger.warn({ srcPath: absPath, format }, 'External asset format does not match output WAV; asset will be skipped at concat. Provide a WAV version to include.');
        }
        // For WAV and mp3 we just copy now; trimming handled later for WAV only at concat
        const dest = path.join(tempDir, `ext-${path.basename(absPath)}`);
        await fs.writeFile(dest, data);
        segmentFiles.push(dest);
        logger.info({ added: dest }, 'Added external audio segment.');
      } catch (e) {
        logger.warn({ srcPath, message: (e as any)?.message }, 'Failed to add external audio segment.');
      }
    };
    // Opening BGM (optional)
    if ((inputData as any).insertOpeningBgm) {
      await pushExternal(openingBgm);
    }
    for (let i = 0; i < lines.length; i++) {
      const l = lines[i];
      const hadLaugh = /[（(]\s*笑\s*[）)]/g.test(l.text);
      const cleaned = sanitizeSpokenText(l.text, { laughterMode: (inputData as any).laughterMode });
      if (!cleaned) continue;
      const voiceName = l.speaker === casterA.name ? (casterA.voiceName || defaultA) : (casterB.voiceName || defaultB);
      const tts = await googleTextToSpeechTool.execute({ context: { text: cleaned, voiceName, languageCode, speakingRate, pitch, format, fileNameBase: `seg-${String(i).padStart(3,'0')}`, outDir: tempDir }, runtimeContext });
      if (tts.success) segmentFiles.push(tts.data.filePath);
      // Periodic jingle insertion
      if ((inputData as any).insertJingles && jingleInterval > 0 && (i + 1) % jingleInterval === 0) {
        await pushExternal(jingle);
      }
      // Laughter SFX insertion when requested
      if ((inputData as any).laughterMode === 'audio' && hadLaugh) {
        await pushExternal(laughSfx);
      }
    }
    // Ending BGM (optional)
    if ((inputData as any).insertEndingBgm) {
      await pushExternal(endingBgm);
    }
    logger.info({ count: segmentFiles.length, tempDir }, 'Synthesized podcast segments including BGM/jingles.');

    // Concatenate segments into a single file named after the report
    const safeBase = reportBaseName;
    const combinedFile = path.join(outDir, `${safeBase}.${format}`);
    if (format === 'mp3') {
      // Naive MP3 concatenation by appending frames
      const bufs: Buffer[] = [];
      for (const f of segmentFiles) {
        const b = await fs.readFile(f);
        bufs.push(b);
      }
      await fs.writeFile(combinedFile, Buffer.concat(bufs));
    } else {
      // WAV LINEAR16 concatenation: merge data chunks and write a new header
      const dataChunks: Buffer[] = [];
      let sampleRate = 0;
      let numChannels = 0;
      let bitsPerSample = 16;
      let totalDataLen = 0;
      const readUInt32LE = (buf: Buffer, off: number) => buf.readUInt32LE(off);
      const readUInt16LE = (buf: Buffer, off: number) => buf.readUInt16LE(off);
      for (const idx in segmentFiles) {
        const f = segmentFiles[idx as any];
        let buf = await fs.readFile(f);
        if (buf.slice(0,4).toString() !== 'RIFF' || buf.slice(8,12).toString() !== 'WAVE') {
          continue;
        }
        // Find 'fmt ' and 'data' chunks
        let pos = 12;
        let fmtFound = false;
        let dataFound = false;
        let localSampleRate = 0;
        let localNumChannels = 0;
        let localBitsPerSample = 16;
        let dataStartPos = -1;
        let dataSize = 0;
        while (pos + 8 <= buf.length) {
          const chunkId = buf.slice(pos, pos+4).toString();
          const chunkSize = readUInt32LE(buf, pos+4);
          if (chunkId === 'fmt ') {
            fmtFound = true;
            localNumChannels = readUInt16LE(buf, pos + 10);
            localSampleRate = readUInt32LE(buf, pos + 12);
            localBitsPerSample = readUInt16LE(buf, pos + 22);
          } else if (chunkId === 'data') {
            dataFound = true;
            dataStartPos = pos + 8;
            dataSize = chunkSize;
          }
          pos += 8 + chunkSize + (chunkSize % 2); // word align
        }
        if (!fmtFound || !dataFound) {
          logger.warn({ file: f }, 'WAV missing fmt or data chunk; skipping.');
          continue;
        }
        // Trim opening/ending by bgmPreviewSeconds if they match provided paths
        const baseName = path.basename(f);
        let dataBuf = buf.slice(dataStartPos, dataStartPos + dataSize);
        const bytesPerSec = (localSampleRate || 44100) * (localNumChannels || 1) * ((localBitsPerSample || 16)/8);
        if (bgmPreviewSeconds > 0 && (baseName.includes(path.basename(openingBgm)) || baseName.includes(path.basename(endingBgm)))) {
          const maxBytes = Math.min(dataBuf.length, Math.max(1, Math.floor(bytesPerSec * bgmPreviewSeconds)));
          dataBuf = dataBuf.slice(0, maxBytes);
        }
        // Adopt first fmt as master
        if (dataChunks.length === 0) {
          sampleRate = localSampleRate;
          numChannels = localNumChannels;
          bitsPerSample = localBitsPerSample;
        }
        dataChunks.push(dataBuf);
        totalDataLen += dataBuf.length;
      }
      const header = Buffer.alloc(44);
      header.write('RIFF', 0);
      header.writeUInt32LE(36 + totalDataLen, 4);
      header.write('WAVE', 8);
      header.write('fmt ', 12);
      header.writeUInt32LE(16, 16); // PCM fmt chunk size
      header.writeUInt16LE(1, 20); // PCM
      header.writeUInt16LE(numChannels || 1, 22);
      header.writeUInt32LE(sampleRate || 44100, 24);
      const byteRate = (sampleRate || 44100) * (numChannels || 1) * (bitsPerSample/8);
      header.writeUInt32LE(byteRate, 28);
      const blockAlign = (numChannels || 1) * (bitsPerSample/8);
      header.writeUInt16LE(blockAlign, 32);
      header.writeUInt16LE(bitsPerSample, 34);
      header.write('data', 36);
      header.writeUInt32LE(totalDataLen, 40);
      await fs.writeFile(combinedFile, Buffer.concat([header, ...dataChunks]));
    }

    if (cleanupSegments) {
      for (const f of segmentFiles) {
        try { await fs.unlink(f); } catch {}
      }
      // Attempt to remove tempDir if empty
      try { await fs.rmdir(tempDir); } catch {}
    }
    logger.info({ combinedFile }, 'Combined podcast audio created.');
    return { success: true, scriptMarkdown, filePath: combinedFile } as const;
  },
}))
.commit();