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
import { logger } from '../../logger';
import { summarizeAndAnalyzeTool } from '../../tools/market-research/summarizeAndAnalyze';
import { contentScrapeTool } from '../../tools/market-research/contentScrape';
import { generateChartTool, createPowerpointTool } from '../../tools/presenter';
import { parseJsonStrings } from '../../tools/xibo-agent/utility/jsonParser';
import { promises as fs } from 'fs';
import path from 'path';
import { config } from '../../tools/xibo-agent/config';

// --- Helper Functions and Schemas ---

const hexColorSchema = z.string().regex(/^#[0-9a-fA-F]{6}$/, "Must be a valid 6-digit hex color code (e.g., #RRGGBB)");
const styleColorSchema = z.union([
  // 6-digit hex with optional '#'
  z.string().regex(/^#?[0-9a-fA-F]{6}$/),
  // 3-digit hex with optional '#'
  z.string().regex(/^#?[0-9a-fA-F]{3}$/),
  // 8-digit hex (ARGB/RGBA) with optional '#'
  z.string().regex(/^#?[0-9a-fA-F]{8}$/),
  // rgb()/rgba() CSS-like colors
  z.string().regex(/^rgba?\(\s*\d{1,3}\s*,\s*\d{1,3}\s*,\s*\d{1,3}(?:\s*,\s*(?:0|1|0?\.\d+))?\s*\)$/i),
  // simple named colors
  z.string().regex(/^[a-zA-Z]+$/),
  // transparent / none sentinel values
  z.literal('transparent'),
  z.literal('none'),
]);

/**
 * Defines the structure for a single slide's design, as determined by the design AI.
 */
const visualRecipeKpiSchema = z.object({
  type: z.literal('kpi'),
  items: z.array(z.object({ label: z.string(), value: z.string(), icon: z.string().optional() })).min(1),
});
const visualRecipeKpiGridSchema = z.object({
  type: z.literal('kpi_grid'),
  items: z.array(z.object({ label: z.string(), value: z.string(), icon: z.string().optional() })).min(1),
});
const visualRecipeComparisonSchema = z.object({
  type: z.literal('comparison'),
  a: z.object({ label: z.string(), value: z.string() }),
  b: z.object({ label: z.string(), value: z.string() }),
});
const visualRecipeTimelineSchema = z.object({
  type: z.literal('timeline'),
  steps: z.array(z.object({ label: z.string() })).min(2),
});
const visualRecipeMatrixSchema = z.object({
  type: z.literal('matrix'),
  axes: z.object({ xLabels: z.tuple([z.string(), z.string()]), yLabels: z.tuple([z.string(), z.string()]) }),
  items: z.array(z.object({ x: z.number().min(0).max(1), y: z.number().min(0).max(1), label: z.string() })).optional(),
});
const visualRecipeFunnelSchema = z.object({
  type: z.literal('funnel'),
  steps: z.array(z.object({ label: z.string(), value: z.string().optional() })).min(2),
});
const visualRecipeProcessSchema = z.object({
  type: z.literal('process'),
  steps: z.array(z.object({ label: z.string() })).min(2),
});
const visualRecipeRoadmapSchema = z.object({
  type: z.literal('roadmap'),
  milestones: z.array(z.object({ label: z.string(), date: z.string().optional() })).min(2),
});
const visualRecipeKpiDonutSchema = z.object({
  type: z.literal('kpi_donut'),
  items: z.array(z.object({ label: z.string(), value: z.number().min(0).max(100) })).min(1),
});
const visualRecipeProgressSchema = z.object({
  type: z.literal('progress'),
  items: z.array(z.object({ label: z.string(), value: z.number().min(0).max(100) })).min(1),
});
const visualRecipeGanttSchema = z.object({
  type: z.literal('gantt'),
  tasks: z.array(z.object({ label: z.string(), start: z.string(), end: z.string() })).min(1),
});
const visualRecipeHeatmapSchema = z.object({
  type: z.literal('heatmap'),
  x: z.array(z.string()).min(1),
  y: z.array(z.string()).min(1),
  z: z.array(z.array(z.number())),
});
const visualRecipeVenn2Schema = z.object({
  type: z.literal('venn2'),
  a: z.object({ label: z.string(), size: z.number().min(0) }),
  b: z.object({ label: z.string(), size: z.number().min(0) }),
  overlap: z.number().min(0),
});
const visualRecipePyramidSchema = z.object({
  type: z.literal('pyramid'),
  steps: z.array(z.object({ label: z.string(), value: z.number().optional() })).min(2),
});
const visualRecipeWaterfallSchema = z.object({
  type: z.literal('waterfall'),
  items: z.array(z.object({ label: z.string(), delta: z.number() })).min(1),
});
const visualRecipeBulletSchema = z.object({
  type: z.literal('bullet'),
  items: z.array(z.object({ label: z.string(), value: z.number(), target: z.number() })).min(1),
});
const visualRecipeMapMarkersSchema = z.object({
  type: z.literal('map_markers'),
  markers: z.array(z.object({ label: z.string(), x: z.number().min(0).max(1), y: z.number().min(0).max(1) })).min(1),
});
const visualRecipeCalloutsSchema = z.object({
  type: z.literal('callouts'),
  items: z.array(z.object({ label: z.string(), value: z.string().optional(), icon: z.string().optional() })).min(1),
});

// Simple flexible schema for line charts
const visualRecipeLineChartSchema = z.object({
  type: z.literal('line_chart'),
  labels: z.array(z.string()).optional(),
  series: z.array(z.object({ name: z.string().optional(), data: z.array(z.number()) })).optional(),
});
const visualRecipeBarChartSchema = z.object({
  type: z.literal('bar_chart'),
  labels: z.array(z.string()).optional(),
  series: z.array(z.object({ name: z.string().optional(), data: z.array(z.number()) })).optional(),
  values: z.array(z.number()).optional(),
});
const visualRecipePieChartSchema = z.object({
  type: z.literal('pie_chart'),
  items: z.array(z.object({ label: z.string(), value: z.number() })).optional(),
  labels: z.array(z.string()).optional(),
  values: z.array(z.number()).optional(),
});

const visualRecipeTableSchema = z.object({
  type: z.literal('table'),
  headers: z.array(z.string()).optional(),
  rows: z.array(z.array(z.union([z.string(), z.number()]).transform(v=>String(v)))).min(1),
});

const visualRecipeStrictSchema = z.union([
  visualRecipeKpiSchema,
  visualRecipeKpiGridSchema,
  visualRecipeComparisonSchema,
  visualRecipeTimelineSchema,
  visualRecipeMatrixSchema,
  visualRecipeFunnelSchema,
  visualRecipeProcessSchema,
  visualRecipeRoadmapSchema,
  visualRecipeLineChartSchema,
  visualRecipeBarChartSchema,
  visualRecipePieChartSchema,
  visualRecipeKpiDonutSchema,
  visualRecipeProgressSchema,
  visualRecipeGanttSchema,
  visualRecipeHeatmapSchema,
  visualRecipeVenn2Schema,
  visualRecipePyramidSchema,
  visualRecipeWaterfallSchema,
  visualRecipeBulletSchema,
  visualRecipeMapMarkersSchema,
  visualRecipeCalloutsSchema,
  visualRecipeTableSchema,
]);

// Fallback: accept unknown recipe shapes to avoid hard-failing template slides; renderer will noop safely
const visualRecipeSchema = visualRecipeStrictSchema.or(z.object({ type: z.string().optional() }).passthrough());

const freeformElementSchema = z.object({
  type: z.enum([
    'title','text','bullets','image','shape','quote',
    // infographic primitives allowed in freeform elements
    'kpi','kpi_grid','comparison','timeline','matrix','funnel','process','roadmap','kpi_donut','progress','gantt','heatmap','venn2','pyramid','waterfall','bullet','map_markers','callouts','line_chart','bar_chart','pie_chart','checklist','visual_recipe'
  ]).describe('Element kind'),
  bbox: z.object({ x: z.number(), y: z.number(), w: z.number(), h: z.number() }).describe('Absolute inches within 16:9 slide'),
  z: z.number().optional(),
  content: z.any().optional(),
  style: z.object({
    fontSize: z.number().optional(),
    color: styleColorSchema.optional(),
    bg: styleColorSchema.optional(),
    cornerRadius: z.number().optional(),
    shadow: z.enum(['none','soft','strong']).optional(),
    align: z.enum(['left','center','right']).optional(),
    sizing: z.enum(['cover','contain']).optional(),
  }).optional(),
});

const slideDesignSchema = z.object({
  title: z.string().describe("The main title of the slide."),
  layout: z.enum(['title_slide', 'section_header', 'content_with_visual', 'content_with_bottom_visual', 'content_only', 'quote', 'visual_hero_split', 'comparison_cards', 'checklist_top_bullets_bottom'])
    .describe("The layout type for the slide."),
  bullets: z.array(z.string()).describe("A list of key bullet points for the slide."),
  visual_suggestion: z.enum(['bar_chart', 'pie_chart', 'line_chart', 'none']).describe("The suggested type of visual for the slide."),
  context_for_visual: z.string().describe("The specific topic or data context from the report needed to create the visual."),
  special_content: z.string().optional().nullable().describe("Special content for layouts like 'quote'."),
  visual_recipe: visualRecipeSchema.optional().nullable().describe("Optional infographic recipe for shapes/icons/timelines/etc."),
  accent_color: hexColorSchema.optional().describe("Optional per-slide accent color (e.g. for title bar), 6-digit hex."),
  slide_style: z.object({
    title_bar_variant: z.enum(['solid','underline','none']).optional(),
    density: z.enum(['compact','normal','airy']).optional(),
  }).optional().describe("Optional per-slide style directives for title bar rendering and content density."),
  elements: z.array(freeformElementSchema).optional().describe('When layout is freeform, render these elements instead of template.'),
});
type SlideDesign = z.infer<typeof slideDesignSchema>;

/**
 * Defines the structure for chart data, to be generated by the analyst AI.
 */
const chartDataSchema = z.object({
    chart_type: z.enum(['bar', 'pie', 'line']),
    title: z.string(),
    labels: z.array(z.string()),
    data: z.array(z.number()),
});
type ChartData = z.infer<typeof chartDataSchema>;

const successOutputSchema = z.object({
    success: z.literal(true),
    data: z.object({
        fileName: z.string(),
        googleSlidesLink: z.string().optional(),
    }),
});
const errorOutputSchema = z.object({
    success: z.literal(false),
    message: z.string(),
});
const finalOutputSchema = z.union([successOutputSchema, errorOutputSchema]);


// --- Workflow Definition ---

/**
 * @workflow intelligent-presenter-workflow
 * This workflow automates the creation of a PowerPoint presentation from a given markdown report.
 * It follows a multi-step process involving several AI agents:
 * 1. Read Report: Reads the source markdown file.
 * 2. Design Presentation: An AI designs the slide structure and theme.
 * 3. Generate Content: AIs generate speech notes and data for charts. (Title background image is generated in parallel here.)
 * 4. Generate Visuals: The system creates chart images from the data.
 * 5. Assemble Outputs: All components are combined into a final .pptx file.
 */
export const intelligentPresenterWorkflow = createWorkflow({
  id: 'intelligent-presenter-workflow',
  description: 'Generates a PowerPoint presentation with speaker notes from a markdown report file.',
  inputSchema: z.object({
    reportFileName: z.string().describe('The name of the report file located in persistent_data/reports.'),
    fileNameBase: z.string().optional().describe('The base name for the output files. Defaults to the report file name.'),
    companyName: z.string().optional().describe('Optional company name to load info from persistent_data/companies_info/<companyName>'),
    templateName: z.string().optional().describe('Template JSON filename under persistent_data/presentations/templates (default: default.json)')
  }),
  outputSchema: finalOutputSchema,
})
.then(createStep({
    /**
     * @step read-report-file
     * Reads the content of the specified report file from the 'reports' directory.
     * If the file cannot be read, it forwards an error message to the next step.
     */
    id: 'read-report-file',
    inputSchema: z.object({
        reportFileName: z.string(),
        fileNameBase: z.string().optional(),
        companyName: z.string().optional(),
        templateName: z.string().optional(),
    }),
    outputSchema: z.object({
        reportContent: z.string(),
        fileNameBase: z.string(),
        companyName: z.string().optional(),
        errorMessage: z.string().optional(),
        templateName: z.string().optional(),
    }),
    execute: async (params) => {
        const { reportFileName, fileNameBase, companyName } = params.inputData;
        const resolvedFileNameBase = fileNameBase || path.parse(reportFileName).name;
        const filePath = path.join(config.reportsDir, reportFileName);
        logger.info({ filePath, resolvedFileNameBase }, "📄 Reading report file...");
        try {
            await fs.access(filePath);
            const reportContent = await fs.readFile(filePath, 'utf-8');
            return { reportContent, fileNameBase: resolvedFileNameBase, companyName, templateName: (params.inputData as any).templateName };
        } catch (error) {
            const message = `Report file not found or could not be read: ${filePath}`;
            logger.error({ filePath, error }, message);
            return { reportContent: '', fileNameBase: resolvedFileNameBase, companyName, errorMessage: message, templateName: (params.inputData as any).templateName };
        }
    },
}))
.then(createStep({
    /**
     * @step design-presentation
     * Uses an AI to analyze the report content and design the presentation structure.
     * It defines the layout, title, and visual suggestions for each slide, plus a theme.
     * It includes robust parsing to handle various formats of AI-generated JSON.
     */
    id: 'design-presentation',
    inputSchema: z.object({
        reportContent: z.string(),
        fileNameBase: z.string(),
        companyName: z.string().optional(),
        errorMessage: z.string().optional(),
        templateName: z.string().optional(),
    }),
    outputSchema: z.object({
        presentationDesign: z.array(slideDesignSchema),
        reportContent: z.string(),
        fileNameBase: z.string(),
        themeColor1: z.string().describe("The primary theme color for the presentation background gradient."),
        themeColor2: z.string().describe("The secondary theme color for the presentation background gradient."),
        companyName: z.string().optional(),
        errorMessage: z.string().optional(),
        templateConfig: z.any().optional()
    }),
    execute: async (params) => {
        const { reportContent, fileNameBase, errorMessage, companyName } = params.inputData;
        const templateNameIn = (params.inputData as any).templateName as string | undefined;
        const safeTemplateName = (templateNameIn && templateNameIn.trim()) ? templateNameIn.trim() : 'default.json';
        try { logger.info({ templateNameIn, safeTemplateName }, 'Using template for design-presentation'); } catch {}
        if (errorMessage) {
            let templateConfig: any = undefined;
            try {
                const tplPath = path.join(config.projectRoot, 'persistent_data', 'presentations', 'templates', safeTemplateName);
                try { logger.info({ tplPath }, 'Loading template JSON'); } catch {}
                const raw = await fs.readFile(tplPath, 'utf-8');
                templateConfig = JSON.parse(raw);
            } catch {}
            return { presentationDesign: [], reportContent, fileNameBase, companyName, errorMessage, themeColor1: '#F1F1F1', themeColor2: '#CCCCCC', templateConfig };
        }
        
        logger.info("🤖 [Designer AI] Analyzing report and designing presentation structure...");
        let designResult;
        try {
            // Prompt for the Designer AI to create the presentation structure and theme.
            const creativeNote = `デザインモード: template\n- 既存テンプレートと調和する保守的な配色・余白・構図を優先。\n- 使えるレイアウトは 'title_slide' | 'section_header' | 'content_with_visual' | 'content_with_bottom_visual' | 'content_only' | 'quote' のみ。\n- 'elements' のようなレイアウト直描画の構造は使用しない。\n- 見出し・箇条書きは可読性最優先（タイトル<=26文字、箇条書き<=8項目/各<=60文字程度）。\n- visual_recipe は必要に応じて使用可（KPI/比較/タイムライン/プロセス/ロードマップ等）。\n- レイアウト選択規則（厳守）:\n  1) 視覚要素が帯状（process/roadmap/gantt/timeline）で、本文の箇条書きを広く使う場合 → 'content_with_bottom_visual' を使用。\n  2) 右パネルに画像/図を置き、左に箇条書きを置く場合 → 'content_with_visual' を使用。\n  3) 視覚要素が不要または本文のみで十分な場合 → 'content_only' を使用。\n  4) 'content_only' を選ぶ場合で visual_recipe を同時に用いるときは、帯状の可読性を優先し 'content_with_bottom_visual' を選び直すこと。\n- 上記に従って、各スライドの 'layout' と 'visual_recipe' を一貫性のある組で出力すること。`;
            const prompt = `あなたは一流のプレゼンテーション設計者です。以下のレポートを分析し、最適なプレゼン構成案とテーマカラーをJSONで出力してください。
            返却するJSONは、必ず以下のキーを持つオブジェクトです:
            - "theme_colors": { "color1": "#HEXCODE", "color2": "#HEXCODE" } (レポートの雰囲気に合うグラデーション用のテーマカラー2色。必ず6桁の16進数カラーコードで指定してください)
            - "slides": array (スライド構成案の配列)

            スライド構成案の各配列要素は、以下のキーを持つJSONオブジェクトです:
            - "title": string (スライドのタイトル)
            - "layout": 'title_slide' | 'section_header' | 'content_with_visual' | 'content_with_bottom_visual' | 'content_with_image' | 'visual_only' | 'content_only' | 'quote' | 'visual_hero_split' | 'comparison_cards' | 'checklist_top_bullets_bottom' (スライドの役割に応じたレイアウトタイプ)
            - "bullets": string[] (スライドの要点を箇条書きで)
            - "visual_suggestion": 'bar_chart' | 'pie_chart' | 'line_chart' | 'none' (グラフの提案、不要なら'none')
            - "context_for_visual": string (グラフ作成に必要な文脈)
            - "special_content": string (任意。引用レイアウトの場合の引用文など)
            - "visual_recipe": object (任意。以下のいずれかの厳密スキーマで返してください)
            - "accent_color": "#RRGGBB" (任意。タイトル等で強調したい時のアクセントカラー)
            - "slide_style": { "title_bar_variant"?: "solid"|"underline"|"none", "density"?: "compact"|"normal"|"airy" } (任意)
            - 重要: 本ワークフローでは "layout": "freeform" は使用しません。"elements" キーは出力しないでください。
            - レイアウト選択ガイド（厳守）:
                1) content_only: 視覚要素が不要で、本文の要点のみで十分な場合。
                2) content_with_visual: 右側に図・画像・簡潔な可視化（KPI/比較/アイコン列など）を置き、左側に本文（bullets）を配置する二分構成。本文だけで終わらせず、原則ビジュアルを伴うこと。
                3) content_with_bottom_visual: 視覚要素が帯状（process/roadmap/gantt/timeline 等）で、本文の幅を広く使いたい場合。帯は下部に配置。
                4) content_with_image: 左に画像（AI自動生成推奨）、右に本文。画像で雰囲気・事例を見せつつ、右で要点を整理する。
                5) visual_only: ビジュアルを主役にしたい場合に選択。本文は最小限に抑え、画面全体にvisual_recipeや画像を大胆に配置する。
                4) visual_hero_split: 左に大きなビジュアル（写真/抽象背景など）を主役として、右側のパネルにタイトルと簡潔な bullets を置く導入/事例向き。
                5) comparison_cards: 2つの選択肢・プラン・競合比較をカードで並べたい場合（カード内はタイトル＋箇条書き）。
                6) checklist_top_bullets_bottom: checklist のような短文アイテムを上部に大きく見せ、本文の bullets を下部にまとめて補足したい場合。チェックリストと本文が重複する場合は、本文を簡潔に圧縮すること。
                7) quote: スライドの主目的が短い引用文のみで、visual_recipe が不要な場合に限定。
                8) section_header: セクションの切り替え用。本文やビジュアルは持たない。
                9) title_slide: 最初のスライド。タイトルと（必要に応じて）小さめの bullets を配置。
            - 追加規則（ビジュアル優先方針）:
                - 文字列の羅列は避け、極力ビジュアルを伴うレイアウト・recipe を選ぶ。bullets が5行以上、または3項目以上の場合は、必ず何らかの visual_recipe（checklist / callouts / comparison / process / timeline / table など）を提案する。
                - segment列挙やカテゴリ紹介には 'callouts'（アイコンやロゴの利用を推奨）。
                - to-do/要点集約には 'checklist'（必要に応じて 'checklist_top_bullets_bottom' レイアウト）。
                - 比較には 'comparison' または 'comparison_cards'。
                - 手順/流れには 'process'、時系列には 'timeline'。
                - visual_recipe が 'process'|'roadmap'|'gantt'|'timeline' の場合は、本文の可読性を優先して "content_with_bottom_visual" を推奨。
                - visual_recipe が 'checklist' の場合は、"checklist_top_bullets_bottom" を優先。bullets と内容が重複する場合は、bullets を短く要約する。'content_with_visual' は原則避ける。
                - visual_suggestion が 'none' でも、checklist / callouts / comparison / process / timeline / table 等が有効なら積極的に提案する（重複は避ける）。
                1) KPI: { "type": "kpi", "items": [{"label": string, "value": string, "icon"?: string}] }
                2) 比較: { "type": "comparison", "a": {"label": string, "value": string}, "b": {"label": string, "value": string} }
                3) タイムライン: { "type": "timeline", "steps": [{"label": string}, ...] }
                4) マトリクス: { "type": "matrix", "axes": { "xLabels": [string,string], "yLabels": [string,string] }, "items"?: [{"x":0|1, "y":0|1, "label": string}] }
                5) ファネル: { "type": "funnel", "steps": [{"label": string, "value"?: string}, ...] }
                6) プロセス: { "type": "process", "steps": [{"label": string}, ...] }
                7) ロードマップ: { "type": "roadmap", "milestones": [{"label": string, "date"?: string}, ...] }
                8) KPIドーナツ: { "type": "kpi_donut", "items": [{"label": string, "value": number(0-100)}] }
                9) 進捗バー群: { "type": "progress", "items": [{"label": string, "value": number(0-100)}] }
                10) ガント簡易: { "type": "gantt", "tasks": [{"label": string, "start": string, "end": string}] }
                11) ヒートマップ2D: { "type": "heatmap", "x": string[], "y": string[], "z": number[][] }
                12) ベン図(2要素): { "type": "venn2", "a": {"label": string, "size": number}, "b": {"label": string, "size": number}, "overlap": number }
                13) ピラミッド: { "type": "pyramid", "steps": [{"label": string, "value"?: number}] }
                14) ウォーターフォール: { "type": "waterfall", "items": [{"label": string, "delta": number}] }
                15) バレット: { "type": "bullet", "items": [{"label": string, "value": number, "target": number}] }
                16) ロケーション(地図風): { "type": "map_markers", "markers": [{"label": string, "x": number(0-1), "y": number(0-1)}] }
                17) コールアウト/バッジ: { "type": "callouts", "items": [{"label": string, "value"?: string, "icon"?: string}] }

            クリエイティブ設定:\n${creativeNote}
            追加で、デッキ全体のデザイントークン（任意）を返しても良い: theme_tokens { "palette"?: {"primary":"#RRGGBB","secondary":"#RRGGBB","accent":"#RRGGBB"}, "shape"?: {"cornerRadius": number(0-16)}, "spacing"?: {"baseUnit": number(0.1-1.0)}, "shadow"?: {"preset":"none"|"soft"|"strong"} }

            重要な表記ルール（短文化/名詞化/非会話体）:
            - タイトル: 名詞句/1行/最大26文字。動詞「〜する」等を避ける。絵文字・過度な記号を避ける。
            - セクション見出し: 名詞句/1行/最大24文字。
            - 箇条書き: 各項目は名詞句中心。1項目は最大3行、各行最大22文字。冗長表現や話し言葉を避ける。
            - 引用文: 最大4行。長文は要約・抜粋して簡潔に。
            - content系タイトルもタイトルの制約に準拠。
            - 全体として、会話体/敬体（です・ます）を避け、資料の見出し・要点として自然な書き言葉の名詞句で短くまとめる。
            - visual_recipe の各ラベル（KPI/タイムライン等）は原則12文字以内。
            
            最初のスライドは必ず layout: 'title_slide' にし、途中に区切りとして layout: 'section_header' を適切に配置してください。
            --- レポート ---
            ${reportContent}`;
            
            designResult = await summarizeAndAnalyzeTool.execute({ ...params, context: { 
                text: reportContent, 
                objective: prompt,
                temperature: 0.3, // Lower temperature for more deterministic structure
                topP: 0.9,
            } });
            if (!designResult.success) {
                const message = `Designer AI failed: ${designResult.message}`;
                logger.error({ error: designResult.message }, message);
                let templateConfig: any = undefined;
                try {
                    const tplPath = path.join(config.projectRoot, 'persistent_data', 'presentations', 'templates', 'default.json');
                    const raw = await fs.readFile(tplPath, 'utf-8');
                    templateConfig = JSON.parse(raw);
                } catch {}
                return { presentationDesign: [], reportContent, fileNameBase, errorMessage: message, themeColor1: '#F1F1F1', themeColor2: '#CCCCCC', templateConfig };
            }

            const designData = parseJsonStrings(designResult.data.summary);
            if (!designData) {
                const message = "Failed to parse presentation design JSON from AI.";
                logger.error({ aiOutput: designResult.data.summary }, message);
                let templateConfig: any = undefined;
                try {
                    const tplPath = path.join(config.projectRoot, 'persistent_data', 'presentations', 'templates', 'default.json');
                    const raw = await fs.readFile(tplPath, 'utf-8');
                    templateConfig = JSON.parse(raw);
                } catch {}
                return { presentationDesign: [], reportContent, fileNameBase, errorMessage: message, themeColor1: '#F1F1F1', themeColor2: '#CCCCCC', templateConfig };
            }

            // --- Robust AI Response Parsing ---
            // The AI might return JSON in slightly different formats, so we try multiple schemas.
            const expectedObjectSchema = z.object({
                theme_colors: z.object({ color1: hexColorSchema, color2: hexColorSchema }),
                slides: z.array(slideDesignSchema),
            });
            const arrayOnlySchema = z.array(slideDesignSchema);

            // 1. Try parsing the expected object format: { theme_colors: ..., slides: [...] }
            let objectParseResult = expectedObjectSchema.safeParse(designData);
            if (objectParseResult.success) {
                const { slides, theme_colors } = objectParseResult.data;
                // Load template (default.json)
                let templateConfig: any = undefined;
                try {
                    const tplPath = path.join(config.projectRoot, 'persistent_data', 'presentations', 'templates', safeTemplateName);
                    try { logger.info({ tplPath }, 'Loading template JSON'); } catch {}
                    const raw = await fs.readFile(tplPath, 'utf-8');
                    templateConfig = JSON.parse(raw);
                } catch {}
                return { presentationDesign: slides, reportContent, fileNameBase, companyName, themeColor1: theme_colors.color1, themeColor2: theme_colors.color2, templateConfig };
            }

            // 2. Try parsing a direct array of slides (if theme is missing).
            let arrayParseResult = arrayOnlySchema.safeParse(designData);
            if (arrayParseResult.success) {
                logger.warn("AI returned an array instead of an object. Using default theme colors.");
                let templateConfig: any = undefined;
                try {
                    const tplPath = path.join(config.projectRoot, 'persistent_data', 'presentations', 'templates', safeTemplateName);
                    try { logger.info({ tplPath }, 'Loading template JSON'); } catch {}
                    const raw = await fs.readFile(tplPath, 'utf-8');
                    templateConfig = JSON.parse(raw);
                } catch {}
                return { presentationDesign: arrayParseResult.data, reportContent, fileNameBase, companyName, themeColor1: '#F1F1F1', themeColor2: '#CCCCCC', templateConfig };
            }
            
            // 3. Try parsing a wrapped array, e.g., { "slides": [...] }.
            if (!Array.isArray(designData) && typeof designData === 'object' && designData !== null) {
                const keys = Object.keys(designData);
                if (keys.length === 1 && Array.isArray(designData[keys[0]])) {
                    const wrappedArray = designData[keys[0]];
                    let wrappedArrayParseResult = arrayOnlySchema.safeParse(wrappedArray);
                    if (wrappedArrayParseResult.success) {
                        logger.warn("AI returned a wrapped array. Extracting array and using default theme colors.");
                        let templateConfig: any = undefined;
                        try {
                            const tplPath = path.join(config.projectRoot, 'persistent_data', 'presentations', 'templates', safeTemplateName);
                            try { logger.info({ tplPath }, 'Loading template JSON'); } catch {}
                            const raw = await fs.readFile(tplPath, 'utf-8');
                            templateConfig = JSON.parse(raw);
                        } catch {}
                        return { presentationDesign: wrappedArrayParseResult.data, reportContent, fileNameBase, themeColor1: '#F1F1F1', themeColor2: '#CCCCCC', templateConfig };
                    }
                }
            }

            // If all parsing attempts fail, forward an error.
            const message = `AI output did not match any expected schema. Zod error: ${objectParseResult.error.message}`;
            logger.error({ error: objectParseResult.error, aiOutput: designData }, message);
            let templateConfig: any = undefined;
            try {
                const tplPath = path.join(config.projectRoot, 'persistent_data', 'presentations', 'templates', safeTemplateName);
                try { logger.info({ tplPath }, 'Loading template JSON'); } catch {}
                const raw = await fs.readFile(tplPath, 'utf-8');
                templateConfig = JSON.parse(raw);
            } catch {}
            return { presentationDesign: [], reportContent, fileNameBase, companyName, errorMessage: message, themeColor1: '#F1F1F1', themeColor2: '#CCCCCC', templateConfig };
        } catch (error) {
            const message = error instanceof Error ? error.message : "An unknown error occurred during presentation design.";
            logger.error({ error, aiOutput: (designResult && designResult.success) ? designResult.data.summary : 'AI output not available.' }, message);
            let templateConfig: any = undefined;
            try {
                const tplPath = path.join(config.projectRoot, 'persistent_data', 'presentations', 'templates', safeTemplateName);
                try { logger.info({ tplPath }, 'Loading template JSON'); } catch {}
                const raw = await fs.readFile(tplPath, 'utf-8');
                templateConfig = JSON.parse(raw);
            } catch {}
            return { presentationDesign: [], reportContent, fileNameBase, companyName, errorMessage: message, themeColor1: '#F1F1F1', themeColor2: '#CCCCCC', templateConfig };
        }
    },
}))
// (Removed) generate-title-image step: now handled in parallel within generate-content
.then(createStep({
    /**
     * @step generate-content
     * Enriches the presentation design with actual content. For each slide, it:
     * 1. Generates a speech script using an AI.
     * 2. If a visual is suggested, uses an AI to extract or create data for a chart.
     * These operations are run in parallel for efficiency.
     */
    id: 'generate-content',
    inputSchema: z.object({
        presentationDesign: z.array(slideDesignSchema),
        reportContent: z.string(),
        fileNameBase: z.string(),
        themeColor1: z.string(),
        themeColor2: z.string(),
        titleSlideImagePath: z.string().optional(),
        companyName: z.string().optional(),
        errorMessage: z.string().optional(),
        templateConfig: z.any().optional()
    }),
    outputSchema: z.object({
        enrichedSlides: z.array(z.object({
            design: slideDesignSchema,
            chartData: chartDataSchema.nullable(),
            speech: z.string(),
        })),
        fileNameBase: z.string(),
        themeColor1: z.string(),
        themeColor2: z.string(),
        titleSlideImagePath: z.string().optional(),
        companyName: z.string().optional(),
        errorMessage: z.string().optional(),
        templateConfig: z.any().optional()
    }),
    execute: async (params) => {
        const { presentationDesign, reportContent, fileNameBase, errorMessage, themeColor1, themeColor2, titleSlideImagePath, companyName } = params.inputData as any;
        if (errorMessage) {
            let templateConfig: any = undefined;
            try {
                const tplPath = path.join(config.projectRoot, 'persistent_data', 'presentations', 'templates', 'default.json');
                const raw = await fs.readFile(tplPath, 'utf-8');
                templateConfig = JSON.parse(raw);
            } catch {}
            return { enrichedSlides: [], fileNameBase, companyName, errorMessage, themeColor1, themeColor2, titleSlideImagePath, templateConfig } as any;
        }

        logger.info("✍️ [Analyst & Speechwriter AIs] Generating content in batch...");
        const slidesInput = presentationDesign.map((s: any, idx: number) => ({
            idx,
            title: s.title,
            bullets: s.bullets,
            visual_suggestion: s.visual_suggestion,
            context_for_visual: s.context_for_visual,
        }));

        // Launch title image generation concurrently (title_slide only)
        const titleImagePromise = (async () => {
            try {
                if (!presentationDesign.length || presentationDesign[0].layout !== 'title_slide') return { buffer: undefined as any, imagePath: undefined as string | undefined };
                const titleSlide = presentationDesign[0];
                const keywordExtractionPrompt = `From the following presentation title, extract 5-7 core visual keywords suitable for generating an abstract background image. The keywords should focus on concepts, themes, and colors. Do not include the original title text. Output only a comma-separated list. Title: "${titleSlide.title}"`;
                const keywordResult = await summarizeAndAnalyzeTool.execute({ ...params, context: { text: titleSlide.title, objective: keywordExtractionPrompt, temperature: 0.2, topP: 0.9 } });
                if (!keywordResult.success) return { buffer: undefined as any, imagePath: undefined };
                const keywords = (keywordResult.data.summary || '').trim();
                // Build composed prompt (no raw keywords/title text; clear instruction for abstract, no text)
                const themeColor1 = (params.inputData as any).themeColor1 as string | undefined;
                const themeColor2 = (params.inputData as any).themeColor2 as string | undefined;
                const paletteHint = (themeColor1 && themeColor2) ? `palette: primary=${themeColor1}, secondary=${themeColor2}` : '';
                const composedPrompt = [
                    'Abstract corporate background. Do not render any words, letters, numbers, symbols, or logos.',
                    'Express the slide theme as visual metaphors using shapes, gradients, light, depth, and rhythm — not text.',
                    'Design cues: clean geometric patterns, subtle gradient layers, soft light streaks, particle networks, depth-of-field bokeh, tasteful contrast.',
                    paletteHint,
                    'Minimal, elegant, high-resolution, professional. No text overlay.'
                ].filter(Boolean).join(' ');
                const tplBgSrc: any = ((params.inputData as any).templateConfig?.layouts?.title_slide?.background?.source) || {};
                const negativePrompt = String(tplBgSrc.negativePrompt || 'text, watermark, logo').trim() || undefined;
                logger.info({ prompt: composedPrompt, negativePrompt }, 'Title background image (pre-gen): sending prompt to generator');
                const { genarateImage } = await import('../../tools/presenter/genarateImage');
                const imageResult = await genarateImage({ prompt: composedPrompt, aspectRatio: '16:9', negativePrompt });
                if (imageResult.success && imageResult.path) return { buffer: undefined as any, imagePath: imageResult.path };
                return { buffer: undefined as any, imagePath: undefined };
            } catch {
                return { buffer: undefined as any, imagePath: undefined };
            }
        })();

        const batchObjective = `You are a senior presentation designer. Generate IMPACTFUL slides that already maximize visuals on the first pass (no post-processing expected). Use structured visual_recipe aggressively and choose the best visual per slide based on its content. Given an array of slides and the report body, output a JSON object strictly in the following format (no extra commentary):
{
  "slides": [
    { "idx": number, "speech": string, "chartData": null | { "chart_type": "bar"|"pie"|"line", "title": string, "labels": string[], "data": number[] }, "visual_recipe": null | (
      { "type": "kpi", "items": [{"label": string, "value": string, "icon"?: string}] } |
      { "type": "checklist", "items": [{"label": string}] } |
      { "type": "comparison", "a": {"label": string, "value": string}, "b": {"label": string, "value": string} } |
      { "type": "timeline", "steps": [{"label": string}, ...] } |
      { "type": "matrix", "axes": { "xLabels": [string,string], "yLabels": [string,string] }, "items"?: [{"x":0|1, "y":0|1, "label": string}] } |
      { "type": "funnel", "steps": [{"label": string, "value"?: string}, ...] } |
      { "type": "process", "steps": [{"label": string}, ...] } |
      { "type": "roadmap", "milestones": [{"label": string, "date"?: string}, ...] } |
      { "type": "kpi_donut", "items": [{"label": string, "value": number(0-100)}] } |
      { "type": "progress", "items": [{"label": string, "value": number(0-100)}] } |
      { "type": "gantt", "tasks": [{"label": string, "start": string, "end": string}] } |
      { "type": "heatmap", "x": string[], "y": string[], "z": number[][] } |
      { "type": "venn2", "a": {"label": string, "size": number}, "b": {"label": string, "size": number}, "overlap": number } |
      { "type": "pyramid", "steps": [{"label": string, "value"?: number}] } |
      { "type": "waterfall", "items": [{"label": string, "delta": number}] } |
      { "type": "bullet", "items": [{"label": string, "value": number, "target": number}] } |
      { "type": "map_markers", "markers": [{"label": string, "x": number, "y": number}] }
    ) }
  ]
}
Rules (Design & Content):
- Strongly prefer a visual_recipe for every slide that benefits from visuals; avoid leaving slides as text-only unless necessary.
- Choose the most impactful visual type per content: KPI/Comparison/Checklist/Timeline/Process/Funnel/Charts/Table/etc., and keep it concise.
- For KPI and Comparison, include clear labels/values; for Callouts, include optional icon keywords (icon) when helpful.
- chartData is only for bar/pie/line charts; ensure labels.length==data.length and data are numbers.
- Keep visual complexity manageable (e.g., checklist <= 6 items, timeline <= 6 steps, compact tables <= 5 rows and <= 3 columns).
- Ensure variety across slides; avoid repeating the same visual type consecutively when possible.
- Titles and bullets remain concise; use colon-separated style where appropriate.
Shortening and style constraints (Japanese):
- Titles and section headers are noun phrases, 1 line (max ~26 chars)。
- Content titles 1 line (max ~24 chars)。
- Bullets up to ~3 lines; avoid spoken style。No emojis or excessive symbols。
`;

        const combined = `# Slides\n\n${JSON.stringify(slidesInput, null, 2)}\n\n# Report\n\n${reportContent}`;
        const [batchRes, titleGen] = await Promise.all([
            summarizeAndAnalyzeTool.execute({ ...params, context: { text: combined, objective: batchObjective, temperature: 0.4, topP: 0.9 } }),
            titleImagePromise,
        ]);

        let idxToResult = new Map<number, { speech: string; chartData: any | null; visual_recipe: z.infer<typeof visualRecipeSchema> | null }>();
        if (batchRes.success) {
            const parsed = parseJsonStrings(batchRes.data.summary) as any;
            const arr = Array.isArray(parsed?.slides) ? parsed.slides : [];
            for (const it of arr) {
                const i = Number(it?.idx);
                if (!Number.isFinite(i)) continue;
                const rawSpeech = typeof it?.speech === 'string' ? it.speech : '';
                const speech = rawSpeech.trim().replace(/([。\.])/g, '$1\n');
                let chartData: ChartData | null = null;
                if (it?.chartData && typeof it.chartData === 'object' && it.chartData !== null) {
                    try {
                        chartData = chartDataSchema.parse(it.chartData);
                    } catch { chartData = null; }
                }
                let visual_recipe: z.infer<typeof visualRecipeSchema> | null = null;
                if (it && typeof it === 'object') {
                    if ((it as any).visual_recipe === null) {
                        // normalize null -> undefined
                    } else if ((it as any).visual_recipe) {
                        const vr = (it as any).visual_recipe;
                        const parsedVr = visualRecipeSchema.safeParse(vr);
                        visual_recipe = parsedVr.success ? parsedVr.data : null;
                    }
                }
                idxToResult.set(i, { speech: speech || '（原稿の生成に失敗しました）', chartData, visual_recipe });
            }
                } else {
            logger.warn('Batch generation failed; falling back to empty results.');
        }

        const enrichedSlides = presentationDesign.map((design: any, idx: number) => {
            const got = idxToResult.get(idx);
            const speech = got?.speech || '（原稿の生成に失敗しました）';
            let chartData: ChartData | null = null;
            if (design.visual_suggestion !== 'none') {
                chartData = got?.chartData || null;
            }
            let normalizedVr = (got?.visual_recipe === null ? undefined : got?.visual_recipe) ?? (design.visual_recipe === null ? undefined : design.visual_recipe);
            // If we have chartData but no visual_recipe, translate chartData into visual_recipe for template-driven rendering
            if (!normalizedVr && chartData && typeof chartData === 'object') {
                const typeMap: Record<string, string> = { bar: 'bar_chart', line: 'line_chart', pie: 'pie_chart' };
                const mapped = typeMap[String((chartData as any).chart_type || '').toLowerCase()] as any;
                if (mapped && Array.isArray((chartData as any).labels) && Array.isArray((chartData as any).data)) {
                    normalizedVr = { type: mapped, labels: (chartData as any).labels, values: (chartData as any).data, title: (chartData as any).title } as any;
                }
            }
            return { design: { ...design, visual_recipe: normalizedVr }, chartData: null, speech } as any;
        });

        const finalTitlePath = (titleGen && (titleGen as any).imagePath) ? (titleGen as any).imagePath : titleSlideImagePath;
        return { enrichedSlides, fileNameBase, themeColor1, themeColor2, titleSlideImagePath: finalTitlePath, companyName, templateConfig: (params.inputData as any).templateConfig } as any;
    },
}))

.then(createStep({
    /**
     * @step enrich-company-info
     */
    id: 'enrich-company-info',
    inputSchema: z.object({
        enrichedSlides: z.array(z.object({
            design: slideDesignSchema,
            chartData: chartDataSchema.nullable(),
            speech: z.string(),
        })),
        fileNameBase: z.string(),
        themeColor1: z.string(),
        themeColor2: z.string(),
        titleSlideImagePath: z.string().optional(),
        companyName: z.string().optional(),
        errorMessage: z.string().optional(),
        templateConfig: z.any().optional()
    }),
    outputSchema: z.object({
        finalSlides: z.array(z.object({
            title: z.string(),
            bullets: z.array(z.string()),
            imagePath: z.string().optional(),
            notes: z.string(),
            layout: z.enum(['title_slide', 'section_header', 'content_with_visual', 'content_with_bottom_visual', 'content_only', 'quote', 'freeform']),
            special_content: z.string().optional().nullable(),
            visual_recipe: z.any().optional(),
            context_for_visual: z.string().optional(),
            elements: z.array(z.any()).optional(),
        })),
        fileNameBase: z.string(),
        themeColor1: z.string(),
        themeColor2: z.string(),
        titleSlideImagePath: z.string().optional(),
        companyLogoPath: z.string().optional(),
        companyCopyright: z.string().optional(),
        companyAbout: z.string().optional(),
        companyOverview: z.object({
            company_name: z.string().optional(),
            address: z.string().optional(),
            founded: z.string().optional(),
            representative: z.string().optional(),
            business: z.array(z.string()).optional(),
            homepage: z.string().optional(),
            contact: z.string().optional(),
        }).optional(),
        templateConfig: z.any().optional()
    }),
    execute: async (params) => {
        const { enrichedSlides, companyName, fileNameBase, themeColor1, themeColor2, titleSlideImagePath, errorMessage } = params.inputData as any;
        if (errorMessage) {
            return { finalSlides: [], fileNameBase, errorMessage, themeColor1, themeColor2, titleSlideImagePath, templateConfig: (params.inputData as any).templateConfig } as any;
        }
        if (!companyName) {
            logger.info('No companyName provided. Skipping company info enrichment.');
            // Pass-through: convert enrichedSlides->finalSlides without change
            const passthrough = (enrichedSlides || []).map((slide: any) => ({
                title: slide.design.title,
                bullets: slide.design.bullets,
                imagePath: undefined,
                notes: slide.speech,
                layout: slide.design.layout,
                special_content: slide.design.special_content,
                visual_recipe: slide.design.visual_recipe,
                context_for_visual: slide.design.context_for_visual,
                elements: slide.design.elements,
            }));
            return { finalSlides: passthrough, fileNameBase, themeColor1, themeColor2, titleSlideImagePath, templateConfig: (params.inputData as any).templateConfig } as any;
        }
        const baseDir = path.join(config.projectRoot, 'persistent_data', 'companies_info', companyName);
        try { await fs.access(baseDir); } catch { logger.info({ baseDir }, 'Company dir not found. Skipping.'); return params.inputData as any; }
        // Prefer about.url
        let urlStr: string | undefined;
        const aboutUrlPath = path.join(baseDir, 'about.url');
        try { const raw = await fs.readFile(aboutUrlPath, 'utf-8'); urlStr = String(raw||'').trim(); logger.info({ aboutUrlPath, urlStr }, 'Read about.url'); } catch {
            try { const rawJ = await fs.readFile(path.join(baseDir, 'about.json'), 'utf-8'); const j = JSON.parse(rawJ); if (j && typeof j.url === 'string') urlStr = j.url; logger.info({ urlStr }, 'Read about.json'); } catch {}
        }
        if (!urlStr) { logger.info('No about URL found. Skipping.');
            const passthrough = (enrichedSlides || []).map((slide: any) => ({
                title: slide.design.title,
                bullets: slide.design.bullets,
                imagePath: undefined,
                notes: slide.speech,
                layout: slide.design.layout,
                special_content: slide.design.special_content,
                elements: slide.design.elements,
            }));
            return { finalSlides: passthrough, fileNameBase, themeColor1, themeColor2, titleSlideImagePath, templateConfig: (params.inputData as any).templateConfig } as any; }
        // Scrape
        let scraped = '';
        try {
            const res = await contentScrapeTool.execute({ ...params, context: { url: urlStr } });
            if (res.success) scraped = res.data.content;
            logger.info({ bytes: scraped.length }, 'Scraped company page for AI extraction.');
        } catch (e) { logger.warn({ e }, 'Scrape failed.'); }
        if (!scraped) {
            const passthrough = (enrichedSlides || []).map((slide: any) => ({
                title: slide.design.title,
                bullets: slide.design.bullets,
                imagePath: undefined,
                notes: slide.speech,
                layout: slide.design.layout,
                special_content: slide.design.special_content,
                elements: slide.design.elements,
            }));
            return { finalSlides: passthrough, fileNameBase, themeColor1, themeColor2, titleSlideImagePath, templateConfig: (params.inputData as any).templateConfig } as any; }
        // AI extract (structured)
        const objective = `以下のテキストから会社情報を抽出し、次のJSON形式のみで出力してください（余計な文字列は禁止）。日本語で簡潔に。\n{\n  "company_name": string,\n  "address": string,\n  "founded": string,\n  "representative": string,\n  "business": string[],\n  "homepage": string,\n  "contact": string,\n  "vision": string\n}`;
        const ai = await summarizeAndAnalyzeTool.execute({ ...params, context: { text: scraped.slice(0, 20000), objective, temperature: 0.2, topP: 0.9 } });
        if (!ai.success) { logger.warn('AI extraction failed.'); return params.inputData as any; }
        const parsed = parseJsonStrings(ai.data.summary) as any;
        const name = typeof parsed?.company_name === 'string' && parsed.company_name.trim() ? parsed.company_name.trim() : companyName;
        const year = new Date().getFullYear();
        const copyrightLine = `© ${year} ${name}. All Rights Reserved.`;
        // Detect logo.png
        let companyLogoPath: string | undefined;
        try {
            const logoPath = path.join(baseDir, 'logo.png');
            await fs.access(logoPath);
            companyLogoPath = logoPath;
            logger.info({ logoPath }, 'Detected company logo for PPTX.');
        } catch {}
        const passthrough = (enrichedSlides || []).map((s: any) => ({ title: s.design.title, bullets: s.design.bullets, imagePath: undefined, notes: s.speech, layout: s.design.layout, special_content: s.design.special_content, visual_recipe: s.design.visual_recipe, context_for_visual: s.design.context_for_visual, elements: s.design.elements }));
        const companyOverview = {
            company_name: name,
            address: typeof parsed?.address === 'string' ? parsed.address : undefined,
            founded: typeof parsed?.founded === 'string' ? parsed.founded : undefined,
            representative: typeof parsed?.representative === 'string' ? parsed.representative : undefined,
            business: Array.isArray(parsed?.business) ? parsed.business.slice(0, 8).map((x:any)=>String(x)) : undefined,
            homepage: typeof parsed?.homepage === 'string' ? parsed.homepage : (urlStr || undefined),
            contact: typeof parsed?.contact === 'string' ? parsed.contact : undefined,
            vision: typeof parsed?.vision === 'string' ? parsed.vision : undefined,
        };
        logger.info({ name }, 'Prepared structured company overview.');
        return { finalSlides: passthrough, fileNameBase, themeColor1, themeColor2, titleSlideImagePath, companyLogoPath, 
            companyCopyright: copyrightLine, companyAbout: '', companyOverview, templateConfig: (params.inputData as any).templateConfig } as any;
    },
}))
.then(createStep({
    /**
     * @step generate-visuals
     */
    id: 'generate-visuals',
    inputSchema: z.object({
        finalSlides: z.array(z.object({
            title: z.string(),
            bullets: z.array(z.string()),
            imagePath: z.string().optional(),
            notes: z.string(),
            layout: z.enum(['title_slide', 'section_header', 'content_with_visual', 'content_with_bottom_visual', 'content_only', 'quote', 'freeform']),
            special_content: z.string().optional().nullable(),
            visual_recipe: z.any().optional(),
            context_for_visual: z.string().optional(),
            elements: z.array(z.any()).optional(),
        })),
        fileNameBase: z.string(),
        themeColor1: z.string(),
        themeColor2: z.string(),
        titleSlideImagePath: z.string().optional(),
        errorMessage: z.string().optional(),
        companyLogoPath: z.string().optional(),
        companyCopyright: z.string().optional(),
        companyAbout: z.string().optional(),
        companyOverview: z.object({
            company_name: z.string().optional(),
            address: z.string().optional(),
            founded: z.string().optional(),
            representative: z.string().optional(),
            business: z.array(z.string()).optional(),
            homepage: z.string().optional(),
            contact: z.string().optional(),
        }).optional(),
        templateConfig: z.any().optional()
    }),
    outputSchema: z.object({
        finalSlides: z.array(z.object({
            title: z.string(),
            bullets: z.array(z.string()),
            imagePath: z.string().optional(),
            notes: z.string(),
            layout: z.enum(['title_slide', 'section_header', 'content_with_visual', 'content_with_bottom_visual', 'content_only', 'quote', 'freeform']),
            special_content: z.string().optional().nullable(),
            visual_recipe: z.any().optional(),
            context_for_visual: z.string().optional(),
        })),
        fileNameBase: z.string(),
        themeColor1: z.string(),
        themeColor2: z.string(),
        titleSlideImagePath: z.string().optional(),
        visualRecipes: z.array(z.any()).optional(),
        errorMessage: z.string().optional(),
        companyLogoPath: z.string().optional(),
        companyCopyright: z.string().optional(),
        companyAbout: z.string().optional(),
        companyOverview: z.object({
            company_name: z.string().optional(),
            address: z.string().optional(),
            founded: z.string().optional(),
            representative: z.string().optional(),
            business: z.array(z.string()).optional(),
            homepage: z.string().optional(),
            contact: z.string().optional(),
        }).optional(),
        templateConfig: z.any().optional()
    }),
    execute: async (params) => {
        const { finalSlides: inputSlides, fileNameBase, errorMessage, themeColor1, themeColor2, titleSlideImagePath } = params.inputData as any;
        const inCompanyLogoPath = (params.inputData as any).companyLogoPath as (string|undefined);
        const inCompanyCopyright = (params.inputData as any).companyCopyright as (string|undefined);
        const inCompanyAbout = (params.inputData as any).companyAbout as (string|undefined);
        const inCompanyOverview = (params.inputData as any).companyOverview as (any|undefined);
        if (errorMessage) {
            return { finalSlides: [], fileNameBase, errorMessage, themeColor1, themeColor2, titleSlideImagePath, templateConfig: (params.inputData as any).templateConfig };
        }

        logger.info("🖼️ [Chart Generator] Creating chart images...");
        const finalSlidesPromises = (inputSlides as any[]).map(async (slide, index) => {
            let imagePath: string | undefined = undefined;
            // Attempt to generate a chart if data is present (chartData no longer present here)
            const chartData = null as any;
            if (chartData && chartData.chart_type) {
                const { chart_type, ...restOfChartData } = chartData;
                // Force disk mode to avoid passing large buffers between steps
                const chartResult = await generateChartTool.execute({ ...params, context: { ...restOfChartData, chartType: chart_type, fileName: `chart_${fileNameBase}_${index}`, returnBuffer: false, themeColor1, themeColor2 }});
                if (chartResult.success) {
                    const d: any = chartResult.data as any;
                    if (d?.imagePath) {
                        imagePath = d.imagePath as string;
                    }
                } else {
                    logger.warn({ slideIndex: index }, "Chart generation failed, proceeding without an image.");
                }
            }

            // (reverted) do not generate special image for section headers

            // Fallback logic removed: explicit layouts should be used (no implicit switching)
            // Respect AI-chosen layout; do not normalize automatically
            const finalLayout = slide.layout;

            // Disable contextual auto image for non-title slides: template-driven only

            return {
                title: slide.title,
                bullets: slide.bullets,
                imagePath: imagePath,
                notes: slide.notes,
                layout: finalLayout,
                special_content: slide.special_content,
                visual_recipe: slide.visual_recipe,
                context_for_visual: slide.context_for_visual,
                elements: (slide as any).elements,
            };
        });

        const finalSlides = await Promise.all(finalSlidesPromises);
        const visualRecipes: any[] = [];
        // Carry forward branding fields from input if present (already in scope)
        return { finalSlides, fileNameBase, themeColor1, themeColor2, titleSlideImagePath, visualRecipes, companyLogoPath: inCompanyLogoPath, companyCopyright: inCompanyCopyright, companyAbout: inCompanyAbout, companyOverview: inCompanyOverview, templateConfig: (params.inputData as any).templateConfig } as any;
    },
}))
.then(createStep({
    /**
     * @step assemble-outputs
     */
    id: 'assemble-outputs',
    inputSchema: z.object({
        finalSlides: z.array(z.object({
            title: z.string(),
            bullets: z.array(z.string()),
            imagePath: z.string().optional(),
            notes: z.string(),
            layout: z.enum(['title_slide', 'section_header', 'content_with_visual', 'content_with_bottom_visual', 'content_only', 'quote', 'freeform']),
            special_content: z.string().optional().nullable(),
            visual_recipe: z.any().optional(),
            context_for_visual: z.string().optional(),
        })),
        fileNameBase: z.string(),
        themeColor1: z.string(),
        themeColor2: z.string(),
        titleSlideImagePath: z.string().optional(),
        visualRecipes: z.array(z.any()).optional(),
        errorMessage: z.string().optional(),
        companyLogoPath: z.string().optional(),
        companyCopyright: z.string().optional(),
        companyAbout: z.string().optional(),
        companyOverview: z.object({
            company_name: z.string().optional(),
            address: z.string().optional(),
            founded: z.string().optional(),
            representative: z.string().optional(),
            business: z.array(z.string()).optional(),
            homepage: z.string().optional(),
            contact: z.string().optional(),
        }).optional(),
        templateConfig: z.any().optional()
    }),
    outputSchema: finalOutputSchema,
    execute: async (params) => {
        const { finalSlides, fileNameBase, errorMessage, themeColor1, themeColor2, titleSlideImagePath, visualRecipes, companyLogoPath, companyCopyright, companyAbout, companyOverview, templateConfig } = params.inputData as any;
        if (errorMessage) {
            try { logger.info('Workflow finished (failed).'); } catch {}
            return { success: false, message: errorMessage } as const;
        }

        logger.info("📦 [Assembler] Creating final PowerPoint file with notes...");
        const slidesForPpt = Array.isArray(finalSlides)
          ? finalSlides
          : finalSlides;

        const visualRecipesFromSlides = Array.isArray(slidesForPpt) ? slidesForPpt.map((s: any) => (s && (s as any).visual_recipe) || null) : [];
        const pptResult = await createPowerpointTool.execute({ ...params, context: { 
            fileName: fileNameBase,
            slides: slidesForPpt,
            themeColor1,
            themeColor2,
            titleSlideImagePath,
            styleTokens: { primary: themeColor1, secondary: themeColor2, accent: '#FFC107', cornerRadius: 12, outlineColor: '#FFFFFF', spacingBaseUnit: 0.9, shadowPreset: 'soft' as any },
            visualRecipes: (visualRecipes && visualRecipes.length ? visualRecipes : visualRecipesFromSlides),
            companyLogoPath,
            companyCopyright,
            companyAbout,
            companyOverview,
            templateConfig
        }});

        if (!pptResult.success) {
            return { success: false, message: `Failed to assemble final PowerPoint file: ${pptResult.message}` } as const;
        }
        let googleSlidesLink: string | undefined;
        // Temporarily disabled Google Slides upload until preparation is complete.
        // try {
        //     const { uploadToGoogleSlidesTool } = await import('../../tools/util/uploadToGoogleSlides');
        //     const gsRes = await uploadToGoogleSlidesTool.execute({
        //         ...params,
        //         context: {
        //             pptxPath: pptResult.data.filePath,
        //             name: fileNameBase,
        //             folderId: process.env.GDRIVE_FOLDER_ID,
        //             serviceAccountJson: process.env.GSA_KEY_JSON,
        //         },
        //     });
        //     if (gsRes.success) {
        //         googleSlidesLink = gsRes.data.webViewLink;
        //     }
        // } catch {}

        const fileName = path.parse(pptResult.data.filePath).base;
        try { logger.info('Workflow finished (success).'); } catch {}
        return {
            success: true,
            data: {
                fileName,
                ...(googleSlidesLink ? { googleSlidesLink } : {}),
            },
        } as const;
    },
}))
.commit();