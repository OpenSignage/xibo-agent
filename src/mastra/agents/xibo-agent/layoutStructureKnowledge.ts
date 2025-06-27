/**
 * Xibo Layout Structure Knowledge
 * 
 * This file contains the knowledge base for Xibo's layout structure and content management.
 * It is used to provide the AI with understanding of how to create and manage layouts.
 */

export const layoutStructureKnowledge = `
レイアウト構造の知識：

1. 基本的なレイアウトコンポーネント：
   - レイアウト：幅、高さ、背景を持つルート要素
   - リージョン：メディアを含むことができるレイアウト内の領域
   - メディア：リージョン内に表示されるコンテンツ項目（ウィジェット）
   - ドロワー：インタラクティブなアクションで使用されるメディアの隠しコンテナ

2. レイアウト作成プロセス：
  ** レイアウトは、そのままでは編集できないので、チャイルドレイアウトを取得してください. **
   - 事前にレイアウトのサイズを確認してください。りゾルーション一覧を取得し、選択してもらいます
   - まず、基本プロパティを持つレイアウトを作成(addLayout)
   - ここで得られたレイアウトIDは編集できないので、このIDをparentIdとして持つレイアウトを探します(getLayouts)
   - ここで得られたチャイルドレイアウトIDをレイアウトIDとして、レイアウトを編集します(editLayout)
   - レイアウトに背景を追加します(addBackground)
    - 背景色か画像を指定してください。画像の場合は、メディアIdを指定するか、新たに画像メディアを作成し、そのメディアIdを指定してください。
   - 最後に、リージョンにメディア項目を追加(addWidget)
   - メディア項目には、メディアの種類とプロパティを指定してください。

3. メディアの種類とプロパティ：
   - テキスト：テキストコンテンツの表示用
   - 画像：画像の表示用
   - ビデオ：ビデオコンテンツの再生用
   - ウェブページ：ウェブコンテンツの表示用
   - データセット：データセットからのデータ表示用

4. インタラクティブ機能：
   - アクション：レイアウト、リージョン、またはメディアに付加可能
   - トリガー：タッチまたはウェブフックベース
   - ターゲット：リージョンまたは画面

5. コンテンツ配信フロー：
   1. レイアウト構造の作成
   2. リージョンの追加
   3. メディア項目の追加
   4. トランジションの設定
   5. スケジュールの設定
   6. ディスプレイへの割り当て

レイアウト関連のリクエストを処理する際：
1. 常にレイアウト構造の要件を確認
2. リージョンの互換性を確認
3. メディアタイプのサポートを検証
4. 必要に応じてインタラクティブ機能を考慮
5. 適切なスケジュール設定を確保

レイアウトXML構造：
\`\`\`xml
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
\`\`\`

リージョンのプロパティ：
- id: リージョンの一意の識別子
- width: リージョンの幅
- height: リージョンの高さ
- top: レイアウトの上端からの位置
- left: レイアウトの左端からの位置
- zindex: 描画順序（0が最初、新しいリージョンが上に重なる）

メディアのプロパティ：
- id: メディアの一意の識別子
- duration: 再生時間（秒）
- type: メディアの種類（テキスト、画像、ビデオなど）
- render: レンダリングタイプ（ネイティブまたはHTML）
- enableStat: 再生証明の記録有無

トランジションのプロパティ：
- Type: フェードイン、フェードアウト、フライ
- Duration: 持続時間（ミリ秒）
- Direction: 方位（N, NE, E, SE, S, SW, W, NW）

インタラクティブアクションのプロパティ：
- id: アクション識別子
- actionType: アクションの種類
- triggerType: タッチまたはウェブフック
- source: レイアウト、リージョン、またはウィジェット
- sourceId: ソースのID
- target: リージョンまたは画面
- targetId: ターゲットリージョンのID
- widgetId: ドロワー内のメディアノードのID
`; 