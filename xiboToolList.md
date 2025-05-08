# Xibo API ツール一覧

## 基本機能

### ユーザー管理
1. **getUserMe**
   - 説明: 現在ログイン中のユーザー情報を取得
   - パラメータ: なし
   - レスポンス: ユーザー情報（ID、名前、メール等）

2. **getUsers**
   - 説明: ユーザー一覧を取得
   - パラメータ:
     - userId: ユーザーID（オプション）
     - userName: ユーザー名（オプション）
     - userTypeId: ユーザータイプID（オプション）
     - retired: 退職フラグ（オプション）
   - レスポンス: ユーザー一覧

3. **getUser**
   - 説明: 指定されたIDのユーザー情報を取得
   - パラメータ:
     - userId: ユーザーID
   - レスポンス: ユーザー情報

4. **addUser**
   - 説明: 新しいユーザーを作成
   - パラメータ:
     - userName: ユーザー名
     - email: メールアドレス（オプション）
     - userTypeId: ユーザータイプID
     - homePageId: ホームページID
     - libraryQuota: ライブラリクォータ（オプション）
     - password: パスワード
   - レスポンス: 作成されたユーザー情報

5. **editUser**
   - 説明: 既存のユーザーを編集
   - パラメータ:
     - userId: ユーザーID
     - userName: 新しいユーザー名
     - email: 新しいメールアドレス（オプション）
     - userTypeId: 新しいユーザータイプID
     - homePageId: 新しいホームページID
     - libraryQuota: 新しいライブラリクォータ（オプション）
     - newPassword: 新しいパスワード（オプション）
   - レスポンス: 更新されたユーザー情報

6. **getUserGroups**
   - 説明: ユーザーグループ一覧を取得
   - パラメータ: なし
   - レスポンス: ユーザーグループ一覧

7. **addUserGroup**
   - 説明: 新しいユーザーグループを作成
   - パラメータ: 
     - name: グループ名
     - description: 説明（オプション）
     - libraryQuota: ライブラリクォータ（オプション）
     - isSystemNotification: システム通知フラグ（オプション）
     - isDisplayNotification: ディスプレイ通知フラグ（オプション）
   - レスポンス: 作成されたグループ情報

8. **editUserGroup**
   - 説明: 既存のユーザーグループを編集
   - パラメータ:
     - groupId: グループID
     - name: 新しいグループ名
     - description: 新しい説明
     - libraryQuota: 新しいライブラリクォータ
     - isSystemNotification: 新しいシステム通知フラグ
     - isDisplayNotification: 新しいディスプレイ通知フラグ
   - レスポンス: 更新されたグループ情報

9. **deleteUserGroup**
   - 説明: ユーザーグループを削除
   - パラメータ:
     - groupId: グループID
   - レスポンス: 削除結果

10. **assignUserToGroup**
    - 説明: ユーザーをグループに割り当て
    - パラメータ:
      - userGroupId: グループID
      - userId: ユーザーID配列
    - レスポンス: 割り当て結果

11. **unassignUserFromGroup**
    - 説明: ユーザーをグループから削除
    - パラメータ:
      - userGroupId: グループID
      - userId: ユーザーID配列
    - レスポンス: 削除結果

12. **getUserPermissions**
    - 説明: ユーザーの権限情報を取得
    - パラメータ:
      - entity: エンティティ名
      - objectId: オブジェクトID
    - レスポンス: 権限情報

13. **getUserPreferences**
    - 説明: ユーザーの設定を取得
    - パラメータ:
      - preference: 設定名（オプション）
    - レスポンス: 設定情報

14. **saveUserPreferences**
    - 説明: ユーザーの設定を保存
    - パラメータ:
      - navigationMenuPosition: ナビゲーションメニューの位置
      - useLibraryDuration: ライブラリ期間使用フラグ
      - showThumbnailColumn: サムネイル列表示フラグ
      - rememberFolderTreeStateGlobally: フォルダツリー状態保持フラグ
    - レスポンス: 保存結果

### ディスプレイ管理
1. **getDisplays**
   - 説明: ディスプレイ一覧を取得
   - パラメータ: なし
   - レスポンス: ディスプレイ一覧

