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
import { podcastConfig } from './config';
// @ts-ignore - lamejs has no official types by default
import lamejs from 'lamejs';

/**
 * @module podcastPlannerWorkflow
 * @description Generates a two-caster podcast-style audio from a markdown report by drafting a dialogue script and synthesizing audio segments.
 */

/**
 * Sanitizes a spoken text line before TTS synthesis.
 * - Removes stage direction cues like musical notes or SFX markers
 * - Removes bracket tokens such as [OPENING_BGM], [JINGLE], etc.
 * - Handles laughter markers by replacing, muting, or reserving for SFX insertion
 */
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
    title: z.string().optional().describe('Title of the program. Defaults to the report base filename when omitted.'),
    casterA: z.object({ name: z.string() }).describe('Caster A name (host).'),
    casterB: z.object({ name: z.string() }).describe('Caster B name (co-host/presenter).'),
    format: z.enum(['mp3', 'wav']).optional().default('wav'),
    programType: z.enum(['podcast','presentation']).optional().default('podcast'),
    pronunciationDictFileName: z.string().optional().default('pronunciation-ja.json'),
    // Script persistence options
    saveScriptJson: z.boolean().optional().default(false).describe('If true, save drafted script to JSON.'),
    loadScriptJson: z.boolean().optional().default(false).describe('If true, load script from JSON and skip drafting.'),
    scriptJsonFileName: z.string().optional().describe('Optional script JSON filename; defaults to <reportBaseName>.json'),
  }),
  outputSchema: finalSchema,
})
.then(createStep({
  id: 'read-report',
  // Reads the source report file, derives title when omitted, and enriches the flowing state
  // with centralized defaults (voices, language, BGM toggles, etc.).
  inputSchema: z.object({
    reportFileName: z.string(),
    title: z.string().optional(),
    casterA: z.object({ name: z.string() }),
    casterB: z.object({ name: z.string() }),
    format: z.enum(['mp3','wav']).optional().default('wav'),
    programType: z.enum(['podcast','presentation']).optional().default('podcast'),
    pronunciationDictFileName: z.string().optional().default('pronunciation-ja.json'),
    saveScriptJson: z.boolean().optional().default(false),
    loadScriptJson: z.boolean().optional().default(false),
    scriptJsonFileName: z.string().optional(),
  }),
  outputSchema: z.object({
    reportText: z.string(),
    reportBaseName: z.string(),
    title: z.string(),
    casterA: z.object({ name: z.string(), voiceName: z.string().optional().default('ja-JP-Neural2-B') }),
    casterB: z.object({ name: z.string(), voiceName: z.string().optional().default('ja-JP-Neural2-C') }),
    languageCode: z.string().optional().default('ja-JP'),
    speakingRate: z.number().optional().default(1.05),
    pitch: z.number().optional().default(0.0),
    format: z.enum(['mp3','wav']).optional().default('mp3'),
    insertOpeningBgm: z.boolean().optional().default(false),
    insertEndingBgm: z.boolean().optional().default(false),
    insertJingles: z.boolean().optional().default(false),
    insertContinuousBgm: z.boolean().optional().default(false),
    laughterMode: z.enum(['replace', 'mute', 'audio']).optional().default('replace'),
    programType: z.enum(['podcast','presentation']).optional().default('podcast'),
    pronunciationDictPath: z.string(),
    saveScriptJson: z.boolean().optional().default(false),
    loadScriptJson: z.boolean().optional().default(false),
    scriptJsonFileName: z.string().optional(),
  }),
  execute: async ({ inputData }) => {
    const filePath = path.join(config.reportsDir, inputData.reportFileName);
    logger.info({ filePath }, 'Reading report markdown for podcast...');
    try {
      await fs.access(filePath);
      const reportText = await fs.readFile(filePath, 'utf-8');
      const reportBaseName = path.parse(inputData.reportFileName).name;
      const title = (inputData.title && inputData.title.trim().length > 0) ? inputData.title.trim() : reportBaseName;
      const pronunciationDictPath = path.join(config.projectRoot, 'persistent_data', 'assets', 'dictionaries', inputData.pronunciationDictFileName || 'pronunciation-ja.json');
      // Enrich with centralized defaults
      const defaults = podcastConfig.defaults;
      return {
        reportText,
        reportBaseName,
        title,
        casterA: { name: inputData.casterA.name, voiceName: defaults.voiceNameA },
        casterB: { name: inputData.casterB.name, voiceName: defaults.voiceNameB },
        languageCode: defaults.languageCode,
        speakingRate: defaults.speakingRate,
        pitch: defaults.pitch,
        format: inputData.format,
        insertOpeningBgm: defaults.insertOpeningBgm,
        insertEndingBgm: defaults.insertEndingBgm,
        insertJingles: defaults.insertJingles,
        insertContinuousBgm: podcastConfig.defaults.insertContinuousBgm ?? false,
        laughterMode: defaults.laughterMode,
        programType: inputData.programType,
        pronunciationDictPath,
        saveScriptJson: inputData.saveScriptJson,
        loadScriptJson: inputData.loadScriptJson,
        scriptJsonFileName: inputData.scriptJsonFileName,
      };
    } catch (error) {
      const message = 'Could not read report file.';
      logger.error({ error }, message);
      const reportBaseName = path.parse(inputData.reportFileName).name;
      const defaults = podcastConfig.defaults;
      const title = (inputData.title && inputData.title.trim().length > 0) ? inputData.title.trim() : reportBaseName;
      const pronunciationDictPath = path.join(config.projectRoot, 'persistent_data', 'assets', 'dictionaries', inputData.pronunciationDictFileName || 'pronunciation-ja.json');
      return {
        reportText: '',
        reportBaseName,
        title,
        casterA: { name: inputData.casterA.name, voiceName: defaults.voiceNameA },
        casterB: { name: inputData.casterB.name, voiceName: defaults.voiceNameB },
        languageCode: defaults.languageCode,
        speakingRate: defaults.speakingRate,
        pitch: defaults.pitch,
        format: inputData.format,
        insertOpeningBgm: defaults.insertOpeningBgm,
        insertEndingBgm: defaults.insertEndingBgm,
        insertJingles: defaults.insertJingles,
        insertContinuousBgm: podcastConfig.defaults.insertContinuousBgm ?? false,
        laughterMode: defaults.laughterMode,
        programType: inputData.programType,
        pronunciationDictPath,
        saveScriptJson: inputData.saveScriptJson,
        loadScriptJson: inputData.loadScriptJson,
        scriptJsonFileName: inputData.scriptJsonFileName,
      };
    }
  },
}))
.then(createStep({
  id: 'draft-dialogue-script',
  // Drafts a dialogue script from the report content, following programType rules
  // and injecting stage tokens as guidance for non-spoken BGM/jingles.
  inputSchema: z.object({
    reportText: z.string(),
    reportBaseName: z.string(),
    title: z.string(),
    casterA: z.object({ name: z.string(), voiceName: z.string().optional().default('ja-JP-Neural2-B') }),
    casterB: z.object({ name: z.string(), voiceName: z.string().optional().default('ja-JP-Neural2-C') }),
    languageCode: z.string().optional().default('ja-JP'),
    speakingRate: z.number().optional().default(1.05),
    pitch: z.number().optional().default(0.0),
    format: z.enum(['mp3','wav']).optional().default('mp3'),
    insertOpeningBgm: z.boolean().optional().default(false),
    insertEndingBgm: z.boolean().optional().default(false),
    insertJingles: z.boolean().optional().default(false),
    insertContinuousBgm: z.boolean().optional().default(false),
    laughterMode: z.enum(['replace', 'mute', 'audio']).optional().default('replace'),
    programType: z.enum(['podcast','presentation']).optional().default('podcast'),
    pronunciationDictPath: z.string(),
    saveScriptJson: z.boolean().optional().default(false),
    loadScriptJson: z.boolean().optional().default(false),
    scriptJsonFileName: z.string().optional(),
  }),
  outputSchema: z.object({
    scriptMarkdown: z.string(),
    lines: z.array(z.object({ speaker: z.string(), text: z.string() })),
    reportBaseName: z.string(),
    title: z.string(),
    casterA: z.object({ name: z.string(), voiceName: z.string().optional().default('ja-JP-Neural2-B') }),
    casterB: z.object({ name: z.string(), voiceName: z.string().optional().default('ja-JP-Neural2-C') }),
    languageCode: z.string().optional().default('ja-JP'),
    speakingRate: z.number().optional().default(1.05),
    pitch: z.number().optional().default(0.0),
    format: z.enum(['mp3','wav']).optional().default('mp3'),
    insertOpeningBgm: z.boolean().optional().default(false),
    insertEndingBgm: z.boolean().optional().default(false),
    insertJingles: z.boolean().optional().default(false),
    insertContinuousBgm: z.boolean().optional().default(false),
    laughterMode: z.enum(['replace', 'mute', 'audio']).optional().default('replace'),
    programType: z.enum(['podcast','presentation']).optional().default('podcast'),
    pronunciationDictPath: z.string(),
    saveScriptJson: z.boolean().optional().default(false),
    loadScriptJson: z.boolean().optional().default(false),
    scriptJsonFileName: z.string().optional(),
  }),
  execute: async ({ inputData, runtimeContext }) => {
    const { reportText, reportBaseName, title, casterA, casterB, languageCode, speakingRate, pitch, format, insertOpeningBgm, insertEndingBgm, insertJingles, insertContinuousBgm, laughterMode, programType, pronunciationDictPath, saveScriptJson, loadScriptJson, scriptJsonFileName } = inputData;
    const scriptsDir = path.join(config.generatedDir, 'podcast');
    await fs.mkdir(scriptsDir, { recursive: true });
    const jsonFile = scriptJsonFileName && scriptJsonFileName.trim().length > 0 ? scriptJsonFileName.trim() : `${reportBaseName}.json`;
    const jsonPath = path.join(scriptsDir, jsonFile);

    // Optional: load from existing JSON to avoid re-drafting
    if (loadScriptJson) {
      try {
        const raw = await fs.readFile(jsonPath, 'utf-8');
        const parsed = JSON.parse(raw) as any;
        const lines = Array.isArray(parsed?.lines) ? parsed.lines.filter((x: any) => typeof x?.speaker === 'string' && typeof x?.text === 'string') : [];
        const scriptMarkdown = typeof parsed?.scriptMarkdown === 'string' ? parsed.scriptMarkdown : (lines.map((l: any) => `${l.speaker}: ${l.text}`).join('\n'));
        // Prefer JSON values for consistency if provided
        const casterAJson = parsed?.casters?.A ?? { name: casterA.name, voiceName: casterA.voiceName };
        const casterBJson = parsed?.casters?.B ?? { name: casterB.name, voiceName: casterB.voiceName };
        return {
          scriptMarkdown,
          lines,
          reportBaseName,
          title: typeof parsed?.title === 'string' ? parsed.title : title,
          casterA: { name: casterAJson.name ?? casterA.name, voiceName: casterAJson.voiceName ?? casterA.voiceName },
          casterB: { name: casterBJson.name ?? casterB.name, voiceName: casterBJson.voiceName ?? casterB.voiceName },
          languageCode: parsed?.languageCode ?? languageCode,
          speakingRate: parsed?.speakingRate ?? speakingRate,
          pitch: parsed?.pitch ?? pitch,
          format: parsed?.format ?? format,
          insertOpeningBgm: parsed?.insertOpeningBgm ?? insertOpeningBgm,
          insertEndingBgm: parsed?.insertEndingBgm ?? insertEndingBgm,
          insertJingles: parsed?.insertJingles ?? insertJingles,
          insertContinuousBgm: parsed?.insertContinuousBgm ?? insertContinuousBgm,
          laughterMode: parsed?.laughterMode ?? laughterMode,
          programType: parsed?.programType ?? programType,
          pronunciationDictPath,
          saveScriptJson,
          loadScriptJson,
          scriptJsonFileName: jsonFile,
        };
      } catch (e) {
        logger.warn({ jsonPath, e }, 'Failed to load script JSON. Falling back to drafting.');
      }
    }
    const baseRules = `台本中のBGM/ジングルについては、以下のルールでステージ指示を明示してください（発話としては読み上げません）。必ず1行単独で、次の正確なトークンのみを使用してください。
- [OPENING_JINGLE] または [OPENING_BGM] を台本の冒頭に1回
- 必要に応じて途中で [JINGLE] を挿入（多用しない。概ね5〜7発話ごとを上限）
- 終了時に [ENDING_BGM] を1回
括弧や記号での表現（例： （♪ ジングル））は使わず、上記の角括弧トークンのみを使ってください。`;
    const objective = programType === 'presentation'
      ? `以下のレポート内容を基に、${casterA.name}（司会者） と ${casterB.name}（プレゼンター） による「プレゼンテーション番組」台本をMarkdownで作成してください。冒頭で司会者がプレゼンターの紹介とプレゼンタイトル（${title || reportBaseName}）を紹介し、その後プレゼンターがレポート内容を分かりやすく構造的に説明、最後に司会者がまとめと締めを行います。5〜8分程度を想定し、必要に応じてセクション見出しや小休止を含めてください。各発話は「${casterA.name}: 〜」「${casterB.name}: 〜」の形式で、1発話は80〜160字程度。発話の行頭は必ず「話者名: 」で開始してください。

${baseRules}`
      : `以下のレポート内容を基に、${casterA.name} と ${casterB.name} の2人が掛け合いで解説するポッドキャスト風の台本をMarkdownで作成してください。楽しく、わかりやすく、具体例を交えつつ、5〜8分程度を想定し、セクション見出しと小休止も含めてください。各発話は「${casterA.name}: 〜」「${casterB.name}: 〜」の形式で、1発話は80〜160字程度で。見出しや箇条書きは自由に使って構いませんが、発話の行頭は必ず「話者名: 」で開始してください。

${baseRules}`;
    const combined = `# Report\n\n${reportText}`;
    const res = await summarizeAndAnalyzeTool.execute({ context: { text: combined, objective, temperature: 0.7, topP: 0.9 }, runtimeContext });
    if (!res.success) {
      const fallback = `${casterA.name}: レポートの読み込みに失敗しました。\n${casterB.name}: 別のファイルで試してみましょう。`;
      return { scriptMarkdown: fallback, lines: [{ speaker: casterA.name, text: 'レポートの読み込みに失敗しました。' }], reportBaseName, title, casterA, casterB, languageCode, speakingRate, pitch, format, insertOpeningBgm, insertEndingBgm, insertJingles, insertContinuousBgm, laughterMode, programType, pronunciationDictPath, saveScriptJson, loadScriptJson, scriptJsonFileName: jsonFile };
    }
    const scriptMarkdown = res.data.summary.trim();
    const lines: Array<{ speaker: string; text: string }> = [];
    const speakerRegex = new RegExp(`^\\s*(?:\\*\\*|__)?(${casterA.name}|${casterB.name})(?:\\*\\*|__)?\\s*[:：]\\s*(.*)$`);
    const headingRegex = /^\s{0,3}#{1,6}\s/;
    const fenceRegex = /^\s*```/;
    // Stage token lines should be ignored for speech text, they are used only as insertion markers.
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
    // Optional: save drafted script to JSON for reproducible synthesis later
    if (saveScriptJson) {
      try {
        const payload = {
          version: 1,
          reportBaseName,
          title,
          casters: { A: casterA, B: casterB },
          languageCode,
          speakingRate,
          pitch,
          format,
          programType,
          insertOpeningBgm,
          insertEndingBgm,
          insertJingles,
          insertContinuousBgm,
          pronunciationDictPath,
          scriptMarkdown,
          lines,
        };
        await fs.writeFile(jsonPath, JSON.stringify(payload, null, 2), 'utf-8');
        logger.info({ jsonPath }, 'Saved drafted podcast script JSON.');
      } catch (e) {
        logger.warn({ e, jsonPath }, 'Failed to save drafted script JSON.');
      }
    }
    return { scriptMarkdown, lines, reportBaseName, title, casterA, casterB, languageCode, speakingRate, pitch, format, insertOpeningBgm, insertEndingBgm, insertJingles, insertContinuousBgm, laughterMode, programType, pronunciationDictPath, saveScriptJson, loadScriptJson, scriptJsonFileName: jsonFile };
  },
}))
.then(createStep({
  id: 'synthesize-audio',
  // Synthesizes per-line TTS, inserts optional SFX/BGM, normalizes audio, and concatenates to a single output.
  inputSchema: z.object({
    scriptMarkdown: z.string(),
    lines: z.array(z.object({ speaker: z.string(), text: z.string() })),
    reportBaseName: z.string(),
    title: z.string(),
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
    insertContinuousBgm: z.boolean().optional().default(false),
    laughterMode: z.enum(['replace', 'mute', 'audio']).optional().default('replace'),
    laughSfxPath: z.string().optional().default(path.join(config.projectRoot, 'persistent_data', 'assets', 'sfx', 'laugh.mp3')),
    programType: z.enum(['podcast','presentation']).optional().default('podcast'),
    pronunciationDictPath: z.string(),
    saveScriptJson: z.boolean().optional().default(false),
    loadScriptJson: z.boolean().optional().default(false),
    scriptJsonFileName: z.string().optional(),
  }),
  outputSchema: successOutput.extend({ success: z.literal(true) }),
  execute: async ({ inputData, runtimeContext }) => {
    const { scriptMarkdown, lines, reportBaseName, title, casterA, casterB, languageCode, speakingRate, pitch, format, cleanupSegments } = inputData;
    // Resolve BGM/Jingle paths with local defaults (avoid relying solely on Zod defaults)
    // Choose BGM set by program type (podcast vs presentation)
    const assets = podcastConfig.assets[(inputData as any).programType === 'presentation' ? 'presentation' : 'podcast'];
    // Allow specifying only a filename in config (default directory: persistent_data/assets/audios)
    const resolveAudioAssetPath = (candidate: string): string => {
      if (!candidate) return '';
      const normalized = candidate.trim();
      const hasDirSep = normalized.includes('/') || normalized.includes('\\');
      const rel = hasDirSep ? normalized : path.join('persistent_data', 'assets', 'audios', normalized);
      return path.isAbsolute(rel) ? rel : path.join(config.projectRoot, rel);
    };
    const openingBgm = (inputData as any).openingBgmPath || resolveAudioAssetPath(assets.opening);
    const endingBgm = (inputData as any).endingBgmPath || resolveAudioAssetPath(assets.ending);
    const jingle = (inputData as any).jinglePath || resolveAudioAssetPath(assets.jingle);
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
    // Helper to push an external audio as a segment (WAV recommended). Non-matching formats are still copied,
    // but may be skipped from WAV concat. Existence is validated; missing assets are warned and ignored.
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
    // Synthesize each line in order, inserting jingles and laughter SFX as requested
    for (let i = 0; i < lines.length; i++) {
      const l = lines[i];
      const hadLaugh = /[（(]\s*笑\s*[）)]/g.test(l.text);
      const cleaned = sanitizeSpokenText(l.text, { laughterMode: (inputData as any).laughterMode });
      if (!cleaned) continue;
      const voiceName = l.speaker === casterA.name ? (casterA.voiceName || defaultA) : (casterB.voiceName || defaultB);
      const tts = await googleTextToSpeechTool.execute({ context: { text: cleaned, voiceName, languageCode, speakingRate, pitch, format, fileNameBase: `seg-${String(i).padStart(3,'0')}`, outDir: tempDir, pronunciationDictPath: (inputData as any).pronunciationDictPath }, runtimeContext });
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

    // Concatenate segments into a single file named after the report.
    // Always build a normalized WAV master (44.1kHz, mono, 16-bit) and produce MP3 if requested.
    const safeBase = reportBaseName;
    const combinedFileWav = path.join(outDir, `${safeBase}.wav`);
    const combinedFile = format === 'mp3' ? path.join(outDir, `${safeBase}.mp3`) : combinedFileWav;
    if (format === 'mp3') {
      // Build a WAV master normalized to target format, then (pure JS) mix optional continuous BGM,
      // finally encode to MP3 (encoder integration not included; placeholder copy).
      const normalizedChunks: Buffer[] = [];
      const muteFlags: boolean[] = [];
      const targetSampleRate = 44100;
      const targetNumChannels = 1; // downmix to mono for consistency
      const bitsPerSample = 16;
      let totalDataLen = 0;
      const readUInt32LE = (buf: Buffer, off: number) => buf.readUInt32LE(off);
      const readUInt16LE = (buf: Buffer, off: number) => buf.readUInt16LE(off);
      // Convert any PCM16 WAV buffer to target PCM16, with optional downmix and linear resampling
      const convertToTargetPcm16 = (srcBuf: Buffer, srcRate: number, srcCh: number): Buffer => {
        // Decode Int16LE
        const srcSamples = new Int16Array(srcBuf.buffer, srcBuf.byteOffset, srcBuf.byteLength / 2);
        // Optional downmix to mono
        const mono: Float32Array = new Float32Array(Math.ceil(srcSamples.length / srcCh));
        let mIdx = 0;
        if (srcCh === 1) {
          for (let i = 0; i < srcSamples.length; i++) mono[mIdx++] = srcSamples[i];
        } else {
          for (let i = 0; i < srcSamples.length; i += srcCh) {
            let sum = 0;
            for (let c = 0; c < srcCh; c++) sum += srcSamples[i + c];
            mono[mIdx++] = sum / srcCh;
          }
        }
        // Resample (linear interpolation)
        if (srcRate === targetSampleRate) {
          const out = new Int16Array(mono.length);
          for (let i = 0; i < mono.length; i++) {
            let v = Math.max(-32768, Math.min(32767, Math.round(mono[i])));
            out[i] = v;
          }
          return Buffer.from(out.buffer, out.byteOffset, out.byteLength);
        }
        const ratio = targetSampleRate / srcRate;
        const dstLen = Math.max(1, Math.floor(mono.length * ratio));
        const out = new Int16Array(dstLen);
        for (let i = 0; i < dstLen; i++) {
          const srcPos = i / ratio;
          const i0 = Math.floor(srcPos);
          const i1 = Math.min(mono.length - 1, i0 + 1);
          const frac = srcPos - i0;
          const v = mono[i0] * (1 - frac) + mono[i1] * frac;
          out[i] = Math.max(-32768, Math.min(32767, Math.round(v)));
        }
        return Buffer.from(out.buffer, out.byteOffset, out.byteLength);
      };
      for (const idx in segmentFiles) {
        const f = segmentFiles[idx as any];
        let buf = await fs.readFile(f);
        if (buf.slice(0,4).toString() !== 'RIFF' || buf.slice(8,12).toString() !== 'WAVE') {
          continue;
        }
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
          pos += 8 + chunkSize + (chunkSize % 2);
        }
        if (!fmtFound || !dataFound) continue;
        let dataBuf = buf.slice(dataStartPos, dataStartPos + dataSize);
        let normalized = convertToTargetPcm16(dataBuf, localSampleRate || 44100, localNumChannels || 1);
        const baseName = path.basename(f);
        const isOpening = baseName.includes(path.basename(openingBgm));
        const isEnding = baseName.includes(path.basename(endingBgm));
        normalizedChunks.push(normalized);
        muteFlags.push(isOpening || isEnding);
        totalDataLen += normalized.length;
      }
      // Optional continuous BGM mixing (pure JS)
      let outChunks = normalizedChunks;
      const bgmSrc = podcastConfig.assets[(inputData as any).programType === 'presentation' ? 'presentation' : 'podcast'].continuous || '';
      if ((inputData as any).insertContinuousBgm && bgmSrc) {
        try {
          const absBgm = resolveAudioAssetPath(bgmSrc);
          const bgmBuf = await fs.readFile(absBgm);
          if (bgmBuf.slice(0,4).toString() === 'RIFF' && bgmBuf.slice(8,12).toString() === 'WAVE') {
            // parse and convert bgm to target format
            const r32 = (off: number) => bgmBuf.readUInt32LE(off);
            const r16 = (off: number) => bgmBuf.readUInt16LE(off);
            let pos = 12; let dataStartPos=-1; let dataSize=0; let sr=44100; let ch=1;
            while (pos + 8 <= bgmBuf.length) {
              const chunkId = bgmBuf.slice(pos, pos+4).toString();
              const chunkSize = r32(pos+4);
              if (chunkId === 'fmt ') { ch = r16(pos + 10); sr = r32(pos + 12); }
              else if (chunkId === 'data') { dataStartPos = pos + 8; dataSize = chunkSize; }
              pos += 8 + chunkSize + (chunkSize % 2);
            }
            if (dataStartPos >= 0 && dataSize > 0) {
              const bgmPcm = convertToTargetPcm16(bgmBuf.slice(dataStartPos, dataStartPos + dataSize), sr, ch);
              const bgmSamples = new Int16Array(bgmPcm.buffer, bgmPcm.byteOffset, bgmPcm.byteLength/2);
              const gain = Math.pow(10, (podcastConfig.defaults.continuousBgmVolumeDb ?? -20) / 20);
              let bgmIdx = 0;
              const mixed: Buffer[] = [];
              for (let i = 0; i < outChunks.length; i++) {
                const buf = outChunks[i];
                if (muteFlags[i]) { mixed.push(buf); continue; }
                const src = new Int16Array(buf.buffer, buf.byteOffset, buf.byteLength/2);
                const dst = new Int16Array(src.length);
                for (let s = 0; s < src.length; s++) {
                  const b = bgmSamples.length > 0 ? bgmSamples[bgmIdx % bgmSamples.length] : 0;
                  bgmIdx++;
                  const v = src[s] + Math.round(b * gain);
                  dst[s] = v < -32768 ? -32768 : (v > 32767 ? 32767 : v);
                }
                mixed.push(Buffer.from(dst.buffer, dst.byteOffset, dst.byteLength));
              }
              outChunks = mixed;
            }
          }
        } catch {}
      }
      // Encode to MP3 using lamejs (44.1kHz mono 16-bit PCM expected)
      const pcmAll = Buffer.concat(outChunks);
      const pcm16 = new Int16Array(pcmAll.buffer, pcmAll.byteOffset, pcmAll.byteLength / 2);
      const mp3Encoder = new lamejs.Mp3Encoder(targetNumChannels, targetSampleRate, 128); // 128 kbps
      const CHUNK = 1152;
      const mp3Data: Uint8Array[] = [];
      for (let i = 0; i < pcm16.length; i += CHUNK) {
        const sampleChunk = pcm16.subarray(i, Math.min(i + CHUNK, pcm16.length));
        const mp3buf = mp3Encoder.encodeBuffer(sampleChunk);
        if (mp3buf.length > 0) mp3Data.push(mp3buf);
      }
      const mp3End = mp3Encoder.flush();
      if (mp3End.length > 0) mp3Data.push(mp3End);
      await fs.writeFile(combinedFile, Buffer.concat(mp3Data.map(b => Buffer.from(b))));
    } else {
      // WAV LINEAR16 concatenation normalized to target format, then pure-JS continuous BGM mixing
      const normalizedChunks: Buffer[] = [];
      const muteFlags: boolean[] = [];
      const targetSampleRate = 44100;
      const targetNumChannels = 1;
      const bitsPerSample = 16;
      let totalDataLen = 0;
      const readUInt32LE = (buf: Buffer, off: number) => buf.readUInt32LE(off);
      const readUInt16LE = (buf: Buffer, off: number) => buf.readUInt16LE(off);
      // Convert any PCM16 WAV buffer to target PCM16, with optional downmix and linear resampling
      const convertToTargetPcm16 = (srcBuf: Buffer, srcRate: number, srcCh: number): Buffer => {
        const srcSamples = new Int16Array(srcBuf.buffer, srcBuf.byteOffset, srcBuf.byteLength / 2);
        const mono: Float32Array = new Float32Array(Math.ceil(srcSamples.length / srcCh));
        let mIdx = 0;
        if (srcCh === 1) {
          for (let i = 0; i < srcSamples.length; i++) mono[mIdx++] = srcSamples[i];
        } else {
          for (let i = 0; i < srcSamples.length; i += srcCh) {
            let sum = 0;
            for (let c = 0; c < srcCh; c++) sum += srcSamples[i + c];
            mono[mIdx++] = sum / srcCh;
          }
        }
        if (srcRate === targetSampleRate) {
          const out = new Int16Array(mono.length);
          for (let i = 0; i < mono.length; i++) out[i] = Math.max(-32768, Math.min(32767, Math.round(mono[i])));
          return Buffer.from(out.buffer, out.byteOffset, out.byteLength);
        }
        const ratio = targetSampleRate / srcRate;
        const dstLen = Math.max(1, Math.floor(mono.length * ratio));
        const out = new Int16Array(dstLen);
        for (let i = 0; i < dstLen; i++) {
          const srcPos = i / ratio;
          const i0 = Math.floor(srcPos);
          const i1 = Math.min(mono.length - 1, i0 + 1);
          const frac = srcPos - i0;
          out[i] = Math.max(-32768, Math.min(32767, Math.round(mono[i0] * (1 - frac) + mono[i1] * frac)));
        }
        return Buffer.from(out.buffer, out.byteOffset, out.byteLength);
      };
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
        const baseName = path.basename(f);
        let dataBuf = buf.slice(dataStartPos, dataStartPos + dataSize);
        let normalized = convertToTargetPcm16(dataBuf, localSampleRate || 44100, localNumChannels || 1);
        const isOpening = baseName.includes(path.basename(openingBgm));
        const isEnding = baseName.includes(path.basename(endingBgm));
        normalizedChunks.push(normalized);
        muteFlags.push(isOpening || isEnding);
        totalDataLen += normalized.length;
      }
      // Optional continuous BGM mixing (pure JS)
      let outChunks = normalizedChunks;
      const bgmSrc = podcastConfig.assets[(inputData as any).programType === 'presentation' ? 'presentation' : 'podcast'].continuous || '';
      if ((inputData as any).insertContinuousBgm && bgmSrc) {
        try {
          const absBgm = resolveAudioAssetPath(bgmSrc);
          const bgmBuf = await fs.readFile(absBgm);
          if (bgmBuf.slice(0,4).toString() === 'RIFF' && bgmBuf.slice(8,12).toString() === 'WAVE') {
            // parse and convert bgm to target format
            const r32 = (off: number) => bgmBuf.readUInt32LE(off);
            const r16 = (off: number) => bgmBuf.readUInt16LE(off);
            let pos = 12; let dataStartPos=-1; let dataSize=0; let sr=44100; let ch=1;
            while (pos + 8 <= bgmBuf.length) {
              const chunkId = bgmBuf.slice(pos, pos+4).toString();
              const chunkSize = r32(pos+4);
              if (chunkId === 'fmt ') { ch = r16(pos + 10); sr = r32(pos + 12); }
              else if (chunkId === 'data') { dataStartPos = pos + 8; dataSize = chunkSize; }
              pos += 8 + chunkSize + (chunkSize % 2);
            }
            if (dataStartPos >= 0 && dataSize > 0) {
              const bgmPcm = convertToTargetPcm16(bgmBuf.slice(dataStartPos, dataStartPos + dataSize), sr, ch);
              const bgmSamples = new Int16Array(bgmPcm.buffer, bgmPcm.byteOffset, bgmPcm.byteLength/2);
              const gain = Math.pow(10, (podcastConfig.defaults.continuousBgmVolumeDb ?? -20) / 20);
              let bgmIdx = 0;
              const mixed: Buffer[] = [];
              for (let i = 0; i < outChunks.length; i++) {
                const buf = outChunks[i];
                if (muteFlags[i]) { mixed.push(buf); continue; }
                const src = new Int16Array(buf.buffer, buf.byteOffset, buf.byteLength/2);
                const dst = new Int16Array(src.length);
                for (let s = 0; s < src.length; s++) {
                  const b = bgmSamples.length > 0 ? bgmSamples[bgmIdx % bgmSamples.length] : 0;
                  bgmIdx++;
                  const v = src[s] + Math.round(b * gain);
                  dst[s] = v < -32768 ? -32768 : (v > 32767 ? 32767 : v);
                }
                mixed.push(Buffer.from(dst.buffer, dst.byteOffset, dst.byteLength));
              }
              outChunks = mixed;
            }
          }
        } catch {}
      }
      // Write a canonical PCM WAV header
      const header = Buffer.alloc(44);
      header.write('RIFF', 0);
      totalDataLen = outChunks.reduce((acc, b) => acc + b.length, 0);
      header.writeUInt32LE(36 + totalDataLen, 4);
      header.write('WAVE', 8);
      header.write('fmt ', 12);
      header.writeUInt32LE(16, 16); // PCM fmt chunk size
      header.writeUInt16LE(1, 20); // PCM
      header.writeUInt16LE(targetNumChannels, 22);
      header.writeUInt32LE(targetSampleRate, 24);
      const byteRate = targetSampleRate * targetNumChannels * (bitsPerSample/8);
      header.writeUInt32LE(byteRate, 28);
      const blockAlign = targetNumChannels * (bitsPerSample/8);
      header.writeUInt16LE(blockAlign, 32);
      header.writeUInt16LE(bitsPerSample, 34);
      header.write('data', 36);
      header.writeUInt32LE(totalDataLen, 40);
      await fs.writeFile(combinedFile, Buffer.concat([header, ...outChunks]));
    }

    // Optional continuous background music (ffmpeg mix):
    // Mix a quiet continuous BGM across the whole track except the explicit opening/ending BGM ranges.
    try {
      const continuousSrc = (podcastConfig.assets[(inputData as any).programType === 'presentation' ? 'presentation' : 'podcast'].continuous) || '';
      if (continuousSrc && (inputData as any).insertOpeningBgm !== undefined) {
        const absContinuous = path.isAbsolute(continuousSrc) ? continuousSrc : path.join(config.projectRoot, continuousSrc);
        const volDb = podcastConfig.defaults.continuousBgmVolumeDb ?? -20;
        // Build ffmpeg command: duck/skip opening & ending by splitting and concatenating segments without BGM underlay
        // For simplicity: we apply BGM to entire track at low volume, then overwrite opening/ending spans with original (no BGM)
        // This keeps the logic simple without computing precise timestamps here.
        const ffmpeg = 'ffmpeg';
        const mixedOut = combinedFileWav.replace(/\.wav$/, '.mixed.wav');
        // Step 1: base mix (speech + low-volume bgm loop)
        // -stream_loop -1 will loop bgm as needed; -shortest ends with speech length
        const cmd1 = `${ffmpeg} -y -stream_loop -1 -i "${absContinuous}" -i "${combinedFileWav}" -filter_complex "[0:a]volume=${Math.pow(10, volDb/20).toFixed(4)}[bgm];[bgm][1:a]amix=inputs=2:normalize=0:dropout_transition=0,aresample=44100,pan=mono|c0=0.5*c0+0.5*c1" -ar 44100 -ac 1 -c:a pcm_s16le "${mixedOut}"`;
        await fs.writeFile(path.join(outDir, '.ffmpeg_cmd.txt'), Buffer.from(cmd1));
        // We do not execute external commands in this environment; user can run cmd1 locally if desired.
        // TODO: If allowed, integrate a non-interactive ffmpeg run via a task runner.
      }
    } catch (e) {
      logger.warn({ e }, 'Continuous BGM mix step skipped.');
    }

    if (cleanupSegments) {
      for (const f of segmentFiles) {
        try { await fs.unlink(f); } catch {}
      }
      // Best-effort: remove any leftover temp files created by this run pattern and then remove dir if empty
      try {
        const names = await fs.readdir(tempDir);
        for (const name of names) {
          if (name.startsWith('seg-') || name.startsWith('ext-')) {
            try { await fs.unlink(path.join(tempDir, name)); } catch {}
          }
        }
        const remain = await fs.readdir(tempDir);
        if (remain.length === 0) {
          try { await fs.rmdir(tempDir); } catch {}
        }
      } catch {}
    }
    logger.info({ combinedFile }, 'Combined podcast audio created.');
    return { success: true, scriptMarkdown, filePath: combinedFile } as const;
  },
}))
.commit();