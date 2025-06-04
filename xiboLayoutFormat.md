## Xibo レイアウトフォーマット (XLF) 解説

Xibo レイアウトフォーマット (XLF) は、レイアウトとそのリソース（画像、動画、テキストなど）の情報を完全に記述するために使用される標準的なXMLドキュメントです。コンテンツ管理システム (CMS) がこのXLFファイルの作成と管理を行い、プレイヤーに送信する前に有効なXMLであることを保証します。

プレイヤーは、このXLFファイルを解釈し、必要なリソースをリクエストし、レイアウトを画面に再生表示する役割を単独で担います。

XLFは、主に以下の2つのパートで構成されていると考えると理解しやすくなります。

1.  **構造 (Structure)**
2.  **メディア (Media)**

---

### 1. 構造 (Structure)

レイアウトの構造は、レイアウト全体の幅、高さ、そしてレイアウトがどのように領域（リージョン）に分割されるかを定義します。これは `<layout>` をルートノードとするXMLドキュメントです。レイアウトはエンドユーザーによってデザインされるため、リージョンとメディアの組み合わせは様々です。

**注意:** Xibo 1.8以降、CMSでは「ウィジェット」をリージョンのタイムラインに追加するという表現が使われますが、プレイヤーにとってはこれは `<media>` ノードとして解釈されます。

#### レイアウト構造の例

以下は、1080pの横長レイアウトで、画面全体を一つのリージョンとする場合のXLF構造の例です。

```xml
<layout schemaVersion="3" width="1920" height="1080" background="126.jpg" bgcolor="#FF3399">
    <action layoutCode="" widgetId="" triggerCode="" targetId="" target="" sourceId="" source="layout" actionType="" triggerType="" id=""/>
    <region id="1" width="1920" height="1080" top="0" left="0" zindex="1">
        <action layoutCode="" widgetId="" triggerCode="" targetId="" target="" sourceId="" source="region" actionType="" triggerType="" id=""/>
        <media/>
        <options>
            <loop>0</loop>
            <transitionType></transitionType>
            <transitionDuration></transitionDuration>
            <transitionDirection></transitionDirection>
        </options>
    </region>
    <drawer id="">
        <media/>
    </drawer>
    <tags>
        <tag>default</tag>
    </tags>
</layout>
```

XLFファイルは常に1つの `<layout>` ノード（ドキュメントのルート要素）と、1つ以上の `<region>` ノードを持ちます。リージョンを持たないレイアウトは無効とみなされます。

#### `<layout>` ノード

`<layout>` ノードは以下のオプションを提供します。

* `schemaVersion`: このレイアウトのスキーマバージョン。
* `width`: レイアウトの幅。
* `height`: レイアウトの高さ。
* `background`: 背景画像のパス (オプション)。
* `bgcolor`: 背景色のHEXカラーコード。
* `enableStat`: このレイアウトの再生証明を記録するかどうかを示す `0` または `1` (2.1以降のみ。存在しない場合は `1` とみなす)。

#### 寸法 (Dimensions)

プレイヤーは、自身の画面サイズに応じて適切なアスペクト比でレイアウトを描画する責任があります。プレイヤーはフルスクリーン表示でもウィンドウ表示でも、またどんな解像度でも動作する可能性があります。そのため、プレイヤーはサポート可能な最大の幅または高さでレイアウトを中心に描画し、必要に応じて余白（黒帯など）を追加できなければなりません。

XLFはレイアウトの幅/高さと、各リージョンの幅/高さ/位置を提供します。これらはレイアウトが**デザインされた**際の寸法です。例えば、レイアウトが1920x1080でデザインされたとします。プレイヤーも1920x1080であれば1:1で描画できますが、プレイヤーが1280x720や1080x1920（縦長）の場合は、スケーリング（拡大縮小）処理が必要になります。

#### `<region>` ノード

`<region>` ノードは以下のオプションを提供します。

* `id`: リージョンID。
* `width`: リージョンの幅。
* `height`: リージョンの高さ。
* `top`: レイアウトの上端からのリージョンの位置。
* `left`: レイアウトの左端からのリージョンの位置。
* `zindex`: このリージョンが画面に描画される順序 (0が最初で、新しいリージョンほど上に重なります)。
* `options`: リージョンノードは、その `<options>` ノード内に追加のオプションを提供します。これらはオプションの要素であり、プレイヤー側で適切なデフォルト値が提供されるべきです。以下に可能なオプションを示します。

    * **ループ (Loop)**
        * このオプションは、リージョン内にメディアアイテムが1つしかない場合にのみ適用されます。
        * その1つのメディアアイテムが終了した後に再読み込みするかどうかを制御します。
        * `loop = 0` の場合: 期限切れのメディアアイテムは、レイアウト全体が終了するまで画面に残ります。
        * `loop = 1` の場合: アイテムは削除され、同じアイテムが再度置き換えられます。
        * デフォルトは `0` (ループしない) です。これは、ロゴ、テキスト、時計など、他のコンテンツが再生されている間ずっと画面に表示しておきたい場合に最も一般的です。これらのアイテムのデュレーション（表示時間）を非常に短く設定（例: 5秒）すると、すぐに期限切れになりますが、他のコンテンツが期限切れになるまで画面に残り、その時点でレイアウト全体が期限切れとなって削除されます。

    * **トランジション (Transition)**
        * リージョンに割り当てられたトランジションは「リージョン出口トランジション」と呼ばれます。これらはレイアウトが終了する際に表示されるべきトランジションです。詳細は後述の「トランジション」セクションを参照してください。

