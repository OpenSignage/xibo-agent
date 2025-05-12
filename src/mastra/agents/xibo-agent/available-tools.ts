export const xiboUserManagementTools = `
### ユーザー管理
* 'get-users'：ユーザー一覧の取得
  - パラメータ：
    - userId: 特定のユーザーID（オプション）
    - userName: ユーザー名（オプション）
    - userTypeId: ユーザータイプID（オプション）
    - retired: 退職状態（オプション）
  - レスポンス：ユーザー情報の配列

* 'get-user'：特定ユーザーの情報取得
  - パラメータ：
    - userId: ユーザーID
  - レスポンス：ユーザーの詳細情報

* 'get-user-me'：現在のユーザー情報取得
  - パラメータ：なし
  - レスポンス：現在ログイン中のユーザー情報

* 'add-user'：ユーザーの追加
  - パラメータ：
    - userName: ユーザー名
    - userTypeId: ユーザータイプID
    - email: メールアドレス
    - password: パスワード
    - homePageId: ホームページID（オプション）
    - retired: 退職状態（オプション）
  - レスポンス：追加されたユーザー情報

* 'edit-user'：ユーザーの編集
  - パラメータ：
    - userId: ユーザーID
    - userName: ユーザー名
    - userTypeId: ユーザータイプID
    - email: メールアドレス
    - password: パスワード（オプション）
    - homePageId: ホームページID（オプション）
    - retired: 退職状態（オプション）
  - レスポンス：更新されたユーザー情報

* 'delete-user'：ユーザーの削除
  - パラメータ：
    - userId: ユーザーID
  - レスポンス：削除結果
`;

export const xiboDisplayManagementTools = `
### ディスプレイ管理
* 'get-displays'：ディスプレイ一覧の取得
  - パラメータ：
    - displayId: 特定のディスプレイID（オプション）
    - display: ディスプレイ名（オプション）
    - macAddress: MACアドレス（オプション）
  - レスポンス：ディスプレイ情報の配列

* 'add-display'：ディスプレイの追加
  - パラメータ：
    - display: ディスプレイ名
    - defaultLayoutId: デフォルトレイアウトID
    - license: ライセンスキー
    - incSchedule: スケジュールを含めるか
    - emailAlert: メールアラート
    - alertTimeout: アラートタイムアウト
    - clientAddress: クライアントアドレス
    - mediaInventoryStatus: メディアインベントリ状態
    - macAddress: MACアドレス
    - clientVersion: クライアントバージョン
    - clientCode: クライアントコード
    - displayProfileId: ディスプレイプロファイルID
    - displayTimeZone: タイムゾーン
    - screenShotRequested: スクリーンショット要求
    - storageAvailableSpace: 利用可能なストレージ容量
    - storageTotalSpace: 合計ストレージ容量
    - storagePercentage: ストレージ使用率
    - displayGroupId: 表示グループIDの配列（オプション）
    - description: 説明（オプション）
    - loggedIn: ログイン状態（オプション）
    - isAuditing: 監査状態（オプション）
  - レスポンス：追加されたディスプレイ情報

* 'edit-display'：ディスプレイの編集
  - パラメータ：
    - displayId: ディスプレイID
    - display: ディスプレイ名
    - defaultLayoutId: デフォルトレイアウトID
    - license: ライセンスキー
    - incSchedule: スケジュールを含めるか
    - emailAlert: メールアラート
    - alertTimeout: アラートタイムアウト
    - clientAddress: クライアントアドレス
    - mediaInventoryStatus: メディアインベントリ状態
    - macAddress: MACアドレス
    - clientVersion: クライアントバージョン
    - clientCode: クライアントコード
    - displayProfileId: ディスプレイプロファイルID
    - displayTimeZone: タイムゾーン
    - screenShotRequested: スクリーンショット要求
    - storageAvailableSpace: 利用可能なストレージ容量
    - storageTotalSpace: 合計ストレージ容量
    - storagePercentage: ストレージ使用率
    - displayGroupId: 表示グループIDの配列（オプション）
    - description: 説明（オプション）
    - loggedIn: ログイン状態（オプション）
    - isAuditing: 監査状態（オプション）
  - レスポンス：更新されたディスプレイ情報

* 'delete-display'：ディスプレイの削除
  - パラメータ：
    - displayId: ディスプレイID
  - レスポンス：削除結果
`;