2. **getDisplayById**
   - 説明: 指定されたIDのディスプレイ情報を取得
   - パラメータ:
     - displayId: ディスプレイID
   - レスポンス: ディスプレイ情報

3. **addDisplay**
   - 説明: 新しいディスプレイを追加
   - パラメータ:
     - name: ディスプレイ名
     - description: 説明（オプション）
     - type: ディスプレイタイプ
   - レスポンス: 作成されたディスプレイ情報

4. **editDisplay**
   - 説明: 既存のディスプレイを編集
   - パラメータ:
     - displayId: ディスプレイID
     - name: 新しいディスプレイ名
     - description: 新しい説明
   - レスポンス: 更新されたディスプレイ情報

5. **deleteDisplay**
   - 説明: ディスプレイを削除
   - パラメータ:
     - displayId: ディスプレイID
   - レスポンス: 削除結果

6. **getDisplayGroups**
   - 説明: ディスプレイグループ一覧を取得
   - パラメータ: なし
   - レスポンス: ディスプレイグループ一覧

7. **getDisplayGroupById**
   - 説明: 指定されたIDのディスプレイグループ情報を取得
   - パラメータ:
     - groupId: グループID
   - レスポンス: ディスプレイグループ情報

8. **addDisplayGroup**
   - 説明: 新しいディスプレイグループを作成
   - パラメータ:
     - name: グループ名
     - description: 説明（オプション）
   - レスポンス: 作成されたグループ情報

9. **editDisplayGroup**
   - 説明: 既存のディスプレイグループを編集
   - パラメータ:
     - groupId: グループID
     - name: 新しいグループ名
     - description: 新しい説明
   - レスポンス: 更新されたグループ情報

10. **deleteDisplayGroup**
    - 説明: ディスプレイグループを削除
    - パラメータ:
      - groupId: グループID
    - レスポンス: 削除結果

### レイアウト管理
1. **getLayouts**
   - 説明: レイアウト一覧を取得
   - パラメータ: なし
   - レスポンス: レイアウト一覧

2. **getLayoutById**
   - 説明: 指定されたIDのレイアウト情報を取得
   - パラメータ:
     - layoutId: レイアウトID
   - レスポンス: レイアウト情報

3. **addLayout**
   - 説明: 新しいレイアウトを作成
   - パラメータ:
     - name: レイアウト名
     - description: 説明（オプション）
     - width: 幅
     - height: 高さ
   - レスポンス: 作成されたレイアウト情報

4. **editLayout**
   - 説明: 既存のレイアウトを編集
   - パラメータ:
     - layoutId: レイアウトID
     - name: 新しいレイアウト名
     - description: 新しい説明
   - レスポンス: 更新されたレイアウト情報

5. **deleteLayout**
   - 説明: レイアウトを削除
   - パラメータ:
     - layoutId: レイアウトID
   - レスポンス: 削除結果

### プレイリスト管理
1. **getPlaylists**
   - 説明: プレイリスト一覧を取得
   - パラメータ: なし
   - レスポンス: プレイリスト一覧

2. **getPlaylistById**
   - 説明: 指定されたIDのプレイリスト情報を取得
   - パラメータ:
     - playlistId: プレイリストID
   - レスポンス: プレイリスト情報

3. **addPlaylist**
   - 説明: 新しいプレイリストを作成
   - パラメータ:
     - name: プレイリスト名
     - description: 説明（オプション）
   - レスポンス: 作成されたプレイリスト情報

4. **editPlaylist**
   - 説明: 既存のプレイリストを編集
   - パラメータ:
     - playlistId: プレイリストID
     - name: 新しいプレイリスト名
     - description: 新しい説明
   - レスポンス: 更新されたプレイリスト情報

5. **deletePlaylist**
   - 説明: プレイリストを削除
   - パラメータ:
     - playlistId: プレイリストID
   - レスポンス: 削除結果

### スケジュール管理
1. **getSchedules**
   - 説明: スケジュール一覧を取得
   - パラメータ: なし
   - レスポンス: スケジュール一覧

