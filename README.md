# Xibo Agent

Xibo-CMSのためのエージェントツールです。

## 環境設定

### APIキーの設定

GoogleGenerativeAIを使用するには、APIキーを設定する必要があります。

#### 方法1: 環境変数の設定

```bash
# macOS/Linux
export GOOGLE_GENERATIVE_AI_API_KEY=your_api_key_here

# Windows
set GOOGLE_GENERATIVE_AI_API_KEY=your_api_key_here
```

#### 方法2: .envファイルの作成

プロジェクトのルートディレクトリに`.env.development`ファイルを作成し、以下の内容を追加：

```env
# Google Generative AI APIキー
GOOGLE_GENERATIVE_AI_API_KEY=your_api_key_here

# Xibo CMS設定
XIBO_CMS_URL=https://your-xibo-cms-url
XIBO_CMS_USERNAME=your_username
XIBO_CMS_PASSWORD=your_password
XIBO_DISPLAY_ID=your_display_id
XIBO_DISPLAY_KEY=your_display_key

# アプリケーション設定
APP_ROOT=/path/to/your/project

# Brave Search APIキー
BRAVE_API_KEY=your_brave_api_key_here
```

### MCPサーバーの設定

MCP（Model Context Protocol）サーバーの設定は`.mcp/config.json`で行います。

#### 設定ファイルの作成

プロジェクトのルートディレクトリに`.mcp/config.json`を作成し、以下の内容を追加：

```json
{
  "mcpServers": {
    "desktop-commander": {
      "type": "local",
      "command": "npx",
      "args": [
        "-y",
        "@smithery/cli@1.1.84",
        "run",
        "@wonderwhy-er/desktop-commander",
        "--key",
        "your_desktop_commander_key_here"
      ],
      "provider": "@wonderwhy-er/desktop-commander",
      "version": "latest",
      "description": "Execute terminal commands and manage files with diff editing capabilities",
      "capabilities": {
        "coding": true,
        "shell": true,
        "terminal": true,
        "task_automation": true
      }
    },
    "brave-search": {
      "type": "local",
      "command": "npx",
      "args": [
        "-y",
        "@modelcontextprotocol/server-brave-search"
      ],
      "env": {
        "BRAVE_API_KEY": "your_brave_api_key_here"
      },
      "provider": "@modelcontextprotocol/server-brave-search",
      "version": "latest",
      "description": "Search the web using Brave Search API",
      "capabilities": {
        "search": true,
        "web": true
      }
    }
  }
}
```

#### 注意事項

- `.mcp`ディレクトリは`.gitignore`に追加されており、GitHubには公開されません
- APIキーなどの機密情報は環境変数から読み込むことを推奨します
- 各開発者は自分の環境に合わせて設定を管理してください

APIキーの取得方法：
1. Google Cloud Consoleにアクセス
2. プロジェクトを作成または選択
3. APIとサービス > 認証情報
4. 「認証情報を作成」> 「APIキー」
5. 生成されたAPIキーをコピー

## Mastra アップデートガイド

### アップデート方法

#### 1. 現在のバージョン確認
```bash
npm list mastra
```

#### 2. 最新バージョンへのアップデート
```bash
npm update mastra
```

#### 3. 特定のバージョンへのアップデート
```bash
npm install mastra@<version>
```

### バージョン管理について

- `package.json`でのバージョン指定方法：
  - `^0.6.0`: メジャーバージョンが変わらない範囲で自動アップデート
  - `~0.6.0`: パッチバージョンのみアップデート
  - `0.6.0`: 完全一致（アップデートなし）
  - `*`: 最新バージョン（非推奨）

### アップデート後の確認事項

1. バージョン確認
```bash
npm list mastra
```

2. 更新可能なパッケージの確認
```bash
npm outdated
```

3. アプリケーションの動作確認
- アップデート後は必ずアプリケーションの動作確認を行ってください
- 特に破壊的変更（Breaking Changes）がないか確認してください

### 注意事項

- メジャーバージョンの変更がある場合は、互換性の問題が発生する可能性があります
- アップデート前に必ず変更履歴を確認することをお勧めします
- 本番環境へのアップデートは、テスト環境で十分な検証を行ってから実施してください

### トラブルシューティング

アップデート後に問題が発生した場合：

1. 前のバージョンに戻す
```bash
npm install mastra@<previous_version>
```

