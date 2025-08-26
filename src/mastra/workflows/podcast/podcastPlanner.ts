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
import crypto from 'crypto';

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
    programType: z.enum(['podcast','presentation','quiz']).optional().default('podcast'),
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
  // Overview: Read the report markdown from disk, derive title when omitted, and enrich
  // the flowing state with centralized defaults (voices, language, BGM toggles, etc.).
  // It also resolves the pronunciation dictionary path and supports graceful fallback
  // when the report file is missing. The enriched state is the canonical base for
  // downstream drafting and rendering steps.
  inputSchema: z.object({
    reportFileName: z.string(),
    title: z.string().optional(),
    casterA: z.object({ name: z.string() }),
    casterB: z.object({ name: z.string() }),
    programType: z.enum(['podcast','presentation','quiz']).optional().default('podcast'),
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
    insertOpeningBgm: z.boolean().optional().default(false),
    insertEndingBgm: z.boolean().optional().default(false),
    insertJingles: z.boolean().optional().default(false),
    insertContinuousBgm: z.boolean().optional().default(false),
    laughterMode: z.enum(['replace', 'mute', 'audio']).optional().default('replace'),
    programType: z.enum(['podcast','presentation','quiz']).optional().default('podcast'),
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
  // Overview: Draft a dialogue script from the report content according to programType rules.
  // For 'quiz', casterA asks questions and casterB answers them; for 'presentation', casterB
  // explains while casterA hosts; otherwise it is a casual podcast dialogue. This step also
  // instructs the LLM to inject stage tokens (e.g., [OPENING_BGM], [ENDING_BGM], and [COUNTDOWN])
  // as non-spoken cues. Optional persistence is supported: it can load a prior script from JSON
  // (to skip re-drafting) and save the drafted script to JSON for reproducibility.
  inputSchema: z.object({
    reportText: z.string(),
    reportBaseName: z.string(),
    title: z.string(),
    casterA: z.object({ name: z.string(), voiceName: z.string().optional().default('ja-JP-Neural2-B') }),
    casterB: z.object({ name: z.string(), voiceName: z.string().optional().default('ja-JP-Neural2-C') }),
    languageCode: z.string().optional().default('ja-JP'),
    speakingRate: z.number().optional().default(1.05),
    pitch: z.number().optional().default(0.0),
    insertOpeningBgm: z.boolean().optional().default(false),
    insertEndingBgm: z.boolean().optional().default(false),
    insertJingles: z.boolean().optional().default(false),
    insertContinuousBgm: z.boolean().optional().default(false),
    laughterMode: z.enum(['replace', 'mute', 'audio']).optional().default('replace'),
    programType: z.enum(['podcast','presentation','quiz']).optional().default('podcast'),
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
    insertOpeningBgm: z.boolean().optional().default(false),
    insertEndingBgm: z.boolean().optional().default(false),
    insertJingles: z.boolean().optional().default(false),
    insertContinuousBgm: z.boolean().optional().default(false),
    laughterMode: z.enum(['replace', 'mute', 'audio']).optional().default('replace'),
    programType: z.enum(['podcast','presentation','quiz']).optional().default('podcast'),
    pronunciationDictPath: z.string(),
    saveScriptJson: z.boolean().optional().default(false),
    loadScriptJson: z.boolean().optional().default(false),
    scriptJsonFileName: z.string().optional(),
  }),
  execute: async ({ inputData, runtimeContext }) => {
    const { reportText, reportBaseName, title, casterA, casterB, languageCode, speakingRate, pitch, insertOpeningBgm, insertEndingBgm, insertJingles, insertContinuousBgm, laughterMode, programType, pronunciationDictPath, saveScriptJson, loadScriptJson, scriptJsonFileName } = inputData;
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
    const baseRules = `台本中のBGM/ジングル/効果音については、以下のルールでステージ指示を明示してください（発話としては読み上げません）。必ず1行単独で、次の正確なトークンのみを使用してください。
- [OPENING_JINGLE] または [OPENING_BGM] を台本の冒頭に1回
- 必要に応じて途中で [JINGLE] を挿入（多用しない。概ね5〜7発話ごとを上限）
- 終了時に [ENDING_BGM] を1回
- クイズ形式の場合、司会の出題直後に [COUNTDOWN] を1行で挿入
括弧や記号での表現（例： （♪ ジングル））は使わず、上記の角括弧トークンのみを使ってください。`;
    const objective = programType === 'presentation'
      ? `以下のレポート内容を基に、${casterA.name}（司会者） と ${casterB.name}（プレゼンター） による「プレゼンテーション番組」台本をMarkdownで作成してください。冒頭で司会者がプレゼンターの紹介とプレゼンタイトル（${title || reportBaseName}）を紹介し、その後プレゼンターがレポート内容を分かりやすく構造的に説明、最後に司会者がまとめと締めを行います。5〜8分程度を想定し、必要に応じてセクション見出しや小休止を含めてください。各発話は「${casterA.name}: 〜」「${casterB.name}: 〜」の形式で、1発話は80〜160字程度。発話の行頭は必ず「話者名: 」で開始してください。

${baseRules}`
      : programType === 'quiz'
      ? `以下のレポート内容を基に、${casterA.name}（司会）と${casterB.name}（解答者）が進行するクイズ番組形式の台本をMarkdownで作成してください。司会はレポートの要点に基づく設問を順番に出題し、解答者が回答・解説します。必要に応じてヒントや追加説明も交え、5〜8分程度を想定してください。各発話は「${casterA.name}: 〜」「${casterB.name}: 〜」の形式で、1発話は80〜160字程度。司会の出題は疑問文で明確にし、解答者は根拠を含めて簡潔に回答してください。構成は「オープニング→設問と回答を複数回→まとめ→エンディング」を基本とします。クイズ形式では [JINGLE] は使用しないでください。出題直後に [COUNTDOWN] を1行で挿入してください。発話の行頭は必ず「話者名: 」で開始してください。

${baseRules}`
      : `以下のレポート内容を基に、${casterA.name} と ${casterB.name} の2人が掛け合いで解説するポッドキャスト風の台本をMarkdownで作成してください。楽しく、わかりやすく、具体例を交えつつ、5〜8分程度を想定し、セクション見出しと小休止も含めてください。各発話は「${casterA.name}: 〜」「${casterB.name}: 〜」の形式で、1発話は80〜160字程度で。見出しや箇条書きは自由に使って構いませんが、発話の行頭は必ず「話者名: 」で開始してください。

${baseRules}`;
    const combined = `# Report\n\n${reportText}`;
    const res = await summarizeAndAnalyzeTool.execute({ context: { text: combined, objective, temperature: 0.7, topP: 0.9 }, runtimeContext });
    if (!res.success) {
      const fallback = `${casterA.name}: レポートの読み込みに失敗しました。\n${casterB.name}: 別のファイルで試してみましょう。`;
      return { scriptMarkdown: fallback, lines: [{ speaker: casterA.name, text: 'レポートの読み込みに失敗しました。' }], reportBaseName, title, casterA, casterB, languageCode, speakingRate, pitch, insertOpeningBgm, insertEndingBgm, insertJingles, insertContinuousBgm, laughterMode, programType, pronunciationDictPath, saveScriptJson, loadScriptJson, scriptJsonFileName: jsonFile };
    }
    const scriptMarkdown = res.data.summary.trim();
    const lines: Array<{ speaker: string; text: string }> = [];
    const speakerRegex = new RegExp(`^\\s*(?:\\*\\*|__)?(${casterA.name}|${casterB.name})(?:\\*\\*|__)?\\s*[:：]\\s*(.*)$`);
    const headingRegex = /^\s{0,3}#{1,6}\s/;
    const fenceRegex = /^\s*```/;
    // Stage token lines should be ignored for speech text, they are used only as insertion markers.
    const stageTokenRegex = /^\s*\[(OPENING_JINGLE|OPENING_BGM|JINGLE|ENDING_BGM|COUNTDOWN)\]\s*$/i;
    let inFence = false;
    let current: { speaker: string; text: string } | null = null;
    for (const raw of scriptMarkdown.split(/\n/)) {
      const line = raw.replace(/\r$/, '');
      if (fenceRegex.test(line)) { inFence = !inFence; continue; }
      if (inFence) continue;
      if (headingRegex.test(line)) { continue; }
      if (stageTokenRegex.test(line)) {
        if (current) { lines.push(current); current = null; }
        lines.push({ speaker: '__STAGE__', text: line.trim() });
        continue;
      }
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
          if (stageTokenRegex.test(trimmed)) {
            lines.push(current);
            current = null;
            lines.push({ speaker: '__STAGE__', text: trimmed });
            continue;
          }
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
          // persisted fields for reproducibility
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
    return { scriptMarkdown, lines, reportBaseName, title, casterA, casterB, languageCode, speakingRate, pitch, insertOpeningBgm, insertEndingBgm, insertJingles, insertContinuousBgm, laughterMode, programType, pronunciationDictPath, saveScriptJson, loadScriptJson, scriptJsonFileName: jsonFile };
  },
}))
.then(createStep({
  id: 'resolve-audio-assets',
  // Overview: Resolve audio asset file names into absolute on-disk paths and merge them into state.
  // Assets include opening/ending BGM, jingle, optional continuous BGM, laughter SFX, and quiz
  // countdown SFX. Relative names are resolved under persistent_data/assets, while absolute paths
  // are preserved. No files are read here; only path resolution occurs.
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
    insertOpeningBgm: z.boolean().optional().default(false),
    insertEndingBgm: z.boolean().optional().default(false),
    insertJingles: z.boolean().optional().default(false),
    insertContinuousBgm: z.boolean().optional().default(false),
    laughterMode: z.enum(['replace', 'mute', 'audio']).optional().default('replace'),
    programType: z.enum(['podcast','presentation','quiz']).optional().default('podcast'),
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
    insertOpeningBgm: z.boolean().optional().default(false),
    insertEndingBgm: z.boolean().optional().default(false),
    insertJingles: z.boolean().optional().default(false),
    insertContinuousBgm: z.boolean().optional().default(false),
    laughterMode: z.enum(['replace', 'mute', 'audio']).optional().default('replace'),
    programType: z.enum(['podcast','presentation','quiz']).optional().default('podcast'),
    pronunciationDictPath: z.string(),
    saveScriptJson: z.boolean().optional().default(false),
    loadScriptJson: z.boolean().optional().default(false),
    scriptJsonFileName: z.string().optional(),
    // Resolved paths
    openingBgmPathResolved: z.string(),
    endingBgmPathResolved: z.string(),
    jinglePathResolved: z.string(),
    continuousBgmPathResolved: z.string().optional(),
    countdownPathResolved: z.string().optional(),
    laughSfxPathResolved: z.string(),
  }),
  execute: async ({ inputData }) => {
    const assets = podcastConfig.assets[(inputData.programType === 'presentation') ? 'presentation' : (inputData.programType === 'quiz' ? 'quiz' : 'podcast')];
    const resolveAudioAssetPath = (candidate?: string): string => {
      if (!candidate) return '';
      const normalized = candidate.trim();
      const hasDirSep = normalized.includes('/') || normalized.includes('\\');
      const rel = hasDirSep ? normalized : path.join('persistent_data', 'assets', 'audios', normalized);
      return path.isAbsolute(rel) ? rel : path.join(config.projectRoot, rel);
    };
    const openingBgmPathResolved = resolveAudioAssetPath(assets.opening);
    const endingBgmPathResolved = resolveAudioAssetPath(assets.ending);
    const jinglePathResolved = resolveAudioAssetPath(assets.jingle);
    const countdownPathResolved = assets.countdown ? resolveAudioAssetPath(assets.countdown) : undefined;
    const laughSfxPathResolved = resolveAudioAssetPath(path.join('persistent_data','assets','sfx','laugh.mp3'));
    const continuousBgmPathResolved = assets.continuous ? resolveAudioAssetPath(assets.continuous) : undefined;
    return { ...inputData, openingBgmPathResolved, endingBgmPathResolved, jinglePathResolved, laughSfxPathResolved, continuousBgmPathResolved, countdownPathResolved };
  },
}))
.then(createStep({
  id: 'render-wav-master',
  // Overview: Perform per-line TTS synthesis, handle stage tokens (e.g., [COUNTDOWN]),
  // optionally insert opening/ending BGM and periodic jingles (disabled for 'quiz'),
  // optionally mix continuous BGM, normalize/convert all audio to 44.1kHz mono PCM16, and
  // concatenate them into a single WAV master. It writes the final WAV header, emits an
  // optional ffmpeg mixing command, cleans up intermediate segment files, and returns the
  // WAV master path along with the per-run temp directory used for segments.
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
    cleanupSegments: z.boolean().optional().default(true),
    openingBgmPathResolved: z.string(),
    endingBgmPathResolved: z.string(),
    jinglePathResolved: z.string(),
    continuousBgmPathResolved: z.string().optional(),
    countdownPathResolved: z.string().optional(),
    bgmPreviewSeconds: z.number().optional().default(4),
    jingleInterval: z.number().optional().default(6),
    insertOpeningBgm: z.boolean().optional().default(false),
    insertEndingBgm: z.boolean().optional().default(false),
    insertJingles: z.boolean().optional().default(false),
    insertContinuousBgm: z.boolean().optional().default(false),
    laughterMode: z.enum(['replace', 'mute', 'audio']).optional().default('replace'),
    laughSfxPathResolved: z.string(),
    programType: z.enum(['podcast','presentation','quiz']).optional().default('podcast'),
    pronunciationDictPath: z.string(),
    saveScriptJson: z.boolean().optional().default(false),
    loadScriptJson: z.boolean().optional().default(false),
    scriptJsonFileName: z.string().optional(),
  }),
  outputSchema: z.object({
    scriptMarkdown: z.string(),
    reportBaseName: z.string(),
    combinedFileWav: z.string(),
    countdownPathResolved: z.string().optional(),
  }),
  execute: async ({ inputData, runtimeContext }) => {
    const { scriptMarkdown, lines, reportBaseName, casterA, casterB, languageCode, speakingRate, pitch } = inputData;
    // format removed
    const openingBgm = (inputData as any).openingBgmPathResolved;
    const endingBgm = (inputData as any).endingBgmPathResolved;
    const jingle = (inputData as any).jinglePathResolved;
    const laughSfx = (inputData as any).laughSfxPathResolved || path.join(config.projectRoot, 'persistent_data', 'assets', 'sfx', 'laugh.mp3');
    const jingleInterval = (inputData as any).jingleInterval ?? 6;
    const outDir = path.join(config.generatedDir, 'podcast');
    await fs.mkdir(outDir, { recursive: true });
    const segmentItems: Array<{ buffer: Buffer; label: string; muteBgm: boolean }> = [];
    const defaultA = 'ja-JP-Neural2-B';
    const defaultB = 'ja-JP-Neural2-C';
    const pushExternal = async (srcPath: string, opts?: { muteBgm?: boolean }) => {
      try {
        if (typeof srcPath !== 'string' || srcPath.trim().length === 0) return;
        const absPath = path.isAbsolute(srcPath) ? srcPath : path.join(config.projectRoot, srcPath);
        try { await fs.access(absPath); } catch { return; }
        const data = await fs.readFile(absPath);
        segmentItems.push({ buffer: data, label: path.basename(absPath), muteBgm: !!(opts && opts.muteBgm) });
      } catch {}
    };
    if ((inputData as any).insertOpeningBgm) {
      await pushExternal(openingBgm, { muteBgm: true });
    }

    // External asset buffer cache to avoid repeated disk reads
    const externalBufferCache = new Map<string, Buffer>();
    const getExternalBuffer = async (srcPath: string): Promise<Buffer | null> => {
      try {
        const abs = path.isAbsolute(srcPath) ? srcPath : path.join(config.projectRoot, srcPath);
        if (externalBufferCache.has(abs)) return externalBufferCache.get(abs)!;
        await fs.access(abs);
        const data = await fs.readFile(abs);
        externalBufferCache.set(abs, data);
        return data;
      } catch { return null; }
    };

    // TTS persistent cache (disk) setup
    const ttsCacheDir = path.join(config.projectRoot, 'persistent_data', 'cache', 'tts');
    try { await fs.mkdir(ttsCacheDir, { recursive: true }); } catch {}
    let dictMtime = '0';
    try {
      const absDict = (inputData as any).pronunciationDictPath ? ((path.isAbsolute((inputData as any).pronunciationDictPath) ? (inputData as any).pronunciationDictPath : path.join(config.projectRoot, (inputData as any).pronunciationDictPath))) : '';
      if (absDict) {
        const st = await fs.stat(absDict).catch(() => null as any);
        if (st && st.mtimeMs) dictMtime = String(Math.floor(st.mtimeMs));
      }
    } catch {}

    // Concurrency-limited execution helper (simple p-limit)
    const runWithConcurrency = async <T>(tasks: Array<() => Promise<T>>, limit: number): Promise<T[]> => {
      const results: T[] = new Array(tasks.length) as T[];
      let next = 0;
      const worker = async () => {
        while (true) {
          const cur = next++;
          if (cur >= tasks.length) break;
          results[cur] = await tasks[cur]();
        }
      };
      const workers = Array.from({ length: Math.max(1, limit) }, () => worker());
      await Promise.all(workers);
      return results;
    };
    const sleep = (ms: number) => new Promise(res => setTimeout(res, ms));

    const maxRetries = 3;
    const concurrency = Number(process.env.PODCAST_TTS_CONCURRENCY || 4);

    const tasks: Array<() => Promise<Array<{ buffer: Buffer; label: string; muteBgm: boolean }>>> = lines.map((l, i) => async () => {
      const out: Array<{ buffer: Buffer; label: string; muteBgm: boolean }> = [];
      // STAGE: handle [COUNTDOWN]
      if (l.speaker === '__STAGE__' && /^\s*\[COUNTDOWN\]\s*$/i.test(l.text || '')) {
        const countdown = (inputData as any).countdownPathResolved as string | undefined;
        if (countdown) {
          const b = await getExternalBuffer(countdown);
          if (b) out.push({ buffer: b, label: path.basename(countdown), muteBgm: false });
        }
        return out;
      }
      const hadLaugh = /[（(]\s*笑\s*[）)]/g.test(l.text);
      const cleaned = sanitizeSpokenText(l.text, { laughterMode: (inputData as any).laughterMode });
      if (cleaned) {
      const voiceName = l.speaker === casterA.name ? (casterA.voiceName || defaultA) : (casterB.voiceName || defaultB);
        let attempt = 0; let ok = false;
        let lastErr: any = null;
        // Compute cache key
        const keyPayload = { v: 1, text: cleaned, voiceName, languageCode, speakingRate, pitch, dictMtime };
        const key = crypto.createHash('sha1').update(JSON.stringify(keyPayload)).digest('hex');
        const cachePath = path.join(ttsCacheDir, `${key}.wav`);
        // Try cache first
        try {
          const cached = await fs.readFile(cachePath);
          if (cached && cached.length > 0) {
            out.push({ buffer: cached, label: path.basename(cachePath), muteBgm: false });
            ok = true;
          }
        } catch {}
        while (attempt <= maxRetries && !ok) {
          try {
            const tts = await googleTextToSpeechTool.execute({ context: { text: cleaned, voiceName, languageCode, speakingRate, pitch, format: 'wav', returnBuffer: true, fileNameBase: `seg-${String(i).padStart(3,'0')}`, pronunciationDictPath: (inputData as any).pronunciationDictPath }, runtimeContext });
            if (tts.success && (tts as any).data?.buffer) {
              const buf = (tts as any).data.buffer as Buffer;
              // Write-through cache (best-effort)
              try { await fs.writeFile(cachePath, buf); } catch {}
              out.push({ buffer: buf, label: `tts-${String(i).padStart(3,'0')}.wav`, muteBgm: false });
              ok = true;
              break;
            }
            lastErr = (tts as any).message || 'unknown';
          } catch (e) { lastErr = e; }
          if (!ok) {
            if (attempt >= maxRetries) { logger.warn({ i, lastErr }, 'TTS retry exhausted'); break; }
            const backoff = Math.min(2000, 300 * Math.pow(2, attempt)) + Math.floor(Math.random() * 200);
            await sleep(backoff);
          }
          attempt++;
        }
      }
      // JINGLE insertion (non-quiz) after the line
      if ((inputData as any).programType !== 'quiz') {
        if ((inputData as any).insertJingles && jingleInterval > 0 && (i + 1) % jingleInterval === 0) {
          const b = await getExternalBuffer(jingle);
          if (b) out.push({ buffer: b, label: path.basename(jingle), muteBgm: false });
        }
      }
      // Laugh SFX if needed
      if ((inputData as any).laughterMode === 'audio' && hadLaugh) {
        const b = await getExternalBuffer(laughSfx);
        if (b) out.push({ buffer: b, label: path.basename(laughSfx), muteBgm: false });
      }
      return out;
    });

    const perLineSegments = await runWithConcurrency(tasks, concurrency);
    for (let i = 0; i < perLineSegments.length; i++) {
      const segs = perLineSegments[i];
      for (const s of segs) segmentItems.push(s);
    }
    if ((inputData as any).insertEndingBgm) {
      await pushExternal(endingBgm, { muteBgm: true });
    }
    const safeBase = reportBaseName;
    const combinedFileWav = path.join(outDir, `${safeBase}.wav`);
    // WAV normalization and concatenation
    const normalizedChunks: Buffer[] = [];
    const muteFlags: boolean[] = [];
    const targetSampleRate = 44100;
    const targetNumChannels = 1;
    const bitsPerSample = 16;
    let totalDataLen = 0;
    const readUInt32LE = (buf: Buffer, off: number) => buf.readUInt32LE(off);
    const readUInt16LE = (buf: Buffer, off: number) => buf.readUInt16LE(off);
    const convertToTargetPcm16 = (srcBuf: Buffer, srcRate: number, srcCh: number): Buffer => {
      const srcSamples = new Int16Array(srcBuf.buffer, srcBuf.byteOffset, srcBuf.byteLength / 2);
      const mono: Float32Array = new Float32Array(Math.ceil(srcSamples.length / srcCh));
      let mIdx = 0;
      if (srcCh === 1) {
        for (let i = 0; i < srcSamples.length; i++) mono[mIdx++] = srcSamples[i];
      } else {
        for (let i = 0; i < srcSamples.length; i += srcCh) {
          let sum = 0; for (let c = 0; c < srcCh; c++) sum += srcSamples[i + c]; mono[mIdx++] = sum / srcCh;
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
        const srcPos = i / ratio; const i0 = Math.floor(srcPos); const i1 = Math.min(mono.length - 1, i0 + 1);
        const frac = srcPos - i0; const v = mono[i0] * (1 - frac) + mono[i1] * frac; out[i] = Math.max(-32768, Math.min(32767, Math.round(v)));
      }
      return Buffer.from(out.buffer, out.byteOffset, out.byteLength);
    };
    for (const it of segmentItems) {
      const buf = it.buffer;
      if (buf.slice(0,4).toString() !== 'RIFF' || buf.slice(8,12).toString() !== 'WAVE') { continue; }
      let pos = 12; let fmtFound = false; let dataFound = false; let localSampleRate = 0; let localNumChannels = 0; let dataStartPos = -1; let dataSize = 0;
      while (pos + 8 <= buf.length) {
        const chunkId = buf.slice(pos, pos+4).toString(); const chunkSize = readUInt32LE(buf, pos+4);
        if (chunkId === 'fmt ') { fmtFound = true; localNumChannels = readUInt16LE(buf, pos + 10); localSampleRate = readUInt32LE(buf, pos + 12); }
        else if (chunkId === 'data') { dataFound = true; dataStartPos = pos + 8; dataSize = chunkSize; }
        pos += 8 + chunkSize + (chunkSize % 2);
      }
      if (!fmtFound || !dataFound) continue;
      let dataBuf = buf.slice(dataStartPos, dataStartPos + dataSize);
      let normalized = convertToTargetPcm16(dataBuf, localSampleRate || 44100, localNumChannels || 1);
      const isMuted = !!it.muteBgm;
      normalizedChunks.push(normalized); muteFlags.push(isMuted); totalDataLen += normalized.length;
    }
    // Continuous BGM (pure JS mixing)
    let outChunks = normalizedChunks;
    const bgmAbsResolved = (inputData as any).continuousBgmPathResolved || '';
    if ((inputData as any).insertContinuousBgm && bgmAbsResolved) {
      try {
        const bgmBuf = await fs.readFile(bgmAbsResolved);
        if (bgmBuf.slice(0,4).toString() === 'RIFF' && bgmBuf.slice(8,12).toString() === 'WAVE') {
          const r32 = (off: number) => bgmBuf.readUInt32LE(off); const r16 = (off: number) => bgmBuf.readUInt16LE(off);
          let pos = 12; let dataStartPos=-1; let dataSize=0; let sr=44100; let ch=1;
          while (pos + 8 <= bgmBuf.length) {
            const chunkId = bgmBuf.slice(pos, pos+4).toString(); const chunkSize = r32(pos+4);
            if (chunkId === 'fmt ') { ch = r16(pos + 10); sr = r32(pos + 12); }
            else if (chunkId === 'data') { dataStartPos = pos + 8; dataSize = chunkSize; }
            pos += 8 + chunkSize + (chunkSize % 2);
          }
          if (dataStartPos >= 0 && dataSize > 0) {
            const bgmPcm = convertToTargetPcm16(bgmBuf.slice(dataStartPos, dataStartPos + dataSize), sr, ch);
            const bgmSamples = new Int16Array(bgmPcm.buffer, bgmPcm.byteOffset, bgmPcm.byteLength/2);
            const gain = Math.pow(10, (podcastConfig.defaults.continuousBgmVolumeDb ?? -20) / 20);
            let bgmIdx = 0; const mixed: Buffer[] = [];
            for (let i = 0; i < outChunks.length; i++) {
              const buf = outChunks[i]; if (muteFlags[i]) { mixed.push(buf); continue; }
              const src = new Int16Array(buf.buffer, buf.byteOffset, buf.byteLength/2); const dst = new Int16Array(src.length);
              for (let s = 0; s < src.length; s++) { const b = bgmSamples.length > 0 ? bgmSamples[bgmIdx % bgmSamples.length] : 0; bgmIdx++; const v = src[s] + Math.round(b * gain); dst[s] = v < -32768 ? -32768 : (v > 32767 ? 32767 : v); }
              mixed.push(Buffer.from(dst.buffer, dst.byteOffset, dst.byteLength));
            }
            outChunks = mixed;
          }
        }
      } catch {}
    }
    // Write WAV header
    const header = Buffer.alloc(44);
    header.write('RIFF', 0);
    totalDataLen = outChunks.reduce((acc, b) => acc + b.length, 0);
    header.writeUInt32LE(36 + totalDataLen, 4);
    header.write('WAVE', 8);
    header.write('fmt ', 12);
    header.writeUInt32LE(16, 16);
    header.writeUInt16LE(1, 20);
    header.writeUInt16LE(targetNumChannels, 22);
    header.writeUInt32LE(targetSampleRate, 24);
    const byteRate = targetSampleRate * targetNumChannels * (bitsPerSample/8);
    header.writeUInt32LE(byteRate, 28);
    const blockAlign = targetNumChannels * (bitsPerSample/8);
    header.writeUInt16LE(blockAlign, 32);
    header.writeUInt16LE(bitsPerSample, 34);
    header.write('data', 36);
    header.writeUInt32LE(totalDataLen, 40);
    await fs.writeFile(combinedFileWav, Buffer.concat([header, ...outChunks]));

    // Note: we no longer emit an ffmpeg command file; mixing happens in-memory above.

    logger.info({ combinedFileWav }, 'WAV master rendered.');
    return { scriptMarkdown, reportBaseName, combinedFileWav } as const;
  },
}))
.then(createStep({
      id: 'finalize-wav',
  // Overview: Confirm the WAV master as the final output and remove the per-run temp directory.
      inputSchema: z.object({
        scriptMarkdown: z.string(),
        reportBaseName: z.string(),
        combinedFileWav: z.string(),
        countdownPathResolved: z.string().optional(),
      }),
  outputSchema: successOutput.extend({ success: z.literal(true) }),
      execute: async ({ inputData }) => {
    const { combinedFileWav, scriptMarkdown } = inputData as any;
        logger.info({ combinedFile: combinedFileWav }, 'WAV finalized.');
    return { success: true, scriptMarkdown, filePath: combinedFileWav } as const;
      },
}))
.commit();