export const xiboLayoutManagementTools = `
### レイアウト管理
* 'get-layouts'：レイアウト一覧の取得
  - パラメータ：
    - layoutId: 特定のレイアウトID（オプション）
    - layout: レイアウト名（オプション）
    - retired: 削除状態（オプション）
  - レスポンス：レイアウト情報の配列

* 'add-layout'：レイアウトの追加
  - パラメータ：
    - layout: レイアウト名
    - description: 説明（オプション）
    - templateId: テンプレートID（オプション）
    - resolutionId: 解像度ID（オプション）
    - backgroundColor: 背景色（オプション）
    - backgroundImageId: 背景画像ID（オプション）
    - status: ステータス（オプション）
  - レスポンス：追加されたレイアウト情報

* 'edit-layout'：レイアウトの編集
  - パラメータ：
    - layoutId: レイアウトID
    - layout: レイアウト名
    - description: 説明（オプション）
    - templateId: テンプレートID（オプション）
    - resolutionId: 解像度ID（オプション）
    - backgroundColor: 背景色（オプション）
    - backgroundImageId: 背景画像ID（オプション）
    - status: ステータス（オプション）
  - レスポンス：更新されたレイアウト情報

* 'delete-layout'：レイアウトの削除
  - パラメータ：
    - layoutId: レイアウトID
  - レスポンス：削除結果
  
* 'retire-layout'：レイアウトの非アクティブ化
  - パラメータ：
    - layoutId: レイアウトID
  - レスポンス：非アクティブ化結果
  
* 'unretire-layout'：レイアウトの再アクティブ化
  - パラメータ：
    - layoutId: レイアウトID
  - レスポンス：再アクティブ化結果
  
* 'clear-layout'：レイアウトのクリア
  - パラメータ：
    - layoutId: レイアウトID
  - レスポンス：クリア結果
  
* 'get-layout-status'：レイアウトのステータス取得
  - パラメータ：
    - layoutId: レイアウトID
  - レスポンス：レイアウトステータス情報
  
* 'checkout-layout'：レイアウトのチェックアウト
  - パラメータ：
    - layoutId: レイアウトID
  - レスポンス：チェックアウト結果
  
* 'discard-layout'：レイアウト変更の破棄
  - パラメータ：
    - layoutId: レイアウトID
  - レスポンス：変更破棄結果
`;

export const xiboPlaylistManagementTools = `
### プレイリスト管理
* 'get-playlists'：プレイリスト一覧の取得
  - パラメータ：
    - playlistId: 特定のプレイリストID（オプション）
    - playlist: プレイリスト名（オプション）
  - レスポンス：プレイリスト情報の配列

* 'add-playlist'：プレイリストの追加
  - パラメータ：
    - playlist: プレイリスト名
    - description: 説明（オプション）
    - isDynamic: 動的プレイリストか（オプション）
    - filterMediaName: メディア名フィルター（オプション）
    - filterMediaTags: メディアタグフィルター（オプション）
  - レスポンス：追加されたプレイリスト情報

* 'edit-playlist'：プレイリストの編集
  - パラメータ：
    - playlistId: プレイリストID
    - playlist: プレイリスト名
    - description: 説明（オプション）
    - isDynamic: 動的プレイリストか（オプション）
    - filterMediaName: メディア名フィルター（オプション）
    - filterMediaTags: メディアタグフィルター（オプション）
  - レスポンス：更新されたプレイリスト情報

* 'delete-playlist'：プレイリストの削除
  - パラメータ：
    - playlistId: プレイリストID
  - レスポンス：削除結果
`;

export const xiboScheduleManagementTools = `
### スケジュール管理
* 'get-schedules'：スケジュール一覧の取得
  - パラメータ：
    - scheduleId: 特定のスケジュールID（オプション）
    - schedule: スケジュール名（オプション）
  - レスポンス：スケジュール情報の配列

* 'add-schedule'：スケジュールの追加
  - パラメータ：
    - schedule: スケジュール名
    - description: 説明（オプション）
    - isRecurring: 繰り返しスケジュールか（オプション）
    - fromDt: 開始日時（オプション）
    - toDt: 終了日時（オプション）
    - displayGroupIds: 表示グループIDの配列（オプション）
    - layoutId: レイアウトID（オプション）
    - priority: 優先度（オプション）
  - レスポンス：追加されたスケジュール情報

* 'edit-schedule'：スケジュールの編集
  - パラメータ：
    - scheduleId: スケジュールID
    - schedule: スケジュール名
    - description: 説明（オプション）
    - isRecurring: 繰り返しスケジュールか（オプション）
    - fromDt: 開始日時（オプション）
    - toDt: 終了日時（オプション）
    - displayGroupIds: 表示グループIDの配列（オプション）
    - layoutId: レイアウトID（オプション）
    - priority: 優先度（オプション）
  - レスポンス：更新されたスケジュール情報

* 'delete-schedule'：スケジュールの削除
  - パラメータ：
    - scheduleId: スケジュールID
  - レスポンス：削除結果
`;