2. **getScheduleById**
   - 説明: 指定されたIDのスケジュール情報を取得
   - パラメータ:
     - scheduleId: スケジュールID
   - レスポンス: スケジュール情報

3. **addSchedule**
   - 説明: 新しいスケジュールを作成
   - パラメータ:
     - name: スケジュール名
     - description: 説明（オプション）
     - startDate: 開始日時
     - endDate: 終了日時
     - displayGroupIds: 表示グループID配列
     - layoutIds: レイアウトID配列
   - レスポンス: 作成されたスケジュール情報

4. **editSchedule**
   - 説明: 既存のスケジュールを編集
   - パラメータ:
     - scheduleId: スケジュールID
     - name: 新しいスケジュール名
     - description: 新しい説明
     - startDate: 新しい開始日時
     - endDate: 新しい終了日時
   - レスポンス: 更新されたスケジュール情報

5. **deleteSchedule**
   - 説明: スケジュールを削除
   - パラメータ:
     - scheduleId: スケジュールID
   - レスポンス: 削除結果

## 拡張機能

### アクション管理
1. **getActions**
   - 説明: アクション一覧を取得
   - パラメータ: なし
   - レスポンス: アクション一覧

2. **getActionById**
   - 説明: 指定されたIDのアクション情報を取得
   - パラメータ:
     - actionId: アクションID
   - レスポンス: アクション情報

3. **addAction**
   - 説明: 新しいアクションを作成
   - パラメータ:
     - name: アクション名
     - description: 説明（オプション）
     - type: アクションタイプ
   - レスポンス: 作成されたアクション情報

4. **editAction**
   - 説明: 既存のアクションを編集
   - パラメータ:
     - actionId: アクションID
     - name: 新しいアクション名
     - description: 新しい説明
   - レスポンス: 更新されたアクション情報

5. **deleteAction**
   - 説明: アクションを削除
   - パラメータ:
     - actionId: アクションID
   - レスポンス: 削除結果

### 会場管理
1. **getVenues**
   - 説明: 会場一覧を取得
   - パラメータ: なし
   - レスポンス: 会場一覧

2. **getVenueById**
   - 説明: 指定されたIDの会場情報を取得
   - パラメータ:
     - venueId: 会場ID
   - レスポンス: 会場情報

3. **addVenue**
   - 説明: 新しい会場を追加
   - パラメータ:
     - name: 会場名
     - description: 説明（オプション）
     - address: 住所
   - レスポンス: 作成された会場情報

4. **editVenue**
   - 説明: 既存の会場を編集
   - パラメータ:
     - venueId: 会場ID
     - name: 新しい会場名
     - description: 新しい説明
     - address: 新しい住所
   - レスポンス: 更新された会場情報

5. **deleteVenue**
   - 説明: 会場を削除
   - パラメータ:
     - venueId: 会場ID
   - レスポンス: 削除結果

### フォント管理
1. **getFonts**
   - 説明: フォント一覧を取得
   - パラメータ: なし
   - レスポンス: フォント一覧

2. **getFontById**
   - 説明: 指定されたIDのフォント情報を取得
   - パラメータ:
     - fontId: フォントID
   - レスポンス: フォント情報

3. **addFont**
   - 説明: 新しいフォントを追加
   - パラメータ:
     - name: フォント名
     - file: フォントファイル
   - レスポンス: 追加されたフォント情報

4. **deleteFont**
   - 説明: フォントを削除
   - パラメータ:
     - fontId: フォントID
   - レスポンス: 削除結果

### メニューボード管理
1. **getMenuBoards**
   - 説明: メニューボード一覧を取得
   - パラメータ: なし
   - レスポンス: メニューボード一覧

2. **getMenuBoardById**
   - 説明: 指定されたIDのメニューボード情報を取得
   - パラメータ:
     - menuBoardId: メニューボードID
   - レスポンス: メニューボード情報

3. **addMenuBoard**
   - 説明: 新しいメニューボードを作成
   - パラメータ:
     - name: メニューボード名
     - description: 説明（オプション）
   - レスポンス: 作成されたメニューボード情報

