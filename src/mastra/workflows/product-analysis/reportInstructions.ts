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
 * @module productAnalysisReportInstructions
 * @description Provides instruction text (objective) for the product analysis report generation.
 */

/**
 * Build instruction text for generating a product analysis report.
 * The content is in Japanese and guides the LLM to produce a structured analysis.
 *
 * @param productName Product name for the analysis
 * @param competitorNames List of competitor identifiers derived from sources
 * @returns Instruction text to pass as "objective" for the summarization tool
 */
export function getProductAnalysisInstructions(productName: string, competitorNames: string[]): string {
  return `以下の情報に基づき、製品「${productName}」の詳細分析および競合分析を行い、包括的でプロフェッショナルな品質のレポートを作成してください。
  出力は日本語で、見出しを用いて論理的に構成してください。可能な限り詳細に記述し、定量的な根拠（数値・比率・期間・市場規模推定・価格帯）、具体例、ケーススタディ、表や箇条書きを活用して可読性を高めてください。
  可能であればベンチマークや簡易算出例も示してください（前提・仮定を明記）。
  わかりやすい文章で、丁寧で詳細なレポートを作成してください。
  サブセクションのヘッダはフォントサイズを大きくして、太字で表示してください。
  文字数の目安は3,000字以上とします。

必須セクション:
- エグゼクティブサマリー: 主要な調査結果の簡単な概要。
- 製品概要: 本製品の目的、主要ユースケース、想定ユーザー。
- 市場環境・市場規模推定: 期間、対象市場、CAGR仮定、根拠（引用）を明記。
- ターゲット顧客層: ペルソナ/セグメント、導入要件。
- 導入事例・ユースケース: 業種/規模/目的/効果（可能なら数値効果）。
- 技術アーキテクチャ概略: 構成要素、依存関係、拡張性、可用性。
- セキュリティ・コンプライアンス: 認証/認可、暗号化、監査、準拠規格（例: ISO、SOC、GDPR等）。
- 主な機能と特徴: 機能一覧（箇条書き）と差別化要素。
- 価格比較表: 初期費用/運用費、課金単位（ユーザー数・端末数・容量等）、割引・ボリューム条件。
- 競合分析（詳細）:
  - 競合候補: ${competitorNames.join(', ') || 'N/A'}
  - 競合各社プロフィール: 会社/製品概要、主な機能、対応プラットフォーム、価格情報（分かる範囲）、サポート体制。
  - 機能比較表: 本製品と競合（行=項目、列=製品）で「有/無/限定」等の記述（できる限り詳細）。
- ポジショニング: 2軸（例: 価格×機能充実度）での相対位置と差別化戦略。
- TCO観点: 初期費用/運用費、導入容易性、拡張性、ベンダーロックイン等。
- 運用・保守/サポート: SLA、保守範囲、障害対応、リリース頻度、ドキュメント整備。
- リスク・課題と対応策: 技術/法規/ビジネス上のリスクと軽減策、トレードオフ。
- ロードマップ/将来予測: 今後の進化見込み、想定される競争環境の変化。
- 推奨事項: 製品改善提案、勝ち筋、次アクション。
- 総括: 主要な結論と意思決定の示唆。
- 強み/弱み（SWOTのS/W）: 技術・価格・導入/運用・サポートの観点。
- 用語集: 本文中の専門用語・略語の簡易定義。

【重要】出力フォーマットの厳守:
1) まず最初の行で、AIの挨拶や前置きは一切出力せず、すぐにレポート本文の見出しから開始してください。
2) レポート本文の直後に必ず水平線(---)を1行だけ出力してください（Markdown）。
3) その後に以下のサブセクションを設けてください。
- 引用: 使用したすべての情報源の完全なリスト（タイトルとURL）。
- 関連企業: 言及された企業のリスト（企業名とウェブサイト）。

注意:
- 競合の具体名や機能、会社名は引用元テキストの根拠に基づいて記載してください。根拠が弱い場合は推測と明示してください。
- 表示できる価格情報等が無い場合は「不明」と記載。
- 数値には単位・期間を必ず付与し、通貨は必要に応じてJPY換算を併記して構いません（換算レートや時点を明記）。
- テーブルはMarkdownで簡易表現して構いません。`;
}

