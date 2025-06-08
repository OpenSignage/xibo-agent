# メディア管理システム設計案

## 概要
画像、映像、音声などのメディアを統一的に管理し、CMSとの連携を容易にするシステム。

## 1. 基本構造

### メディアの種類
```typescript
type MediaType = 'image' | 'video' | 'audio';
```

### メディアの基本情報
```typescript
interface MediaMetadata {
  id: string;
  type: MediaType;
  filename: string;
  originalPath: string;
  cmsMediaId?: string;  // CMSに登録後のID
  createdAt: Date;
  updatedAt: Date;
  tags: string[];
  description?: string;
  metadata: {
    width?: number;
    height?: number;
    duration?: number;
    format: string;
    size: number;
  };
}
```

### メディアの生成情報
```typescript
interface GenerationInfo {
  prompt?: string;
  baseImageId?: string;  // 元画像のID（画像生成の場合）
  model: string;         // 使用したモデル
  parameters: Record<string, any>;
}
```

## 2. データベース設計（LibSQL）

```sql
-- メディアテーブル
CREATE TABLE media (
  id TEXT PRIMARY KEY,
  type TEXT NOT NULL,
  filename TEXT NOT NULL,
  original_path TEXT NOT NULL,
  cms_media_id TEXT,
  created_at TIMESTAMP NOT NULL,
  updated_at TIMESTAMP NOT NULL,
  tags TEXT[],
  description TEXT,
  metadata JSONB NOT NULL
);

-- 生成情報テーブル
CREATE TABLE generation_info (
  media_id TEXT PRIMARY KEY,
  prompt TEXT,
  base_image_id TEXT,
  model TEXT NOT NULL,
  parameters JSONB NOT NULL,
  FOREIGN KEY (media_id) REFERENCES media(id),
  FOREIGN KEY (base_image_id) REFERENCES media(id)
);
```

## 3. 主要な機能

```typescript
// メディア管理クラス
class MediaManager {
  // メディアの登録
  async registerMedia(file: File, metadata: Partial<MediaMetadata>): Promise<MediaMetadata>;
  
  // メディアの生成（画像生成など）
  async generateMedia(type: MediaType, params: GenerationParams): Promise<MediaMetadata>;
  
  // メディアの編集
  async editMedia(id: string, edits: MediaEdit[]): Promise<MediaMetadata>;
  
  // CMSへの登録
  async registerToCMS(id: string): Promise<string>;  // CMSのメディアIDを返す
  
  // メディアの検索
  async searchMedia(query: MediaSearchQuery): Promise<MediaMetadata[]>;
  
  // メディアの削除
  async deleteMedia(id: string): Promise<void>;
}
```

## 4. 画像生成の拡張

```typescript
interface ImageGenerationParams {
  prompt: string;
  baseImageId?: string;  // 元画像のID
  aspectRatio?: string;  // 16:9, 4:3 など
  style?: string;        // スタイル指定
  size?: {
    width: number;
    height: number;
  };
}

// 画像生成ツールの拡張
export const generateImage = createTool({
  id: "generate-image",
  description: "Generate and manage images using Google Gemini API",
  inputSchema: z.object({
    prompt: z.string(),
    baseImageId: z.string().optional(),
    aspectRatio: z.string().optional(),
    style: z.string().optional(),
    size: z.object({
      width: z.number(),
      height: z.number()
    }).optional(),
  }),
  // ... 実装
});
```

## 5. 統合的なメディア管理の利点
- 一貫したメディア管理
- メタデータの一元管理
- CMSとの連携が容易
- 生成履歴の追跡
- タグベースの検索
- バージョン管理

## 6. 実装の優先順位
1. 基本的なメディア管理システムの構築
2. データベース設計と実装
3. 画像生成機能の拡張
4. CMS連携の実装
5. 検索機能の実装
6. 編集機能の実装

## 7. 今後の検討事項
- メディアのバージョン管理方法
- ストレージの最適化
- キャッシュ戦略
- バックアップ戦略
- セキュリティ対策
- パフォーマンス最適化 