4. **editMenuBoard**
   - 説明: 既存のメニューボードを編集
   - パラメータ:
     - menuBoardId: メニューボードID
     - name: 新しいメニューボード名
     - description: 新しい説明
   - レスポンス: 更新されたメニューボード情報

5. **deleteMenuBoard**
   - 説明: メニューボードを削除
   - パラメータ:
     - menuBoardId: メニューボードID
   - レスポンス: 削除結果

### プレイヤーソフトウェア管理
1. **getPlayerSoftwares**
   - 説明: プレイヤーソフトウェア一覧を取得
   - パラメータ: なし
   - レスポンス: プレイヤーソフトウェア一覧

2. **getPlayerSoftwareById**
   - 説明: 指定されたIDのプレイヤーソフトウェア情報を取得
   - パラメータ:
     - playerSoftwareId: プレイヤーソフトウェアID
   - レスポンス: プレイヤーソフトウェア情報

3. **addPlayerSoftware**
   - 説明: 新しいプレイヤーソフトウェアを追加
   - パラメータ:
     - name: ソフトウェア名
     - version: バージョン
     - file: ソフトウェアファイル
   - レスポンス: 追加されたソフトウェア情報

4. **editPlayerSoftware**
   - 説明: 既存のプレイヤーソフトウェアを編集
   - パラメータ:
     - playerSoftwareId: ソフトウェアID
     - name: 新しいソフトウェア名
     - version: 新しいバージョン
   - レスポンス: 更新されたソフトウェア情報

5. **deletePlayerSoftware**
   - 説明: プレイヤーソフトウェアを削除
   - パラメータ:
     - playerSoftwareId: ソフトウェアID
   - レスポンス: 削除結果

### 同期グループ管理
1. **getSyncGroups**
   - 説明: 同期グループ一覧を取得
   - パラメータ: なし
   - レスポンス: 同期グループ一覧

2. **getSyncGroupById**
   - 説明: 指定されたIDの同期グループ情報を取得
   - パラメータ:
     - syncGroupId: 同期グループID
   - レスポンス: 同期グループ情報

3. **addSyncGroup**
   - 説明: 新しい同期グループを作成
   - パラメータ:
     - name: グループ名
     - description: 説明（オプション）
   - レスポンス: 作成されたグループ情報

4. **editSyncGroup**
   - 説明: 既存の同期グループを編集
   - パラメータ:
     - syncGroupId: グループID
     - name: 新しいグループ名
     - description: 新しい説明
   - レスポンス: 更新されたグループ情報

5. **deleteSyncGroup**
   - 説明: 同期グループを削除
   - パラメータ:
     - syncGroupId: グループID
   - レスポンス: 削除結果

## 追加機能

### ライブラリ管理
1. **getLibraryItems**
   - 説明: ライブラリ内のメディア一覧を取得
   - パラメータ:
     - mediaId: メディアID（オプション）
     - media: メディア名（オプション）
     - type: メディアタイプ（オプション）
     - ownerId: 所有者ID（オプション）
     - retired: 廃止フラグ（オプション）
     - tags: タグ（オプション）
   - レスポンス: メディア一覧

2. **uploadMedia**
   - 説明: メディアファイルをアップロード
   - パラメータ:
     - files: アップロードするファイル
     - name: メディア名（オプション）
     - oldMediaId: 置き換える既存メディアID（オプション）
     - updateInLayouts: レイアウト内の更新フラグ（オプション）
     - deleteOldRevisions: 古いリビジョンの削除フラグ（オプション）
     - tags: タグ（オプション）
     - expires: 有効期限（オプション）
     - playlistId: プレイリストID（オプション）
   - レスポンス: アップロードされたメディア情報

3. **downloadMedia**
   - 説明: メディアファイルをダウンロード
   - パラメータ:
     - mediaId: メディアID
     - type: モジュールタイプ
   - レスポンス: メディアファイル

4. **getMediaThumbnail**
   - 説明: メディアのサムネイルを取得
   - パラメータ:
     - mediaId: メディアID
   - レスポンス: サムネイル画像

5. **getMediaUsage**
   - 説明: メディアの使用状況レポートを取得
   - パラメータ:
     - mediaId: メディアID
   - レスポンス: 使用状況レポート

