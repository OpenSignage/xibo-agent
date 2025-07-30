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

const slideDesignSchema = z.object({
  title: z.string().describe("The main title of the slide."),
  bullets: z.array(z.string()).describe("A list of key bullet points for the slide."),
  visual_suggestion: z.enum(['bar_chart', 'pie_chart', 'line_chart', 'none']).describe("The suggested type of visual for the slide."),
  context_for_visual: z.string().describe("The specific topic or data context from the report needed to create the visual."),
});
type SlideDesign = z.infer<typeof slideDesignSchema>;

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
        powerpointPath: z.string(),
    }),
});
const errorOutputSchema = z.object({
    success: z.literal(false),
    message: z.string(),
});
const finalOutputSchema = z.union([successOutputSchema, errorOutputSchema]);


// --- Workflow Definition ---

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
        errorMessage: z.string().optional(),
    }),
    execute: async (params) => {
        const { reportContent, fileNameBase, errorMessage } = params.inputData;
        if (errorMessage) {
            return { presentationDesign: [], reportContent, fileNameBase, errorMessage };
        }
        
        logger.info("🤖 [Designer AI] Analyzing report and designing presentation structure...");
        try {
            const prompt = `あなたは一流のプレゼンテーション設計者です。以下のレポートを分析し、最適なプレゼン構成案をJSON配列で出力してください。トップレベルの要素は必ず配列([])にしてください。
            各配列要素は、以下のキーを持つJSONオブジェクトです:
            - "title": string
            - "bullets": string[]
            - "visual_suggestion": 'bar_chart' | 'pie_chart' | 'line_chart' | 'none'
            - "context_for_visual": string
            --- レポート ---
            ${reportContent}`;
            
            const designResult = await summarizeAndAnalyzeTool.execute({ ...params, context: { text: reportContent, objective: prompt } });
            if (!designResult.success) {
                throw new Error(`Designer AI failed: ${designResult.message}`);
            }

            let presentationDesign = parseJsonStrings(designResult.data.summary);
            if (!presentationDesign) {
                throw new Error("Failed to parse presentation design JSON from AI.");
            }

            logger.debug({ aiOutput: presentationDesign }, "Parsed presentation design from AI");

            // Handle cases where AI wraps the array in an object
            if (!Array.isArray(presentationDesign) && typeof presentationDesign === 'object' && presentationDesign !== null) {
                const keys = Object.keys(presentationDesign);
                if (keys.length === 1 && Array.isArray(presentationDesign[keys[0]])) {
                    logger.warn("AI returned an object instead of an array. Extracting array from the single key.");
                    presentationDesign = presentationDesign[keys[0]];
                }
            }
            
            const validatedDesign = slideDesignSchema.array().parse(presentationDesign);
            return { presentationDesign: validatedDesign, reportContent, fileNameBase };
        } catch (error) {
            const message = error instanceof Error ? error.message : "An unknown error occurred during presentation design.";
            logger.error({ error }, message);
            return { presentationDesign: [], reportContent, fileNameBase, errorMessage: message };
        }
    },
}))
.then(createStep({
    id: 'generate-content',
    inputSchema: z.object({
        presentationDesign: z.array(slideDesignSchema),
        reportContent: z.string(),
        fileNameBase: z.string(),
        errorMessage: z.string().optional(),
    }),
    outputSchema: z.object({
        enrichedSlides: z.array(z.object({
            design: slideDesignSchema,
            chartData: chartDataSchema.nullable(),
            speech: z.string(),
        })),
        fileNameBase: z.string(),
        errorMessage: z.string().optional(),
    }),
    execute: async (params) => {
        const { presentationDesign, reportContent, fileNameBase, errorMessage } = params.inputData;
        if (errorMessage) {
            return { enrichedSlides: [], fileNameBase, errorMessage };
        }

        logger.info("✍️ [Analyst & Speechwriter AIs] Generating chart data and speech scripts...");
        const contentGenerationPromises = presentationDesign.map(async (design) => {
            const speechPromise = summarizeAndAnalyzeTool.execute({ ...params, context: {
                text: `- タイトル: ${design.title}\n- 要点: ${design.bullets.join(', ')}`,
                objective: `あなたはこのスライドのプレゼンターです。上記のタイトルと要点に基づき、約150字程度の自然で聞きやすいスピーチ原稿を作成してください。`,
            }});

            let chartDataPromise: Promise<ChartData | null> = Promise.resolve(null);
            if (design.visual_suggestion !== 'none') {
                chartDataPromise = (async () => {
                    const analystPrompt = `あなたはデータアナリストです。以下のテキストから、「${design.context_for_visual}」に関するデータを抽出し、${design.visual_suggestion}を描画するためのJSONを出力してください。JSONの形式は { "chart_type": "${design.visual_suggestion.replace('_chart', '')}", "title": "...", "labels": [...], "data": [...] } です。`;
                    const analystResult = await summarizeAndAnalyzeTool.execute({ ...params, context: { text: reportContent, objective: analystPrompt }});
                    if (!analystResult.success) return null;
                    const parsed = parseJsonStrings(analystResult.data.summary);
                    try {
                        return parsed ? chartDataSchema.parse(parsed) : null;
                    } catch { return null; }
                })();
            }

            const [speechResult, chartData] = await Promise.all([speechPromise, chartDataPromise]);
            return {
                design,
                chartData,
                speech: speechResult.success ? speechResult.data.summary : "（原稿の生成に失敗しました）",
            };
        });

        const enrichedSlides = await Promise.all(contentGenerationPromises);
        return { enrichedSlides, fileNameBase };
    },
}))
.then(createStep({
    id: 'generate-visuals',
    inputSchema: z.object({
        enrichedSlides: z.array(z.object({
            design: slideDesignSchema,
            chartData: chartDataSchema.nullable(),
            speech: z.string(),
        })),
        fileNameBase: z.string(),
        errorMessage: z.string().optional(),
    }),
    outputSchema: z.object({
        finalSlides: z.array(z.object({
            title: z.string(),
            bullets: z.array(z.string()),
            imagePath: z.string().optional(),
            notes: z.string(),
        })),
        fileNameBase: z.string(),
        errorMessage: z.string().optional(),
    }),
    execute: async (params) => {
        const { enrichedSlides, fileNameBase, errorMessage } = params.inputData;
        if (errorMessage) {
            return { finalSlides: [], fileNameBase, errorMessage };
        }

        logger.info("🖼️ [Chart Generator] Creating chart images...");
        const finalSlidesPromises = enrichedSlides.map(async (slide, index) => {
            let imagePath: string | undefined = undefined;
            if (slide.chartData) {
                const { chart_type, ...restOfChartData } = slide.chartData;
                const chartResult = await generateChartTool.execute({ ...params, context: { ...restOfChartData, chartType: chart_type, fileName: `chart_${fileNameBase}_${index}` }});
                if (chartResult.success) {
                    imagePath = chartResult.data.imagePath;
                }
            }
            return {
                title: slide.design.title,
                bullets: slide.design.bullets,
                imagePath: imagePath,
                notes: slide.speech,
            };
        });

        const finalSlides = await Promise.all(finalSlidesPromises);
        return { finalSlides, fileNameBase };
    },
}))
.then(createStep({
    id: 'assemble-outputs',
    inputSchema: z.object({
        finalSlides: z.array(z.object({
            title: z.string(),
            bullets: z.array(z.string()),
            imagePath: z.string().optional(),
            notes: z.string(),
        })),
        fileNameBase: z.string(),
        errorMessage: z.string().optional(),
    }),
    outputSchema: finalOutputSchema,
    execute: async (params) => {
        const { finalSlides, fileNameBase, errorMessage } = params.inputData;
        if (errorMessage) {
            return { success: false, message: errorMessage } as const;
        }

        logger.info("📦 [Assembler] Creating final PowerPoint file with notes...");
        const pptResult = await createPowerpointTool.execute({ ...params, context: { fileName: fileNameBase, slides: finalSlides }});

        if (!pptResult.success) {
            return { success: false, message: `Failed to assemble final PowerPoint file: ${pptResult.message}` } as const;
        }

        return {
            success: true,
            data: {
                powerpointPath: pptResult.data.filePath,
            },
        } as const;
    },
}))
.commit(); 