2. 依存関係のクリーンアップ
```bash
npm cache clean --force
rm -rf node_modules
npm install
```

## ツール一覧

### Xibo Manual Tool

Xibo-CMSのマニュアルを参照して回答を提供するツールです。

#### 設定

`src/mastra/tools/xibo-manual/config.ts`で以下の設定を行うことができます：

```typescript
export const config = {
  // マニュアルのベースURL
  baseUrl: 'https://sigme.net/manual-r4/ja/',
  
  // パス設定
  paths: {
    // プロジェクトのルートディレクトリ
    // 環境変数APP_ROOTが設定されていない場合はデフォルト値を使用
    root: process.env.APP_ROOT || '/Users/miuramasataka/OpenSignage/xibo-agent',
    
    // マニュアルコンテンツのディレクトリ
    contents: 'src/mastra/tools/xibo-manual/contents'
  }
} as const;
```

#### 環境変数の設定

異なる環境で使用する場合は、環境変数`APP_ROOT`を設定してください：

```bash
# macOS/Linux
export APP_ROOT=/path/to/your/project

# Windows
set APP_ROOT=C:\path\to\your\project
```

または、`.env.development`ファイルを作成して設定することもできます：

```env
APP_ROOT=/path/to/your/project
```

#### 使用方法

1. マニュアルコンテンツを`contents`ディレクトリに配置
2. 必要に応じて`config.ts`の設定を変更
3. ツールを実行

#### 注意事項

- マニュアルコンテンツは`.md`形式で保存してください
- 各ファイルにはフロントマター（メタデータ）を含めてください
- 環境変数`APP_ROOT`が設定されていない場合は、デフォルトのパスが使用されます

## プレゼンテンプレートとテンプレート駆動レンダリング（TDR）

プレゼン（PowerPoint）生成時の見た目はテンプレート `persistent_data/presentations/templates/default.json` で制御します。レンダリングは常に `src/mastra/tools/presenter/infographicRegistry.ts` を経由し、コード側の見た目デフォルトは原則撤廃しました。優先順は次の通りです。

1) ユーザー定義テンプレート.json > 2) default.json > 3) 必要最小限の幾何補正（はみ出し防止など）

したがって、見た目の変更はテンプレート編集のみで完結します。

### 実装構成
- `src/mastra/tools/presenter/infographicRegistry.ts`: タイプ→レンダラの登録。全インフォグラフィックはここ経由で描画。
- `src/mastra/tools/presenter/styleResolver.ts`: `visualStyles.*` の値取得・型変換ヘルパー。
- `src/mastra/tools/presenter/createPowerpoint.ts`: レジストリを優先的に呼ぶ薄いラッパ（既存レガシー分岐はフォールバック）。

### 代表的な visualStyles キー（要点）
- bullet: `labelFontSize`, `labelAlign`, `valueFontSize`, `targetFontSize`, `valueBoxWidth`, `valueOutsidePad`, `valueTextColor`
- waterfall: `baselineRatio`, `grid`, `gridColor`, `gridWidth`, `gridLevels`, `positiveColor`, `negativeColor`
- venn2: `aFillColor`, `aFillAlpha`, `aLineColor`, `bFillColor`, `bFillAlpha`, `bLineColor`, `showOverlapPercent`, `overlapFontSize`
- heatmap: `baseColor`, `borderColor`, `padLeft`, `padTop`, `labelFontSize`
- progress: `labelAlign`, `labelFontSize`, `labelGap`, `bar.heightMax`, `bar.bg`, `bar.bgLine`, `value.show`, `value.suffix`, `value.fontSize`, `value.align`, `value.offset`, `fillColor`
- gantt: `labelFontSize`, `gridColor`, `gridWidth`, `minBarWidth`, `barColor`, `barLineColor`, `dateLabelFontSize`, `dateLabelColor`, `dateLabelOffsetY`, `dateLabelWidth`, `dateLabelHeight`
- checklist: `gapY`, `markSize`, `baseRowHeight`, `markLineColor`, `markFillColor`, `textColor`
- matrix: `frameLineColor`, `axisLineColor`, `axisFontSize`, `pointFill`, `pointLine`, `pointSize`, `labelFontSize`
- comparison: `labelColor`, `labelFontSize`, `valueColor`, `valueFontSize`, `layoutPolicy.gapX`, `layoutPolicy.padX`, `layoutPolicy.padY`
- callouts: `boxBgColor`, `boxLineColor`, `labelFontSize`, `valueFontSize`, `labelColor`, `valueColor`, `icon.enabled`, `icon.size`, `icon.padding`
- kpi: `labelFontSize`, `valueFontSize`, `layout.gap1Col`, `layout.gap2Col`, `layout.outerMargin1Col`, `layout.outerMargin2Col`, `layout.innerPadX`
- kpi_grid: `labelFontSize`, `valueFontSize`, `borderWidth`, `borderColor`, `gap`
- tables: `headerFill`, `headerColor`, `rowFillA`, `rowFillB`