### 統計情報管理
1. **getStatistics**
   - 説明: 統計情報を取得
   - パラメータ:
     - type: 統計タイプ（Layout|Media|Widget）
     - fromDt: 開始日時
     - toDt: 終了日時
     - statDate: 統計日付
     - statId: 統計ID
     - displayId: ディスプレイID
     - displayIds: ディスプレイID配列
     - layoutId: レイアウトID配列
     - parentCampaignId: 親キャンペーンID
     - mediaId: メディアID配列
   - レスポンス: 統計情報

### ウィジェット管理
1. **editWidget**
   - 説明: ウィジェットを編集
   - パラメータ:
     - id: ウィジェットID
     - useDuration: 期間使用フラグ
     - duration: 期間
     - name: ウィジェット名
     - enableStat: 統計有効化フラグ
   - レスポンス: 更新されたウィジェット情報

### データセット管理
1. **getDatasets**
   - 説明: データセット一覧を取得
   - パラメータ: なし
   - レスポンス: データセット一覧

2. **getDatasetById**
   - 説明: 指定されたIDのデータセット情報を取得
   - パラメータ:
     - datasetId: データセットID
   - レスポンス: データセット情報

3. **addDataset**
   - 説明: 新しいデータセットを作成
   - パラメータ:
     - name: データセット名
     - description: 説明（オプション）
   - レスポンス: 作成されたデータセット情報

### フォルダ管理
1. **getFolders**
   - 説明: フォルダ一覧を取得
   - パラメータ: なし
   - レスポンス: フォルダ一覧

2. **addFolder**
   - 説明: 新しいフォルダを作成
   - パラメータ:
     - name: フォルダ名
     - description: 説明（オプション）
   - レスポンス: 作成されたフォルダ情報

### コマンド管理
1. **getCommands**
   - 説明: コマンド一覧を取得
   - パラメータ: なし
   - レスポンス: コマンド一覧

2. **addCommand**
   - 説明: 新しいコマンドを作成
   - パラメータ:
     - name: コマンド名
     - description: 説明（オプション）
     - command: コマンド内容
   - レスポンス: 作成されたコマンド情報

### 日時帯管理
1. **getDayParts**
   - 説明: 日時帯一覧を取得
   - パラメータ: なし
   - レスポンス: 日時帯一覧

2. **addDayPart**
   - 説明: 新しい日時帯を作成
   - パラメータ:
     - name: 日時帯名
     - description: 説明（オプション）
     - startTime: 開始時間
     - endTime: 終了時間
   - レスポンス: 作成された日時帯情報

### 通知管理
1. **getNotifications**
   - 説明: 通知一覧を取得
   - パラメータ: なし
   - レスポンス: 通知一覧

2. **addNotification**
   - 説明: 新しい通知を作成
   - パラメータ:
     - subject: 件名
     - body: 本文
     - displayGroupIds: 表示グループID配列
   - レスポンス: 作成された通知情報

### テンプレート管理
1. **getTemplates**
   - 説明: テンプレート一覧を取得
   - パラメータ: なし
   - レスポンス: テンプレート一覧

2. **addTemplate**
   - 説明: 新しいテンプレートを作成
   - パラメータ:
     - name: テンプレート名
     - description: 説明（オプション）
     - layoutId: レイアウトID
   - レスポンス: 作成されたテンプレート情報

### 解像度管理
1. **getResolutions**
   - 説明: 解像度一覧を取得
   - パラメータ: なし
   - レスポンス: 解像度一覧

2. **addResolution**
   - 説明: 新しい解像度を追加
   - パラメータ:
     - width: 幅
     - height: 高さ
     - name: 解像度名
   - レスポンス: 作成された解像度情報

### モジュール管理
1. **getModules**
   - 説明: モジュール一覧を取得
   - パラメータ: なし
   - レスポンス: モジュール一覧

2. **getModuleById**
   - 説明: 指定されたIDのモジュール情報を取得
   - パラメータ:
     - moduleId: モジュールID
   - レスポンス: モジュール情報

### ディスプレイプロファイル管理
1. **getDisplayProfiles**
   - 説明: ディスプレイプロファイル一覧を取得
   - パラメータ: なし
   - レスポンス: プロファイル一覧