export const xiboMiscTools = `
### アクション管理
* 'get-actions'：アクション一覧の取得
  - パラメータ：
    - actionId: 特定のアクションID（オプション）
    - ownerId: 所有者ID（オプション）
    - triggerType: トリガータイプ（オプション）
  - レスポンス：アクション情報の配列

* 'add-action'：アクションの追加
  - パラメータ：
    - layoutId: レイアウトID
    - actionType: アクションタイプ
    - target: ターゲット
    - triggerType: トリガータイプ
    - triggerCode: トリガーコード（オプション）
    - source: ソース（オプション）
    - sourceId: ソースID（オプション）
  - レスポンス：追加されたアクション情報

* 'delete-action'：アクションの削除
  - パラメータ：
    - actionId: アクションID
  - レスポンス：削除結果

### 会場管理
* 'get-display-venues'：会場一覧の取得
  - パラメータ：なし
  - レスポンス：会場情報の配列

* 'add-display-venue'：会場の追加
  - パラメータ：
    - name: 会場名
    - address: 住所（オプション）
    - isMobile: モバイル会場か（オプション）
    - isOutdoor: 屋外会場か（オプション）
    - languages: 言語設定（オプション）
    - latitude: 緯度（オプション）
    - longitude: 経度（オプション）
  - レスポンス：追加された会場情報

* 'edit-display-venue'：会場の編集
  - パラメータ：
    - venueId: 会場ID
    - name: 会場名
    - address: 住所（オプション）
    - isMobile: モバイル会場か（オプション）
    - isOutdoor: 屋外会場か（オプション）
    - languages: 言語設定（オプション）
    - latitude: 緯度（オプション）
    - longitude: 経度（オプション）
  - レスポンス：更新された会場情報

* 'delete-display-venue'：会場の削除
  - パラメータ：
    - venueId: 会場ID
  - レスポンス：削除結果

### フォント管理
* 'get-fonts'：フォント一覧の取得
  - パラメータ：なし
  - レスポンス：フォント情報の配列

* 'add-font'：フォントの追加
  - パラメータ：
    - name: フォント名
    - family: フォントファミリー
    - file: フォントファイル
  - レスポンス：追加されたフォント情報

* 'delete-font'：フォントの削除
  - パラメータ：
    - fontId: フォントID
  - レスポンス：削除結果

### メニューボード管理
* 'get-menu-boards'：メニューボード一覧の取得
  - パラメータ：
    - menuId: 特定のメニューID（オプション）
    - menu: メニュー名（オプション）
  - レスポンス：メニューボード情報の配列

* 'add-menu-board'：メニューボードの追加
  - パラメータ：
    - name: メニュー名
    - description: 説明（オプション）
    - code: コード（オプション）
    - categoryId: カテゴリーID（オプション）
  - レスポンス：追加されたメニューボード情報

* 'edit-menu-board'：メニューボードの編集
  - パラメータ：
    - menuId: メニューID
    - name: メニュー名
    - description: 説明（オプション）
    - code: コード（オプション）
    - categoryId: カテゴリーID（オプション）
  - レスポンス：更新されたメニューボード情報

* 'delete-menu-board'：メニューボードの削除
  - パラメータ：
    - menuId: メニューID
  - レスポンス：削除結果

### プレイヤーソフトウェア管理
* 'get-player-software'：プレイヤーソフトウェア一覧の取得
  - パラメータ：なし
  - レスポンス：プレイヤーソフトウェア情報の配列

* 'add-player-software'：プレイヤーソフトウェアの追加
  - パラメータ：
    - version: バージョン
    - type: タイプ
    - code: コード
    - fileName: ファイル名
    - file: ファイル
  - レスポンス：追加されたプレイヤーソフトウェア情報

* 'edit-player-software'：プレイヤーソフトウェアの編集
  - パラメータ：
    - versionId: バージョンID
    - version: バージョン
    - type: タイプ
    - code: コード
    - fileName: ファイル名（オプション）
    - file: ファイル（オプション）
  - レスポンス：更新されたプレイヤーソフトウェア情報

* 'delete-player-software'：プレイヤーソフトウェアの削除
  - パラメータ：
    - versionId: バージョンID
  - レスポンス：削除結果

### 同期グループ管理
* 'get-sync-groups'：同期グループ一覧の取得
  - パラメータ：
    - syncGroupId: 特定の同期グループID（オプション）
    - syncGroup: 同期グループ名（オプション）
  - レスポンス：同期グループ情報の配列

* 'add-sync-group'：同期グループの追加
  - パラメータ：
    - name: グループ名
    - description: 説明（オプション）
    - displayIds: ディスプレイIDの配列（オプション）
  - レスポンス：追加された同期グループ情報

* 'edit-sync-group'：同期グループの編集
  - パラメータ：
    - syncGroupId: 同期グループID
    - name: グループ名
    - description: 説明（オプション）
    - displayIds: ディスプレイIDの配列（オプション）
  - レスポンス：更新された同期グループ情報

* 'delete-sync-group'：同期グループの削除
  - パラメータ：
    - syncGroupId: 同期グループID
  - レスポンス：削除結果
`;

// すべてのツールをまとめた関数
export function getAllTools() {
  return `
## 基本機能

${xiboUserManagementTools}

${xiboDisplayManagementTools}

${xiboLayoutManagementTools}

${xiboPlaylistManagementTools}

${xiboScheduleManagementTools}

${xiboMiscTools}
  `;
} 