### ガント（gantt）のスタイル指定

`visualStyles.gantt` で開始日ラベルやグリッド線のスタイルを調整できます。

```json
{
  "visualStyles": {
    "gantt": {
      "shadow": "none",
      "labelFontSize": 12,
      "gridColor": "#9AA3AF",
      "gridWidth": 1.2,
      "minBarWidth": 0.05,
      "barColor": "#E6E6E6",
      "barLineColor": "#DDDDDD",
      "dateLabelFontSize": 12,
      "dateLabelColor": "#666666",
      "dateLabelOffsetY": 0.18,
      "dateLabelWidth": 1.6,
      "dateLabelHeight": 0.2
    }
  }
}
```

- `labelFontSize`: 各タスクの開始日ラベルのフォントサイズ（pt）。
- `gridColor`: ガントの縦グリッド線の色。
- `gridWidth`: ガントの縦グリッド線の太さ。

実装上の挙動:
- 開始日ラベルは各バーの開始X座標に揃え、帯の上（上側）に左寄せで表示します。
- グリッド線は期間に応じて自動で単位を切替（約60日以上: 月、14日以上: 週、2日以上: 日、それ未満: 時間）。

サンプル:
- `persistent_data/presentations/recipes/sample-recipe.json` の「ガント予定（日付付き）」スライド。

### ブレットチャート（bullet）のスタイル指定

`visualStyles.bullet` でラベルの配置や数値表示の体裁を調整できます。

```json
{
  "visualStyles": {
    "bullet": {
      "labelFontSize": 14,
      "labelAlign": "right",        // "left" or "right"
      "valueFontSize": 12,
      "targetFontSize": 11,
      "valueBoxWidth": 0.8,         // 値テキストの幅（in）
      "valueOutsidePad": 0.05,      // バー外に出す際の左パディング（in）
      "targetOffsetY": 0.18         // 目標値テキストの縦方向オフセット（in）
    }
  }
}
```

実装上の挙動:
- ラベルは `labelAlign` と `labelFontSize` を使用
- value はバーの内側終端に右寄せ（短いときは外側に左寄せ）+ `valueFontSize`/`valueBoxWidth`/`valueOutsidePad`
- target は目標ライン上に表示（上部）+ `targetFontSize`/`targetOffsetY`

### ウォーターフォール（waterfall）のスタイル指定
### ベン図（venn2）のスタイル指定

```json
{
  "visualStyles": {
    "venn2": {
      "aFillColor": "#0B5CAB",
      "aFillAlpha": 40,
      "aLineColor": "#0B5CAB",
      "bFillColor": "#00B0FF",
      "bFillAlpha": 40,
      "bLineColor": "#00B0FF",
      "showOverlapPercent": true,
      "overlapFontSize": 14
    }
  }
}
```

### visualStyles キー詳細一覧（デフォルト値）

以下は `persistent_data/presentations/templates/default.json` に記載される既定値（出荷時点）です。値を変更すればコード改修なしで反映されます。各タイプはここに列挙されたキーが必須（未定義は描画スキップ＋警告）です。

#### bullet
| キー | 型 | 既定値 | 説明 |
|---|---|---|---|
| labelFontSize | number | 14 | ラベルのフォントサイズ |
| labelAlign | 'left'|'right' | right | ラベルの水平方向配置 |
| valueFontSize | number | 12 | 値のフォントサイズ |
| targetFontSize | number | 11 | 目標値のフォントサイズ |
| valueBoxWidth | number(in) | 0.8 | 値テキスト用ボックス幅（in） |
| valueOutsidePad | number(in) | 0.05 | バー外側表示時の左パディング |
| targetOffsetY | number(in) | 0.18 | 目標値表示の縦方向オフセット |
| valueTextColor | hex | なし | 値の文字色。未指定時はバー色から自動判定 |

