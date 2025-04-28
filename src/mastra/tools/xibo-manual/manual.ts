import { createTool } from '@mastra/core/tools';
import { z } from 'zod';
import { readFileSync, readdirSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { GoogleGenerativeAI } from '@google/generative-ai';

const __dirname = dirname(fileURLToPath(import.meta.url));
const rootDir = join(__dirname, '../../../../');

// config.jsonの内容を直接定義
const MANUAL_BASE_URL = 'https://sigme.net/manual-r4/ja/index.html';

// マニュアルの内容を読み込む
const loadManualContent = () => {
  const contentDir = join(__dirname, 'content');
  try {
    const files = readdirSync(contentDir)
      .filter(file => file.endsWith('.md'))
      .sort();

    let content = '';
    for (const file of files) {
      const filePath = join(contentDir, file);
      const fileContent = readFileSync(filePath, 'utf8');
      content += `\n\n## ${file.replace('.md', '')}\n\n${fileContent}`;
    }
    return content;
  } catch (error) {
    console.error('マニュアルの読み込みに失敗しました:', error);
    return ''; // エラー時は空の文字列を返す
  }
};

const MANUAL_CONTENT = loadManualContent();

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || '');

const manualSections = {
  introduction: {
    title: 'イントロダクション',
    url: `${MANUAL_BASE_URL}#introduction`,
    description: 'Sigmeの基本概念とシステムアーキテクチャについて'
  },
  userAccess: {
    title: 'ユーザーアクセス',
    url: `${MANUAL_BASE_URL}#user-access`,
    description: 'ユーザー管理とアクセス制御について'
  },
  cmsNavigation: {
    title: 'CMSナビゲーション',
    url: `${MANUAL_BASE_URL}#cms-navigation`,
    description: 'CMSの操作方法とインターフェースについて'
  },
  display: {
    title: 'ディスプレイ',
    url: `${MANUAL_BASE_URL}#display`,
    description: 'ディスプレイの設定と管理について'
  },
  layout: {
    title: 'レイアウト',
    url: `${MANUAL_BASE_URL}#layout`,
    description: 'レイアウトの作成と編集について'
  },
  media: {
    title: 'メディア',
    url: `${MANUAL_BASE_URL}#media`,
    description: 'メディアファイルの管理と使用方法について'
  },
  scheduling: {
    title: 'スケジューリング',
    url: `${MANUAL_BASE_URL}#scheduling`,
    description: 'コンテンツのスケジュール設定について'
  },
  troubleshooting: {
    title: 'トラブルシューティング',
    url: `${MANUAL_BASE_URL}#troubleshooting`,
    description: '一般的な問題の解決方法について'
  }
};

const findRelevantSection = async (query: string) => {
  try {
    const model = genAI.getGenerativeModel({ model: "gemini-pro" });

    const prompt = `あなたはXibo-CMSの専門家です。以下のマニュアルの内容を基に、ユーザーの質問に回答してください。

マニュアルの内容:
${MANUAL_CONTENT}

ユーザーの質問: ${query}

回答は日本語で、簡潔かつ具体的にお願いします。また、回答の最後に、参考にしたマニュアルのセクション名を記載してください。`;

    const result = await model.generateContent(prompt);
    const response = await result.response;
    const answer = response.text();
    
    if (!answer) {
      return {
        answer: '申し訳ありません。回答を生成できませんでした。',
        relevantSection: manualSections.introduction
      };
    }
    
    // 関連するセクションを特定
    const sectionMatch = Object.entries(manualSections).find(([_, section]) => 
      answer.toLowerCase().includes(section.title.toLowerCase())
    );

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
  description: 'Xibo-CMSのマニュアルを参照して回答を提供します',
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
    const { answer, relevantSection } = await findRelevantSection(context.query);
    
    return {
      answer: `${answer}\n\n詳細は以下のURLをご確認ください：`,
      relevantSection
    };
  },
}); 