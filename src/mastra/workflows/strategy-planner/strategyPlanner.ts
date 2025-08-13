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
import { saveReportTool } from '../../tools/util/saveReport';
import { config } from '../../tools/xibo-agent/config';

/**
 * @module strategyPlannerWorkflow
 * @description Aggregates insights from market research and product analysis reports,
 * then drafts a comprehensive marketing strategy in Markdown.
 */

const successOutputSchema = z.object({
	strategyMarkdown: z.string().describe('The final strategy plan in Markdown.'),
	filePath: z.string().describe('The absolute path to the saved strategy file.'),
});
const errorOutputSchema = z.object({
	success: z.literal(false),
	message: z.string(),
	error: z.any().optional(),
});
const finalOutputSchema = z.union([successOutputSchema.extend({ success: z.literal(true) }), errorOutputSchema]);

export const strategyPlannerWorkflow = createWorkflow({
	id: 'strategy-planner-workflow',
	description: 'Creates a comprehensive marketing strategy by combining market research and product analysis reports.',
	inputSchema: z.object({
		marketResearchReportFile: z.string().describe('File name of the market research report located in persistent_data/reports'),
		productAnalysisReportFile: z.string().describe('File name of the product analysis report located in persistent_data/reports'),
		outputTitle: z.string().optional().describe('Optional title to use for the strategy file name. Defaults to "Strategy-Plan"'),
	}),
	outputSchema: finalOutputSchema,
})
.then(createStep({
	/**
	 * Reads both input reports from persistent storage. If one is missing, returns an error.
	 */
	id: 'read-source-reports',
	inputSchema: z.object({ marketResearchReportFile: z.string(), productAnalysisReportFile: z.string(), outputTitle: z.string().optional() }),
	outputSchema: z.object({ marketResearch: z.string(), productAnalysis: z.string(), outputTitle: z.string() }),
	execute: async ({ inputData }) => {
		const reportsDir = config.reportsDir;
		const mrPath = path.join(reportsDir, inputData.marketResearchReportFile);
		const paPath = path.join(reportsDir, inputData.productAnalysisReportFile);
		logger.info({ mrPath, paPath }, 'Reading source reports...');
		try {
			await fs.access(mrPath);
			await fs.access(paPath);
			const [marketResearch, productAnalysis] = await Promise.all([
				fs.readFile(mrPath, 'utf-8'),
				fs.readFile(paPath, 'utf-8'),
			]);
			const outputTitle = inputData.outputTitle || 'Strategy-Plan';
			return { marketResearch, productAnalysis, outputTitle };
		} catch (error) {
			const message = 'Failed to read one or both reports.';
			logger.error({ error }, message);
			return { marketResearch: '', productAnalysis: '', outputTitle: 'Strategy-Plan' };
		}
	},
}))
.then(createStep({
	/**
	 * Uses the LLM to synthesize a detailed, flexible strategy plan in Markdown.
	 */
	id: 'draft-strategy',
	inputSchema: z.object({ marketResearch: z.string(), productAnalysis: z.string(), outputTitle: z.string() }),
	outputSchema: z.object({ strategyMarkdown: z.string(), outputTitle: z.string() }),
	execute: async (params) => {
		const { marketResearch, productAnalysis, outputTitle } = params.inputData;
		if (!marketResearch || !productAnalysis) {
			const fallback = '# Strategy Plan\n\nOne or both reports could not be read.';
			return { strategyMarkdown: fallback, outputTitle };
		}

		const objective = `以下の2つのレポート（市場調査と製品分析）を統合し、具体的で実行可能なマーケティング戦略を日本語のMarkdownで立案してください。柔軟かつ詳細に、短期～中長期の施策も含めて記述してください。

必須セクション:
- 目的とKPI: ビジネス目標、主要KPI（リード、CV、LTV、CACなど）
- ターゲットセグメント: ペルソナ、主要セグメント、優先度、課題仮説
- ポジショニングとメッセージ: 価値提案、差別化要素、主要メッセージ
- キャッチコピー案: 複数案（トーン別/用途別）、短い説明文付き
- コンテンツ/チャネル戦略:
  - Web/SEO/コンテンツ、SNS、広告、イベント、パートナーシップ
  - コンテンツカレンダー（四半期/週次例）
  - 主要チャネル別の施策例とKPI
- キャンペーン設計（複数案）:
  - 目的、ターゲット、オファー、クリエイティブ方向、チャネル、配信計画
  - 計測設計（UTM, A/Bテスト）と改善サイクル
- 価格/パッケージ戦略（分かる範囲）:
  - 価格案、割引/バンドル、フリーミアム/トライアル
- 営業/CSとの連携:
  - リードハンドリング、セールスプレイブック概要、CS施策（オンボーディング/アップセル）
- 競合対応:
  - 主要競合の想定反応と対抗策
  - ウィンロス要因の仮説と改善
- リスクと前提: 主要リスク、回避/緩和策、前提条件
- ロードマップ（90日/6ヶ月/12ヶ月）: マイルストーン、成果物、責任分担
- 付録: 主要な根拠/引用（該当箇所を簡単に示す）

出力形式はMarkdownで、見出し（#, ##, ###）と箇条書きを活用してください。`;

		const combined = `# Market Research Report\n\n${marketResearch}\n\n---\n\n# Product Analysis Report\n\n${productAnalysis}`;
		const result = await summarizeAndAnalyzeTool.execute({ context: { text: combined, objective, temperature: 0.6, topP: 0.9 }, runtimeContext: params.runtimeContext });
		if (!result.success) {
			const fallback = `# Strategy Plan\n\nFailed to draft strategy: ${result.message}`;
			return { strategyMarkdown: fallback, outputTitle };
		}
		return { strategyMarkdown: result.data.summary, outputTitle };
	},
}))
.then(createStep({
	/**
	 * Saves the strategy Markdown to persistent_data/reports and returns the file path.
	 */
	id: 'save-strategy',
	inputSchema: z.object({ strategyMarkdown: z.string(), outputTitle: z.string() }),
	outputSchema: successOutputSchema.extend({ success: z.literal(true) }),
	execute: async (params) => {
		const { strategyMarkdown, outputTitle } = params.inputData;
		const save = await saveReportTool.execute({ ...params, context: { title: outputTitle, content: strategyMarkdown } });
		if (!save.success) {
			return { success: true, strategyMarkdown, filePath: path.join(config.reportsDir, `${outputTitle}.md`) } as const;
		}
		return { success: true, strategyMarkdown, filePath: save.data.filePath } as const;
	},
}))
.commit();