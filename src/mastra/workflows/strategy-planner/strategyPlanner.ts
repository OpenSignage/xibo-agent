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
import { contentScrapeTool } from '../../tools/market-research/contentScrape';
import { pdfScrapeTool } from '../../tools/market-research/pdfScrape';
import { powerpointExtractTool } from '../../tools/product-analysis';
import { webSearchTool } from '../../tools/market-research/webSearch';

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
		companyName: z.string().optional().describe('Optional company directory name under persistent_data/company_info/<companyName> to load reference materials.'),
		outputTitle: z.string().optional().describe('Optional title to use for the strategy file name. Defaults to "Strategy-Plan"'),
	}),
	outputSchema: finalOutputSchema,
})
.then(createStep({
	/**
	 * Reads both input reports from persistent storage. If one is missing, returns an error.
	 */
	id: 'read-source-reports',
	inputSchema: z.object({ marketResearchReportFile: z.string(), productAnalysisReportFile: z.string(), companyName: z.string().optional(), outputTitle: z.string().optional() }),
	outputSchema: z.object({ marketResearch: z.string(), productAnalysis: z.string(), companyName: z.string().optional(), outputTitle: z.string() }),
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
			return { marketResearch, productAnalysis, companyName: inputData.companyName, outputTitle };
		} catch (error) {
			const message = 'Failed to read one or both reports.';
			logger.error({ error }, message);
			return { marketResearch: '', productAnalysis: '', companyName: inputData.companyName, outputTitle: 'Strategy-Plan' };
		}
	},
}))
.then(createStep({
	/**
	 * Collects reference materials under persistent_data/<companyName>.
	 * Supports .md/.txt/.url direct reads, .pdf/.pptx via tools, and URLs via web scraping tool.
	 */
	id: 'collect-reference-materials',
	inputSchema: z.object({ marketResearch: z.string(), productAnalysis: z.string(), companyName: z.string().optional(), outputTitle: z.string() }),
	outputSchema: z.object({ marketResearch: z.string(), productAnalysis: z.string(), references: z.string(), outputTitle: z.string() }),
	execute: async ({ inputData, runtimeContext }) => {
		const { marketResearch, productAnalysis, companyName, outputTitle } = inputData;
		if (!companyName) {
			logger.info('No companyName provided. Skipping reference material collection.');
			return { marketResearch, productAnalysis, references: '', outputTitle };
		}
		const baseDir = path.join(config.projectRoot, 'persistent_data', 'company_info', companyName);
		logger.info({ baseDir }, 'Collecting company reference materials...');
		let refs: string[] = [];
		try {
			const entries = await fs.readdir(baseDir, { recursive: true, withFileTypes: true } as any);
			const files = (entries as Array<any>).filter(e => e.isFile());
			// Process files by extension
			for (const f of files) {
				const filePath = path.join((f as any).path, f.name);
				if (f.name.endsWith('.md')) {
					try {
						const content = await fs.readFile(filePath, 'utf-8');
						refs.push(`Company Ref: ${filePath}\n${content}`);
					} catch {}
				} else if (f.name.endsWith('.txt') || f.name.endsWith('.url')) {
					try {
						const content = await fs.readFile(filePath, 'utf-8');
						const lines = content.split(/\r?\n/).map(l => l.trim()).filter(l => l.length > 0);
						const urlLines = lines.filter(l => l.startsWith('http'));
						const nonUrlText = lines.filter(l => !l.startsWith('http')).join('\n');
						if (nonUrlText) refs.push(`Company Notes: ${filePath}\n${nonUrlText}`);
						// Split wildcard patterns and plain URLs
						const patternSet = new Set<string>();
						const plainUrls: string[] = [];
						for (const u of urlLines) {
							if (u.includes('*')) patternSet.add(u); else plainUrls.push(u);
						}
						// Helper: expand wildcard with search + sitemap + base fallback
						const expandPattern = async (pattern: string): Promise<string[]> => {
							const acc: string[] = [];
							try {
								const withoutStar = pattern.replace(/\*+$/, '');
								const pu = new URL(withoutStar);
								const host = pu.host;
								const pathPrefix = pu.pathname.endsWith('/') ? pu.pathname.slice(0, -1) : pu.pathname;
								const query = pathPrefix && pathPrefix !== '' && pathPrefix !== '/'
									? `site:${host} inurl:${pathPrefix}`
									: `site:${host}`;
								const search = await webSearchTool.execute({ context: { query, maxResults: 50 } as any, runtimeContext });
								if (search.success) {
									for (const r of search.data.results) acc.push(r.url);
								}
								if (acc.length === 0) {
									// Try sitemap(s)
									const base = `${pu.protocol}//${pu.host}`;
									const sitemapCandidates = [ `${base}/sitemap.xml`, `${base}/sitemap_index.xml` ];
									for (const sm of sitemapCandidates) {
										try {
											const resp = await fetch(sm);
											if (resp.ok) {
												const xml = await resp.text();
												const locs = Array.from(xml.matchAll(/<loc>([^<]+)<\/loc>/g)).map(m => m[1]);
												for (const loc of locs) {
													try {
														const lu = new URL(loc);
														if (lu.host === host && (!pathPrefix || lu.pathname.startsWith(pathPrefix))) {
															acc.push(loc);
														}
													} catch {}
												}
											}
										} catch {}
										if (acc.length > 0) break;
									}
									// If still empty, perform shallow crawl starting from base path
									if (acc.length === 0) {
										const basePath = `${pu.protocol}//${pu.host}${pathPrefix || ''}`;
										const toVisit: string[] = [basePath];
										const visited = new Set<string>();
										const addLink = (link: string) => {
											try {
												const abs = new URL(link, basePath).toString();
												const au = new URL(abs);
												if (au.host === host && (!pathPrefix || au.pathname.startsWith(pathPrefix))) {
													if (!visited.has(abs)) toVisit.push(abs);
												}
											} catch {}
										};
										const hrefRegex = /href=["']([^"']+)["']/gi;
										const MAX_PAGES = 10;
										while (toVisit.length > 0 && visited.size < MAX_PAGES) {
											const current = toVisit.shift() as string;
											if (visited.has(current)) continue;
											visited.add(current);
											try {
												const resp = await fetch(current);
												if (resp.ok) {
													const html = await resp.text();
													acc.push(current);
													let m: RegExpExecArray | null;
													hrefRegex.lastIndex = 0;
													while ((m = hrefRegex.exec(html)) !== null) {
														addLink(m[1]);
													}
												}
											} catch {}
										}
										// Ensure basePath present
										acc.push(basePath);
									}
									// Ensure at least base URL is included
									const basePath = `${pu.protocol}//${pu.host}${pathPrefix || ''}`;
									acc.push(basePath);
								}
							} catch {}
							return Array.from(new Set(acc));
						};
						// Expand wildcard patterns via web search (site: + inurl:)
						const expandedUrls: string[] = [];
						for (const pattern of patternSet) {
							const urls = await expandPattern(pattern);
							for (const u of urls) expandedUrls.push(u);
						}
						const toFetch = Array.from(new Set<string>([...plainUrls, ...expandedUrls]));
						for (const url of toFetch as string[]) {
							const res = await contentScrapeTool.execute({ context: { url: url as string }, runtimeContext });
							if (res.success && res.data.content.length > 100) {
								refs.push(`Company URL: ${url}\n${res.data.content}`);
							}
						}
					} catch {}
				} else if (f.name.endsWith('.pdf')) {
					try {
						const res = await pdfScrapeTool.execute({ context: { url: `file://${filePath}` }, runtimeContext });
						if (res.success && res.data.content.length > 100) refs.push(`Company PDF: ${filePath}\n${res.data.content}`);
					} catch {}
				} else if (f.name.endsWith('.pptx')) {
					try {
						const res = await powerpointExtractTool.execute({ context: { filePath }, runtimeContext });
						if (res.success && res.data.content.length > 100) refs.push(`Company PPTX: ${filePath}\n${res.data.content}`);
					} catch {}
				}
			}
		} catch (error) {
			logger.info({ baseDir, error }, 'No reference materials found or directory unreadable.');
		}
		const references = refs.join('\n\n---\n\n');
		logger.info({ sections: refs.length }, 'Reference materials collected.');
		return { marketResearch, productAnalysis, references, outputTitle };
	},
}))
.then(createStep({
	/**
	 * Uses the LLM to synthesize a detailed, flexible strategy plan in Markdown.
	 */
	id: 'draft-strategy',
	inputSchema: z.object({ marketResearch: z.string(), productAnalysis: z.string(), references: z.string(), outputTitle: z.string() }),
	outputSchema: z.object({ strategyMarkdown: z.string(), outputTitle: z.string() }),
	execute: async (params) => {
		const { marketResearch, productAnalysis, references, outputTitle } = params.inputData;
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

		const combined = `# Market Research Report\n\n${marketResearch}\n\n---\n\n# Product Analysis Report\n\n${productAnalysis}\n\n---\n\n# Company References\n\n${references || '(none)'}`;
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