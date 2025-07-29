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
 * @module reportInstructions
 * @description Provides the detailed instructions for generating the market research report.
 */

export const getReportGenerationInstructions = (topic: string): string => {
  return `以下の情報に基づき、「${topic}」に関する包括的でプロフェッショナルな品質のマーケットリサーチレポートを作成してください。
レポートは詳細で、以下のサブセクションを含む必要があります。わかりやすい文章で、丁寧で詳細なレポートを作成してください:
サブセクションのヘッダはフォントサイズを大きくして、太字で表示してください。

- エグゼクティブサマリー: 主要な調査結果の簡単な概要。
- 市場規模: 市場の現状の規模の分析。可能な限り過去のデータを年別の市場のサイズを表にまとめてください。
- 成長率: 市場の過去からの成長率の分析。
- 業界トレンド: 業界全体の動向や流行、変化の兆候などを分析。
- 顧客の属性: 顧客の年齢、性別、収入、ライフスタイル、購買行動、ニーズなどを分析。
- 競合: 市場での競合関係の分析。
- サプライチェーン: 製品やサービスの生産、流通、販売に関わるサプライチェーン全体を分析。
- マーケットポジション: マーケットポジショニングの分析。
- 技術動向: 業界の技術革新や新しい技術の動向の分析。
- 規制環境: 業界に関連する法律、規制、政策の分析。
- 主要プレイヤー分析: 分野内の主要企業、その戦略、市場での位置付けに関する考察。(一覧表にできる場合は一覧表にしてください)
- 将来の展望: 機会や脅威を含む、市場の進化に関する予測。
- 課題: 市場での課題の分析。(一覧表にできる場合は一覧表にしてください)

レポート本文を作成した後、水平線(---)を追加し、以下のサブセクションを設けてください。
- 引用: 使用したすべての情報源の完全なリスト（タイトルとURL）。
- 関連企業: 言及された企業のリスト（企業名とウェブサイト）。
`;
}; 