#### waterfall
| キー | 型 | 既定値 | 説明 |
|---|---|---|---|
| baselineRatio | number(0.05-0.95) | 0.55 | ベースラインの位置（領域高に対する比率） |
| grid | boolean | true | グリッド線の表示 |
| gridColor | hex | #9AA3AF | グリッド線色 |
| gridWidth | number | 1.0 | グリッド線太さ |
| gridLevels | number(2-6) | 4 | グリッド線本数 |
| positiveColor | hex | #00B0FF | 増分バーの色（未定義時） |
| negativeColor | hex | #0B5CAB | 減分バーの色（未定義時） |

#### venn2
| キー | 型 | 既定値 | 説明 |
|---|---|---|---|
| aFillColor | hex | #0B5CAB | 左円の塗り色 |
| aFillAlpha | number(0-100) | 40 | 左円の透明度（%） |
| aLineColor | hex | #0B5CAB | 左円の枠色 |
| bFillColor | hex | #00B0FF | 右円の塗り色 |
| bFillAlpha | number(0-100) | 40 | 右円の透明度（%） |
| bLineColor | hex | #00B0FF | 右円の枠色 |
| showOverlapPercent | boolean | true | 重なり率テキストの表示 |
| overlapFontSize | number | 14 | 重なり率テキストのフォントサイズ |

レシピ拡張:
- `visual_recipe` に `overlapLabel: string` を与えると、重なり領域のテキストを任意の文言で表示できます（`showOverlapPercent` より優先）。

#### heatmap
| キー | 型 | 既定値 | 説明 |
|---|---|---|---|
| baseColor | hex | tokens.primary | ベースカラー（明度で濃淡表現） |
| borderColor | hex | #EAEAEA | セル枠色 |
| padLeft | number(in) | 1.0 | 左パディング（Y軸ラベル領域） |
| padTop | number(in) | 0.5 | 上パディング（X軸ラベル領域） |
| labelFontSize | number | 12 | 軸ラベルのフォントサイズ |

#### progress
| キー | 型 | 既定値 | 説明 |
|---|---|---|---|
| labelAlign | 'left'|'right' | right | ラベル配置 |
| labelFontSize | number | 14 | ラベルのフォントサイズ |
| labelGap | number(in) | 0.08 | ラベルとバーの隙間 |
| bar.heightMax | number(in) | 0.4 | バーの最大高さ |
| bar.bg | hex | #EEEEEE | バー背景色 |
| bar.bgLine | hex | #DDDDDD | バー背景枠色 |
| value.show | boolean | true | 値の表示有無 |
| value.suffix | string | % | 値の接尾辞 |
| value.fontSize | number | 12 | 値のフォントサイズ |
| value.align | 'left'|'right' | right | 値の配置基準 |
| value.offset | number(in) | 0.04 | 値のオフセット |
| fillColor | hex | #00B0FF | 進捗の塗り色（未定義時） |

#### gantt
| キー | 型 | 既定値 | 説明 |
|---|---|---|---|
| labelFontSize | number | 12 | 開始日ラベルのフォントサイズ |
| gridColor | hex | #9AA3AF | 縦グリッド線色 |
| gridWidth | number | 1.2 | 縦グリッド線太さ |

#### checklist
| キー | 型 | 既定値 | 説明 |
|---|---|---|---|
| gapY | number(in) | 0.18 | 行間 |
| markSize | number(in) | 0.28 | チェックマークボックスのサイズ |
| baseRowHeight | number(in) | 0.42 | 行の基準高さ |
| markLineColor | hex | #0B5CAB | マーク枠色 |
| markFillColor | hex | #00B0FF | マーク塗り色 |

#### matrix
| キー | 型 | 既定値 | 説明 |
|---|---|---|---|
| frameLineColor | hex | #0B5CAB | 外枠線色 |
| axisLineColor | hex | #0B5CAB | 軸線色 |
| axisFontSize | number | 11 | 軸ラベルサイズ |
| pointFill | hex | #FFC107 | 点の塗り色 |
| pointLine | hex | #FFFFFF | 点の枠色 |
| pointSize | number(in) | 0.16 | 点のサイズ |
| labelFontSize | number | 10 | ラベルサイズ |