2. **getDisplayProfileById**
   - 説明: 指定されたIDのディスプレイプロファイル情報を取得
   - パラメータ:
     - profileId: プロファイルID
   - レスポンス: プロファイル情報

3. **addDisplayProfile**
   - 説明: 新しいディスプレイプロファイルを作成
   - パラメータ:
     - name: プロファイル名
     - type: プロファイルタイプ
     - config: 設定JSON
   - レスポンス: 作成されたプロファイル情報

4. **editDisplayProfile**
   - 説明: 既存のディスプレイプロファイルを編集
   - パラメータ:
     - profileId: プロファイルID
     - name: 新しいプロファイル名
     - type: 新しいプロファイルタイプ
     - config: 新しい設定JSON
   - レスポンス: 更新されたプロファイル情報

5. **deleteDisplayProfile**
   - 説明: ディスプレイプロファイルを削除
   - パラメータ:
     - profileId: プロファイルID
   - レスポンス: 削除結果

### キャンペーン管理
1. **getCampaigns**
   - 説明: キャンペーン一覧を取得
   - パラメータ: なし
   - レスポンス: キャンペーン一覧

2. **getCampaignById**
   - 説明: 指定されたIDのキャンペーン情報を取得
   - パラメータ:
     - campaignId: キャンペーンID
   - レスポンス: キャンペーン情報

3. **addCampaign**
   - 説明: 新しいキャンペーンを作成
   - パラメータ:
     - name: キャンペーン名
     - description: 説明（オプション）
   - レスポンス: 作成されたキャンペーン情報

4. **editCampaign**
   - 説明: 既存のキャンペーンを編集
   - パラメータ:
     - campaignId: キャンペーンID
     - name: 新しいキャンペーン名
     - description: 新しい説明
   - レスポンス: 更新されたキャンペーン情報

5. **deleteCampaign**
   - 説明: キャンペーンを削除
   - パラメータ:
     - campaignId: キャンペーンID
   - レスポンス: 削除結果

### タグ管理
1. **getTags**
   - 説明: タグ一覧を取得
   - パラメータ: なし
   - レスポンス: タグ一覧

2. **addTag**
   - 説明: 新しいタグを作成
   - パラメータ:
     - name: タグ名
     - description: 説明（オプション）
   - レスポンス: 作成されたタグ情報

3. **editTag**
   - 説明: 既存のタグを編集
   - パラメータ:
     - tagId: タグID
     - name: 新しいタグ名
     - description: 新しい説明
   - レスポンス: 更新されたタグ情報

4. **deleteTag**
   - 説明: タグを削除
   - パラメータ:
     - tagId: タグID
   - レスポンス: 削除結果

### ユーティリティ機能
1. **getSystemStatus**
   - 説明: システムステータスを取得
   - パラメータ: なし
   - レスポンス: システムステータス情報

2. **getSystemInfo**
   - 説明: システム情報を取得
   - パラメータ: なし
   - レスポンス: システム情報

3. **getVersion**
   - 説明: APIバージョン情報を取得
   - パラメータ: なし
   - レスポンス: バージョン情報

4. **getHelp**
   - 説明: APIヘルプ情報を取得
   - パラメータ: なし
   - レスポンス: ヘルプ情報

## テスト手順

1. 基本機能のテスト
   - ユーザー管理機能のテスト
   - ディスプレイ管理機能のテスト
   - レイアウト管理機能のテスト
   - プレイリスト管理機能のテスト
   - スケジュール管理機能のテスト

2. 拡張機能のテスト
   - アクション管理機能のテスト
   - 会場管理機能のテスト
   - フォント管理機能のテスト
   - メニューボード管理機能のテスト
   - プレイヤーソフトウェア管理機能のテスト
   - 同期グループ管理機能のテスト

3. エラーハンドリングのテスト
   - 無効なパラメータでのテスト
   - 認証エラーのテスト
   - 権限エラーのテスト

4. パフォーマンステスト
   - 大量データ取得時のテスト
   - 同時実行時のテスト
   - レスポンス時間のテスト
