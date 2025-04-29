import { createTool } from '@mastra/core/tools';
import { z } from 'zod';
import { GoogleGenerativeAI } from '@google/generative-ai';
import { config } from './config';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

// 元のソースコードのパスを取得
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// config.tsの設定を使用
const BASE_DIR = config.paths.root;
const SOURCE_DIR = path.join(BASE_DIR, config.paths.contents);

const MANUAL_BASE_URL = config.baseUrl;

const CONTENTS_DIR = SOURCE_DIR;

// デバッグ用：パスを確認
console.log('BASE_DIR:', BASE_DIR);
console.log('SOURCE_DIR:', SOURCE_DIR);
console.log('CONTENTS_DIR:', CONTENTS_DIR);

const loadManualContents = () => {
  const contents: Record<string, string> = {};
  
  const files = fs.readdirSync(CONTENTS_DIR);
  for (const file of files) {
    if (file.endsWith('.md')) {
      const key = file.replace('.md', '');
      const content = fs.readFileSync(path.join(CONTENTS_DIR, file), 'utf-8');
      contents[key] = content;
    }
  }

  return contents;
};

const manualContents = loadManualContents();

// フロントマターを解析する関数
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

// マニュアルのセクション情報を生成
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
  
  console.log('Generated sections:', sections);
  return sections;
};

const manualSections = generateManualSections();
console.log('Manual sections:', manualSections);

// マニュアルの内容を読み込む
const loadManualContent = () => {
  let content = '';
  for (const [section, text] of Object.entries(manualContents)) {
    content += `\n\n${text}`;
  }

  return content;
};

const MANUAL_CONTENT = loadManualContent();

const genAI = new GoogleGenerativeAI(process.env.GOOGLE_GENERATIVE_AI_API_KEY || '');

const findRelevantSection = async (query: string) => {
  try {
    const model = genAI.getGenerativeModel({ model: "gemini-1.5-pro" });

    const prompt = `あなたはXibo-CMSの専門家です。以下のマニュアルの内容を基に、ユーザーの質問に回答してください。

マニュアルの内容:
${MANUAL_CONTENT}

ユーザーの質問: ${query}

回答は日本語で、簡潔かつ具体的にお願いします。また、回答の最後に、参考にしたマニュアルのセクション名を記載してください。`;

    const result = await model.generateContent(prompt);
    const response = await result.response;
    const answer = response.text();
    
    if (!answer) {
      console.log('No answer generated');
      return {
        answer: '申し訳ありません。回答を生成できませんでした。',
        relevantSection: manualSections.introduction
      };
    }
    
    // 関連するセクションを特定
    const sectionMatch = Object.entries(manualSections).find(([_, section]) => 
      answer.toLowerCase().includes(section.title.toLowerCase())
    );

    console.log('Section match:', sectionMatch);

    return {
      answer,
      relevantSection: sectionMatch ? manualSections[sectionMatch[0] as keyof typeof manualSections] : manualSections.introduction
    };
  } catch (error) {
    console.error('AIによる回答生成でエラーが発生しました:', error);
    return {
      answer: '申し訳ありません。現在、回答を生成できません。',
      relevantSection: manualSections.introduction
    };
  }
};

export const xiboManualTool = createTool({
  id: 'xibo-manual',
  description: 'Xiboユーザーマニュアルを参照して回答を提供します',
  inputSchema: z.object({
    query: z.string().describe('ユーザーの質問や問題の内容'),
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
    console.log(' findRelevantSection:', context.query);
    const { answer, relevantSection } = await findRelevantSection(context.query);
    console.log(' answer:', answer);
    console.log(' relevantSection:', relevantSection);
    
    return {
      answer: `${answer}\n\n詳細は以下のページをご確認ください：\n${relevantSection.url}`,
      relevantSection
    };
  },
}); 