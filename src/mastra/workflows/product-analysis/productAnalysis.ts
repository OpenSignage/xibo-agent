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
// In-memory LRU for extraction results (pdf/pptx)
type CacheKey = string;
const extractCache = new Map<CacheKey, { content: string; ts: number }>();
const order: CacheKey[] = [];
const MAX_CACHE = 128;
const now = () => Date.now();
const makeKey = async (filePath: string): Promise<string> => {
  try {
    const stat = await fs.stat(filePath);
    return `${filePath}|${stat.mtimeMs}|${stat.size}`;
  } catch {
    return `${filePath}|na`;
  }
};
const putCache = (k: string, v: { content: string; ts: number }) => {
  if (!extractCache.has(k)) order.push(k); else order.splice(order.indexOf(k), 1) && order.push(k);
  extractCache.set(k, v);
  while (order.length > MAX_CACHE) {
    const old = order.shift();
    if (old) extractCache.delete(old);
  }
};
import { summarizeAndAnalyzeTool } from '../../tools/market-research/summarizeAndAnalyze';
import { webSearchTool } from '../../tools/market-research/webSearch';
import { saveReportTool } from '../../tools/util/saveReport';
import { getProductAnalysisInstructions } from './reportInstructions';
import { config } from '../../tools/xibo-agent/config';

const finalOutputSchema = z.object({
  report: z.string().describe('The final analysis report.'),
  sources: z.array(z.string()).describe('List of sources used for the analysis.'),
  filePath: z.string().describe('The absolute path to the saved report file.'),
  mdFileName: z.string().describe('The saved report file name (e.g., "xxxx.md").'),
  pdfFileName: z.string().describe('The saved PDF file name (e.g., "xxxx.pdf").'),
});

/**
 * @module productAnalysisWorkflow
 * @description A workflow to analyze product information from a directory of files.
 */