実装上の挙動（更新）:
- グリッド（2×2）の外側に上下左右のラベル帯を確保し、その帯の中に軸ラベルを配置します。
  - Y軸: 上側に `yLabels[0]`（上寄せ・中央）、下側に `yLabels[1]`（下寄せ・中央）。
  - X軸: 左側に `xLabels[0]`（中寄せ・左）、右側に `xLabels[1]`（中寄せ・右）。
- 座標は `items[].x`/`items[].y` を [-1, +1] で受け付け、グリッド内の [0,1] に正規化して配置します。
- `items[].z` が 0〜1 のとき、点サイズを `pointSize*0.6`〜`pointSize*1.6` に線形マッピングします（省略時は既定サイズ）。

#### comparison
| キー | 型 | 既定値 | 説明 |
|---|---|---|---|
| labelColor | hex | #000000 | ラベル色 |
| labelFontSize | number | 20 | ラベルサイズ |
| valueColor | hex | #111111 | 値の色 |
| valueFontSize | number | 16 | 値のサイズ |
| layoutPolicy.gapX | number(in) | 0.12 | 2カラム間ギャップ |
| layoutPolicy.padX | number(in) | 0.15 | 内側Xパディング |
| layoutPolicy.padY | number(in) | 0.12 | 内側Yパディング |

#### callouts
| キー | 型 | 既定値 | 説明 |
|---|---|---|---|
| icon.enabled | boolean | true | アイコン生成の有無 |
| icon.size | number(in) | 0.36 | アイコンサイズ |
| icon.padding | number(in) | 0.08 | アイコン周りのパディング |

追加仕様（更新）:
- カード下部右隅にアクセント三角形（右下が直角）を描画します。サイズは `accentHeightRatio`（0〜1）でカード短辺比により決定、塗りは半透明（`accentAlpha`）。
- カードの枠線色はアクセント三角と同一パレット色で描画します。`borderWidth` で太さを指定。
- アイコンはアクセント三角の内部に `contain` で収め、背景は可能な限り透明化（生成プロンプト＋白近似色の自動透過処理）します。
- テンプレ追加キー（`visualStyles.callouts`）: `cornerRadius`, `borderWidth`, `accentHeightRatio`, `accentAlpha`。

#### kpi
| キー | 型 | 既定値 | 説明 |
|---|---|---|---|
| labelFontSize | number | 16 | ラベルサイズ |
| valueFontSize | number | 16 | 値サイズ |
| layout.gap1Col | number(in) | 0.24 | 1列時のカード間ギャップ |
| layout.gap2Col | number(in) | 0.30 | 2列時のカード間ギャップ |
| layout.outerMargin1Col | number(in) | 0.02 | 1列時の外余白 |
| layout.outerMargin2Col | number(in) | 0.06 | 2列時の外余白 |
| layout.innerPadX | number(in) | 0.20 | カード内側のXパディング |
| labelTopOffset | number(in) | 0.12 | ラベル開始位置の上余白 |
| labelHeight | number(in) | 0.34 | ラベル領域の高さ |
| valueTopOffset | number(in) | 0.52 | 値の開始位置（上からのオフセット） |
| valueBottomPad | number(in) | 0.12 | 値領域の下側余白（はみ出し防止） |

#### kpi_grid
| キー | 型 | 既定値 | 説明 |
|---|---|---|---|
| labelFontSize | number | 12 | ラベルサイズ |
| valueFontSize | number | 18 | 値サイズ |
| borderWidth | number | 0.5 | 枠線太さ |
| borderColor | hex | #FFFFFF | 枠線色 |
| gap | number(in) | 0.4 | カード間ギャップ |

#### tables（table）
| キー | 型 | 既定値 | 説明 |
|---|---|---|---|
| headerFill | hex | #3B7FD3 | ヘッダー行背景色 |
| headerColor | hex | #FFFFFF | ヘッダー文字色 |
| rowFillA | hex | #FFFFFF | 偶数行背景色 |
| rowFillB | hex | #F7FAFF | 奇数行背景色 |

#### チャート（Chart.js連携・種別別のキーのみ）
#### pyramid
| キー | 型 | 既定値 | 説明 |
|---|---|---|---|
| maxLayers | number | 3 | 層数の上限 |
| labelFontSize | number | 11 | ラベルサイズ |
| labelColor | 'auto' or hex | 'auto' | ラベル色（'auto'は背景コントラストで自動） |
| borderColor | hex | #FFFFFF | 枠線色 |