---

### 2. メディア (Media)

Xiboではメディアを表すために3つの用語が使われます。

* **モジュール (Modules)**: 特定のファイルタイプやデータソースを処理し、追加・設定し、描画するソフトウェア内のコンポーネント。
* **メディア (CMS内)**: ライブラリに保存されているファイル。
* **メディア (XLF内)**: 再生するアイテム。
* **ウィジェット (Widgets)**: リージョンのタイムラインやプレイリストに割り当てられたモジュール。

`<media>` ノードは、CMSでリージョンに追加されたウィジェットを表します。これらはプレイリストから来ることもあれば、リージョンのタイムラインから直接来ることもあります。CMSは、どのウィジェットがリージョンに表示されるべきかを事前に計算し、それらをXLF内の `<media>` ノードとして追加します。メディアは、レイアウト内の `<region>` ノードの中にある `<media>` ノードとして現れます。

メディアはXLFに現れる順序で再生され、終了したらループ再生されるべきです。リージョンがループしない唯一のケースは、メディアノードが1つだけで、かつ `loop` オプションが `0` に設定されている場合です。

メディアノードには、すべてのメディアタイプに共通の属性と、メディアモジュールに固有のオプションノードがあります。

#### `<media>` ノードの主な属性

```xml
<media id="" duration="" type="" render="" enableStat="" toDt="" fromDt="">
    <action layoutCode="" widgetId="" targetId="" target="" sourceId="{the media nodes id}" source="widget" actionType="" triggerType="" id=""/>
    <options>
        <uri></uri>
        <transIn></transIn>
        <transInDuration></transInDuration>
        <transInDirection></transInDirection>
        <transOut></transOut>
        <transOutDuration></transOutDuration>
        <transOutDirection></transOutDirection>
    </options>
    <raw>
        </raw>
</media>
```

* `id`: このメディアノードのメディアID (1.7以降ではCMSの `widgetId`)。
* `duration`: このメディアアイテムが再生されるべき時間 (秒単位)。ただし、後述するように上書きされる場合があります。
* `type`: メディアモジュールの種類 (例: `image`, `text`, `video`)。
* `render`: レンダリングタイプで、`native` (ネイティブ描画) または `html` (HTMLとして描画)。
* `enableStat`: このアイテムの再生証明を記録するかどうかを示す `0` または `1` (2.1以降のみ。存在しない場合は `1` とみなす)。
* `toDt`, `fromDt`: ウィジェットに設定された有効期限（開始日時と終了日時）。具体的に設定されていない場合は、Unixタイムスタンプの最小値と最大値が `Y-m-d H:i:s` 形式で表現されます。プレイヤーは有効期限が切れたウィジェットを表示すべきではありません。

#### `<options>` ノード内の共通オプション

* `uri`: `RequiredFiles` (別途定義される、必要なファイルのリスト) に示される保存場所のURI。これはライブラリベースのすべてのメディアに共通です。

#### サブプレイリストウィジェット由来のメディア

ウィジェットがサブプレイリストウィジェットから来ている場合、メディアノードに以下の追加プロパティが追加されます。

* `parentWidgetId`: このウィジェットが派生したサブプレイリストウィジェットのID。
* `displayOrder`: 同じプレイリスト内のウィジェットが表示される順序。
* `playlist`: このウィジェットが派生したプレイリストの名前。

CMSバージョン3.1以降では、サブプレイリストウィジェットにさらに以下の設定が可能です。

* `cyclePlayback`: サイクルベースの再生が有効な場合、レイアウトが表示されるたびに、このサブプレイリストから1つのウィジェットのみが再生されます。同じウィジェットが「再生回数」に達するまで表示されます。
* `playCount`: ウィジェットが次に移るまでの再生回数。
* `isRandom`: 有効な場合、各サイクルの開始時に同じグループからランダムなウィジェットが選択され、その再生回数を満たすまで表示されます。

プレイヤーは `parentWidgetId` を使用して、同じサブプレイリストに属するウィジェットグループを識別する必要があります。

#### `<audio>` ノード (スキーマバージョン5以降)

スキーマバージョン5以降、XLFには `<audio>` ノードが含まれることがあります。これらはメディアアイテムの開始時に再生されるべきオーディオファイルで、オーディオモジュールによって実行されます。オーディオは、他のメディアアイテムに紐づかない独立したメディアノードとしても存在できます。

`<audio>` ノードは、再生するオーディオファイルを表す子 `<uri>` ノードを持ちます。各 `<uri>` ノードは `volume` (音量) および `loop` (ループ再生) 属性を持つことができます。

