import { google } from '@ai-sdk/google';
import { Agent } from '@mastra/core/agent';
import { Step, Workflow, StepExecutionContext } from '@mastra/core/workflows';
import { z } from 'zod';
import * as fs from 'fs';
import * as path from 'path';

// ログレベルの設定
process.env.MASTRA_LOG_LEVEL = 'info';

interface MastraContext {
  prompt: (message: string) => Promise<string>;
}

const llm = google('gemini-1.5-pro-latest');

const agent = new Agent({
  name: 'SVG Illustration Agent',
  model: llm,
  instructions: `
    あなたはSVGイラストレーションの専門家です。ユーザーの指示に基づいて、美しく正確なSVGコードを生成します。

    以下のガイドラインに従ってください：
    1. SVGはシンプルで効率的なコードを心がける
    2. 適切なviewBoxとサイズを設定する
    3. パスや図形は可能な限り最適化する
    4. アニメーションが必要な場合は、適切なタイミングとイージングを設定する
    5. アクセシビリティを考慮し、必要に応じてtitleやdescタグを追加する

    生成するSVGは以下の形式で出力してください：
    \`\`\`svg
    <svg ...>
      <!-- SVGコード -->
    </svg>
    \`\`\`
  `,
});

type GenerateSVGInput = {
  prompt: string;
  style?: string;
  size?: string;
};

type GenerateSVGOutput = {
  svg: string;
  description: string;
};

const generateSVGInputSchema = z.object({
  prompt: z.string().describe('SVGの生成指示'),
  style: z.string().optional().describe('スタイルの指定（例：ミニマル、カートゥーン、リアル）'),
  size: z.string().optional().describe('SVGのサイズ（例：400x400）'),
});

const generateSVGOutputSchema = z.object({
  svg: z.string().describe('生成されたSVGコード'),
  description: z.string().describe('生成されたSVGの説明'),
});

const generateSVG = new Step({
  id: 'generate-svg',
  description: 'ユーザーの指示に基づいてSVGコードを生成します',
  inputSchema: generateSVGInputSchema,
  outputSchema: generateSVGOutputSchema,
  execute: async (context: StepExecutionContext<typeof generateSVGInputSchema>) => {
    console.log('SVG生成ステップを開始します...');
    
    const input = context.context.inputData;

    console.log('入力データ:', JSON.stringify(input, null, 2));

    if (!input) {
      console.error('入力データが見つかりません');
      throw new Error('入力データが見つかりません');
    }

    if (!input.prompt) {
      console.error('プロンプトが指定されていません');
      throw new Error('プロンプトが指定されていません');
    }

    const prompt = `以下の指示に基づいてSVGコードを生成してください：
    指示: ${input.prompt}
    ${input.style ? `スタイル: ${input.style}` : ''}
    ${input.size ? `サイズ: ${input.size}` : ''}

    以下の形式でSVGコードを生成してください：
    \`\`\`svg
    <svg ...>
      <!-- SVGコード -->
    </svg>
    \`\`\`
    `;

    console.log('プロンプト:', prompt);

    const response = await agent.stream([
      {
        role: 'user',
        content: prompt,
      },
    ]);

    let svgCode = '';
    let description = '';
    let receivedChunks = '';

    console.log('レスポンスの受信を開始します...');

    for await (const chunk of response.textStream) {
      receivedChunks += chunk;
      const svgMatch = receivedChunks.match(/```svg\n([\s\S]*?)\n```/);
      if (svgMatch) {
        svgCode = svgMatch[1];
        description = receivedChunks.replace(/```svg\n[\s\S]*?\n```/, '').trim();
        break;
      }
    }

    if (!svgCode) {
      console.error('SVGコードが見つかりません');
      throw new Error('SVGコードが見つかりません');
    }

    console.log('SVGコードを生成しました');
    return {
      svg: svgCode,
      description,
    };
  },
});

type PreviewAndEditSVGInput = GenerateSVGOutput;

type PreviewAndEditSVGOutput = GenerateSVGOutput;

const previewAndEditSVGInputSchema = generateSVGOutputSchema;

const previewAndEditSVGOutputSchema = generateSVGOutputSchema;

const previewAndEditSVG = new Step({
  id: 'preview-and-edit',
  description: '生成されたSVGをプレビューし、必要に応じて修正を行います',
  inputSchema: generateSVGOutputSchema,
  outputSchema: generateSVGOutputSchema,
  execute: async (context: StepExecutionContext<typeof generateSVGOutputSchema>) => {
    const input = context.context.inputData;

    if (!input) {
      throw new Error('SVGコードが見つかりません');
    }

    return input;
  },
});

const svgWorkflow = new Workflow({
  name: 'svg-illustration-workflow',
  triggerSchema: generateSVGInputSchema
})
  .step(generateSVG)
  .then(previewAndEditSVG);

console.log('ワークフローを初期化しました');

svgWorkflow.commit();

console.log('ワークフローをコミットしました');

export { svgWorkflow }; 