#### funnel
| キー | 型 | 既定値 | 説明 |
|---|---|---|---|
| layers | number | 4 | 段数 |
| labelFontSize | number | 18 | 左側ラベルのフォントサイズ |
| valueFontSize | number | 20 | セグメント中央の値フォントサイズ |
| baseColor | hex | #0B5CAB | 勾配の基準色（上段ほど明るく、下段ほど暗く） |
| gradientMinRatio | number(0-1) | 0.05 | 勾配の暗さ下限（0に近いほど濃淡差が大きい） |
| gradientMaxRatio | number(0-1) | 1.0 | 勾配の明るさ上限 |
| gradientGamma | number(>0) | 0.7 | 勾配カーブのガンマ補正（小さいほど上部をより明るく） |
| gradientTopColor | hex | #FFFFFF | 上部へブレンドする色（既定は白） |
| alpha.barFill | number(0-1) | 0.4 | 塗りの透明度（枠は同色不透明） |

実装上の挙動:
- 台形は `flipV: true` で上辺>下辺のファネルを描画。
- 配色は `baseColor` を基準に、上側は `gradientTopColor` へブレンド、下側は基準色寄りに。比率は `gradientMinRatio`〜`gradientMaxRatio` を `gradientGamma` で補正して決定。
- 塗りは半透明（`alpha.barFill`）、枠は同色の不透明。

#### timeline
| キー | 型 | 既定値 | 説明 |
|---|---|---|---|
| axisLineColor | hex | #0B5CAB | 軸線色 |
| axisLineWidth | number | 1.2 | 軸線太さ |
| pointFill | hex | #FFC107 | ポイント塗り色 |
| pointLine | hex | #FFFFFF | ポイント枠色 |
| pointSize | number(in) | 0.16 | ポイントサイズ |
| labelFontSize | number | 11 | ラベルサイズ |
| labelColor | 'auto' or hex | 'auto' | ラベル色（'auto'は背景コントラストで自動） |

#### roadmap
| キー | 型 | 既定値 | 説明 |
|---|---|---|---|
| axisLineColor | hex | #FFFFFF | 軸線色 |
| axisLineWidth | number | 1.2 | 軸線太さ |
| pointLine | hex | #FFFFFF | ポイント枠色 |
| labelFontSize | number | 11 | マイルストーンラベルサイズ |
| dateFontSize | number | 9 | 日付サイズ |
| dateColor | hex | #666666 | 日付色 |
### labelColor の共通ルール
- ほとんどのビジュアルで `labelColor` を受け付けます。
- 値は `'auto'` または 6桁HEX を指定できます。
- `'auto'` の場合は背景色とのコントラストから黒/白を自動選択します（チャート系はプロット背景/目盛り背景を基準に、その他は該当ボックス/レイヤの実効背景色を基準）。

チャート系（scatter/bubble など）のポイントラベルも `labelColor: 'auto'` を受け入れ、背景が明るい前提では自動的にダーク系（#333）に、明示色指定時はその色を使用します。

#### heatmap
| キー | 型 | 既定値 | 説明 |
|---|---|---|---|
| baseColor | hex | #0B5CAB | ベースカラー |
| borderColor | hex | #EAEAEA | セル枠色 |
| padLeft | number(in) | 1.0 | 左パディング |
| padTop | number(in) | 0.5 | 上パディング |
| labelFontSize | number | 12 | 軸ラベルサイズ |

#### image
| キー | 型 | 既定値 | 説明 |
|---|---|---|---|
| sizing | 'contain'|'cover' | contain | 画像フィット方式 |
共通`visualStyles.charts`は廃止しました。各チャート種別（`*_chart`）に完結してキーを定義してください。よく使うキーは次の通りです（種別により適用外あり）。

- `gridColor`: グリッド線色（pie/doughnut除く。radar/polarは極座標グリッド）
- `legend.position`: 't'|'r'|'b'|'l'
- `bar.borderRadius`, `bar.borderSkipped`: 棒グラフの角丸/スキップ
- `line.tension`, `line.pointRadius`, `line.pointHoverRadius`, `line.fillAlpha`: 折れ線/面グラフ関連

