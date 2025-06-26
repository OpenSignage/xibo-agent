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
export const weatherWorkflow = `
weatherワークフロー：
1. ユーザーから天気情報を取得する地域を指定してもらいます。
2. 指定された地域が英語以外の言語で入力された場合、英語に変換します。
    例：「東京」→「Tokyo」
3.指定された地域の天気情報を取得します。
4. 取得した天気情報をテーブル形式で表示します。ただしユーザーからの表示形式の指定があれば、その形式で表示します。
    例：「東京の天気を解説してください。」→「東京の天気は晴れです。気温が高くなるので、熱中症に注意してください。」
`;
export const googleNewsWorkflow = `
Google Newsワークフロー：
1. ユーザーからGoogle News検索タイプをtopicなのか、geoなのか、queryなのかを指定してもらい、のちの実行時にそのタイプをsearchTypeに指定して実行します
2. typeがtopicならば、WORLD,NATION ,BUSINES,TECHNOLOGY,ENTERTEAIMENT,SPOTS,SCIENCE,HELTHのどのtopicなのかを聞き、topicに指定して実行します
3. typeがgeoならば、入力された情報をlocationに指定して実行します
4. typeがqueryならば、入力された情報をqueryに指定して実行します
5. ユーザーから取得件数の指定があれば、その数値をlimitパラメータに指定して実行します。指定がなければデフォルト値が使用されます。
6. 取得したデータはデフォルトではテーブル形式で、pubDateとtitleを表示します。pubDateもデフォルトでは日本時間で表示します。
`;

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