```xml
<media>
    <audio>
        <uri volume="100" loop="1" mediaId="12">1.mp4</uri>
    </audio>
</media>
```

#### `<commands>` ノード (スキーマバージョン5以降)

スキーマバージョン5以降、XLFには `<commands>` 要素内に1つ以上の `<command>` ノードが含まれることがあります。これらはメディアアイテムが開始されるときに順番に実行されるべきコマンドです。シェルコマンドモジュールによって実行されるべきです。

```xml
<media>
    <commands>
        <command>code</command>
    </commands>
</media>
```

---

### 3. トランジション (Transitions)

メディアのオプションには、各メディアアイテムの開始時と終了時に表示するトランジション（切り替え効果）の指示が含まれます。これらはそれぞれ「イン (In)」と「アウト (Out)」として記述されます。それぞれのトランジションには以下の3つのプロパティがあります。

* **タイプ (Type)**: トランジションの種類。現在サポートされているのは、フェードイン、フェードアウト、フライです。
* **デュレーション (Duration)**: トランジションが実行される時間 (ミリ秒単位)。
* **方向 (Direction)**: トランジションの方向を示すコンパス方位 (フライのみ適用)。N (北), NE (北東), E (東), SE (南東), S (南), SW (南西), W (西), NW (北西)。

リージョン自体にもトランジションを設定でき、これは「リージョン出口トランジション」と呼ばれ、レイアウト全体が終了する際に適用されます。

---

### 4. アクション (Actions)

Xibo バージョン3以降、`<action>` 要素は `<layout>`、`<region>`、または `<media>` ノードの子要素として存在できます。アクションは、インタラクティブコントロールモジュールからの機能を記述します。

アクションは以下の属性を持ちます。

* `id`: アクションのID。
* `actionType`: アクションの種類。
* `triggerType`: `touch` (タッチ) または `webhook` (ウェブフック)。
* `source`: アクションの発生源で、`layout`、`region`、または `widget` のいずれか。これはアクションが子要素となっているノードと同じになります。
* `sourceId`: 発生源のID。
* `target`: アクションの対象で、`region` または `screen` のいずれか。
* `targetId`: 対象が `region` の場合、対象となるリージョンのID。
* `widgetId`: リージョンにナビゲートする場合、ドロワー内のメディアノードのID。

---

### 5. ドロワー (Drawer)

`<drawer>` ノードが提供され、アクションで使用される可能性のある `<media>` ノードを含みます。ドロワーに含まれるメディアは通常の操作では表示されず、実質的に非表示の領域です。

---

### 6. XLF具体例

以下は、白い背景に2つのリージョンを持つレイアウトの完全なXLFの例です。

```xml
<?xml version="1.0" encoding="UTF-8"?>
<layout width="1920" height="1080" resolutionid="9" bgcolor="#ffffff" schemaVersion="2" background="975.jpg">
   <tags>
      <tag>unittest</tag>
   </tags>
   <region id="1" userId="1" width="1812" height="132" top="57.1875" left="54.7875">
      <media id="1" type="text" render="native" duration="5">
         <options>
            <xmds>1</xmds>
            <effect>none</effect>
            <speed>0</speed>
            <backgroundColor />
         </options>
         <raw>
            <text><![CDATA[<p style="text-align: center;"><font color="#000000" face="lucida sans unicode, lucida grande, sans-serif"><span style="font-size: 80px;">Image Alignment Test</span></font></p>]]></text>
         </raw>
      </media>
   </region>
   <region id="2" userId="1" width="1816.8" height="772.79999999999" top="253.9875" left="54.7875">
      <media id="2" type="image" render="native" duration="10">
         <options>
            <uri>2.png</uri>
         </options>
         <raw />
      </media>
      <media id="3" type="image" render="native" duration="10">
         <options>
            <uri>3.png</uri>
            <scaleType>center</scaleType>
            <align>left</align>
            <valign>middle</valign>
         </options>
         <raw />
      </media>
      <media id="4" type="image" render="native" duration="10">
         <options>
            <uri>4.png</uri>
            <scaleType>center</scaleType>
            <align>right</align>
            <valign>middle</valign>
         </options>
         <raw />
      </media>
   </region>
</layout>
```

この例では、`<layout>` タグで全体のサイズ (1920x1080)、背景色 (`#ffffff`)、背景画像 (`975.jpg`) を定義しています。
そして、2つの `<region>` があります。

* 最初のリージョン (id="1") は、テキストメディア (`type="text"`) を5秒間表示します。`<raw>` タグ内に実際のテキストコンテンツがHTML形式で記述されています。
* 2番目のリージョン (id="2") は、3つの画像メディア (`type="image"`) をそれぞれ10秒間表示します。各 `<media>` タグの `<options>` 内にある `<uri>` タグで画像ファイル名を指定しています。また、画像の表示方法に関するオプション (`scaleType`, `align`, `valign`) も設定されています。

---

この解説が、Xiboのレイアウトフォーマット (XLF) の理解の一助となれば幸いです。
ご不明な点がありましたら、お気軽にご質問ください。