種別の例（default.json既定）:
- bar_chart/horizontal_bar_chart/stacked_bar_chart: `gridColor`, `bar.*`, `legend.position`
- line_chart/area_chart: `gridColor`, `line.*`, `legend.position`
- pie_chart: `legend.position`, `alpha.pieDoughnut`
- radar_chart/polar_area_chart/scatter_chart/bubble_chart: `gridColor`, `legend.position`

#### チャートタイトルのフォントサイズ指定（重要）

- bar_chart: `titleFontSizeBar`
- 上記以外（kpi_donut/pie_chart/line_chart/polar_area_chart/radar_chart/scatter_chart/bubble_chart/horizontal_bar_chart/stacked_bar_chart/area_chart）: `titleFontSizeDefault`

備考:
- 未指定時は Chart.js の既定フォントサイズが使われます。
- 例）kpi_donut のタイトルを大きくするには `visualStyles.kpi_donut.titleFontSizeDefault` を設定してください。

### 主要チャートタイプのレシピ仕様とスタイルキー（追補）

以下はテンプレート駆動レンダリング（TDR）でサポートしているチャート種別のレシピ（recipe）構造と、代表的なスタイルキーです。レシピは `slides[].visual_recipe` にそのまま記述します。

#### stacked_bar_chart
- レシピ例（推奨: series 形式）
```json
{
  "type": "stacked_bar_chart",
  "labels": ["Q1","Q2","Q3","Q4"],
  "series": [
    { "label": "製品A", "data": [12,18,9,15] },
    { "label": "製品B", "data": [8,14,7,10] },
    { "label": "製品C", "data": [10,13,9,15] }
  ],
  "title": "スタック棒（見た目確認）"
}
```
- 2D 配列も可: `values: number[][]`
- スタイル（`visualStyles.stacked_bar_chart`）: `gridColor`, `bar.borderRadius`, `legend.position`, `dataLabelFontSize`, `dataLabelColor`, `titleFontSizeDefault`
- 値ラベルはバーの内側に表示（横棒/縦棒とも）。

#### horizontal_bar_chart
- 構造は `bar_chart` と同一（単系列: `labels` + `values`、または `series`）
- タイトルサイズは `titleFontSizeBar`、値ラベルはバー右内側に表示

#### area_chart
- 構造は `line_chart` と同等（`labels` + `values` or `series`）
- タイトルサイズは `titleFontSizeDefault`（bar 専用の `titleFontSizeBar` は無効）

#### scatter_chart
- レシピ例
```json
{
  "type": "scatter_chart",
  "labels": ["P1","P2","P3"],
  "values": [ { "x": 1, "y": 10 }, { "x": 2, "y": 15 }, { "x": 3, "y": 9 } ],
  "title": "サンプル散布図"
}
```
- スタイル（`visualStyles.scatter_chart`）: `labelFontSize`, `labelColor`, `labelOffsetY`, `pointRadius`, `pointHoverRadius`, `pointColor`, `pointBorderColor`, `pointBorderWidth`, `gridColor`, `titleFontSizeDefault`
- 0より大きい値が大半でレンジ比が大きい場合、軸を自動で対数化（X/Y 別々に判定）
- 各点ラベルはプロット位置付近に表示

#### bubble_chart
- レシピ例（z を半径に自動スケーリング）
```json
{
  "type": "bubble_chart",
  "labels": ["B1","B2","B3"],
  "values": [
    { "x": 10, "y": 8,  "z": 120 },
    { "x": 20, "y": 12, "z": 300 },
    { "x": 30, "y": 5,  "z": 80 }
  ],
  "title": "サンプルバブル"
}
```
- `z` の代わりに `r`（ピクセル半径）を直接指定も可
- スタイル（`visualStyles.bubble_chart`）: `pointMinRadius`, `pointMaxRadius`, `labelFontSize`, `labelColor`, `labelOffsetY`, `gridColor`, `titleFontSizeDefault`
- 各点ラベルはプロット位置付近に表示

#### bar_chart / line_chart / pie_chart / radar_chart / polar_area_chart / kpi_donut
- 既存の構造に加え、タイトルサイズは上記「チャートタイトルのフォントサイズ指定」を参照
- `bar_chart` の各バーの値は上側内側に表示