export const productAnalysisWorkflow = createWorkflow({
  id: 'product-analysis-workflow',
  description: 'Analyzes product information from a directory of files (.pdf, .pptx, .txt with URLs).',
  inputSchema: z.object({
    productName: z.string().describe('Target product name (required). Files will be read from persistent_data/products_info/<productName>.'),
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
    const productNameInput: string = (inputData as any).productName;

    let directoryPath: string;
    let pdfFiles: string[] = [];
    let pptxFiles: string[] = [];
    let textFiles: string[] = [];
    let mdFiles: string[] = [];
    let urlFiles: string[] = [];
    let compPdfFiles: string[] = [];
    let compPptxFiles: string[] = [];
    let compTextFiles: string[] = [];
    let compMdFiles: string[] = [];
    let compUrlFiles: string[] = [];

    directoryPath = path.join(config.projectRoot, 'persistent_data', 'products_info', productNameInput);
    logger.info({ directoryPath }, 'Gathering files from product info directory');
    const allFiles = await fs.readdir(directoryPath, { recursive: true, withFileTypes: true });

    const toFull = (f: any) => path.join(f.path, f.name);
    pdfFiles = allFiles.filter(f => f.isFile() && f.name.endsWith('.pdf')).map(toFull);
    pptxFiles = allFiles.filter(f => f.isFile() && (f.name.endsWith('.pptx') || f.name.endsWith('.ppt'))).map(toFull);
    textFiles = allFiles.filter(f => f.isFile() && f.name.endsWith('.txt')).map(toFull);
    mdFiles = allFiles.filter(f => f.isFile() && f.name.endsWith('.md')).map(toFull);
    urlFiles = allFiles.filter(f => f.isFile() && f.name.endsWith('.url')).map(toFull);

    const competitorsDir = path.join(directoryPath, 'competitors');
    try {
      const compEntries = await fs.readdir(competitorsDir, { recursive: true, withFileTypes: true });
      const toComp = (f: any) => path.join(f.path, f.name);
      compPdfFiles = compEntries.filter(f => f.isFile() && f.name.endsWith('.pdf')).map(toComp);
      compPptxFiles = compEntries.filter(f => f.isFile() && (f.name.endsWith('.pptx') || f.name.endsWith('.ppt'))).map(toComp);
      compTextFiles = compEntries.filter(f => f.isFile() && f.name.endsWith('.txt')).map(toComp);
      compMdFiles = compEntries.filter(f => f.isFile() && f.name.endsWith('.md')).map(toComp);
      compUrlFiles = compEntries.filter(f => f.isFile() && f.name.endsWith('.url')).map(toComp);
    } catch { /* optional */ }

    logger.info({ pdfs: pdfFiles.length, ppt: pptxFiles.length, txt: textFiles.length, md: mdFiles.length, url: urlFiles.length, compPdfs: compPdfFiles.length, compPpt: compPptxFiles.length, compTxt: compTextFiles.length, compMd: compMdFiles.length, compUrl: compUrlFiles.length }, 'File gathering complete');
    return { pdfFiles, pptxFiles, textFiles, mdFiles, urlFiles, directoryPath, compPdfFiles, compPptxFiles, compTextFiles, compMdFiles, compUrlFiles, productName: productNameInput ?? '' };
  }
}))
.then(createStep({
  /**
   * Builds per-item extraction payloads from files and URLs.
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
  outputSchema: z.array(z.object({ kind: z.enum(['pdf', 'pptx', 'url', 'md', 'comp_pdf', 'comp_pptx', 'comp_url', 'comp_md']), value: z.string(), productName: z.string() })),
  execute: async ({ inputData, runtimeContext }) => {
    const { pdfFiles, pptxFiles, textFiles, mdFiles, urlFiles, compPdfFiles, compPptxFiles, compTextFiles, compMdFiles, compUrlFiles, productName } = inputData;
    const items: { kind: 'pdf'|'pptx'|'url'|'md'|'comp_pdf'|'comp_pptx'|'comp_url'|'comp_md'; value: string }[] = [];
    logger.info({ productName, pdfs: pdfFiles.length, pptx: pptxFiles.length, md: mdFiles.length, urls: urlFiles.length }, 'Building extraction items');

    for (const filePath of pdfFiles) items.push({ kind: 'pdf', value: filePath });
    for (const filePath of pptxFiles) items.push({ kind: 'pptx', value: filePath });
    for (const filePath of mdFiles) items.push({ kind: 'md', value: filePath });

    // Helper: try to expand wildcard via web search; fallback to sitemap.xml
    const expandWildcard = async (pattern: string): Promise<string[]> => {
      const results: string[] = [];
      try {
        const withoutStar = pattern.replace(/\*+$/, '');
        const u = new URL(withoutStar);
        const host = u.host;
        const pathPrefix = u.pathname.endsWith('/') ? u.pathname.slice(0, -1) : u.pathname;
        const query = pathPrefix && pathPrefix !== '' && pathPrefix !== '/'
          ? `site:${host} inurl:${pathPrefix}`
          : `site:${host}`;
        const search = await webSearchTool.execute({ context: { query, maxResults: 50 } as any, runtimeContext });
        if (search.success) {
          for (const r of search.data.results) results.push(r.url);
        }
        if (results.length === 0) {
          // Try sitemap.xml
          const base = `${u.protocol}//${u.host}`;
          const sitemapUrls = [
            `${base}/sitemap.xml`,
            `${base}/sitemap_index.xml`,
          ];
          for (const sm of sitemapUrls) {
            try {
              const resp = await fetch(sm);
              if (resp.ok) {
                const xml = await resp.text();
                const locs = Array.from(xml.matchAll(/<loc>([^<]+)<\/loc>/g)).map(m => m[1]);
                for (const loc of locs) {
                  try {
                    const lu = new URL(loc);
                    if (lu.host === host && (!pathPrefix || lu.pathname.startsWith(pathPrefix))) {
                      results.push(loc);
                    }
                  } catch {}
                }
              }
            } catch {}
            if (results.length > 0) break;
          }
          // If still empty, perform a shallow crawl starting from base path
          if (results.length === 0) {
            const basePath = `${u.protocol}//${u.host}${pathPrefix || ''}`;
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
                  results.push(current);
                  let m: RegExpExecArray | null;
                  hrefRegex.lastIndex = 0;
                  while ((m = hrefRegex.exec(html)) !== null) {
                    addLink(m[1]);
                  }
                }
              } catch {}
            }
            // Ensure basePath present
            results.push(basePath);
          }
        }
      } catch {}
      return Array.from(new Set(results));
    };

    // Read URL lists from text files
    const urlSet = new Set<string>();
    const patternSet = new Set<string>();
    const limit = 8;
    const pool = async <T,>(tasks: (() => Promise<T>)[], max = limit): Promise<T[]> => {
      const results: T[] = [];
      let i = 0;
      const workers = new Array(Math.min(max, tasks.length)).fill(0).map(async () => {
        while (i < tasks.length) {
          const idx = i++;
          try { results[idx] = await tasks[idx](); } catch { /* ignore */ }
        }
      });
      await Promise.all(workers);
      return results;
    };

    const readAsUrls = (filePath: string) => fs.readFile(filePath, 'utf-8')
      .then(c => c.split(/\r?\n/).map(l => l.trim()).filter(line => line.startsWith('http')))
      .catch(() => [] as string[]);

    const tasks: Array<() => Promise<void>> = [];
    for (const filePath of textFiles) {
      tasks.push(async () => {
        const urls = await readAsUrls(filePath);
        for (const u of urls) { if (u.includes('*')) patternSet.add(u); else urlSet.add(u); }
      });
    }
    for (const filePath of urlFiles) {
      tasks.push(async () => {
        const urls = await readAsUrls(filePath);
        for (const u of urls) { if (u.includes('*')) patternSet.add(u); else urlSet.add(u); }
      });
    }
    await pool(tasks, limit);

    // Expand wildcard patterns using web search (site: and inurl:), with sitemap fallback
    if (patternSet.size > 0) {
      for (const pattern of patternSet) {
        try {
          const expanded = await expandWildcard(pattern);
          for (const u of expanded) urlSet.add(u);
        } catch { logger.warn({ pattern }, 'Wildcard expansion failed'); }
      }
    }

    for (const u of urlSet) items.push({ kind: 'url', value: u });

    // Competitor items
    for (const filePath of compPdfFiles) items.push({ kind: 'comp_pdf', value: filePath });
    for (const filePath of compPptxFiles) items.push({ kind: 'comp_pptx', value: filePath });
    for (const filePath of compMdFiles) items.push({ kind: 'comp_md', value: filePath });

    const compUrlSet = new Set<string>();
    const compPatternSet = new Set<string>();
    for (const filePath of compTextFiles) {
      try {
        const fileContent = await fs.readFile(filePath, 'utf-8');
        const urls = fileContent.split(/\r?\n/).map(l => l.trim()).filter(line => line.startsWith('http'));
        for (const url of urls) { if (url.includes('*')) compPatternSet.add(url); else compUrlSet.add(url); }
      } catch (error) {
        logger.info({ filePath }, 'Skipping unreadable competitor text file.');
      }
    }
    for (const filePath of compUrlFiles) {
      try {
        const fileContent = await fs.readFile(filePath, 'utf-8');
        const urls = fileContent.split(/\r?\n/).map(l => l.trim()).filter(line => line.startsWith('http'));
        for (const url of urls) { if (url.includes('*')) compPatternSet.add(url); else compUrlSet.add(url); }
      } catch (error) {
        logger.info({ filePath }, 'Skipping unreadable competitor url file.');
      }
    }
    if (compPatternSet.size > 0) {
      for (const pattern of compPatternSet) {
        try {
          const expanded = await expandWildcard(pattern);
          for (const u of expanded) compUrlSet.add(u);
        } catch { logger.warn({ pattern }, 'Competitor wildcard expansion failed'); }
      }
    }

    logger.info({ items: items.length, urls: urlSet.size, urlPatterns: patternSet.size, compUrls: compUrlSet.size, compUrlPatterns: compPatternSet.size }, 'Extraction items built');
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
        const key = await makeKey(value);
        const hit = extractCache.get(key);
        if (hit) return { source: value, content: hit.content, productName, isCompetitor: false };
        const res = await pdfScrapeTool.execute({ context: { url: `file://${value}` }, runtimeContext });
        if (res.success && res.data.content.length > 0) {
          putCache(key, { content: res.data.content, ts: now() });
          return { source: value, content: res.data.content, productName, isCompetitor: false };
        }
        return null;
      }
      if (kind === 'pptx') {
        const key = await makeKey(value);
        const hit = extractCache.get(key);
        if (hit) return { source: value, content: hit.content, productName, isCompetitor: false };
        const res = await powerpointExtractTool.execute({ context: { filePath: value }, runtimeContext });
        if (res.success && res.data.content.length > 0) {
          putCache(key, { content: res.data.content, ts: now() });
          return { source: value, content: res.data.content, productName, isCompetitor: false };
        }
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
        const key = await makeKey(value);
        const hit = extractCache.get(key);
        if (hit) return { source: value, content: hit.content, productName, isCompetitor: true };
        const res = await pdfScrapeTool.execute({ context: { url: `file://${value}` }, runtimeContext });
        if (res.success && res.data.content.length > 0) {
          putCache(key, { content: res.data.content, ts: now() });
          return { source: value, content: res.data.content, productName, isCompetitor: true };
        }
        return null;
      }
      if (kind === 'comp_pptx') {
        const key = await makeKey(value);
        const hit = extractCache.get(key);
        if (hit) return { source: value, content: hit.content, productName, isCompetitor: true };
        const res = await powerpointExtractTool.execute({ context: { filePath: value }, runtimeContext });
        if (res.success && res.data.content.length > 0) {
          putCache(key, { content: res.data.content, ts: now() });
          return { source: value, content: res.data.content, productName, isCompetitor: true };
        }
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
}), { concurrency: 8 })
.then(createStep({
  /**
   * Aggregates extracted texts into two buckets: product and competitors.
   */
  id: 'aggregate-extractions',
  inputSchema: z.array(z.object({ source: z.string(), content: z.string(), productName: z.string(), isCompetitor: z.boolean() }).nullable()),
  outputSchema: z.object({ extractedTexts: z.array(z.object({ source: z.string(), content: z.string() })), competitorTexts: z.array(z.object({ source: z.string(), content: z.string() })), productName: z.string() }),
  execute: async ({ inputData }) => {
    const nonNull = inputData.filter((x): x is { source: string; content: string; productName: string; isCompetitor: boolean } => x !== null);
    let productName = nonNull[0]?.productName ?? '';
    const extractedTexts = nonNull.filter(x => !x.isCompetitor && x.content.length > 0).map(x => ({ source: x.source, content: x.content }));
    const competitorTexts = nonNull.filter(x => x.isCompetitor && x.content.length > 0).map(x => ({ source: x.source, content: x.content }));
    // Infer product name if not provided
    if (!productName) {
      try {
        const joined = extractedTexts.slice(0, 5).map(t => t.content).join('\n').slice(0, 4000);
        const titleMatch = joined.match(/#\s*([^\n#]{2,80})/);
        if (titleMatch && titleMatch[1]) {
          productName = titleMatch[1].trim();
        } else {
          const candidates = Array.from(new Set(
            extractedTexts
              .flatMap(t => Array.from(t.content.matchAll(/([A-Z][A-Za-z0-9\-_/]{2,})/g)).map(m => m[1]))
          ));
          productName = (candidates[0] || 'Product').slice(0, 60);
        }
      } catch {
        productName = 'Product';
      }
    }
    logger.info({ productSources: extractedTexts.length, competitorSources: competitorTexts.length }, 'Aggregated extracted texts.');
    return { extractedTexts, competitorTexts, productName };
  }
}))
.then(createStep({
  /**
   * Discovers competitor URLs and fetches their contents, then merges into competitor texts.
   */
  id: 'discover-and-merge-competitors',
  inputSchema: z.object({ productName: z.string(), extractedTexts: z.array(z.object({ source: z.string(), content: z.string() })), competitorTexts: z.array(z.object({ source: z.string(), content: z.string() })) }),
  outputSchema: z.object({ productName: z.string(), extractedTexts: z.array(z.object({ source: z.string(), content: z.string() })), competitorTexts: z.array(z.object({ source: z.string(), content: z.string() })) }),
  execute: async ({ inputData, runtimeContext }) => {
    const { productName, extractedTexts, competitorTexts } = inputData;
    const lang = process.env.LANG || '';
    const query = lang.startsWith('ja')
      ? `${productName} 競合 比較 代替 製品 vs`
      : `${productName} competitors alternatives comparison vs`;

    const search = await webSearchTool.execute({ context: { query, maxResults: 20 }, runtimeContext });
    const urls = search.success ? search.data.results.map((r: any) => r.url) : [];
    const known = new Set<string>([...extractedTexts.map(t => t.source), ...competitorTexts.map(t => t.source)]);
    const discovered = urls.filter(u => !known.has(u));

    if (discovered.length === 0) {
      return { productName, extractedTexts, competitorTexts };
    }
    const results = await Promise.allSettled(discovered.map(url => contentScrapeTool.execute({ context: { url }, runtimeContext })));
    const scraped = results
      .map((r, i) => (r.status === 'fulfilled' && r.value.success && r.value.data.content.length > 100) ? { source: discovered[i], content: r.value.data.content } : null)
      .filter((x): x is { source: string; content: string } => x !== null);

    const all = [...competitorTexts, ...scraped];
    const seen = new Set<string>();
    const merged = all.filter(t => (seen.has(t.source) ? false : (seen.add(t.source), true)));
    logger.info({ query, discovered: discovered.length, accepted: scraped.length, merged: merged.length }, 'Discover and merge competitor contents.');
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

    const objective = getProductAnalysisInstructions(productName, competitorNames);

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
      const mdFileName = path.basename(saveResult.data.filePath);
      const pdfFileName = saveResult.data.pdfFileName;
      return { report, sources, filePath: saveResult.data.filePath, mdFileName, pdfFileName };
    }
    // If saving fails, still return the report and sources with empty filePath
    logger.info('Report saving failed; returning report without file path.');
    return { report, sources, filePath: '', mdFileName: '', pdfFileName: '' };
  }
}))
.commit(); 