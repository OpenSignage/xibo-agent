/**
 * Xibo API Knowledge
 * 
 * This file contains the knowledge base for Xibo's API structure and request handling.
 * It is used to provide the AI with understanding of how to interact with the Xibo CMS API.
 */

export const apiKnowledge = `
AI向けAPI知識：

1. ウィジェット管理プロセス：
   ウィジェットの追加：
   1. まず、モジュールとテンプレートを特定
   2. 次に、「Add Widget」APIを呼び出し
   3. その後、モジュールのプロパティを確認
   4. 最後に、プロパティを指定して「Edit Widget」を呼び出し

   重要なルール：
   - レイアウトにウィジェットを追加する場合：
     * まず、リージョンが存在することを確認
     * その後、リージョンのプレイリストにウィジェットを追加
   - プレイリストにウィジェットを追加する場合：
     * プレイリストに直接追加
     * リージョンの処理は不要

   リージョンの種類と制限：
   - frame: 1つのウィジェットのみ保持可能
     * 2つ目のウィジェットを追加すると自動的にプレイリストに変換
   - playlist: 複数のウィジェットを保持可能
     * ウィジェットは順番に再生
   - zone: テンプレートで使用
     * ウィジェットが追加されると自動的にframe/playlistに変換
   - canvas: エレメント用（APIでは使用不可）

   ウィジェットの種類：
   - 通常のウィジェット: APIで追加可能
   - 静的テンプレートを持つデータウィジェット: APIで追加可能
   - エレメント: APIでは追加不可

2. エラー処理：
   一般的なエラーシナリオ：
   - 404: リソースが見つからない
   - 409: 既存のエンティティとの競合
   - 422: 無効なエンティティが提供された

   エラーレスポンス形式：
   \`\`\`json
   {
       "error": {
           "message": "人間が読めるエラーメッセージ",
           "code": 422,
           "data": {
               "property": "name"
           }
       }
   }
   \`\`\`

3. 重要な注意事項：
   - ウィジェットを編集する場合、すべてのプロパティを指定する必要がある
   - フレームリージョンは2つ目のウィジェットを追加すると自動的にプレイリストに変換
   - リージョンはスタンドアロンのプレイリストには適用されない
   - エレメントはAPIで追加できない
`; 