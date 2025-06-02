# MCP (Model Context Protocol) サーバー情報

## 概要
MCPサーバーは、AIエージェントがクライアントの環境と安全に相互作用するためのプロトコルを提供します。
現在、複数のMCPサーバーが利用可能で、それぞれ異なる機能を提供しています。

## 利用可能なMCPサーバー

### 1. ファイル操作関連
- `@wonderwhy-er/desktop-commander`
  - 現在設定済み
  - ターミナルコマンドの実行
  - ファイルの管理と編集
  - 差分編集機能

- `@modelcontextprotocol/server-file-manager`
  - より体系的なファイル管理
  - バッチ処理機能
  - メタデータ管理
  - バックアップ機能

- `@modelcontextprotocol/server-media-processor`
  - メディアファイルの変換
  - 最適化
  - バッチ処理
  - メタデータ抽出

### 2. 検索関連
- `@modelcontextprotocol/server-brave-search`
  - 現在設定済み
  - Brave Search APIを使用したウェブ検索

- `@modelcontextprotocol/server-google-search`
  - Google Search APIを使用した検索

- `@modelcontextprotocol/server-bing-search`
  - Bing Search APIを使用した検索

### 3. その他の有用なMCP
- `@modelcontextprotocol/server-image-processor`
  - 画像処理
  - 最適化
  - 変換

- `@modelcontextprotocol/server-video-processor`
  - 動画処理
  - 変換
  - 最適化

- `@modelcontextprotocol/server-document-processor`
  - 文書処理
  - 変換
  - テキスト抽出

- `@modelcontextprotocol/server-archive-manager`
  - アーカイブ管理
  - 圧縮/解凍
  - バックアップ

## 設定例
```json
{
  "mcpServers": {
    "file-manager": {
      "type": "local",
      "command": "npx",
      "args": ["-y", "@modelcontextprotocol/server-file-manager"],
      "provider": "@modelcontextprotocol/server-file-manager",
      "version": "latest"
    },
    "media-processor": {
      "type": "local",
      "command": "npx",
      "args": ["-y", "@modelcontextprotocol/server-media-processor"],
      "provider": "@modelcontextprotocol/server-media-processor",
      "version": "latest"
    }
  }
}
```

## 選択基準

### 1. 機能要件
- 必要なファイル操作の種類
- バッチ処理の必要性
- メタデータ管理の必要性

### 2. 安定性
- メンテナンス状況
- コミュニティの規模
- ドキュメントの充実度

### 3. 拡張性
- カスタマイズの容易さ
- 他のMCPとの連携
- 将来の機能追加

## 注意事項
- MCPサーバーの設定は`.mcp/config.json`で行います
- 各MCPサーバーは必要なAPIキーや認証情報が必要な場合があります
- セキュリティ上の理由から、必要なMCPサーバーのみを有効にすることを推奨します 