### データラベル（値表示）の方針
- `bar_chart`/`horizontal_bar_chart`/`stacked_bar_chart` では、各データの値をバーの内側に描画します（横棒は終端から内側、縦棒は上端から内側）。
- フォント・色は各チャートの `dataLabelFontSize`, `dataLabelColor` で制御します。
 - `progress` は値（%）をバーの内側右端に右寄せで表示（バーが短い場合は外側に退避）。


`visualStyles.waterfall` で基準線（ベースライン）やグリッド表示を制御できます。

```json
{
  "visualStyles": {
    "waterfall": {
      "baselineRatio": 0.55,   // ベースラインを領域高さに対する比率で指定（0.05〜0.95）
      "grid": true,            // グリッド線の表示有無
      "gridColor": "#DDE3EA", // グリッド線の色
      "gridWidth": 1.0,        // グリッド線の太さ
      "gridLevels": 4          // グリッド線の本数（2〜6）
    }
  }
}
```

実装上の挙動:
- ベースラインは `baselineRatio` に基づいて領域内Y位置を決定（既定 0.55）。
- `grid` が有効な場合、等間隔の水平グリッドを描画し、ベースラインはやや太めで強調します。


## ログ出力

このプロジェクトでは、`@mastra/core`のロガーを使用してログを出力します。

### ログレベルの設定

`src/mastra/tools/xibo-manual/manual.ts`でロガーの設定を行います：

```typescript
const logger = createLogger({
  name: 'xibo-manual',
  level: 'info'  // debug, info, warn, error
});
```

### ログの出力方法

```typescript
// デバッグ情報
logger.debug('メッセージ', { データ });

// 情報
logger.info('メッセージ', { データ });

// 警告
logger.warn('メッセージ', { データ });

// エラー
logger.error('メッセージ', { データ });
```

## 開発環境のセットアップ

1. 依存関係のインストール:
```bash
npm install
```

2. 開発サーバーの起動:
```bash
npm run dev
```

3. ビルド:
```bash
npm run build
```

## ライセンス

Elastic License 2.0 (ELv2) 

#### kpi_donut
| キー | 型 | 既定値 | 説明 |
|---|---|---|---|
| labelFontSize | number | 11 | ラベルサイズ |
| holeScale | number(0-1) | 0.6 | ドーナツの内側の比率（0で穴なし〜1で全て穴） |
| leaderLineWidth | number | 1 | リーダー線の太さ |
| legend.position | 't'|'r'|'b'|'l' | r | 凡例の位置 |
| legend.fontSize | number | 18 | 凡例ラベルのフォントサイズ |
| transparent | boolean | true | 背景透過（PNG） |
| titleFontSizeDefault | number | なし | タイトルフォントサイズ（未指定はChart.js既定） |

実装上の挙動:
- Chart.jsの `doughnut` を使用。`holeScale` から `cutout` を自動設定
- 全チャートを正方キャンバス（1200x1200）で生成し、スライド貼付け時は元アスペクト比を維持したままフィット（上揃え）
- `transparent: true` で背景は透過、falseなら白背景

### 追加・更新（テンプレートおよび描画ポリシー）

- 共通パレット
  - `visualStyles.palette.colors: string[]` を定義すると、KPI/Chart.js系すべてのカラーピッカーに優先して使用されます（例: パステル10色のブランドパレット）。
  - 未定義時は `rules.paletteStrategy` に従い AI/テーマ色から動的生成。

- KPI（カード）
  - `visualStyles.kpi.alpha.barFill: number(0-1)` 塗りの透明度（既定 0.4 推奨）。
  - 表示ロジック: カードの下に白い下地 → 透明塗り → 同色の不透明枠（2px）。文字色は「白背景に対する実効色」から自動で黒/白を選択。

- 棒グラフ（bar_chart / horizontal_bar_chart / stacked_bar_chart）
  - `visualStyles.bar_chart.borderWidth: number` 既定 2。バーの枠は「塗りと同色の不透明」で描画し輪郭を強調。
  - `visualStyles.bar_chart.alpha.barFill: number(0-1)` 塗りの透明度（既定 0.2）。

- 円/ドーナツ/極（pie/doughnut/polarArea）
  - 塗りは `alpha.pieDoughnut`、枠は同色不透明。

- キャンバス/貼付け
  - すべて 1200x1200 の正方キャンバス。スライド貼付けはアスペクト比維持・上揃え。