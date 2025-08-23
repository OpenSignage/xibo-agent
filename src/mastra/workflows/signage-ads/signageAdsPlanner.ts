/*
 * Copyright (C) 2025 Open Source Digital Signage Initiative.
 *
 * This software is licensed under the Elastic License 2.0 (ELv2).
 */

import { createWorkflow, createStep } from '@mastra/core/workflows';
import { z } from 'zod';
import path from 'path';
import { promises as fs } from 'fs';
import { logger } from '../../logger';
import { summarizeAndAnalyzeTool } from '../../tools/market-research/summarizeAndAnalyze';
import { config } from '../../tools/xibo-agent/config';
import { parseJsonStrings } from '../../tools/xibo-agent/utility/jsonParser';

/**
 * signageAdsPlannerWorkflow
 * Overview: Reads a report and drafts a digital signage advertising plan that promotes
 * a product or service via DOOH/digital signage. The plan includes campaign goals,
 * audience, messages, creative/layered layout recommendations, durations, schedule,
 * variants, and an asset checklist. Outputs Markdown and optionally JSON.
 */
export const signageAdsPlannerWorkflow = createWorkflow({
  id: 'signage-ads-planner-workflow',
  description: 'Drafts a digital signage ad campaign plan from a given report.',
  inputSchema: z.object({
    reportFileName: z.string().describe('Report filename under persistent_data/reports.'),
    campaignName: z.string().optional().describe('Campaign name; defaults to the report base name.'),
    savePlanJson: z.boolean().optional().default(true),
    savePlanMarkdown: z.boolean().optional().default(true),
    planJsonFileName: z.string().optional(),
    planMarkdownFileName: z.string().optional(),
  }),
  outputSchema: z.object({
    success: z.literal(true),
    campaignBaseName: z.string(),
    planMarkdownPath: z.string().optional(),
    planJsonPath: z.string().optional(),
    planMarkdown: z.string(),
    xiboLayoutPaths: z.array(z.string()).optional(),
    mockImagePaths: z.array(z.string()).optional(),
    buildGuidePath: z.string().optional(),
    regionTimelinePaths: z.array(z.string()).optional(),
    scheduleChartPaths: z.array(z.string()).optional(),
  }),
})
.then(createStep({
  id: 'read-report',
  // Overview: Read the report from disk, derive campaign name, and prepare output dirs.
  inputSchema: z.object({
    reportFileName: z.string(),
    campaignName: z.string().optional(),
    savePlanJson: z.boolean().optional().default(true),
    savePlanMarkdown: z.boolean().optional().default(true),
    planJsonFileName: z.string().optional(),
    planMarkdownFileName: z.string().optional(),
  }),
  outputSchema: z.object({
    reportText: z.string(),
    campaignBaseName: z.string(),
    savePlanJson: z.boolean().optional().default(true),
    savePlanMarkdown: z.boolean().optional().default(true),
    planJsonFileName: z.string().optional(),
    planMarkdownFileName: z.string().optional(),
  }),
  execute: async ({ inputData }) => {
    const filePath = path.join(config.reportsDir, inputData.reportFileName);
    const base = path.parse(inputData.reportFileName).name;
    const campaignBaseName = (inputData.campaignName && inputData.campaignName.trim().length > 0)
      ? inputData.campaignName.trim()
      : base;
    logger.info({ filePath, campaignBaseName }, 'Reading report for signage ads planning...');
    const reportText = await fs.readFile(filePath, 'utf-8');
    return {
      reportText,
      campaignBaseName,
      savePlanJson: inputData.savePlanJson,
      savePlanMarkdown: inputData.savePlanMarkdown,
      planJsonFileName: inputData.planJsonFileName,
      planMarkdownFileName: inputData.planMarkdownFileName,
    };
  },
}))
.then(createStep({
  id: 'draft-signage-plan',
  // Overview: Use the LLM summarize/analyze tool to produce a signage ad plan.
  // The plan covers objectives, audience, key messages, creative concepts, layout blocks,
  // scene durations, animation cues, CTA, schedule (by day/time/location cluster), variants,
  // asset checklist, and measurement/KPIs.
  inputSchema: z.object({
    reportText: z.string(),
    campaignBaseName: z.string(),
    savePlanJson: z.boolean().optional().default(true),
    savePlanMarkdown: z.boolean().optional().default(true),
    planJsonFileName: z.string().optional(),
    planMarkdownFileName: z.string().optional(),
  }),
  outputSchema: z.object({
    success: z.literal(true),
    campaignBaseName: z.string(),
    planMarkdownPath: z.string().optional(),
    planJsonPath: z.string().optional(),
    planMarkdown: z.string(),
  }),
  execute: async ({ inputData, runtimeContext }) => {
    const { reportText, campaignBaseName, savePlanJson, savePlanMarkdown } = inputData;
    const outDir = path.join(config.generatedDir, 'signage-ads');
    await fs.mkdir(outDir, { recursive: true });

    // Compose the objective (Japanese system-style instruction) for the LLM tool.
    const objective = `【システム指示（日本語）】
あなたはデジタルサイネージのクリエイティブ・ディレクターです。以降の出力はすべて日本語で記述してください（英語の併記は禁止）。
与えられたレポート内容を基に、製品/サービスを訴求するデジタルサイネージ（DOOH）広告の企画書をMarkdownで作成してください。実装コードやAPI仕様の記述は不要で、企画書としての内容に集中してください。

【前提】
- 本企画は Xibo CMS 上で実装（ページ/レイアウト作成、ウィジェット配置、スケジュール設定）できることを前提とします。
- Xibo の概念（Layouts/Regions/Playlists/Widgets、Campaigns、Schedules、Tags、Proof of Play）に即して記述してください。

【企画書に含めるべき項目】
- キャンペーン概要（目的、成功指標/KPI）
- ターゲット（セグメント、インサイト、視聴状況/文脈）
- キーメッセージ（一次/二次）
- クリエイティブコンセプト（2〜3案）と想定コピー/ビジュアルムードの例
- レイアウトとリージョン設計（画面ブロックの役割、セーフエリア、タイポグラフィ、ブランド要素）
- シーン構成（シーンの順序、各シーンの想定秒数、アニメーションやトランジションの指示）
- CTA（視聴者に次にしてほしい行動）
- 掲出/配信設計（曜日/時間帯、頻度、想定滞留時間）
- ロケーション戦略（屋内/屋外、コンテクスチュアルトリガー）
- バリエーション（短尺/長尺、季節/地域/言語のローカライズ案）
- アセット準備チェックリスト（画像/動画/ループ、アイコン、フォント、ロゴ等と推奨仕様）
- 効果測定（KPI、計測方法、A/Bテストアイデア）

【Xibo 実装観点の具体要件】
- レイアウト: 想定解像度（例: 1920x1080/1080x1920、4K など）、アスペクト比、縦横の別を明記。
- リージョン: 役割（メイン映像/タイトル/サブ情報/テロップ等）と各リージョンに配置するウィジェット種別（例: Image, Video, Text, Ticker, Embedded, Clock など）を対応付け。
- プレイリスト/ウィジェット: 表示順、各ウィジェットの表示秒数、繰り返し有無、遷移（Xibo 標準のトランジションに限定）を明記。
- メディア仕様: 
  - 動画: mp4(H.264/AVC + AAC)、推奨ビットレート/フレームレート、最大ファイルサイズ目安。
  - 画像: png/jpg、推奨解像度/画質、透過の可否。
  - フォント: Xibo CMS へアップロードして利用する前提（代替フォントも提示）。
- スケジュール: Campaign/Layouts の紐付け、曜日/時間帯、優先度、日付範囲、再生頻度の指針。
- タグ運用: 検索/切替用のタグ設計（例: キャンペーン名、季節、地域）。
- 計測: Proof of Play ログ活用方針、比較設計（A/B レイアウトの切替案など）。

【出力形式の要件】
- 見出しや箇条書きを活用した読みやすいMarkdown。
- 各シーンは「目的」「秒数」「演出（アニメーション/トランジション）」「表示要素（テキスト/画像/動画の役割）」を簡潔に整理。
- 実務でそのまま議論/レビューに使える粒度で、曖昧表現は避け、具体性を優先。
`;

    const combined = `# Source Report\n\n${reportText}`;
    const res = await summarizeAndAnalyzeTool.execute({
      context: { text: combined, objective, temperature: 0.5, topP: 0.9 },
      runtimeContext,
    });
    if (!res.success) {
      const fallback = `# Signage Ad Plan\n\nUnable to draft a plan from the report. Please verify the source report.`;
      return { success: true as const, campaignBaseName, planMarkdown: fallback };
    }

    const planMarkdown = res.data.summary.trim();
    let planMarkdownPath: string | undefined;
    let planJsonPath: string | undefined;

    // Optional persistence
    if (savePlanMarkdown) {
      const mdName = (inputData.planMarkdownFileName && inputData.planMarkdownFileName.trim().length > 0)
        ? inputData.planMarkdownFileName.trim()
        : `${campaignBaseName}.plan.md`;
      planMarkdownPath = path.join(outDir, mdName);
      await fs.writeFile(planMarkdownPath, planMarkdown, 'utf-8');
      logger.info({ planMarkdownPath }, 'Saved signage ad plan (Markdown).');
    }
    if (savePlanJson) {
      const jsonName = (inputData.planJsonFileName && inputData.planJsonFileName.trim().length > 0)
        ? inputData.planJsonFileName.trim()
        : `${campaignBaseName}.plan.json`;
      planJsonPath = path.join(outDir, jsonName);
      const payload = {
        version: 1,
        campaignBaseName,
        generatedAt: new Date().toISOString(),
        planMarkdown,
      };
      await fs.writeFile(planJsonPath, JSON.stringify(payload, null, 2), 'utf-8');
      logger.info({ planJsonPath }, 'Saved signage ad plan (JSON).');
    }

    return { success: true as const, campaignBaseName, planMarkdownPath, planJsonPath, planMarkdown };
  },
}))
.then(createStep({
  id: 'generate-xibo-layout-structure',
  // Overview: Convert the drafted plan (Markdown) into a structured JSON describing a Xibo-like
  // layout concept (planning-only). It is NOT an API spec. The JSON is saved for implementation.
  inputSchema: z.object({
    success: z.literal(true),
    campaignBaseName: z.string(),
    planMarkdown: z.string(),
    planMarkdownPath: z.string().optional(),
    planJsonPath: z.string().optional(),
  }),
  outputSchema: z.object({
    success: z.literal(true),
    campaignBaseName: z.string(),
    planMarkdown: z.string(),
    planMarkdownPath: z.string().optional(),
    planJsonPath: z.string().optional(),
    xiboLayoutPaths: z.array(z.string()),
  }),
  execute: async ({ inputData, runtimeContext }) => {
    const { campaignBaseName, planMarkdown, planMarkdownPath, planJsonPath } = inputData;
    const outDir = path.join(config.generatedDir, 'signage-ads');
    await fs.mkdir(outDir, { recursive: true });

    const objective = `【システム指示（日本語）】
あなたはXibo CMSでの実装を想定したレイアウト設計者です。以下の企画書（Markdown）をもとに、Xiboの概念に沿った「実装計画用JSON」を出力してください。API仕様ではなく、企画→実装ブリッジ用の構造です。

必ず以下のJSON形式（できる限りXiboの実フィールド名に近い命名）で出力してください（コードブロックや説明文は不要、JSONのみ）：
{
  "layouts": [
    {
      "name": string,
      "description": string,
      "width": number,
      "height": number,
      "orientation": "landscape",
      "tags": string[],
      "regions": [
        {
          "name": string,
          "left": number,
          "top": number,
          "width": number,
          "height": number,
          "zIndex": number,
          "playlists": [
            {
              "name": string,
              "widgets": [
                { "type": "image" | "video" | "text" | "ticker" | "embedded" | "clock", "duration": number, "options": object, "contentHint": string }
              ]
            }
          ]
        }
      ]
    },
    {
      "name": string,
      "description": string,
      "width": number,
      "height": number,
      "orientation": "portrait",
      "tags": string[],
      "regions": [
        {
          "name": string,
          "left": number,
          "top": number,
          "width": number,
          "height": number,
          "zIndex": number,
          "playlists": [
            {
              "name": string,
              "widgets": [
                { "type": "image" | "video" | "text" | "ticker" | "embedded" | "clock", "duration": number, "options": object, "contentHint": string }
              ]
            }
          ]
        }
      ]
    }
  ],
  "schedule": {
    "campaignName": string,
    "fromDt": "YYYY-MM-DD HH:MM",
    "toDt": "YYYY-MM-DD HH:MM",
    "daysOfWeek": ["Mon","Tue","Wed","Thu","Fri","Sat","Sun"],
    "times": [ { "start": "HH:MM", "end": "HH:MM" } ],
    "priority": number
  }
}

注意:
- 実際のXibo APIのID等（layoutId / regionId / playlistId / mediaId など）は含めないでください。命名・構造は可能な限り近づけてください。
- widgets.options には、Xibo標準ウィジェットで一般的な設定（例: textのフォント/サイズ/色、imageのfit、videoのmute/loop等）を簡潔に含めてください。
- playlists.widgets[].duration は秒数（number）で記載。
 - landscape と portrait の両 layout に必ず regions を含めてください。片方しか設計できない場合でも、もう一方は同等の役割分担で縦横比に合わせて再構成してください（単純なコピーでも可）。
 - playlists.widgets[].contentHint は、生成画像/動画のための詳細なプロンプトとして非常に具体的に記述してください。以下を可能な限り含めてください：被写体、構図、距離感（クローズアップ/ミディアム/ロング）、視点（俯瞰/アイレベル/仰角）、背景/小物、配色・テーマカラー、雰囲気（明るい/落ち着いた/ポップ）、質感（紙/金属/ガラス/布）、季節/時間帯、ブランド要素（禁止事項があれば記す）、不要要素（入れないもの）。画像は水彩イラスト風のモックである前提（フォトリアル禁止、文字やロゴも禁止）。

【企画書（Markdown）】
---
${planMarkdown}
---`;

    const res = await summarizeAndAnalyzeTool.execute({
      context: { text: planMarkdown, objective, temperature: 0.2, topP: 0.9 },
      runtimeContext,
    });

    const landscapeFile = path.join(outDir, `${campaignBaseName}.landscape.xibo-layout.json`);
    const portraitFile = path.join(outDir, `${campaignBaseName}.portrait.xibo-layout.json`);
    const paths: string[] = [];

    if (!res.success) {
      const fallbackLayouts = [
        { name: `${campaignBaseName} 16:9`, description: '', width: 1920, height: 1080, orientation: 'landscape', tags: [], regions: [] },
        { name: `${campaignBaseName} 9:16`, description: '', width: 1080, height: 1920, orientation: 'portrait', tags: [], regions: [] },
      ];
      await Promise.all([
        fs.writeFile(landscapeFile, JSON.stringify({ layout: fallbackLayouts[0], schedule: {}, tags: [] }, null, 2), 'utf-8'),
        fs.writeFile(portraitFile, JSON.stringify({ layout: fallbackLayouts[1], schedule: {}, tags: [] }, null, 2), 'utf-8'),
      ]);
      paths.push(landscapeFile, portraitFile);
      return { success: true as const, campaignBaseName, planMarkdown, planMarkdownPath, planJsonPath, xiboLayoutPaths: paths };
    }

    const parsed = parseJsonStrings(res.data.summary) as any;
    let layouts: any[] = [];
    if (parsed && Array.isArray(parsed.layouts)) {
      layouts = parsed.layouts;
    }
    // Basic normalization and fallback
    if (layouts.length === 0) {
      layouts = [
        { name: `${campaignBaseName} 16:9`, description: '', width: 1920, height: 1080, orientation: 'landscape', tags: [], regions: [] },
        { name: `${campaignBaseName} 9:16`, description: '', width: 1080, height: 1920, orientation: 'portrait', tags: [], regions: [] },
      ];
    }
    // If one orientation has empty regions but the other has regions, derive a simple scaled copy
    const ensureRegionsOnBoth = (ls: any[]): any[] => {
      const byOri: Record<string, any> = {};
      for (const l of ls) byOri[String(l.orientation || '').toLowerCase()] = l;
      const land = byOri['landscape'];
      const port = byOri['portrait'];
      const cloneWithScale = (src: any, dw: number, dh: number) => {
        const sw = Number(src.width) || 1920;
        const sh = Number(src.height) || 1080;
        const sx = (v: any) => Math.round((Number(v) || 0) * (dw / sw));
        const sy = (v: any) => Math.round((Number(v) || 0) * (dh / sh));
        const swd = (v: any) => Math.round((Number(v) || 0) * (dw / sw));
        const shd = (v: any) => Math.round((Number(v) || 0) * (dh / sh));
        const newRegions = (Array.isArray(src.regions) ? src.regions : []).map((r: any) => ({
          ...r,
          left: sx(r.left),
          top: sy(r.top),
          width: swd(r.width),
          height: shd(r.height),
        }));
        return newRegions;
      };
      if (land && port) {
        const landHas = Array.isArray(land.regions) && land.regions.length > 0;
        const portHas = Array.isArray(port.regions) && port.regions.length > 0;
        if (landHas && !portHas) {
          port.regions = cloneWithScale(land, Number(port.width) || 1080, Number(port.height) || 1920);
        } else if (!landHas && portHas) {
          land.regions = cloneWithScale(port, Number(land.width) || 1920, Number(land.height) || 1080);
        }
      }
      return ls;
    };
    layouts = ensureRegionsOnBoth(layouts);

    // Write files by orientation and track presence (parallelized)
    await Promise.all(
      layouts.map(async (layout: any) => {
        const isPortrait = String(layout.orientation || '').toLowerCase() === 'portrait';
        const file = isPortrait ? portraitFile : landscapeFile;
        await fs.writeFile(file, JSON.stringify({ layout, schedule: parsed?.schedule ?? {} }, null, 2), 'utf-8');
      })
    );
    const wroteLandscape = layouts.some(l => String(l.orientation || '').toLowerCase() === 'landscape');
    const wrotePortrait = layouts.some(l => String(l.orientation || '').toLowerCase() === 'portrait');
    // Ensure both orientations exist by creating minimal fallbacks if missing
    if (!wroteLandscape) {
      const landscapeFallback = { name: `${campaignBaseName} 16:9`, description: '', width: 1920, height: 1080, orientation: 'landscape', tags: [], regions: [] };
      await fs.writeFile(landscapeFile, JSON.stringify({ layout: landscapeFallback, schedule: parsed?.schedule ?? {} }, null, 2), 'utf-8');
    }
    if (!wrotePortrait) {
      const portraitFallback = { name: `${campaignBaseName} 9:16`, description: '', width: 1080, height: 1920, orientation: 'portrait', tags: [], regions: [] };
      await fs.writeFile(portraitFile, JSON.stringify({ layout: portraitFallback, schedule: parsed?.schedule ?? {} }, null, 2), 'utf-8');
    }
    // Collect paths (parallelized)
    await Promise.all([
      (async () => { try { await fs.access(landscapeFile); paths.push(landscapeFile); } catch {} })(),
      (async () => { try { await fs.access(portraitFile); paths.push(portraitFile); } catch {} })(),
    ]);
    return { success: true as const, campaignBaseName, planMarkdown, planMarkdownPath, planJsonPath, xiboLayoutPaths: paths };
  },
}))
.parallel([
  createStep({
    id: 'render-layout-mockups-landscape',
    // Overview: Render simple mock images (PNG) for each generated layout JSON (landscape & portrait).
    // The mock shows region boxes and labels to help reviewers visualize the screen structure.
    inputSchema: z.object({
      success: z.literal(true),
      campaignBaseName: z.string(),
      planMarkdown: z.string(),
      planMarkdownPath: z.string().optional(),
      planJsonPath: z.string().optional(),
      xiboLayoutPaths: z.array(z.string()),
    }),
    outputSchema: z.object({
      success: z.literal(true),
      campaignBaseName: z.string(),
      planMarkdown: z.string(),
      planMarkdownPath: z.string().optional(),
      planJsonPath: z.string().optional(),
      xiboLayoutPaths: z.array(z.string()),
      mockImagePaths: z.array(z.string()),
    }),
    execute: async ({ inputData, runtimeContext }) => {
      const { campaignBaseName, planMarkdown, planMarkdownPath, planJsonPath } = inputData as any;
      const xiboLayoutPaths = (inputData as any).xiboLayoutPaths.filter((p: string) => /\.landscape\.xibo-layout\.json$/i.test(p));
      const outDir = path.join(config.generatedDir, 'signage-ads');
      await fs.mkdir(outDir, { recursive: true });

      const mockPaths: string[] = [];
      const maxLongSide = 1280; // Scale large canvases down to a manageable size

      // Helpers: cache and generate sample images for image/video widgets
      const sampleImageCache = new Map<string, string>();
      const getAspect = (w: number, h: number): '16:9' | '9:16' | '1:1' => {
        const r = w / Math.max(1, h);
        if (r > 1.2) return '16:9';
        if (r < 0.85) return '9:16';
        return '1:1';
      };
      const generateSampleImage = async (type: string, hint: string, ar: '16:9' | '9:16' | '1:1', runtimeContext?: any): Promise<string | null> => {
        const sanitizeHint = (s: string): string => {
          const cleaned = String(s)
            .replace(/「[^」]*」/g, '')
            .replace(/『[^』]*』/g, '')
            .replace(/"[^"]*"/g, '')
            .replace(/'[^']*'/g, '')
            .trim();
          return cleaned.length ? cleaned : 'abstract scene background';
        };
        const tryOnce = async (t: string): Promise<string | null> => {
          const key = `${t}|${ar}|${hint}`;
          if (sampleImageCache.has(key)) return sampleImageCache.get(key) || null;
          try {
            const { generateImage } = await import('../../tools/xibo-agent/generateImage/imageGeneration');
            const clean = sanitizeHint(hint);
            const prompt = `Hand-drawn watercolor illustration mock of a digital signage ${t || 'image'} for: ${clean}. Soft pastel colors, paper texture, sketchy outlines, non-photorealistic, clearly a mockup. No text.`;
            const negativePrompt = 'photorealistic, realistic, glossy, 3d render, text, words, letters, typography, characters, subtitles, captions, numbers, numerals, UI, watermark, signature, logo, Japanese characters, 文字, テキスト, ロゴ, 透かし, 字幕, キャプション, 数字, 数字列, 英字, 記号';
            const res = await generateImage.execute({ context: { prompt, aspectRatio: ar, negativePrompt }, runtimeContext });
            if (res.success && res.data?.imagePath) {
              sampleImageCache.set(key, res.data.imagePath);
              return res.data.imagePath;
            }
          } catch {}
          return null;
        };
        // Try up to 2 attempts for requested type
        for (let i = 0; i < 2; i++) {
          const p = await tryOnce(type);
          if (p) return p;
        }
        // Fallback: if video fails, try image type with same AR/hint (also retry up to 2)
        if (type === 'video') {
          for (let i = 0; i < 2; i++) {
            const p = await tryOnce('image');
            if (p) return p;
          }
        }
        return null;
      };

      for (const layoutPath of xiboLayoutPaths) {
        try {
          const raw = await fs.readFile(layoutPath, 'utf-8');
          const parsed = JSON.parse(raw);
          const layout = parsed?.layout;
          if (!layout || !layout.width || !layout.height) continue;

          const width: number = Number(layout.width);
          const height: number = Number(layout.height);
          const scale = Math.min(1, maxLongSide / Math.max(width, height));
          const canvasW = Math.max(1, Math.round(width * scale));
          const canvasH = Math.max(1, Math.round(height * scale));

          let wroteRaster = false;
          try {
            // Try raster rendering via node-canvas (ESM-friendly dynamic import)
            const { createCanvas } = await import('canvas');
            const canvas = createCanvas(canvasW, canvasH);
            const ctx = canvas.getContext('2d');

            // Background
            ctx.fillStyle = '#f7f9fb';
            ctx.fillRect(0, 0, canvasW, canvasH);

            // Theme colors from plan (first two hex codes)
            const hexMatches = (planMarkdown.match(/#[0-9a-fA-F]{6}/g) || []).slice(0, 2);
            const themePrimary = hexMatches[0] || '#1976D2';
            const themeSecondary = hexMatches[1] || '#2E7D32';

            // Title banner
            ctx.fillStyle = themePrimary;
            ctx.font = 'bold 20px sans-serif';
            const title = `${layout.name || campaignBaseName} (${layout.orientation || ''}) ${canvasW}x${canvasH}`;
            ctx.fillText(title, 16, 28);

            // Safe area (5% margin) & 12x12 grid
            const margin = 0.05;
            const sx = Math.round(canvasW * margin);
            const sy = Math.round(canvasH * margin);
            const sw = Math.round(canvasW * (1 - margin*2));
            const sh = Math.round(canvasH * (1 - margin*2));
            ctx.save();
            ctx.strokeStyle = themeSecondary;
            ctx.setLineDash([6, 6]);
            ctx.lineWidth = 2;
            ctx.strokeRect(sx, sy, sw, sh);
            ctx.restore();
            ctx.save();
            ctx.strokeStyle = 'rgba(0,0,0,0.08)';
            ctx.lineWidth = 1;
            for (let i = 1; i < 12; i++) {
              const x = Math.round((canvasW / 12) * i);
              ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, canvasH); ctx.stroke();
            }
            for (let j = 1; j < 12; j++) {
              const y = Math.round((canvasH / 12) * j);
              ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(canvasW, y); ctx.stroke();
            }
            ctx.restore();

            // Regions (enhanced rendering with colors and widget mock content)
            const regions = Array.isArray(layout.regions) ? layout.regions : [];
            const palette = [themePrimary + '20', themeSecondary + '20', '#FFF3E0', '#F3E5F5', '#E0F7FA', '#FCE4EC'];
            const strokePalette = [themePrimary, themeSecondary, '#EF6C00', '#6A1B9A', '#00838F', '#AD1457'];
            ctx.font = '12px sans-serif';
            let colorIndex = 0;
            for (const region of regions) {
              const toPx = (v: any, total: number): number => {
                if (typeof v === 'string') {
                  const s = v.trim();
                  if (s.endsWith('%')) {
                    const p = parseFloat(s.slice(0, -1));
                    return isFinite(p) ? (p / 100) * total : 0;
                  }
                  if (s.endsWith('px')) {
                    const px = parseFloat(s.slice(0, -2));
                    return isFinite(px) ? px : 0;
                  }
                  const asNum = Number(s);
                  if (isFinite(asNum)) return asNum;
                  return 0;
                }
                const n = Number(v);
                if (!isFinite(n) || isNaN(n)) return 0;
                if (n > 0 && n < 1) return n * total; // 0..1 ratio
                return n; // treat as pixels by default
              };
              const rx = Math.round(toPx(region.left,  width) * scale);
              const ry = Math.round(toPx(region.top,   height) * scale);
              const rw = Math.max(1, Math.round(toPx(region.width,  width) * scale));
              const rh = Math.max(1, Math.round(toPx(region.height, height) * scale));

              const fillCol = palette[colorIndex % palette.length];
              const strokeCol = strokePalette[colorIndex % strokePalette.length];
              colorIndex++;

              // Region background (semi-transparent) & border
              ctx.save();
              ctx.globalAlpha = 0.5;
              ctx.fillStyle = fillCol;
              ctx.fillRect(rx, ry, rw, rh);
              ctx.restore();
              ctx.strokeStyle = strokeCol;
              ctx.lineWidth = 2;
              ctx.strokeRect(rx, ry, rw, rh);

              // Region label
              ctx.fillStyle = '#0a0a0a';
              const regionName = String(region.name || 'Region');
              const firstPlaylist = Array.isArray(region.playlists) ? region.playlists[0] : undefined;
              const widgetsArr = (firstPlaylist && Array.isArray(firstPlaylist.widgets)) ? firstPlaylist.widgets : [];
              const widgetTypes = widgetsArr.map((w: any) => w?.type).filter(Boolean);
              const label = widgetTypes.length ? `${regionName} [${widgetTypes.join(', ')}]` : regionName;
              ctx.fillText(label, rx + 8, ry + 18);

              // Draw mock content based on first widget type
              const primaryWidget = widgetsArr[0] || {};
              const p = 8; // padding
              const cx = rx + p, cy = ry + 26, cw = Math.max(1, rw - p*2), ch = Math.max(1, rh - 26 - p);
              ctx.save();
              ctx.beginPath();
              ctx.rect(cx, cy, cw, ch);
              ctx.clip();
              const wt = String(primaryWidget.type || '').toLowerCase();
              const opt = (primaryWidget.options || {}) as any;
              const optBg = typeof opt.backgroundColor === 'string' ? opt.backgroundColor : undefined;
              const optColor = typeof opt.color === 'string' ? opt.color : '#111';
              const optFont = typeof opt.fontFamily === 'string' ? opt.fontFamily : 'sans-serif';
              const optFontSize = (typeof opt.fontSize === 'number' ? opt.fontSize : 12);
              const optAlign = typeof opt.textAlign === 'string' ? opt.textAlign : 'left';
              const setAlign = () => { ctx.textAlign = optAlign as CanvasTextAlign; };
              if (wt === 'image') {
                // Try sample image generation then draw; fallback to placeholder
                let drew = false;
                try {
                  const hint = String((primaryWidget as any).contentHint || regionName || 'product');
                  const ar = getAspect(cw, ch);
                  const imgPath = await generateSampleImage('image', hint, ar, runtimeContext);
                  if (imgPath) {
                    const { loadImage } = await import('canvas');
                    const img = await loadImage(imgPath);
                    // Always cover with center-crop to preserve aspect ratio without distortion
                    const ir = img.width / img.height;
                    let dw = cw, dh = ch, dx = cx, dy = cy;
                    if (ir > cw / ch) { // image wider than container
                      dh = ch;
                      dw = dh * ir;
                      dx = cx + Math.round((cw - dw) / 2);
                      dy = cy;
                    } else { // image taller than container
                      dw = cw;
                      dh = Math.round(dw / ir);
                      dx = cx;
                      dy = cy + Math.round((ch - dh) / 2);
                    }
                    ctx.drawImage(img, dx, dy, dw, dh);
                    drew = true;
                  }
                } catch {}
                if (!drew) {
                  ctx.fillStyle = '#EEEEEE';
                  ctx.fillRect(cx, cy, cw, ch);
                  ctx.strokeStyle = '#BDBDBD';
                  ctx.strokeRect(cx+2, cy+2, cw-4, ch-4);
                  ctx.fillStyle = '#BDBDBD';
                  ctx.beginPath();
                  ctx.moveTo(cx + cw*0.15, cy + ch*0.75);
                  ctx.lineTo(cx + cw*0.35, cy + ch*0.5);
                  ctx.lineTo(cx + cw*0.55, cy + ch*0.75);
                  ctx.closePath();
                  ctx.fill();
                  ctx.beginPath();
                  ctx.arc(cx + cw*0.8, cy + ch*0.25, Math.min(cw,ch)*0.06, 0, Math.PI*2);
                  ctx.fill();
                }
              } else if (wt === 'video') {
                // Try generating thumbnail-like still (no play icon)
                let drew = false;
                try {
                  const hint = String((primaryWidget as any).contentHint || regionName || 'product');
                  const ar = getAspect(cw, ch);
                  const imgPath = await generateSampleImage('video', hint, ar, runtimeContext);
                  if (imgPath) {
                    const { loadImage } = await import('canvas');
                    const img = await loadImage(imgPath);
                    // cover center-crop without distortion
                    const ir = img.width / img.height;
                    let dw = cw, dh = ch, dx = cx, dy = cy;
                    if (ir > cw / ch) { dh = ch; dw = dh * ir; dx = cx + Math.round((cw - dw) / 2); dy = cy; }
                    else { dw = cw; dh = Math.round(dw / ir); dx = cx; dy = cy + Math.round((ch - dh) / 2); }
                    ctx.drawImage(img, dx, dy, dw, dh);
                    drew = true;
                  }
                } catch {}
                if (!drew) {
                  ctx.fillStyle = '#212121';
                  ctx.fillRect(cx, cy, cw, ch);
                }
                // Do not draw play icons or additional overlay marks for video
              } else if (wt === 'text') {
                // Render actual text from layout JSON options (supports <br> newlines and alignment synonyms)
                const rawText = typeof (primaryWidget as any).options?.text === 'string'
                  ? (primaryWidget as any).options.text
                  : 'Text';
                const text = String(rawText).replace(/<br\s*\/?>/gi, '\n');
                const bg = typeof opt.backgroundColor === 'string' ? opt.backgroundColor : '';
                const hasTransparentBg = bg.toLowerCase() === 'transparent' || bg === '';
                ctx.fillStyle = hasTransparentBg ? 'rgba(255,255,255,0.5)' : bg;
                ctx.fillRect(cx, cy, cw, ch);

                const fontFamily = (typeof opt.fontFamily === 'string' && opt.fontFamily) || (typeof opt.font === 'string' && opt.font) || 'sans-serif';
                const sizeVal = (typeof opt.fontSize === 'number') ? opt.fontSize : (typeof opt.fontSize === 'string' ? parseInt(opt.fontSize, 10) : 16);
                const fontSizePx = Math.max(12, isFinite(sizeVal) ? sizeVal : 16);
                const isBold = /bold/i.test(String(opt.font || '')) || /bold/i.test(String(fontFamily));
                const textColor = (typeof opt.color === 'string' && opt.color) || (typeof opt.fontColor === 'string' && opt.fontColor) || '#111';
                const alignRaw = ((typeof opt.textAlign === 'string' && opt.textAlign) || (typeof opt.hAlign === 'string' && opt.hAlign) || 'left').toLowerCase();
                const vAlignRaw = ((typeof opt.vAlign === 'string' && opt.vAlign) || 'top').toLowerCase();
                const align = (alignRaw === 'middle' || alignRaw === 'centre') ? 'center' : (alignRaw as CanvasTextAlign);
                const vAlign = (vAlignRaw === 'middle') ? 'center' : vAlignRaw;
                ctx.fillStyle = textColor;
                ctx.font = `${isBold ? 'bold ' : ''}${fontSizePx}px ${fontFamily}`;
                ctx.textAlign = align as CanvasTextAlign;
                ctx.textBaseline = 'alphabetic';

                // Wrap within area with explicit newlines respected
                const padding = 10;
                const maxWidth = Math.max(1, cw - padding * 2);
                const paragraphs = text.split(/\n/);
                const lines: string[] = [];
                for (const para of paragraphs) {
                  const words = String(para).split(/\s+/);
                  let current = '';
                  for (const w of words) {
                    const test = current.length ? current + ' ' + w : w;
                    if (ctx.measureText(test).width > maxWidth) {
                      if (current.length) lines.push(current);
                      current = w;
                    } else {
                      current = test;
                    }
                  }
                  if (current.length) lines.push(current);
                }

                const lineHeight = Math.max(14, fontSizePx + 2);
                const totalTextH = lines.length * lineHeight;
                let yStart = cy + padding + lineHeight;
                if (vAlign === 'center') {
                  yStart = cy + Math.max(padding + lineHeight, (ch - totalTextH) / 2 + lineHeight * 0.5);
                } else if (vAlign === 'bottom') {
                  yStart = cy + ch - padding - totalTextH + lineHeight;
                }

                let xPos = cx + padding;
                if (align === 'center') xPos = cx + cw / 2;
                else if (align === 'right') xPos = cx + cw - padding;

                let yPos = yStart;
                for (const ln of lines) {
                  if (yPos > cy + ch - 4) break;
                  ctx.fillText(ln, xPos, yPos);
                  yPos += lineHeight;
                }
              } else if (wt === 'ticker') {
                // Ticker bar at bottom
                const th = Math.min(40, Math.max(18, Math.round(ch * 0.18)));
                ctx.fillStyle = optBg || '#FFF8E1';
                ctx.fillRect(cx, cy + ch - th, cw, th);
                ctx.fillStyle = optColor || '#6D4C41';
                ctx.font = `bold ${Math.max(12, optFontSize)}px ${optFont}`;
                ctx.fillText('TICKER SAMPLE • HEADLINE • UPDATE • NEWS •', cx + 10, cy + ch - th/2 + 5);
              } else if (wt === 'clock') {
                // Digital clock text
                ctx.fillStyle = optBg || '#004D40';
                ctx.fillRect(cx, cy, cw, ch);
                ctx.fillStyle = optColor || '#E0F2F1';
                ctx.font = `bold ${Math.max(24, optFontSize+18)}px ${optFont.includes('mono') ? optFont : 'monospace'}`;
                ctx.fillText('12:34', cx + 20, cy + 56);
              } else if (wt === 'embedded') {
                // Embedded placeholder
                ctx.fillStyle = optBg || '#EDE7F6';
                ctx.fillRect(cx, cy, cw, ch);
                ctx.strokeStyle = opt.borderColor || '#5E35B1';
                ctx.strokeRect(cx+4, cy+4, cw-8, ch-8);
                ctx.fillStyle = optColor || '#4527A0';
                ctx.font = `bold ${Math.max(14, optFontSize)}px ${optFont}`;
                ctx.fillText('<embedded>', cx + 12, cy + 28);
              }
              ctx.restore();
            }
            const isPortrait = String(layout.orientation || '').toLowerCase() === 'portrait';
            const suffix = isPortrait ? 'portrait' : 'landscape';
            const outPng = path.join(outDir, `${campaignBaseName}.${suffix}.mock.png`);
            await fs.writeFile(outPng, canvas.toBuffer('image/png'));
            mockPaths.push(outPng);
            wroteRaster = true;
          } catch (e) {
            try { logger.error({ error: (e as any)?.message, layoutPath }, 'Failed to render layout mock (PNG).'); } catch {}
          }
        } catch {}
      }

      return {
        success: true as const,
        campaignBaseName,
        planMarkdown,
        planMarkdownPath,
        planJsonPath,
        xiboLayoutPaths: Array.isArray(xiboLayoutPaths) ? [...xiboLayoutPaths] : [],
        mockImagePaths: [...mockPaths],
      };
    },
  }),
  createStep({
    id: 'render-layout-mockups-portrait',
    // Overview: Render simple mock images (PNG) for each generated layout JSON (portrait only).
    inputSchema: z.object({
      success: z.literal(true),
      campaignBaseName: z.string(),
      planMarkdown: z.string(),
      planMarkdownPath: z.string().optional(),
      planJsonPath: z.string().optional(),
      xiboLayoutPaths: z.array(z.string()),
    }),
    outputSchema: z.object({
      success: z.literal(true),
      campaignBaseName: z.string(),
      planMarkdown: z.string(),
      planMarkdownPath: z.string().optional(),
      planJsonPath: z.string().optional(),
      xiboLayoutPaths: z.array(z.string()),
      mockImagePaths: z.array(z.string()),
    }),
    execute: async ({ inputData, runtimeContext }) => {
      const { campaignBaseName, planMarkdown, planMarkdownPath, planJsonPath } = inputData as any;
      const xiboLayoutPaths = (inputData as any).xiboLayoutPaths.filter((p: string) => /\.portrait\.xibo-layout\.json$/i.test(p));
      const outDir = path.join(config.generatedDir, 'signage-ads');
      await fs.mkdir(outDir, { recursive: true });
      const mockPaths: string[] = [];
      const maxLongSide = 1280; // same rendering body reused
      const sampleImageCache = new Map<string, string>();
      const getAspect = (w: number, h: number): '16:9' | '9:16' | '1:1' => { const r = w / Math.max(1, h); if (r > 1.2) return '16:9'; if (r < 0.85) return '9:16'; return '1:1'; };
      const generateSampleImage = async (type: string, hint: string, ar: '16:9' | '9:16' | '1:1', runtimeContext?: any): Promise<string | null> => {
        const sanitizeHint = (s: string): string => String(s).replace(/「[^」]*」/g,'').replace(/『[^』]*』/g,'').replace(/"[^"]*"/g,'').replace(/'[^']*'/g,'').trim() || 'abstract scene background';
        const tryOnce = async (t: string): Promise<string | null> => {
          const key = `${t}|${ar}|${hint}`; if (sampleImageCache.has(key)) return sampleImageCache.get(key) || null;
          try { const { generateImage } = await import('../../tools/xibo-agent/generateImage/imageGeneration');
            const clean = sanitizeHint(hint);
            const prompt = `Hand-drawn watercolor illustration mock of a digital signage ${t || 'image'} for: ${clean}. Soft pastel colors, paper texture, sketchy outlines, non-photorealistic, clearly a mockup. No text.`;
            const negativePrompt = 'photorealistic, realistic, glossy, 3d render, text, words, letters, typography, characters, subtitles, captions, numbers, numerals, UI, watermark, signature, logo, Japanese characters, 文字, テキスト, ロゴ, 透かし, 字幕, キャプション, 数字, 数字列, 英字, 記号';
            const res = await generateImage.execute({ context: { prompt, aspectRatio: ar, negativePrompt }, runtimeContext });
            if (res.success && res.data?.imagePath) { sampleImageCache.set(key, res.data.imagePath); return res.data.imagePath; }
          } catch {}
          return null;
        };
        for (let i=0;i<2;i++){ const p=await tryOnce(type); if(p) return p; }
        if (type==='video'){ for (let i=0;i<2;i++){ const p=await tryOnce('image'); if(p) return p; } }
        return null;
      };
      for (const layoutPath of xiboLayoutPaths) {
        try {
          const raw = await fs.readFile(layoutPath, 'utf-8');
          const parsed = JSON.parse(raw);
          const layout = parsed?.layout; if (!layout || !layout.width || !layout.height) continue;
          const width: number = Number(layout.width); const height: number = Number(layout.height);
          const scale = Math.min(1, maxLongSide / Math.max(width, height));
          const canvasW = Math.max(1, Math.round(width * scale));
          const canvasH = Math.max(1, Math.round(height * scale));
          try {
            const { createCanvas } = await import('canvas');
            const canvas = createCanvas(canvasW, canvasH); const ctx = canvas.getContext('2d');
            ctx.fillStyle = '#f7f9fb'; ctx.fillRect(0, 0, canvasW, canvasH);
            const hexMatches = (planMarkdown.match(/#[0-9a-fA-F]{6}/g) || []).slice(0, 2);
            const themePrimary = hexMatches[0] || '#1976D2'; const themeSecondary = hexMatches[1] || '#2E7D32';
            ctx.fillStyle = themePrimary; ctx.font = 'bold 20px sans-serif';
            const title = `${layout.name || campaignBaseName} (${layout.orientation || ''}) ${canvasW}x${canvasH}`; ctx.fillText(title, 16, 28);
            const margin = 0.05; const sx = Math.round(canvasW * margin); const sy = Math.round(canvasH * margin);
            const sw = Math.round(canvasW * (1 - margin*2)); const sh = Math.round(canvasH * (1 - margin*2));
            ctx.save(); ctx.strokeStyle = themeSecondary; ctx.setLineDash([6,6]); ctx.lineWidth = 2; ctx.strokeRect(sx, sy, sw, sh); ctx.restore();
            ctx.save(); ctx.strokeStyle = 'rgba(0,0,0,0.08)'; ctx.lineWidth = 1; for (let i=1;i<12;i++){ const x=Math.round((canvasW/12)*i); ctx.beginPath(); ctx.moveTo(x,0); ctx.lineTo(x,canvasH); ctx.stroke(); } for (let j=1;j<12;j++){ const y=Math.round((canvasH/12)*j); ctx.beginPath(); ctx.moveTo(0,y); ctx.lineTo(canvasW,y); ctx.stroke(); } ctx.restore();
            const regions = Array.isArray(layout.regions) ? layout.regions : [];
            const palette = [themePrimary + '20', themeSecondary + '20', '#FFF3E0', '#F3E5F5', '#E0F7FA', '#FCE4EC'];
            const strokePalette = [themePrimary, themeSecondary, '#EF6C00', '#6A1B9A', '#00838F', '#AD1457'];
            ctx.font = '12px sans-serif'; let colorIndex = 0;
            for (const region of regions) {
              const toPx = (v: any, total: number): number => { if (typeof v === 'string'){ const s=v.trim(); if (s.endsWith('%')){ const p=parseFloat(s.slice(0,-1)); return isFinite(p)? (p/100)*total:0;} if (s.endsWith('px')){ const px=parseFloat(s.slice(0,-2)); return isFinite(px)? px:0;} const asNum=Number(s); if (isFinite(asNum)) return asNum; return 0; } const n=Number(v); if (!isFinite(n)||isNaN(n)) return 0; if (n>0 && n<1) return n*total; return n; };
              const rx = Math.round(toPx(region.left,  width) * scale);
              const ry = Math.round(toPx(region.top,   height) * scale);
              const rw = Math.max(1, Math.round(toPx(region.width,  width) * scale));
              const rh = Math.max(1, Math.round(toPx(region.height, height) * scale));
              const fillCol = palette[colorIndex % palette.length]; const strokeCol = strokePalette[colorIndex % strokePalette.length]; colorIndex++;
              ctx.save(); ctx.globalAlpha = 0.5; ctx.fillStyle = fillCol; ctx.fillRect(rx, ry, rw, rh); ctx.restore();
              ctx.strokeStyle = strokeCol; ctx.lineWidth = 2; ctx.strokeRect(rx, ry, rw, rh);
              ctx.fillStyle = '#0a0a0a'; const regionName = String(region.name || 'Region');
              const firstPlaylist = Array.isArray(region.playlists) ? region.playlists[0] : undefined;
              const widgetsArr = (firstPlaylist && Array.isArray(firstPlaylist.widgets)) ? firstPlaylist.widgets : [];
              const widgetTypes = widgetsArr.map((w: any) => w?.type).filter(Boolean);
              const label = widgetTypes.length ? `${regionName} [${widgetTypes.join(', ')}]` : regionName; ctx.fillText(label, rx + 8, ry + 18);
              const primaryWidget = widgetsArr[0] || {}; const p = 8; const cx = rx + p, cy = ry + 26, cw = Math.max(1, rw - p*2), ch = Math.max(1, rh - 26 - p);
              ctx.save(); ctx.beginPath(); ctx.rect(cx, cy, cw, ch); ctx.clip();
              const wt = String(primaryWidget.type || '').toLowerCase(); const opt = (primaryWidget.options || {}) as any;
              const optBg = typeof opt.backgroundColor === 'string' ? opt.backgroundColor : undefined; const optColor = typeof opt.color === 'string' ? opt.color : '#111';
              const optFont = typeof opt.fontFamily === 'string' ? opt.fontFamily : 'sans-serif'; const optFontSize = (typeof opt.fontSize === 'number' ? opt.fontSize : 12);
              const optAlign = typeof opt.textAlign === 'string' ? opt.textAlign : 'left'; const setAlign = () => { ctx.textAlign = optAlign as CanvasTextAlign; };
              // identical widget rendering branches as landscape step
              if (wt === 'image') { let drew=false; try { const hint=String((primaryWidget as any).contentHint||regionName||'product'); const ar=getAspect(cw,ch); const imgPath=await generateSampleImage('image',hint,ar,runtimeContext); if(imgPath){ const { loadImage }=await import('canvas'); const img=await loadImage(imgPath); const ir=img.width/img.height; let dw=cw,dh=ch,dx=cx,dy=cy; if(ir>cw/ch){ dh=ch; dw=dh*ir; dx=cx+Math.round((cw-dw)/2); dy=cy; } else { dw=cw; dh=Math.round(dw/ir); dx=cx; dy=cy+Math.round((ch-dh)/2);} ctx.drawImage(img,dx,dy,dw,dh); drew=true; } } catch {} if(!drew){ ctx.fillStyle='#EEEEEE'; ctx.fillRect(cx,cy,cw,ch); ctx.strokeStyle='#BDBDBD'; ctx.strokeRect(cx+2,cy+2,cw-4,ch-4); ctx.fillStyle='#BDBDBD'; ctx.beginPath(); ctx.moveTo(cx + cw*0.15, cy + ch*0.75); ctx.lineTo(cx + cw*0.35, cy + ch*0.5); ctx.lineTo(cx + cw*0.55, cy + ch*0.75); ctx.closePath(); ctx.fill(); ctx.beginPath(); ctx.arc(cx + cw*0.8, cy + ch*0.25, Math.min(cw,ch)*0.06, 0, Math.PI*2); ctx.fill(); }}
              else if (wt==='video'){ let drew=false; try { const hint=String((primaryWidget as any).contentHint||regionName||'product'); const ar=getAspect(cw,ch); const imgPath=await generateSampleImage('video',hint,ar,runtimeContext); if(imgPath){ const { loadImage }=await import('canvas'); const img=await loadImage(imgPath); const ir=img.width/img.height; let dw=cw,dh=ch,dx=cx,dy=cy; if(ir>cw/ch){ dh=ch; dw=dh*ir; dx=cx+Math.round((cw-dw)/2); dy=cy;} else { dw=cw; dh=Math.round(dw/ir); dx=cx; dy=cy+Math.round((ch-dh)/2);} ctx.drawImage(img,dx,dy,dw,dh); drew=true; } } catch {} if(!drew){ ctx.fillStyle='#212121'; ctx.fillRect(cx,cy,cw,ch);} }
              else if (wt==='text'){ const rawText=typeof (primaryWidget as any).options?.text==='string'?(primaryWidget as any).options.text:'Text'; const text=String(rawText).replace(/<br\s*\/?>/gi,'\n'); const bg=typeof opt.backgroundColor==='string'?opt.backgroundColor:''; const hasTransparentBg=bg.toLowerCase()==='transparent'||bg===''; ctx.fillStyle=hasTransparentBg?'rgba(255,255,255,0.5)':bg; ctx.fillRect(cx,cy,cw,ch); const fontFamily=(typeof opt.fontFamily==='string'&&opt.fontFamily)||(typeof opt.font==='string'&&opt.font)||'sans-serif'; const sizeVal=(typeof opt.fontSize==='number')?opt.fontSize:(typeof opt.fontSize==='string'?parseInt(opt.fontSize,10):16); const fontSizePx=Math.max(12,isFinite(sizeVal)?sizeVal:16); const isBold=/bold/i.test(String(opt.font||''))||/bold/i.test(String(fontFamily)); const textColor=(typeof opt.color==='string'&&opt.color)||(typeof opt.fontColor==='string'&&opt.fontColor)||'#111'; const alignRaw=((typeof opt.textAlign==='string'&&opt.textAlign)||(typeof opt.hAlign==='string'&&opt.hAlign)||'left').toLowerCase(); const vAlignRaw=((typeof opt.vAlign==='string'&&opt.vAlign)||'top').toLowerCase(); const align=(alignRaw==='middle'||alignRaw==='centre')?'center':(alignRaw as CanvasTextAlign); const vAlign=(vAlignRaw==='middle')?'center':vAlignRaw; ctx.fillStyle=textColor; ctx.font=`${isBold ? 'bold ' : ''}${fontSizePx}px ${fontFamily}`; ctx.textAlign=align as CanvasTextAlign; ctx.textBaseline='alphabetic'; const padding=10; const maxWidth=Math.max(1,cw-padding*2); const paragraphs=text.split(/\n/); const lines:string[]=[]; for(const para of paragraphs){ const words=String(para).split(/\s+/); let current=''; for(const w of words){ const test=current.length?current+' '+w:w; if(ctx.measureText(test).width>maxWidth){ if(current.length) lines.push(current); current=w; } else { current=test; } } if(current.length) lines.push(current);} const lineHeight=Math.max(14,fontSizePx+2); const totalTextH=lines.length*lineHeight; let yStart=cy+padding+lineHeight; if(vAlign==='center') yStart=cy+Math.max(padding+lineHeight,(ch-totalTextH)/2+lineHeight*0.5); else if(vAlign==='bottom') yStart=cy+ch-padding-totalTextH+lineHeight; let xPos=cx+padding; if(align==='center') xPos=cx+cw/2; else if(align==='right') xPos=cx+cw-padding; let yPos=yStart; for(const ln of lines){ if(yPos>cy+ch-4) break; ctx.fillText(ln,xPos,yPos); yPos+=lineHeight; } }
              else if (wt==='ticker'){ const th=Math.min(40,Math.max(18,Math.round(ch*0.18))); ctx.fillStyle=optBg||'#FFF8E1'; ctx.fillRect(cx,cy+ch-th,cw,th); ctx.fillStyle=optColor||'#6D4C41'; ctx.font=`bold ${Math.max(12,optFontSize)}px ${optFont}`; ctx.fillText('TICKER SAMPLE • HEADLINE • UPDATE • NEWS •', cx + 10, cy + ch - th/2 + 5); }
              else if (wt==='clock'){ ctx.fillStyle=optBg||'#004D40'; ctx.fillRect(cx,cy,cw,ch); ctx.fillStyle=optColor||'#E0F2F1'; ctx.font=`bold ${Math.max(24,optFontSize+18)}px ${optFont.includes('mono') ? optFont : 'monospace'}`; ctx.fillText('12:34', cx + 20, cy + 56); }
              else if (wt==='embedded'){ ctx.fillStyle=optBg||'#EDE7F6'; ctx.fillRect(cx,cy,cw,ch); ctx.strokeStyle=opt.borderColor||'#5E35B1'; ctx.strokeRect(cx+4,cy+4,cw-8,ch-8); ctx.fillStyle=optColor||'#4527A0'; ctx.font=`bold ${Math.max(14,optFontSize)}px ${optFont}`; ctx.fillText('<embedded>', cx + 12, cy + 28); }
              ctx.restore();
            }
            const isPortrait = String(layout.orientation || '').toLowerCase() === 'portrait'; const suffix = isPortrait ? 'portrait' : 'landscape';
            const outPng = path.join(outDir, `${campaignBaseName}.${suffix}.mock.png`); await fs.writeFile(outPng, canvas.toBuffer('image/png')); mockPaths.push(outPng);
          } catch (e) { try { logger.error({ error: (e as any)?.message, layoutPath }, 'Failed to render layout mock (PNG).'); } catch {} }
        } catch {}
      }
      return {
        success: true as const,
        campaignBaseName,
        planMarkdown,
        planMarkdownPath,
        planJsonPath,
        xiboLayoutPaths: Array.isArray(xiboLayoutPaths) ? [...xiboLayoutPaths] : [],
        mockImagePaths: [...mockPaths],
      };
    },
  }),
  createStep({
    id: 'render-region-timeline',
    // Overview: Render region timeline charts (PNG). Y-axis = time, X-axis = regions. Each widget stacked by duration.
    inputSchema: z.object({
      success: z.literal(true),
      campaignBaseName: z.string(),
      planMarkdown: z.string(),
      planMarkdownPath: z.string().optional(),
      planJsonPath: z.string().optional(),
      xiboLayoutPaths: z.array(z.string()),
    }),
    outputSchema: z.object({
      success: z.literal(true),
      campaignBaseName: z.string(),
      planMarkdown: z.string(),
      planMarkdownPath: z.string().optional(),
      planJsonPath: z.string().optional(),
      xiboLayoutPaths: z.array(z.string()),
      regionTimelinePaths: z.array(z.string()),
    }),
    execute: async ({ inputData }) => {
      const { campaignBaseName, xiboLayoutPaths, planMarkdown, planMarkdownPath, planJsonPath } = inputData as any;
      const outDir = path.join(config.generatedDir, 'signage-ads');
      await fs.mkdir(outDir, { recursive: true });

      const outPaths: string[] = [];
      try {
        const { createCanvas } = await import('canvas');
        for (const layoutPath of xiboLayoutPaths) {
          try {
            const raw = await fs.readFile(layoutPath, 'utf-8');
            const j = JSON.parse(raw);
            const layout = j?.layout;
            if (!layout) continue;

            const regions = Array.isArray(layout.regions) ? layout.regions : [];
            const regionNames = regions.map((r: any) => String(r?.name || 'Region'));
            const stacks: Array<Array<{ type: string; duration: number }>> = regions.map((r: any) => {
              const p = Array.isArray(r?.playlists) ? r.playlists[0] : undefined;
              const ws = (p && Array.isArray(p.widgets)) ? p.widgets : [];
              return ws.map((w: any) => ({ type: String(w?.type || 'other'), duration: Number(w?.duration || 0) }));
            });

            const sum = (arr: Array<{ duration: number }>) => arr.reduce((a, b) => a + (isFinite(b.duration) ? b.duration : 0), 0);
            const colTotals = stacks.map(sum);
            const maxTotal = Math.max(10, ...colTotals);

            const colWidth = 140;
            const leftPad = 60; // narrower label gutter
            const rightPad = 40;
            const topPad = 40;
            const bottomPad = 40;
            const chartW = leftPad + regionNames.length * colWidth + rightPad;
            const chartH = 800;
            const chartAreaH = chartH - topPad - bottomPad;

            const canvas = createCanvas(chartW, chartH);
            const ctx = canvas.getContext('2d');
            ctx.fillStyle = '#ffffff';
            ctx.fillRect(0, 0, chartW, chartH);

            ctx.fillStyle = '#0a0a0a';
            ctx.font = 'bold 18px sans-serif';
            const suffix = String(layout.orientation || '').toLowerCase() === 'portrait' ? 'portrait' : 'landscape';
            ctx.fillText(`${campaignBaseName} - Region Timeline (${suffix})`, 16, 28);

            // Axes (no thick frame around chart)
            // Draw only a light left baseline for reference
            ctx.strokeStyle = 'rgba(0,0,0,0.25)';
            ctx.lineWidth = 1.5;
            ctx.beginPath(); ctx.moveTo(leftPad, topPad); ctx.lineTo(leftPad, chartH - bottomPad); ctx.stroke();

            // Y-grid (time top->bottom): 1s darker thin, every 5s thicker & darker with labels
            ctx.fillStyle = '#444';
            ctx.font = '14px sans-serif';
            const totalSeconds = Math.ceil(maxTotal);
            for (let s = 0; s <= totalSeconds; s++) {
              const y = topPad + (s / Math.max(1, maxTotal)) * chartAreaH;
              ctx.strokeStyle = (s % 5 === 0) ? 'rgba(0,0,0,0.35)' : 'rgba(0,0,0,0.20)';
              ctx.lineWidth = (s % 5 === 0) ? 2 : 1;
              ctx.beginPath();
              ctx.moveTo(leftPad, y);
              ctx.lineTo(chartW - rightPad, y);
              ctx.stroke();
              if (s % 5 === 0) ctx.fillText(`${s}s`, 6, y + 4);
            }

            ctx.fillStyle = '#0a0a0a';
            ctx.font = '12px sans-serif';
            regionNames.forEach((name: string, idx: number) => {
              const cx = leftPad + idx * colWidth + colWidth / 2;
              ctx.textAlign = 'center';
              ctx.fillText(name, cx, chartH - 12);
            });

            // Rich color selection: large palette + HSL fallback; vary by (type, region, segment)
            const bigPalette = [
              '#1f77b4','#ff7f0e','#2ca02c','#d62728','#9467bd','#8c564b','#e377c2','#7f7f7f','#bcbd22','#17becf',
              '#4e79a7','#f28e2b','#e15759','#76b7b2','#59a14f','#edc949','#af7aa1','#ff9da7','#9c755f','#bab0ab',
              '#6b5b95','#feb236','#d64161','#ff7b25','#88b04b','#92a8d1','#f7cac9','#955251','#b565a7','#009b77',
              '#dd4124','#45b8ac','#e6b0aa','#a9cce3','#7fb3d5','#73c6b6','#f8c471','#f5b7b1','#82e0aa','#bb8fce'
            ];
            const colorCache = new Map<string,string>();
            const hslFallback = (seed: number) => {
              const hue = (seed * 47) % 360;
              return `hsl(${hue} 65% 55%)`;
            };
            const colorOfSegment = (type: string, regionIndex: number, segmentIndex: number): string => {
              const key = `${String(type).toLowerCase()}|${regionIndex}|${segmentIndex}`;
              if (colorCache.has(key)) return colorCache.get(key)!;
              const idx = Math.abs(hashCode(key)) % bigPalette.length;
              const col = bigPalette[idx] || hslFallback(idx);
              colorCache.set(key, col);
              return col;
            };
            function hashCode(s: string): number {
              let h = 0; for (let i = 0; i < s.length; i++) { h = (h << 5) - h + s.charCodeAt(i); h |= 0; }
              return h;
            }

            stacks.forEach((segments, idx) => {
              const x0 = leftPad + idx * colWidth + 24;
              const barW = colWidth - 48;
              let acc = 0;
              for (let sIdx = 0; sIdx < segments.length; sIdx++) {
                const seg = segments[sIdx];
                const d = Math.max(0, isFinite(seg.duration) ? seg.duration : 0);
                const y0 = topPad + (acc / Math.max(1, maxTotal)) * chartAreaH;
                acc += d;
                const y1 = topPad + (acc / Math.max(1, maxTotal)) * chartAreaH;
                const h = Math.max(1, y1 - y0);
                ctx.fillStyle = colorOfSegment(seg.type, idx, sIdx);
                ctx.fillRect(x0, y0, barW, h);
                ctx.fillStyle = '#263238';
                ctx.font = '11px sans-serif';
                if (h >= 14) ctx.fillText(`${seg.type} ${d}s`, x0 + barW / 2, y0 + h / 2 + 4);
              }
            });

            const outPng = path.join(outDir, `${campaignBaseName}.${suffix}.region-timeline.png`);
            await fs.writeFile(outPng, canvas.toBuffer('image/png'));
            outPaths.push(outPng);
          } catch {}
        }
      } catch {}

      return {
        success: true as const,
        campaignBaseName,
        planMarkdown,
        planMarkdownPath,
        planJsonPath,
        xiboLayoutPaths,
        regionTimelinePaths: outPaths,
      };
    },
  }),
  createStep({
    id: 'write-xibo-build-guide',
    // Overview: Write a Japanese step-by-step guide for building the generated layouts in Xibo CMS.
    inputSchema: z.object({
      success: z.literal(true),
      campaignBaseName: z.string(),
      planMarkdown: z.string(),
      planMarkdownPath: z.string().optional(),
      planJsonPath: z.string().optional(),
      xiboLayoutPaths: z.array(z.string()),
    }),
    outputSchema: z.object({
      success: z.literal(true),
      campaignBaseName: z.string(),
      planMarkdown: z.string(),
      planMarkdownPath: z.string().optional(),
      planJsonPath: z.string().optional(),
      xiboLayoutPaths: z.array(z.string()),
      buildGuidePath: z.string(),
    }),
    execute: async ({ inputData }) => {
      const { campaignBaseName, xiboLayoutPaths, planMarkdown, planMarkdownPath, planJsonPath } = inputData as any;
      const outDir = path.join(config.generatedDir, 'signage-ads');
      await fs.mkdir(outDir, { recursive: true });

      // Load both layouts (landscape/portrait) with full structure
      const layouts: Array<{ path: string; name: string; orientation: string; size: string; structure: any } > = [];
      for (const p of xiboLayoutPaths) {
        try {
          const raw = await fs.readFile(p, 'utf-8');
          const j = JSON.parse(raw);
          const l = j?.layout || {};
          layouts.push({ path: p, name: String(l.name || ''), orientation: String(l.orientation || ''), size: `${l.width || ''}x${l.height || ''}`, structure: l });
        } catch {}
      }

      const guidePath = path.join(outDir, `${campaignBaseName}.xibo-build-guide.md`);
      const landscape = layouts.find(l => String(l.orientation).toLowerCase() === 'landscape');
      const portrait = layouts.find(l => String(l.orientation).toLowerCase() === 'portrait');

      const sectionForLayout = (L: { path: string; name: string; orientation: string; size: string; structure: any }): string => {
        const lay = L.structure || {};
        const regions = Array.isArray(lay.regions) ? lay.regions : [];
        const header = `## レイアウト: ${L.name || campaignBaseName}（${(L.orientation || '').toLowerCase()} / ${L.size}）\n\n` +
          `### 作成手順\n` +
          `1) メインメニュー > レイアウト > 追加\n` +
          `2) レイアウト名: "${campaignBaseName} - ${(L.orientation || '').charAt(0).toUpperCase()}${(L.orientation || '').slice(1).toLowerCase()}"（推奨）\n` +
          `3) 方向: ${(L.orientation || '').toLowerCase()}\n` +
          `4) 解像度: ${L.size}\n` +
          `5) 作成 をクリック\n\n`;

        const regionTableHeader = `### リージョン配置（座標/サイズ）\n` +
          `| Region | Left | Top | Width | Height |\n` +
          `|---|---:|---:|---:|---:|\n`;
        const toStr = (v: any) => (v === 0 ? '0' : (v ? String(v) : ''));
        const regionTableRows = regions.map((r: any) => `| ${toStr(r.name) || 'Region'} | ${toStr(r.left)} | ${toStr(r.top)} | ${toStr(r.width)} | ${toStr(r.height)} |`).join('\n');

        const regionSteps: string[] = [];
        for (const r of regions) {
          const rname = toStr(r.name) || 'Region';
          regionSteps.push(`#### Region: ${rname}\n` +
            `1) レイアウト編集画面で「リージョン追加」をクリックし、おおよその位置に配置\n` +
            `2) リージョンのプロパティを開き、「左/上/幅/高さ」を以下の値に設定\n` +
            `   - Left: ${toStr(r.left)} / Top: ${toStr(r.top)} / Width: ${toStr(r.width)} / Height: ${toStr(r.height)}\n` +
            `3) プレイリスト > ウィジェットを以下の順で追加・設定\n` +
            buildPlaylistGuide(r)
          );
        }

        return header + regionTableHeader + regionTableRows + '\n\n' + regionSteps.join('\n\n');
      };

      const buildWidgetOptionsList = (w: any): string => {
        const lines: string[] = [];
        const opt = w?.options || {};
        const pushKV = (k: string, label?: string) => { if (opt[k] !== undefined) lines.push(`      - ${label || k}: ${String(opt[k])}`); };
        if (w?.duration !== undefined) lines.push(`      - duration: ${String(w.duration)} 秒`);
        pushKV('backgroundColor');
        pushKV('color');
        pushKV('fontFamily');
        pushKV('fontSize');
        pushKV('textAlign');
        pushKV('fit');
        pushKV('loop');
        pushKV('muted');
        pushKV('borderColor');
        return lines.length ? ['    - オプション:', ...lines].join('\n') : '';
      };

      const buildPlaylistGuide = (region: any): string => {
        const playlists = Array.isArray(region?.playlists) ? region.playlists : [];
        if (!playlists.length) return '   - （プレイリストなし）';
        const parts: string[] = [];
        let pIndex = 1;
        for (const p of playlists) {
          const widgets = Array.isArray(p?.widgets) ? p.widgets : [];
          const pname = p?.name ? String(p.name) : `Playlist ${pIndex}`;
          const head = `   - プレイリスト: ${pname}`;
          parts.push(head);
          let wIndex = 1;
          for (const w of widgets) {
            const wtype = String(w?.type || 'widget');
            const title = `    - Widget ${wIndex}: ${wtype}`;
            const optLines = buildWidgetOptionsList(w);
            parts.push([title, optLines].filter(Boolean).join('\n'));
            wIndex++;
          }
          pIndex++;
        }
        return parts.join('\n');
      };

      const dynamicSections = layouts.map(L => sectionForLayout(L)).join('\n\n');

      const md = `# Xibo レイアウト構築手順 (${campaignBaseName})\n\n` +
`本手順書は、生成済みのレイアウトJSONを基に、Xibo CMS 上で同等レイアウトを構築・スケジュールするための詳細ガイドです。\n` +
`横向き（landscape）・縦向き（portrait）の2種類を対象とし、各リージョンの座標、プレイリスト、ウィジェット設定まで具体的に手順化します。\n\n` +
`## 1. 前提\n` +
`- Xibo CMS への管理画面アクセス権を保有していること。\n` +
`- 必要素材（画像/動画/フォント等）をライブラリへアップロード可能であること。\n` +
`- 以降の数値（Left/Top/Width/Height）は、JSONの値に従って px または % として入力してください。\n\n` +
dynamicSections + '\n\n' +
`## キャンペーン/スケジュール手順\n` +
`1) （任意）メインメニュー > キャンペーン > 追加 > 上記で作成したレイアウト（Landscape/Portrait）を追加\n` +
`2) スケジュール: メインメニュー > スケジュール > 追加\n` +
`   - 対象: ディスプレイ/ディスプレイグループ\n` +
`   - コンテンツ: 作成済みレイアウト（Landscape/Portrait）\n` +
`   - 期間: 開始/終了日時、曜日/時間帯（必要に応じて繰り返し）\n\n` +
`## 検証チェックリスト\n` +
`- プレビューで各リージョンの座標/サイズが JSON と一致している\n` +
`- ウィジェットのオプション（背景色/文字色/フォント/サイズ/整列/ループ/ミュート等）が反映されている\n` +
`- スケジュール後の対象ディスプレイで意図通り表示される\n\n` +
`---\n` +
`補足: 生成レイアウトJSONは設計の参考であり、直接インポート用のファイルではありません。実装環境に合わせて名称や細部を調整してください。`;

      await fs.writeFile(guidePath, md, 'utf-8');
      return {
        success: true as const,
        campaignBaseName,
        planMarkdown,
        planMarkdownPath,
        planJsonPath,
        xiboLayoutPaths,
        buildGuidePath: guidePath,
      };
    },
  }),
  createStep({
    id: 'render-schedule-chart',
    // Overview: Render weekly schedule chart (PNG). Y=24h (top->bottom), X=Mon..Sun. Highlight scheduled windows.
    inputSchema: z.object({
      success: z.literal(true),
      campaignBaseName: z.string(),
      planMarkdown: z.string(),
      planMarkdownPath: z.string().optional(),
      planJsonPath: z.string().optional(),
      xiboLayoutPaths: z.array(z.string()),
    }),
    outputSchema: z.object({
      success: z.literal(true),
      campaignBaseName: z.string(),
      planMarkdown: z.string(),
      planMarkdownPath: z.string().optional(),
      planJsonPath: z.string().optional(),
      xiboLayoutPaths: z.array(z.string()),
      scheduleChartPaths: z.array(z.string()),
    }),
    execute: async ({ inputData }) => {
      const { campaignBaseName, xiboLayoutPaths, planMarkdown, planMarkdownPath, planJsonPath } = inputData as any;
      const outDir = path.join(config.generatedDir, 'signage-ads');
      await fs.mkdir(outDir, { recursive: true });

      const outPaths: string[] = [];
      const days = ['Mon','Tue','Wed','Thu','Fri','Sat','Sun'];
      const emitted = new Set<string>();
      try {
        const { createCanvas } = await import('canvas');
        for (const layoutPath of xiboLayoutPaths) {
          try {
            const raw = await fs.readFile(layoutPath, 'utf-8');
            const j = JSON.parse(raw);
            const schedule = j?.schedule || {};
            const times = Array.isArray(schedule.times) ? schedule.times : [];
            const targetDays = Array.isArray(schedule.daysOfWeek) && schedule.daysOfWeek.length ? schedule.daysOfWeek : days;

            // Canvas sizing and helpers
            const colWidth = 120;
            const leftPad = 60;
            const rightPad = 30;
            const topPad = 40;
            const bottomPad = 40;
            const chartW = leftPad + days.length * colWidth + rightPad;
            const chartH = 900; // 24h scale
            const chartAreaH = chartH - topPad - bottomPad;
            const hourToY = (h: number, m: number) => topPad + ((h + m/60) / 24) * chartAreaH;

            const canvas = createCanvas(chartW, chartH);
            const ctx = canvas.getContext('2d');
            ctx.fillStyle = '#ffffff';
            ctx.fillRect(0, 0, chartW, chartH);

            // Title
            ctx.fillStyle = '#0a0a0a';
            ctx.font = 'bold 18px sans-serif';
            ctx.fillText(`${campaignBaseName} - Weekly Schedule`, 16, 28);

            // Baseline (left)
            ctx.strokeStyle = 'rgba(0,0,0,0.25)';
            ctx.lineWidth = 1.5;
            ctx.beginPath(); ctx.moveTo(leftPad, topPad); ctx.lineTo(leftPad, chartH - bottomPad); ctx.stroke();

            // Hour grid (every hour; thicker at 0,6,12,18,24)
            ctx.font = '12px sans-serif';
            ctx.fillStyle = '#444';
            for (let h = 0; h <= 24; h++) {
              const y = hourToY(h, 0);
              ctx.strokeStyle = (h % 6 === 0) ? 'rgba(0,0,0,0.35)' : 'rgba(0,0,0,0.20)';
              ctx.lineWidth = (h % 6 === 0) ? 2 : 1;
              ctx.beginPath(); ctx.moveTo(leftPad, y); ctx.lineTo(chartW - rightPad, y); ctx.stroke();
              if (h % 3 === 0) ctx.fillText(`${String(h).padStart(2,'0')}:00`, 6, y + 4);
            }

            // Day columns background & labels
            ctx.fillStyle = '#0a0a0a';
            ctx.font = '12px sans-serif';
            days.forEach((d, idx) => {
              const cx = leftPad + idx * colWidth + colWidth / 2;
              ctx.textAlign = 'center';
              ctx.fillText(d, cx, chartH - 12);
            });
            for (let i = 0; i < days.length; i++) {
              const x0 = leftPad + i * colWidth + 8;
              const w = colWidth - 16;
              ctx.fillStyle = i % 2 === 0 ? 'rgba(0,0,0,0.02)' : 'rgba(0,0,0,0.04)';
              ctx.fillRect(x0, topPad, w, chartAreaH);
            }

            // Scheduled windows per active day (split bar: left=landscape, right=portrait)
            const activeDay = new Set<string>(targetDays.map((s: string) => String(s)));
            const colorLand = 'rgba(33,150,243,0.65)'; // blue
            const colorPort = 'rgba(255,152,0,0.65)';  // orange
            // Determine which orientations exist in this run
            const hasLandscape = xiboLayoutPaths.some((p: string) => /\.landscape\.xibo-layout\.json$/i.test(p));
            const hasPortrait  = xiboLayoutPaths.some((p: string) => /\.portrait\.xibo-layout\.json$/i.test(p));
            for (let i = 0; i < days.length; i++) {
              const day = days[i];
              if (!activeDay.has(day)) continue;
              const x0 = leftPad + i * colWidth + 14;
              const w = colWidth - 28;
              const half = Math.max(2, Math.floor(w / 2) - 1);
              const xLand = x0;
              const xPort = x0 + w - half;
              for (const t of times) {
                const [sh, sm] = String(t.start || '00:00').split(':').map((n: string) => parseInt(n, 10) || 0);
                const [eh, em] = String(t.end || '00:00').split(':').map((n: string) => parseInt(n, 10) || 0);
                const y0 = hourToY(sh, sm);
                const y1 = hourToY(eh, em);
                const h = Math.max(2, y1 - y0);
                if (hasLandscape) {
                  ctx.fillStyle = colorLand; ctx.fillRect(xLand, y0, half, h);
                  ctx.strokeStyle = 'rgba(0,0,0,0.25)'; ctx.lineWidth = 1; ctx.strokeRect(xLand, y0, half, h);
                }
                if (hasPortrait) {
                  ctx.fillStyle = colorPort; ctx.fillRect(xPort, y0, half, h);
                  ctx.strokeStyle = 'rgba(0,0,0,0.25)'; ctx.lineWidth = 1; ctx.strokeRect(xPort, y0, half, h);
                }
              }
            }

            const outPng = path.join(outDir, `${campaignBaseName}.weekly-schedule.png`);
            if (!emitted.has(outPng)) {
              await fs.writeFile(outPng, canvas.toBuffer('image/png'));
              emitted.add(outPng);
              outPaths.push(outPng);
            }
          } catch {}
        }
      } catch {}

      return {
        success: true as const,
        campaignBaseName,
        planMarkdown,
        planMarkdownPath,
        planJsonPath,
        xiboLayoutPaths,
        scheduleChartPaths: outPaths,
      };
    },
  }),
])
.then(createStep({
  id: 'finalize-results',
  // Overview: Aggregate parallel outputs and return unified result.
  inputSchema: z.object({
    'render-layout-mockups-landscape': z.object({
      success: z.literal(true),
      campaignBaseName: z.string(),
      planMarkdown: z.string(),
      planMarkdownPath: z.string().optional(),
      planJsonPath: z.string().optional(),
      xiboLayoutPaths: z.array(z.string()),
      mockImagePaths: z.array(z.string()),
    }),
    'render-layout-mockups-portrait': z.object({
      success: z.literal(true),
      campaignBaseName: z.string(),
      planMarkdown: z.string(),
      planMarkdownPath: z.string().optional(),
      planJsonPath: z.string().optional(),
      xiboLayoutPaths: z.array(z.string()),
      mockImagePaths: z.array(z.string()),
    }),
    'render-region-timeline': z.object({
      success: z.literal(true),
      campaignBaseName: z.string(),
      planMarkdown: z.string(),
      planMarkdownPath: z.string().optional(),
      planJsonPath: z.string().optional(),
      xiboLayoutPaths: z.array(z.string()),
      regionTimelinePaths: z.array(z.string()),
    }),
    'write-xibo-build-guide': z.object({
      success: z.literal(true),
      campaignBaseName: z.string(),
      planMarkdown: z.string(),
      planMarkdownPath: z.string().optional(),
      planJsonPath: z.string().optional(),
      xiboLayoutPaths: z.array(z.string()),
      buildGuidePath: z.string(),
    }),
    'render-schedule-chart': z.object({
      success: z.literal(true),
      campaignBaseName: z.string(),
      planMarkdown: z.string(),
      planMarkdownPath: z.string().optional(),
      planJsonPath: z.string().optional(),
      xiboLayoutPaths: z.array(z.string()),
      scheduleChartPaths: z.array(z.string()),
    }),
  }),
  outputSchema: z.object({
    success: z.literal(true),
    campaignBaseName: z.string(),
    planMarkdownPath: z.string().optional(),
    planJsonPath: z.string().optional(),
    planMarkdown: z.string(),
    xiboLayoutPaths: z.array(z.string()).optional(),
    mockImagePaths: z.array(z.string()).optional(),
    buildGuidePath: z.string().optional(),
    regionTimelinePaths: z.array(z.string()).optional(),
    scheduleChartPaths: z.array(z.string()).optional(),
  }),
  execute: async ({ inputData }) => {
    const ml = (inputData as any)['render-layout-mockups-landscape'];
    const mp = (inputData as any)['render-layout-mockups-portrait'];
    const t = (inputData as any)['render-region-timeline'];
    const g = (inputData as any)['write-xibo-build-guide'];
    const s = (inputData as any)['render-schedule-chart'];
    const campaignBaseName: string = String(ml.campaignBaseName || mp.campaignBaseName || '');
    const planMarkdownPath: string | undefined = ml.planMarkdownPath || mp.planMarkdownPath;
    const planJsonPath: string | undefined = ml.planJsonPath || mp.planJsonPath;
    const planMarkdown: string = String(ml.planMarkdown || mp.planMarkdown || '');
    const xiboLayoutPaths: string[] | undefined = (ml.xiboLayoutPaths && ml.xiboLayoutPaths.length
      ? [...ml.xiboLayoutPaths]
      : (mp.xiboLayoutPaths ? [...mp.xiboLayoutPaths] : undefined));
    const mockImagePaths: string[] = ([] as string[])
      .concat(ml.mockImagePaths || [])
      .concat(mp.mockImagePaths || []);
    const buildGuidePath: string | undefined = g.buildGuidePath;
    const regionTimelinePaths: string[] | undefined = t.regionTimelinePaths ? [...t.regionTimelinePaths] : undefined;
    const scheduleChartPaths: string[] | undefined = s.scheduleChartPaths ? [...s.scheduleChartPaths] : undefined;

    return {
      success: true as const,
      campaignBaseName,
      planMarkdownPath,
      planJsonPath,
      planMarkdown,
      xiboLayoutPaths,
      mockImagePaths,
      buildGuidePath,
      regionTimelinePaths,
      scheduleChartPaths,
    };
  },
}))
.commit();

