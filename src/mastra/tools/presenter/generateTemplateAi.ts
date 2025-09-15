/*
 * Copyright (C) 2025 Open Source Digital Signage Initiative.
 */
import { createTool } from '@mastra/core/tools';
import { z } from 'zod';
import { logger } from '../../logger';
import path from 'path';
import { promises as fs } from 'fs';
import { config } from '../xibo-agent/config';
import { summarizeAndAnalyzeTool } from '../market-research/summarizeAndAnalyze';
import { parseJsonStrings } from '../xibo-agent/utility/jsonParser';

const inputSchema = z.object({
  fileName: z.string().optional().describe('New template filename (default: aiGenerated.json)'),
  stylePreset: z.enum(['minimal','brutalist','editorial','neo_brutalism','glassmorphism','material','corporate_modern']).optional().describe('High-level style direction for the template'),
  
});
const successSchema = z.object({ success: z.literal(true), data: z.object({ filePath: z.string() }) });
const errorSchema = z.object({ success: z.literal(false), message: z.string() });

export const generateTemplateAiTool = createTool({
  id: 'generate-template-ai',
  description: 'Generate a new presentation template JSON via AI using default.json and README.md as guidance.',
  inputSchema,
  outputSchema: z.union([successSchema, errorSchema]),
  execute: async ({ context }) => {
    // Simple in-process lock to prevent overlapping generations
    // Note: per-process only; scale-out requires external lock.
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const g: any = global as any;
    if (g.__GEN_TPL_RUNNING__) {
      logger.warn('Template generation skipped: another run is in progress.');
      return { success: false, message: 'Another generation is in progress. Please retry shortly.' } as const;
    }
    g.__GEN_TPL_RUNNING__ = true;
    try {
    const fileNameIn = (context as any)?.fileName as (string|undefined);
    const stylePresetIn = (context as any)?.stylePreset as (string|undefined);
    
    
    const outName = (fileNameIn && fileNameIn.trim()) ? fileNameIn.trim() : 'aiGenerated.json';
    const templatesDir = path.join(config.projectRoot, 'persistent_data', 'presentations', 'templates');
    const readmePath = path.join(templatesDir, 'README.md');
    const outPath = path.join(templatesDir, outName);
    
    // Disallow overwriting base template
    if (outName.trim().toLowerCase() === 'default.json') {
      logger.warn({ requested: outName }, 'Refusing to overwrite base template default.json. Choose another fileName.');
      return { success: false, message: 'fileName "default.json" is not allowed. Please choose another name.' } as const;
    }
      const runId = `tpl-${Date.now()}-${Math.floor(Math.random()*1e6)}`;
      logger.info({ runId, outName }, 'Generating template JSON via AI...');
      
      // Cross-process file lock (prevents overlapping runs across restarts/processes)
      const lockPath = path.join(templatesDir, '.generateTemplate.lock');
      await fs.mkdir(templatesDir, { recursive: true }).catch(()=>{});
      try {
        const cur = await fs.readFile(lockPath, 'utf-8').catch(()=>null);
        let curObj: any = null; try { curObj = cur ? JSON.parse(cur) : null; } catch {}
        if (curObj && Number(curObj.expiresAt) > Date.now()) {
          logger.warn({ runId, holder: curObj.runId }, 'Another template generation is active (file lock). Returning last output if available.');
          const lastOut = typeof curObj.outPath === 'string' ? curObj.outPath : outPath;
          const exists = await fs.stat(lastOut).then(()=>true).catch(()=>false);
          if (exists) return { success: true, data: { filePath: lastOut } } as const;
          return { success: false, message: 'Another generation is in progress.' } as const;
        }
        await fs.writeFile(lockPath, JSON.stringify({ runId, outPath, expiresAt: Date.now() + 180000 }), 'utf-8');
      } catch (lockErr) {
        // If lock cannot be obtained, continue without strict locking
        logger.warn({ runId }, 'Lock setup failed; continuing without hard lock.');
      }
      const [readmeRaw] = await Promise.all([
        fs.readFile(readmePath, 'utf-8').catch(() => Promise.resolve('')),
      ]);
      logger.info({ runId, readmeFound: !!readmeRaw }, 'Loaded README guide for template generation.');

      // Build strict objective for the AI
      const variation = 'low';
      const temperature = 0.35;
      const preset = stylePresetIn || 'corporate_modern';
      
      // Placeholder for legacy templates that referenced this variable inside prompt strings
      const requireLayoutsChangedCount = 0;
      const objective = `あなたはテンプレート設計の専門家です。設計ガイド(README.md)のみを根拠に、
新しい PowerPoint プレゼンテンプレート(JSON)を1つ出力してください。出力は純粋なJSONのみ（前後に説明文やコードブロックを付けない）。

必須要件（最小ではなく“完成度の高い”テンプレートを生成）:
- JSON整合: 有効なJSONであること（コメント不可、末尾カンマ不可）
- 単位: すべてインチ(in)。geometry.regionDefsでサイズのみ定義し、layouts.<layout>.areasでx/yとref参照を行う
- カラー: #RRGGBB / #RRGGBBAA / rgba() 対応（アルファは transparency へマップ前提）
- 影: tokens.shadowPresets と style.shadow（プリセット名 or オブジェクト）を定義/参照可能
- レイアウト: 次の“すべて”に elements を用意（固定描画に依存しない）
  - title_slide, section_header, content_only, content_with_visual, content_with_bottom_visual, quote,
    visual_hero_split, comparison_cards, checklist_top_bullets_bottom, company_about
- elements: 各レイアウトに shape/text を含む。visual領域を持つレイアウトは type:"visual" を含む。tableを用いるレイアウト（company_about など）は type:"table" を含む。
- areaStyles/visualStyles: bullets 背景（alpha色）、タイトル帯の影、文字影、charts.colors/legend を定義
 - areaStyles/visualStyles: bullets 背景（alpha色）、タイトル帯の影、文字影、charts.colors/legend を定義
 - company_about の table は style トークンを用いて定義（例: labelFill, valueFill, altRowFill, valueColor, borderColor, colW）。altRowFill は“行全体”の交互塗りに使うこと
- geometry.regionDefs: 再利用サイズを複数定義（例: titleBar, twoColText, twoColVisual, bottomBand, topPanel, rightPanel, heroImage, card など）
- layouts.*.areas: 各レイアウトで x/y と ref を記述し、複数の配置パターンが“明確に”異なるように設計
- rules.aiColorPolicy を含める（template|prefer_ai|ai_overrides|disabled のいずれか）。titleBarColor は任意

厳格な整合性ルール（実行環境に適合させるため“必須”）:
- elements[].area は必ず layouts.<layout>.areas に存在するキーのみを参照する（未定義のarea名は使用禁止）
- elements[].contentRef は次のみを使用する: "title" | "bullets" | "special_content"（quote用）| "companyOverview"（company_aboutのtable用）
  - title_slide の小見出しは contentRef:"bullets" を使用する（"subtitle"は使用しない）
- elements[].type:"visual" を含める場合、必ず recipeRef:"visual_recipe" を指定する（これ以外のキーは禁止）
- styleRef はテンプレ内の有効パスのみ使用する（例: "areaStyles.titleBar", "components.title"）。存在しないパスは使用禁止
- quote レイアウトは原則 visual を含めない（recipeが無い visual は出力しない）
 - table の色指定にはテーマトークン使用可: primary/secondary/white/black/primaryLight/primaryLighter/primaryUltraLight/secondaryLight/secondaryLighter/secondaryUltraLight

多様性・差別化のための必須指針:
- 配色: tokens.primary/secondary/accent/palette/gradients を stylePreset に沿って刷新（“最小例”は厳禁）
- タイポ: typography.sizes/lineHeights を用意して可読性の差を付ける
- 形状/影: cornerRadius/outlineColor/shadowPresets を設計（soft/strong などの差を付ける）
- 構造: regionDefs と layouts.*.areas を積極的に変化させ、各レイアウトの“見た目や余白リズム”が一目で異なるようにする
- elements: checklist はアイコン感の出る構成（角丸パネル/チェックマーク風）、comparison は2カラムのカード化、title_slide は半透明帯＋文字影など、各レイアウトの個性を出す
- 禁止: “極小・最小”テンプレ（content_onlyだけ／elementsほぼ空／パレット未設計）は不可

多様性を強制する追加要件（ここを必ず満たす）:
- stylePreset は以下から1つを必ず選択（glassmorphismは禁止）: brutalist | monochrome_accent | editorial_serif | neon_dark | warm_pastel | techno_grid
- 主要レイアウトで少なくとも3つは“構造差分”を導入（例）
  1) title_bar を縦帯（左/右）に変更、2) content_with_visual を上下分割ではなく重ね合わせ(overlay)構成、
  3) comparison をカードではなくストライプ/ボーダー構成 など
- 角丸は最小限: 基本は shapeType:"rect" + rectRadius<=0.12。必要箇所（KPIなど）のみ軽度の角丸
- 背景モチーフ: 斜め帯/下線ストローク/半透明パネル等の“明確なモチーフ”を title_slide 以外にも1つ以上導入
- charts.colors は stylePreset に応じて彩度/明度レンジを“明確に”変える（既存配色の微差は不可）

スタイル指示（stylePreset=${preset}）:
- minimal: 余白多め / 薄い色 / シャドウ弱め / 幾何学
- brutalist/neo_brutalism: 強いコントラスト / 太い線 / 角を立てる / 高めの影
- editorial: タイポ強調 / 余白リズム / セリフ/サンセリフの対比
- glassmorphism: 半透明パネル / ぼかしを想起させる色（#RRGGBBAA）を増やす
- material/corporate_modern: マテリアル準拠 / カードと影の整合 / ブランド配色

AI主導カラー適用の推奨:
- rules.aiColorPolicy は "ai_overrides" を強く推奨（未指定時は ai_overrides を設定）。AIの themeColor1/2 を優先的に活用する

出力JSONのヒント（網羅的に定義）:
- tokens: primary/secondary/accent/neutral/surface/textPrimary/border/cornerRadius/outlineColor/spacingBaseUnit/shadowPresets/palette/gradients
- typography: fontFamily/lineHeights/sizes
- geometry: page/margins/contentTopY/contentWidth/regionDefs
- areaStyles: titleBar/bullets
- visualStyles: type別のshadowやcharts.colors/legend
- layouts: 各レイアウトのtitleBar.color, areas, elements

狙い:
- README方針に準拠しつつ、配色・余白・カード/帯・影・配置・要素構成の各面で“大胆に差別化”されたテンプレートを生成すること。
- 出力は“最小”ではなく、そのまま使っても視覚的に個性あるスライド一式が得られる水準にする。`;

      const corpus = `# README.md\n${readmeRaw}`;
      // Single fast attempt to avoid long retries; immediate fallback if invalid
      const tries = 2;
      const candidates: any[] = [];
      // Each attempt timeout (portion of overall timeout)
      

      for (let i = 0; i < tries; i++) {
        logger.info({ runId, try: i+1, tries, temperature, preset: stylePresetIn || 'default' }, 'Invoking Designer AI for template candidate...');
        const aiRes: any = await summarizeAndAnalyzeTool.execute({ context: { text: corpus, objective, temperature, topP: 0.9 } } as any).catch((e:any)=>({ success:false, message:String(e) }));
        if (!aiRes.success) continue;
        const cand = parseJsonStrings(aiRes.data?.summary ?? '') as any;
        if (cand && typeof cand === 'object' && cand.layouts && typeof cand.layouts === 'object') {
          candidates.push(cand);
          logger.info({ runId, candidates: candidates.length }, 'Accepted a candidate from AI.');
        }
      }
      if (!candidates.length) {
        logger.warn({ runId }, 'No valid candidates produced by AI. Falling back to minimal README-based template.');
        const minimalTemplate = {
          units: 'in',
          tokens: { primary: '#0B5CAB', secondary: '#00B0FF', accent: '#FFC107', shadowPreset: 'soft' },
          typography: { fontFamily: { head: 'Noto Sans JP', body: 'Noto Sans JP' } },
          geometry: { page: { width: 13.33, height: 7.5 }, regionDefs: { titleBar: { w: 12.13, h: 0.6 }, bulletsFull: { w: 12.13, h: 4.0 } } },
          areaStyles: { titleBar: { height: 0.6 } },
          rules: { titleBarColor: 'fixed', aiColorPolicy: 'prefer_ai' },
          layouts: {
            content_only: {
              titleBar: { color: '#0B5CAB' },
              areas: { title: { ref: 'titleBar', x: 0.6, y: 0.6 }, bullets: { ref: 'bulletsFull', x: 0.6, y: 1.45 } },
              elements: [
                { type: 'shape', area: 'title', styleRef: ['areaStyles.titleBar'], style: { shapeType: 'rect' } },
                { type: 'text', area: 'title', contentRef: 'title' },
                { type: 'text', area: 'bullets', contentRef: 'bullets', style: { fontSize: 18, bullet: true, autoFit: true } }
              ]
            }
          },
          branding: { reservedBottom: 0.8 }
        };
        candidates.push(minimalTemplate as any);
      }

      // Select best candidate without referencing default.json
      const best = candidates[0];
      logger.info({ runId, candidateCount: candidates.length }, 'Selected template candidate.');

      // Overwrite if the file already exists
      try {
        await fs.mkdir(templatesDir, { recursive: true });
      } catch (e) {}
      const pretty = JSON.stringify(best, null, 2);
      await fs.writeFile(outPath, pretty, 'utf-8');
      logger.info({ runId, outPath }, 'AI template generated and saved.');
      logger.info({ runId }, 'Template generation complete.');
      
      return { success: true, data: { filePath: outPath } } as const;
    } catch (e: any) {
      const message = e?.message ? String(e.message) : 'Unknown error';
      return { success: false, message } as const;
    } finally {
      // release lock
      const gg: any = global as any; gg.__GEN_TPL_RUNNING__ = false;
      try {
        const templatesDirFin = path.join(config.projectRoot, 'persistent_data', 'presentations', 'templates');
        const lockFin = path.join(templatesDirFin, '.generateTemplate.lock');
        await fs.unlink(lockFin).catch(()=>{});
      } catch {}
    }
  }
});

