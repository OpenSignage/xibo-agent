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
import { createTool } from '@mastra/core/tools';
import { z } from 'zod';
import { GoogleGenerativeAI } from '@google/generative-ai';
import { config } from './config';
import fs from 'fs';
import path from 'path';
import { logger } from '../../logger';

// config.tsで定義された、常に正しいソースディレクトリを指すパスを使用します。
const CONTENTS_DIR = config.paths.contents;
const MANUAL_BASE_URL = config.baseUrl;

let manualContents: Record<string, string> = {};

function loadManualContents() {
  try {
    const files = fs.readdirSync(CONTENTS_DIR);
    for (const file of files) {
      if (file.endsWith('.md')) {
        const key = file.replace('.md', '');
        const content = fs.readFileSync(path.join(CONTENTS_DIR, file), 'utf-8');
        manualContents[key] = content;
      }
    }
  } catch (error) {
    //logger.error(`Failed to load manual contents from '${CONTENTS_DIR}'`, { error });
    throw new Error(`Failed to load manual contents from '${CONTENTS_DIR}'`);
  }
}

// アプリケーション起動時に一度だけマニュアルを読み込む
try {
  loadManualContents();
} catch (error) {
  // 起動時の読み込みエラーは致命的であるため、コンソールにも表示
  console.error(error);
  // process.exit(1); // or handle it gracefully
}

// Function to parse front matter
const parseFrontMatter = (content: string) => {
  const frontMatterMatch = content.match(/^---\n([\s\S]*?)\n---/);
  if (!frontMatterMatch) return null;

  const frontMatter = frontMatterMatch[1];
  const excerptMatch = frontMatter.match(/excerpt:\s*(.*)/);
  const keywordsMatch = frontMatter.match(/keywords:\s*(.*)/);

  return {
    excerpt: excerptMatch ? excerptMatch[1].trim() : '',
    keywords: keywordsMatch ? keywordsMatch[1].split(',').map(k => k.trim()) : []
  };
};

// Generate manual section information
const generateManualSections = () => {
  const sections: Record<string, { title: string; url: string; description: string; keywords: string[] }> = {};

  for (const [key, content] of Object.entries(manualContents)) {
    const frontMatter = parseFrontMatter(content);
    if (!frontMatter) continue;

    const titleMatch = content.match(/#\s+(.*)/);
    const title = titleMatch ? titleMatch[1].trim() : key;

    sections[key] = {
      title,
      url: `${MANUAL_BASE_URL}${key}.html`,
      description: frontMatter.excerpt,
      keywords: frontMatter.keywords
    };
  }

  return sections;
};

const manualSections = generateManualSections();

// Load the manual content
const loadManualContent = () => {
  let content = '';
  for (const [section, text] of Object.entries(manualContents)) {
    content += `\n\n${text}`;
  }

  return content;
};

const MANUAL_CONTENT = loadManualContent();

const genAI = new GoogleGenerativeAI(process.env.GOOGLE_GENERATIVE_AI_API_KEY || '');

// Interface for cache entries
interface CacheEntry {
  answer: string;
  relevantSection: any;
  timestamp: number;
}

// Cache expiration: 1 hour
const CACHE_TTL = 60 * 60 * 1000;

// Cache store
const answerCache = new Map<string, CacheEntry>();

// Function to get an answer from the cache
const getCachedAnswer = (query: string): CacheEntry | null => {
  const cached = answerCache.get(query);
  if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
    logger.info({ query }, "Returning cached answer for manual query.");
    return cached;
  }
  return null;
};

// Function to save an answer to the cache
const cacheAnswer = (query: string, answer: string, relevantSection: any) => {
  answerCache.set(query, {
    answer,
    relevantSection,
    timestamp: Date.now()
  });
  logger.info({ query }, "Cached new answer for manual query.");
};

const findRelevantSection = async (query: string) => {
  try {

    // Check cache
    const cached = getCachedAnswer(query);
    if (cached) {
      return {
        answer: cached.answer,
        relevantSection: cached.relevantSection
      };
    }

    const model = genAI.getGenerativeModel({ model: "gemini-1.5-pro" });

    const prompt = `あなたはXibo-CMSの専門家です。以下のマニュアルの内容を基に、ユーザーの質問に回答してください。
マニュアルには \`![代替テキスト](img/ファイル名.png)\` という形式で画像への参照が含まれています。回答を生成する際、関連する画像があれば、そのMarkdown形式のリンク文字列を、一切変更せずにそのまま回答に含めてください。

マニュアルの内容:
${MANUAL_CONTENT}

ユーザーの質問: ${query}

回答は日本語で、簡潔かつ具体的にお願いします。また、回答の最後に、参考にしたマニュアルのセクション名を記載してください。`;

    const result = await model.generateContent(prompt);
    const response = await result.response;
    let answer = response.text();
    
    if (!answer) {
      logger.warn('No answer generated');
      return {
        answer: '申し訳ありません。回答を生成できませんでした。',
        relevantSection: manualSections.introduction
      };
    }
    
    // Replace relative image paths with absolute URLs
    answer = answer.replace(/\(img\//g, `(https://xibosignage.com/img/manual/en/`);

    // Identify the relevant section
    const sectionMatch = Object.entries(manualSections).find(([_, section]) => 
      answer.toLowerCase().includes(section.title.toLowerCase())
    );

    const relevantSection = sectionMatch ? manualSections[sectionMatch[0] as keyof typeof manualSections] : manualSections.introduction;

    // Cache the answer
    // cacheAnswer(query, answer, relevantSection);

    return {
      answer,
      relevantSection
    };
  } catch (error) {
    logger.error('An error occurred while generating an answer with AI', { error });
    return {
      answer: 'I apologize, but I cannot currently generate an answer.',
      relevantSection: manualSections.introduction
    };
  }
};

export const xiboManualTool = createTool({
  id: 'xibo-manual',
  description: 'Refer to the Xibo user manual to provide an answer',
  inputSchema: z.object({
    query: z.string().describe('The content of the user\'s question or problem'),
  }),
  outputSchema: z.object({
    answer: z.string(),
    relevantSection: z.object({
      title: z.string(),
      url: z.string(),
      description: z.string()
    })
  }),
  execute: async ({ context }) => {
    logger.info({ query: context.query }, "Executing xiboManualTool.");
    const { answer, relevantSection } = await findRelevantSection(context.query);
    
    return {
      answer: `${answer}\n\n詳細は以下のページをご確認ください：\n${relevantSection.url}`,
      relevantSection
    };
  },
});

/**
 * Returns the Xibo manual tool in a structured object.
 * This function is the recommended way to get the tool for agent initialization.
 * @returns An object containing the xiboManualTool.
 */
export function getTools() {
  return {
    xiboManualTool,
  };
} 