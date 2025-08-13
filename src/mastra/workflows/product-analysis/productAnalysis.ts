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
import fs from 'fs/promises';
import path from 'path';
import { contentScrapeTool } from '../../tools/market-research/contentScrape';
import { pdfScrapeTool } from '../../tools/market-research/pdfScrape';
import { powerpointExtractTool } from '../../tools/product-analysis';
import { summarizeAndAnalyzeTool } from '../../tools/market-research/summarizeAndAnalyze';
import { webSearchTool } from '../../tools/market-research/webSearch';
import { saveReportTool } from '../../tools/util/saveReport';
import { config } from '../../tools/xibo-agent/config';

const finalOutputSchema = z.object({
  report: z.string().describe('The final analysis report.'),
  sources: z.array(z.string()).describe('List of sources used for the analysis.'),
  filePath: z.string().describe('The absolute path to the saved report file.'),
});

/**
 * @module productAnalysisWorkflow
 * @description A workflow to analyze product information from a directory of files.
 */
export const productAnalysisWorkflow = createWorkflow({
  id: 'product-analysis-workflow',
  description: 'Analyzes product information from a directory of files (.pdf, .pptx, .txt with URLs).',
  inputSchema: z.object({
    infoName: z.string().describe('The name under persistent_data/products_info/<infoName> containing product information files.'),
    productName: z.string().describe('The name of the product or service being analyzed.'),
  }),
  outputSchema: finalOutputSchema,
})
.then(createStep({
  /**
   * Collects all supported files from the product info directory.
   * Also attempts to collect competitor files from the 'competitors' subdirectory if present.
   */
  id: 'gather-files',
  inputSchema: z.object({ 
    infoName: z.string(),
    productName: z.string(),
  }),
  outputSchema: z.object({
    pdfFiles: z.array(z.string()),
    pptxFiles: z.array(z.string()),
    textFiles: z.array(z.string()),
    mdFiles: z.array(z.string()),
    urlFiles: z.array(z.string()),
    directoryPath: z.string(),
    compPdfFiles: z.array(z.string()),
    compPptxFiles: z.array(z.string()),
    compTextFiles: z.array(z.string()),
    compMdFiles: z.array(z.string()),
    compUrlFiles: z.array(z.string()),
    productName: z.string(),
  }),
  execute: async ({ inputData }) => {
    const { infoName, productName } = inputData;
    const directoryPath = path.join(config.projectRoot, 'persistent_data', 'products_info', infoName);
    logger.info({ directoryPath }, 'Gathering files from directory...');
    const allFiles = await fs.readdir(directoryPath, { recursive: true, withFileTypes: true });
    
    const pdfFiles = allFiles.filter(f => f.isFile() && f.name.endsWith('.pdf')).map(f => path.join(f.path, f.name));
    const pptxFiles = allFiles.filter(f => f.isFile() && f.name.endsWith('.pptx')).map(f => path.join(f.path, f.name));
    const textFiles = allFiles.filter(f => f.isFile() && f.name.endsWith('.txt')).map(f => path.join(f.path, f.name));
    const mdFiles = allFiles.filter(f => f.isFile() && f.name.endsWith('.md')).map(f => path.join(f.path, f.name));
    const urlFiles = allFiles.filter(f => f.isFile() && f.name.endsWith('.url')).map(f => path.join(f.path, f.name));

    // Competitor subdirectory collection (optional)
    const competitorsDir = path.join(directoryPath, 'competitors');
    let compPdfFiles: string[] = [];
    let compPptxFiles: string[] = [];
    let compTextFiles: string[] = [];
    let compMdFiles: string[] = [];
    let compUrlFiles: string[] = [];
    try {
      const compEntries = await fs.readdir(competitorsDir, { recursive: true, withFileTypes: true });
      compPdfFiles = compEntries.filter(f => f.isFile() && f.name.endsWith('.pdf')).map(f => path.join(f.path, f.name));
      compPptxFiles = compEntries.filter(f => f.isFile() && f.name.endsWith('.pptx')).map(f => path.join(f.path, f.name));
      compTextFiles = compEntries.filter(f => f.isFile() && f.name.endsWith('.txt')).map(f => path.join(f.path, f.name));
      compMdFiles = compEntries.filter(f => f.isFile() && f.name.endsWith('.md')).map(f => path.join(f.path, f.name));
      compUrlFiles = compEntries.filter(f => f.isFile() && f.name.endsWith('.url')).map(f => path.join(f.path, f.name));
    } catch { /* competitors directory is optional */ }

    logger.info({ pdfs: pdfFiles.length, pptx: pptxFiles.length, txt: textFiles.length, md: mdFiles.length, url: urlFiles.length, compPdfs: compPdfFiles.length, compPptx: compPptxFiles.length, compTxt: compTextFiles.length, compMd: compMdFiles.length, compUrl: compUrlFiles.length }, 'File gathering complete.');
    return { pdfFiles, pptxFiles, textFiles, mdFiles, urlFiles, directoryPath, compPdfFiles, compPptxFiles, compTextFiles, compMdFiles, compUrlFiles, productName };
  }
}))
.then(createStep({
  /**
   * Normalizes collected files into a flat list of extraction items.
   * Also reads URLs from .txt/.url files and deduplicates them.
   */
  id: 'build-extraction-items',
  inputSchema: z.object({
    pdfFiles: z.array(z.string()),
    pptxFiles: z.array(z.string()),
    textFiles: z.array(z.string()),
    mdFiles: z.array(z.string()),
    urlFiles: z.array(z.string()),
    directoryPath: z.string(),
    compPdfFiles: z.array(z.string()),
    compPptxFiles: z.array(z.string()),
    compTextFiles: z.array(z.string()),
    compMdFiles: z.array(z.string()),
    compUrlFiles: z.array(z.string()),
    productName: z.string(),
  }),
  outputSchema: z.object({
    items: z.array(z.object({ kind: z.enum(['pdf', 'pptx', 'url', 'md', 'comp_pdf', 'comp_pptx', 'comp_url', 'comp_md']), value: z.string() })),
    productName: z.string(),
  }),
  execute: async ({ inputData }) => {
    const { pdfFiles, pptxFiles, textFiles, mdFiles, urlFiles, compPdfFiles, compPptxFiles, compTextFiles, compMdFiles, compUrlFiles, productName } = inputData;
    const items: { kind: 'pdf'|'pptx'|'url'|'md'|'comp_pdf'|'comp_pptx'|'comp_url'|'comp_md'; value: string }[] = [];

    for (const filePath of pdfFiles) items.push({ kind: 'pdf', value: filePath });
    for (const filePath of pptxFiles) items.push({ kind: 'pptx', value: filePath });
    for (const filePath of mdFiles) items.push({ kind: 'md', value: filePath });

    // Read URL lists from text files
    const urlSet = new Set<string>();
    for (const filePath of textFiles) {
      try {
        const fileContent = await fs.readFile(filePath, 'utf-8');
        const urls = fileContent.split(/\r?\n/).filter(line => line.startsWith('http'));
        for (const url of urls) urlSet.add(url);
      } catch (error) {
        logger.info({ filePath }, 'Skipping unreadable text file.');
      }
    }
    // Read URL lists from .url files
    for (const filePath of urlFiles) {
      try {
        const fileContent = await fs.readFile(filePath, 'utf-8');
        const urls = fileContent.split(/\r?\n/).filter(line => line.startsWith('http'));
        for (const url of urls) urlSet.add(url);
      } catch (error) {
        logger.info({ filePath }, 'Skipping unreadable url file.');
      }
    }

    for (const u of urlSet) items.push({ kind: 'url', value: u });

    // Competitor items
    for (const filePath of compPdfFiles) items.push({ kind: 'comp_pdf', value: filePath });
    for (const filePath of compPptxFiles) items.push({ kind: 'comp_pptx', value: filePath });
    for (const filePath of compMdFiles) items.push({ kind: 'comp_md', value: filePath });

    const compUrlSet = new Set<string>();
    for (const filePath of compTextFiles) {
      try {
        const fileContent = await fs.readFile(filePath, 'utf-8');
        const urls = fileContent.split(/\r?\n/).filter(line => line.startsWith('http'));
        for (const url of urls) compUrlSet.add(url);
      } catch (error) {
        logger.info({ filePath }, 'Skipping unreadable competitor text file.');
      }
    }
    for (const filePath of compUrlFiles) {
      try {
        const fileContent = await fs.readFile(filePath, 'utf-8');
        const urls = fileContent.split(/\r?\n/).filter(line => line.startsWith('http'));
        for (const url of urls) compUrlSet.add(url);
      } catch (error) {
        logger.info({ filePath }, 'Skipping unreadable competitor url file.');
      }
    }
    for (const u of compUrlSet) items.push({ kind: 'comp_url', value: u });

    logger.info({ items: items.length, urls: urlSet.size, compUrls: compUrlSet.size }, 'Built extraction items.');
    return { items, productName };
  }
}))
.then(createStep({
  /**
   * Prepares the per-item payloads for foreach processing.
   */
  id: 'prepare-foreach-input',
  inputSchema: z.object({
    items: z.array(z.object({ kind: z.enum(['pdf', 'pptx', 'url', 'md', 'comp_pdf', 'comp_pptx', 'comp_url', 'comp_md']), value: z.string() })),
    productName: z.string(),
  }),
  // For foreach, we output an array of per-item payloads
  outputSchema: z.array(z.object({ kind: z.enum(['pdf', 'pptx', 'url', 'md', 'comp_pdf', 'comp_pptx', 'comp_url', 'comp_md']), value: z.string(), productName: z.string() })),
  execute: async ({ inputData }) => {
    const { items, productName } = inputData;
    logger.info({ items: items.length }, 'Preparing items for extraction...');
    return items.map(i => ({ ...i, productName }));
  }
}))
.foreach(createStep({
  /**
   * Extracts text content for a single item (file or URL).
   * Errors are tolerated and represented as null results to keep the pipeline flowing.
   */
  id: 'extract-one',
  inputSchema: z.object({ kind: z.enum(['pdf', 'pptx', 'url', 'md', 'comp_pdf', 'comp_pptx', 'comp_url', 'comp_md']), value: z.string(), productName: z.string() }),
  outputSchema: z.object({ source: z.string(), content: z.string(), productName: z.string(), isCompetitor: z.boolean() }).nullable(),
  execute: async ({ inputData, runtimeContext }) => {
    const { kind, value, productName } = inputData;
    try {
      if (kind === 'pdf') {
        const res = await pdfScrapeTool.execute({ context: { url: `file://${value}` }, runtimeContext });
        if (res.success && res.data.content.length > 0) return { source: value, content: res.data.content, productName, isCompetitor: false };
        return null;
      }
      if (kind === 'pptx') {
        const res = await powerpointExtractTool.execute({ context: { filePath: value }, runtimeContext });
        if (res.success && res.data.content.length > 0) return { source: value, content: res.data.content, productName, isCompetitor: false };
        return null;
      }
      if (kind === 'url') {
        const res = await contentScrapeTool.execute({ context: { url: value }, runtimeContext });
        if (res.success && res.data.content.length > 0) return { source: value, content: res.data.content, productName, isCompetitor: false };
        return null;
      }
      if (kind === 'md') {
        const content = await fs.readFile(value, 'utf-8');
        if (content.length > 0) return { source: value, content, productName, isCompetitor: false };
        return null;
      }
      if (kind === 'comp_pdf') {
        const res = await pdfScrapeTool.execute({ context: { url: `file://${value}` }, runtimeContext });
        if (res.success && res.data.content.length > 0) return { source: value, content: res.data.content, productName, isCompetitor: true };
        return null;
      }
      if (kind === 'comp_pptx') {
        const res = await powerpointExtractTool.execute({ context: { filePath: value }, runtimeContext });
        if (res.success && res.data.content.length > 0) return { source: value, content: res.data.content, productName, isCompetitor: true };
        return null;
      }
      if (kind === 'comp_url') {
        const res = await contentScrapeTool.execute({ context: { url: value }, runtimeContext });
        if (res.success && res.data.content.length > 0) return { source: value, content: res.data.content, productName, isCompetitor: true };
        return null;
      }
      if (kind === 'comp_md') {
        const content = await fs.readFile(value, 'utf-8');
        if (content.length > 0) return { source: value, content, productName, isCompetitor: true };
        return null;
      }
      return null;
    } catch (error) {
      logger.info({ source: value }, 'Skipping source due to extraction error.');
      return null;
    }
  }
}), { concurrency: 4 })
.then(createStep({
  /**
   * Aggregates extracted texts into two buckets: product and competitors.
   */
  id: 'aggregate-extractions',
  inputSchema: z.array(z.object({ source: z.string(), content: z.string(), productName: z.string(), isCompetitor: z.boolean() }).nullable()),
  outputSchema: z.object({ extractedTexts: z.array(z.object({ source: z.string(), content: z.string() })), competitorTexts: z.array(z.object({ source: z.string(), content: z.string() })), productName: z.string() }),
  execute: async ({ inputData }) => {
    const nonNull = inputData.filter((x): x is { source: string; content: string; productName: string; isCompetitor: boolean } => x !== null);
    const productName = nonNull[0]?.productName ?? '';
    const extractedTexts = nonNull.filter(x => !x.isCompetitor && x.content.length > 0).map(x => ({ source: x.source, content: x.content }));
    const competitorTexts = nonNull.filter(x => x.isCompetitor && x.content.length > 0).map(x => ({ source: x.source, content: x.content }));
    logger.info({ productSources: extractedTexts.length, competitorSources: competitorTexts.length }, 'Aggregated extracted texts.');
    return { extractedTexts, competitorTexts, productName };
  }
}))
.then(createStep({
  /**
   * Uses web search to automatically discover competitor URLs related to the product name.
   */
  id: 'discover-competitor-urls',
  inputSchema: z.object({ productName: z.string(), extractedTexts: z.array(z.object({ source: z.string(), content: z.string() })), competitorTexts: z.array(z.object({ source: z.string(), content: z.string() })) }),
  outputSchema: z.object({ productName: z.string(), extractedTexts: z.array(z.object({ source: z.string(), content: z.string() })), competitorTexts: z.array(z.object({ source: z.string(), content: z.string() })), discoveredUrls: z.array(z.string()) }),
  execute: async ({ inputData, runtimeContext }) => {
    const { productName, extractedTexts, competitorTexts } = inputData;
    const lang = process.env.LANG || '';
    const query = lang.startsWith('ja')
      ? `${productName} 競合 比較 代替 製品 vs`
      : `${productName} competitors alternatives comparison vs`;

    const search = await webSearchTool.execute({ context: { query, maxResults: 20 }, runtimeContext });
    if (!search.success) {
      return { productName, extractedTexts, competitorTexts, discoveredUrls: [] };
    }
    const urls = search.data.results.map(r => r.url);
    // Deduplicate with already known sources
    const known = new Set<string>([...extractedTexts.map(t => t.source), ...competitorTexts.map(t => t.source)]);
    const deduped = urls.filter(u => !known.has(u));
    logger.info({ query, found: urls.length, new: deduped.length }, 'Discovered competitor URLs.');
    return { productName, extractedTexts, competitorTexts, discoveredUrls: deduped };
  }
}))
.then(createStep({
  /**
   * Fetches content from discovered competitor URLs and merges into competitor texts.
   */
  id: 'fetch-discovered-competitors',
  inputSchema: z.object({ productName: z.string(), extractedTexts: z.array(z.object({ source: z.string(), content: z.string() })), competitorTexts: z.array(z.object({ source: z.string(), content: z.string() })), discoveredUrls: z.array(z.string()) }),
  outputSchema: z.object({ productName: z.string(), extractedTexts: z.array(z.object({ source: z.string(), content: z.string() })), competitorTexts: z.array(z.object({ source: z.string(), content: z.string() })) }),
  execute: async ({ inputData, runtimeContext }) => {
    const { productName, extractedTexts, competitorTexts, discoveredUrls } = inputData;
    if (discoveredUrls.length === 0) {
      return { productName, extractedTexts, competitorTexts };
    }
    const promises = discoveredUrls.map(url => contentScrapeTool.execute({ context: { url }, runtimeContext }));
    const results = await Promise.allSettled(promises);
    const scraped = results
      .map((r, i) => (r.status === 'fulfilled' && r.value.success && r.value.data.content.length > 100) ? { source: discoveredUrls[i], content: r.value.data.content } : null)
      .filter((x): x is { source: string; content: string } => x !== null);
    // Merge with existing competitor texts, dedupe by source
    const all = [...competitorTexts, ...scraped];
    const seen = new Set<string>();
    const merged = all.filter(t => (seen.has(t.source) ? false : (seen.add(t.source), true)));
    logger.info({ fetched: discoveredUrls.length, accepted: scraped.length, merged: merged.length }, 'Fetched discovered competitor contents.');
    return { productName, extractedTexts, competitorTexts: merged };
  }
}))
.then(createStep({
  /**
   * Generates the final analysis report (product + competitors) and returns text + sources.
   */
  id: 'generate-analysis-report',
  inputSchema: z.object({
    productName: z.string(),
    extractedTexts: z.array(z.object({ source: z.string(), content: z.string() })),
    competitorTexts: z.array(z.object({ source: z.string(), content: z.string() })),
  }),
  outputSchema: z.object({ report: z.string(), sources: z.array(z.string()), productName: z.string() }),
  execute: async (params) => {
    const { productName, extractedTexts, competitorTexts } = params.inputData;
    const { runtimeContext } = params;
    logger.info(`Generating analysis report for ${productName}...`);

    if (extractedTexts.length === 0) {
      logger.info('No content available to generate report.');
      return { report: '分析に必要な情報をファイルから抽出できませんでした。', sources: [], productName };
    }

    const combinedText = extractedTexts
      .map(t => `Source: ${t.source}\nContent:\n${t.content}`)
      .join('\n\n---\n\n');
    const competitorCombinedText = competitorTexts
      .map(t => `Competitor Source: ${t.source}\nContent:\n${t.content}`)
      .join('\n\n---\n\n');

    // Derive competitor identifiers from URLs to guide the model
    const competitorNames = Array.from(new Set(
      competitorTexts
        .map(t => {
          try {
            const u = new URL(t.source);
            return u.hostname.replace(/^www\./, '');
          } catch {
            return t.source;
          }
        })
        .filter(Boolean)
    ));

    const sources = [...extractedTexts.map(t => t.source), ...competitorTexts.map(t => t.source)];

    const objective = `以下の情報に基づき、製品「${productName}」の詳細分析および競合分析レポートを作成してください。出力は日本語で、見出しを用いて論理的に構成してください。

必須セクション:
- 製品概要: 本製品の目的、主要ユースケース、想定ユーザー。
- 主な機能と特徴: 機能一覧（箇条書き）と差別化要素。
- 強み/弱み（SWOTのS/W）: 技術・価格・導入/運用・サポートの観点。
- ターゲット顧客層: ペルソナ/セグメント、導入要件。
- 競合分析（詳細）:
  - 競合候補: ${competitorNames.join(', ') || 'N/A'}
  - 競合各社プロフィール: 会社/製品概要、主な機能、対応プラットフォーム、価格情報（分かる範囲）、サポート体制。
  - 機能比較表: 本製品と競合（行=項目、列=製品）で「有/無/限定」等の記述。
  - TCO観点: 初期費用/運用費、導入容易性、拡張性、ベンダーロックイン等。
  - リスク/制約: セキュリティ、スケーラビリティ、依存関係、サポート範囲。
- ポジショニング: 2軸（例: 価格×機能充実度）での相対位置と差別化戦略。
- 推奨事項: 製品改善提案、勝ち筋、次アクション。
- 総括: 主要な結論と意思決定の示唆。

注意:
- 競合の具体名や機能は引用元テキストの根拠に基づいて記載してください。根拠が弱い場合は推測と明示してください。
- 表示できる価格情報が無い場合は「不明」と記載。
- テーブルはMarkdownで簡易表現して構いません。`;

    // Provide both product and competitor materials to the model as input text
    const combinedForModel = `${combinedText}\n\n---\n\n${competitorCombinedText}`;

    const reportResult = await summarizeAndAnalyzeTool.execute({ 
      context: { text: combinedForModel, objective, temperature: 0.6, topP: 0.9 }, 
      runtimeContext 
    });

    if (!reportResult.success) {
      const message = `Failed to generate the final report. Reason: ${reportResult.message}`;
      logger.info({ message }, 'Report generation failed.');
      return { report: `レポート生成に失敗しました: ${message}`, sources, productName };
    }

    logger.info('Report generation complete.');
    return { report: reportResult.data.summary, sources, productName };
  }
}))
.then(createStep({
  /**
   * Persists the generated report to persistent storage and returns the file path.
   */
  id: 'save-report-to-file',
  inputSchema: z.object({ report: z.string(), sources: z.array(z.string()), productName: z.string() }),
  outputSchema: finalOutputSchema,
  execute: async (params) => {
    const { report, sources, productName } = params.inputData;
    // Save to persistent_data/reports using saveReportTool
    const saveResult = await saveReportTool.execute({ ...params, context: { title: productName, content: report } });
    if (saveResult.success) {
      logger.info({ filePath: saveResult.data.filePath }, 'Saved report to file.');
      return { report, sources, filePath: saveResult.data.filePath };
    }
    // If saving fails, still return the report and sources with empty filePath
    logger.info('Report saving failed; returning report without file path.');
    return { report, sources, filePath: '' };
  }
}))
.commit(); 