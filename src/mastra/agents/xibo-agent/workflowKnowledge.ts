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

/**
 * Workflow Knowledge Base
 * 
 * This module defines the knowledge base for various workflows in the Xibo Agent.
 * Each workflow is defined as a string template that can be included in the agent's instructions.
 */

export const imageGenerationWorkflow = `
画像生成ワークフロー：
1. ユーザーから画像生成の要望を受け取ります
2. ImageGenerationツールを使用して最初の画像を生成します。
3. 生成された画像と画像IDを表示し、ユーザーに確認を求めます
4. ユーザーの応答に応じて：
   - 「登録」の場合：
     a. 画像をCMSのメディアライブラリに登録します
     b. 処理を終了します
   - 「修正」の場合：
     a. 修正の要望を確認します
     b. ImageUpdateツールを使用して新しい画像を生成します
     c. 3の確認プロセスに戻ります
   - 「終了」の場合：
     a. 処理を終了します

画像生成の制約：
- アスペクト比は指定されたものを維持します
- 画像の品質と一貫性を保ちます
- ユーザーの要望を正確に反映します

使用可能なツール：
- ImageGeneration: 新規画像の生成
- ImageUpdate: 既存画像の修正
- getImageHistory: 生成履歴の確認（必要な場合）

注意事項：
- 画像の生成履歴は、新規生成時に初期化されます
- 画像の生成履歴は、生成された画像のIDを使用して管理されます
`; 