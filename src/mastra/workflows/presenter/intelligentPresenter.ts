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
import { generateChartTool, createPowerpointTool } from '../../tools/presenter';
import { parseJsonStrings } from '../../tools/xibo-agent/utility/jsonParser';
import { promises as fs } from 'fs';
import path from 'path';
import { config } from '../../tools/xibo-agent/config';

// --- Helper Functions and Schemas ---

const hexColorSchema = z.string().regex(/^#[0-9a-fA-F]{6}$/, "Must be a valid 6-digit hex color code (e.g., #RRGGBB)");

/**
 * Defines the structure for a single slide's design, as determined by the design AI.
 */
const visualRecipeKpiSchema = z.object({
  type: z.literal('kpi'),
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
  items: z.array(z.object({ x: z.number().int().min(0).max(1), y: z.number().int().min(0).max(1), label: z.string() })).optional(),
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

const visualRecipeSchema = z.union([
  visualRecipeKpiSchema,
  visualRecipeComparisonSchema,
  visualRecipeTimelineSchema,
  visualRecipeMatrixSchema,
  visualRecipeFunnelSchema,
  visualRecipeProcessSchema,
  visualRecipeRoadmapSchema,
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
]);

const slideDesignSchema = z.object({
  title: z.string().describe("The main title of the slide."),
  layout: z.enum(['title_slide', 'section_header', 'content_with_visual', 'content_only', 'quote'])
    .describe("The layout type for the slide."),
  bullets: z.array(z.string()).describe("A list of key bullet points for the slide."),
  visual_suggestion: z.enum(['bar_chart', 'pie_chart', 'line_chart', 'none']).describe("The suggested type of visual for the slide."),
  context_for_visual: z.string().describe("The specific topic or data context from the report needed to create the visual."),
  special_content: z.string().optional().describe("Special content for layouts like 'quote'."),
  visual_recipe: visualRecipeSchema.optional().nullable().describe("Optional infographic recipe for shapes/icons/timelines/etc."),
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
    }),
    outputSchema: z.object({
        reportContent: z.string(),
        fileNameBase: z.string(),
        errorMessage: z.string().optional(),
    }),
    execute: async (params) => {
        const { reportFileName, fileNameBase } = params.inputData;
        const resolvedFileNameBase = fileNameBase || path.parse(reportFileName).name;
        const filePath = path.join(config.reportsDir, reportFileName);
        logger.info({ filePath, resolvedFileNameBase }, "📄 Reading report file...");
        
        try {
            await fs.access(filePath);
            const reportContent = await fs.readFile(filePath, 'utf-8');
            return { reportContent, fileNameBase: resolvedFileNameBase };
        } catch (error) {
            const message = `Report file not found or could not be read: ${filePath}`;
            logger.error({ filePath, error }, message);
            return { reportContent: '', fileNameBase: resolvedFileNameBase, errorMessage: message };
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
        errorMessage: z.string().optional(),
    }),
    outputSchema: z.object({
        presentationDesign: z.array(slideDesignSchema),
        reportContent: z.string(),
        fileNameBase: z.string(),
        themeColor1: z.string().describe("The primary theme color for the presentation background gradient."),
        themeColor2: z.string().describe("The secondary theme color for the presentation background gradient."),
        errorMessage: z.string().optional(),
    }),
    execute: async (params) => {
        const { reportContent, fileNameBase, errorMessage } = params.inputData;
        if (errorMessage) {
            return { presentationDesign: [], reportContent, fileNameBase, errorMessage, themeColor1: '#F1F1F1', themeColor2: '#CCCCCC' };
        }
        
        logger.info("🤖 [Designer AI] Analyzing report and designing presentation structure...");
        let designResult;
        try {
            // Prompt for the Designer AI to create the presentation structure and theme.
            const prompt = `あなたは一流のプレゼンテーション設計者です。以下のレポートを分析し、最適なプレゼン構成案とテーマカラーをJSONで出力してください。
            返却するJSONは、必ず以下のキーを持つオブジェクトです:
            - "theme_colors": { "color1": "#HEXCODE", "color2": "#HEXCODE" } (レポートの雰囲気に合うグラデーション用のテーマカラー2色。必ず6桁の16進数カラーコードで指定してください)
            - "slides": array (スライド構成案の配列)

            スライド構成案の各配列要素は、以下のキーを持つJSONオブジェクトです:
            - "title": string (スライドのタイトル)
            - "layout": 'title_slide' | 'section_header' | 'content_with_visual' | 'content_only' | 'quote' (スライドの役割に応じたレイアウトタイプ)
            - "bullets": string[] (スライドの要点を箇条書きで)
            - "visual_suggestion": 'bar_chart' | 'pie_chart' | 'line_chart' | 'none' (グラフの提案、不要なら'none')
            - "context_for_visual": string (グラフ作成に必要な文脈)
            - "special_content": string (任意。引用レイアウトの場合の引用文など)
            - "visual_recipe": object (任意。以下のいずれかの厳密スキーマで返してください)
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
                return { presentationDesign: [], reportContent, fileNameBase, errorMessage: message, themeColor1: '#F1F1F1', themeColor2: '#CCCCCC' };
            }

            const designData = parseJsonStrings(designResult.data.summary);
            if (!designData) {
                const message = "Failed to parse presentation design JSON from AI.";
                logger.error({ aiOutput: designResult.data.summary }, message);
                return { presentationDesign: [], reportContent, fileNameBase, errorMessage: message, themeColor1: '#F1F1F1', themeColor2: '#CCCCCC' };
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
                return { presentationDesign: slides, reportContent, fileNameBase, themeColor1: theme_colors.color1, themeColor2: theme_colors.color2 };
            }

            // 2. Try parsing a direct array of slides (if theme is missing).
            let arrayParseResult = arrayOnlySchema.safeParse(designData);
            if (arrayParseResult.success) {
                logger.warn("AI returned an array instead of an object. Using default theme colors.");
                return { presentationDesign: arrayParseResult.data, reportContent, fileNameBase, themeColor1: '#F1F1F1', themeColor2: '#CCCCCC' };
            }
            
            // 3. Try parsing a wrapped array, e.g., { "slides": [...] }.
            if (!Array.isArray(designData) && typeof designData === 'object' && designData !== null) {
                const keys = Object.keys(designData);
                if (keys.length === 1 && Array.isArray(designData[keys[0]])) {
                    const wrappedArray = designData[keys[0]];
                    let wrappedArrayParseResult = arrayOnlySchema.safeParse(wrappedArray);
                    if (wrappedArrayParseResult.success) {
                        logger.warn("AI returned a wrapped array. Extracting array and using default theme colors.");
                        return { presentationDesign: wrappedArrayParseResult.data, reportContent, fileNameBase, themeColor1: '#F1F1F1', themeColor2: '#CCCCCC' };
                    }
                }
            }

            // If all parsing attempts fail, forward an error.
            const message = `AI output did not match any expected schema. Zod error: ${objectParseResult.error.message}`;
            logger.error({ error: objectParseResult.error, aiOutput: designData }, message);
            return { presentationDesign: [], reportContent, fileNameBase, errorMessage: message, themeColor1: '#F1F1F1', themeColor2: '#CCCCCC' };

        } catch (error) {
            const message = error instanceof Error ? error.message : "An unknown error occurred during presentation design.";
            logger.error({ error, aiOutput: (designResult && designResult.success) ? designResult.data.summary : 'AI output not available.' }, message);
            return { presentationDesign: [], reportContent, fileNameBase, errorMessage: message, themeColor1: '#F1F1F1', themeColor2: '#CCCCCC' };
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
        errorMessage: z.string().optional(),
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
        errorMessage: z.string().optional(),
    }),
    execute: async (params) => {
        const { presentationDesign, reportContent, fileNameBase, errorMessage, themeColor1, themeColor2, titleSlideImagePath } = params.inputData;
        if (errorMessage) {
            return { enrichedSlides: [], fileNameBase, errorMessage, themeColor1, themeColor2, titleSlideImagePath } as any;
        }

        logger.info("✍️ [Analyst & Speechwriter AIs] Generating content in batch...");
        const slidesInput = presentationDesign.map((s, idx) => ({
            idx,
            title: s.title,
            bullets: s.bullets,
            visual_suggestion: s.visual_suggestion,
            context_for_visual: s.context_for_visual,
        }));

        // Launch title image generation concurrently (if needed)
        const titleImagePromise = (async () => {
            try {
                if (!presentationDesign.length || presentationDesign[0].layout !== 'title_slide') return { buffer: undefined as any, imagePath: undefined as string | undefined };
                const titleSlide = presentationDesign[0];
                const keywordExtractionPrompt = `From the following presentation title, extract 5-7 core visual keywords suitable for generating an abstract background image. The keywords should focus on concepts, themes, and colors. Do not include the original title text. Output only a comma-separated list. Title: "${titleSlide.title}"`;
                const keywordResult = await summarizeAndAnalyzeTool.execute({ ...params, context: { text: titleSlide.title, objective: keywordExtractionPrompt, temperature: 0.2, topP: 0.9 } });
                if (!keywordResult.success) return { buffer: undefined as any, imagePath: undefined };
                const keywords = (keywordResult.data.summary || '').trim();
                const prompt = `An abstract, professional background image representing the following themes: ${keywords}. High resolution, clean, and visually appealing.`;
                const negativePrompt = 'text, words, letters, numbers, writing, typography, signatures, logos, people, faces';
                const { generateImage } = await import('../../tools/xibo-agent/generateImage/imageGeneration');
                // Force disk mode: save image to file and pass only the path
                const imageResult = await generateImage.execute({ ...params, context: { prompt, aspectRatio: '16:9', negativePrompt, returnBuffer: false } });
                if (imageResult.success && imageResult.data) {
                    const d: any = imageResult.data as any;
                    if (d.imagePath) return { buffer: undefined as any, imagePath: d.imagePath as string };
                }
                return { buffer: undefined as any, imagePath: undefined };
            } catch {
                return { buffer: undefined as any, imagePath: undefined };
            }
        })();

        const batchObjective = `You are a senior presentation designer and content generator. Produce visually rich slides using structured visuals. Given an array of slides and the report body, output a JSON object strictly in the following format (no extra commentary):
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
- The speech should be ~150 Japanese characters, readable and presenter-friendly. Do not include markdown fences.
- If a slide's visual_suggestion is 'none', set chartData to null.
- If chartData is provided, labels.length must equal data.length and data values must be numbers.
- Use the slide's context_for_visual only when chartData is required.
- If chartData is null but a visual is useful, propose a simple visual_recipe such as KPI cards, checklist, or a short timeline. Keep it minimal and structured.
- Prefer diverse visuals across the deck (KPI / comparison / checklist / timeline / process). Avoid repeating the same visual style consecutively.
- Titles and section headers should be concise; bullets should be scannable and benefit from colon-separated formatting (e.g., "課題：説明").
Shortening and style constraints (Japanese):
- Titles and section headers must be noun phrases, no verbs like "〜する". 1 line only. Title max 26 chars, section max 24 chars.
- Content titles must also be noun phrases, 1 line, max 24 chars.
- Bullets are concise lead phrases (noun-based), each item up to 3 lines, each line up to 22 chars; avoid spoken style.
- Quotes up to 4 lines; summarize if longer.
- Avoid emojis and excessive symbols. Use formal written style fit for slide headlines.
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

        const enrichedSlides = presentationDesign.map((design, idx) => {
            const got = idxToResult.get(idx);
            const speech = got?.speech || '（原稿の生成に失敗しました）';
            let chartData: ChartData | null = null;
            if (design.visual_suggestion !== 'none') {
                chartData = got?.chartData || null;
            }
            const normalizedVr = (got?.visual_recipe === null ? undefined : got?.visual_recipe) ?? (design.visual_recipe === null ? undefined : design.visual_recipe);
            return { design: { ...design, visual_recipe: normalizedVr }, chartData, speech } as any;
        });

        const finalTitlePath = (titleGen && (titleGen as any).imagePath) ? (titleGen as any).imagePath : titleSlideImagePath;
        return { enrichedSlides, fileNameBase, themeColor1, themeColor2, titleSlideImagePath: finalTitlePath } as any;
    },
}))
.then(createStep({
    /**
     * @step generate-visuals
     * Creates PNG images for any charts defined in the previous step.
     * It also includes fallback logic: if a slide is supposed to have a visual but
     * chart generation fails, it changes the slide's layout to 'content_only'
     * to avoid an empty space in the presentation.
     */
    id: 'generate-visuals',
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
        errorMessage: z.string().optional(),
    }),
    outputSchema: z.object({
        finalSlides: z.array(z.object({
            title: z.string(),
            bullets: z.array(z.string()),
            imagePath: z.string().optional(),
            notes: z.string(),
            layout: z.enum(['title_slide', 'section_header', 'content_with_visual', 'content_only', 'quote']),
            special_content: z.string().optional(),
        })),
        fileNameBase: z.string(),
        themeColor1: z.string(),
        themeColor2: z.string(),
        titleSlideImagePath: z.string().optional(),
        visualRecipes: z.array(z.any()).optional(),
        errorMessage: z.string().optional(),
    }),
    execute: async (params) => {
        const { enrichedSlides, fileNameBase, errorMessage, themeColor1, themeColor2, titleSlideImagePath } = params.inputData;
        if (errorMessage) {
            return { finalSlides: [], fileNameBase, errorMessage, themeColor1, themeColor2, titleSlideImagePath };
        }

        logger.info("🖼️ [Chart Generator] Creating chart images...");
        const finalSlidesPromises = enrichedSlides.map(async (slide, index) => {
            let imagePath: string | undefined = undefined;
            // Attempt to generate a chart if data is present
            if (slide.chartData) {
                const { chart_type, ...restOfChartData } = slide.chartData;
                // Force disk mode to avoid passing large buffers between steps
                const chartResult = await generateChartTool.execute({ ...params, context: { ...restOfChartData, chartType: chart_type, fileName: `chart_${fileNameBase}_${index}`, returnBuffer: false, themeColor1, themeColor2 }});
                if (chartResult.success) {
                    const d: any = chartResult.data as any;
                    if (d?.imagePath) {
                        imagePath = d.imagePath as string;
                    }
                } else {
                    logger.warn({ slideTitle: slide.design.title }, "Chart generation failed, proceeding without an image.");
                }
            }

            // (reverted) do not generate special image for section headers

            // Fallback logic: If layout requires a visual but we don't have one, change layout.
            let finalLayout = slide.design.layout;
            if (finalLayout === 'content_with_visual' && !imagePath) {
                logger.info({ slideTitle: slide.design.title }, "Visual not available for 'content_with_visual' layout. Switching to 'content_only'.");
                finalLayout = 'content_only';
            }

            return {
                title: slide.design.title,
                bullets: slide.design.bullets,
                imagePath: imagePath,
                notes: slide.speech,
                layout: finalLayout,
                special_content: slide.design.special_content,
            };
        });

        const finalSlides = await Promise.all(finalSlidesPromises);
        const visualRecipes = enrichedSlides.map(s => (s as any).design?.visual_recipe ?? null);
        return { finalSlides, fileNameBase, themeColor1, themeColor2, titleSlideImagePath, visualRecipes } as any;
    },
}))
.then(createStep({
    /**
     * @step assemble-outputs
     * Takes all the generated components (slide designs, text, image paths)
     * and uses the `createPowerpointTool` to assemble the final .pptx file.
     */
    id: 'assemble-outputs',
    inputSchema: z.object({
        finalSlides: z.array(z.object({
            title: z.string(),
            bullets: z.array(z.string()),
            imagePath: z.string().optional(),
            notes: z.string(),
            layout: z.enum(['title_slide', 'section_header', 'content_with_visual', 'content_only', 'quote']),
            special_content: z.string().optional(),
        })),
        fileNameBase: z.string(),
        themeColor1: z.string(),
        themeColor2: z.string(),
        titleSlideImagePath: z.string().optional(),
        visualRecipes: z.array(z.any()).optional(),
        errorMessage: z.string().optional(),
    }),
    outputSchema: finalOutputSchema,
    execute: async (params) => {
        const { finalSlides, fileNameBase, errorMessage, themeColor1, themeColor2, titleSlideImagePath, visualRecipes } = params.inputData as any;
        if (errorMessage) {
            return { success: false, message: errorMessage } as const;
        }

        logger.info("📦 [Assembler] Creating final PowerPoint file with notes...");
        const pptResult = await createPowerpointTool.execute({ ...params, context: { 
            fileName: fileNameBase,
            slides: finalSlides,
            themeColor1,
            themeColor2,
            titleSlideImagePath,
            styleTokens: { primary: themeColor1, secondary: themeColor2, accent: '#FFC107', cornerRadius: 12, outlineColor: '#FFFFFF' },
            visualRecipes,
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