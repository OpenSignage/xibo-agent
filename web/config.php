<?php
/*
 * Xibo-agent - Open Source Digital Signage - https://www.open-signage.org
 * Copyright (C) 2025 Open Source Digital Signage Initiative
 *
 * This file is part of Xibo-agent.
 * This software access xibo-cms through their APIs to control xibo-cms
 *
 * Xibo-agent is free software: you can redistribute it and/or modify
 * it under the terms of the GNU Affero General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * any later version.
 *
 * Xibo-agent is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 * GNU Affero General Public License for more details.
 *
 * You should have received a copy of the GNU Affero General Public License
 * along with Xibo.  If not, see <http://www.gnu.org/licenses/>.
 */

/*
 * Xibo API エージェント - 設定ファイル
 * Google Gemini AIを活用したXiboデジタルサイネージAPIインターフェース
 */

// デバッグモードを有効化（実稼働環境では無効化する）
define('DEBUG_MODE', true);

// 共通ユーティリティ関数の読み込み
require_once __DIR__ . '/../includes/utils.php';

// API関連設定
define('API_PATH', '../controller/handler.php'); // APIエンドポイントへのパス
define('API_URL', API_PATH); // APIエンドポイントのURL

// セッション設定
define('SESSION_COOKIE_NAME', 'xibo_session');

// パス設定
define('BASE_PATH', '.');
define('INCLUDES_PATH', './includes');
define('AUTH_PATH', './auth');
define('SETTINGS_PATH', './settings');
define('CHAT_PATH', './chat');

// コンテンツタイプ
define('CONTENT_TYPE_JSON', 'application/json');

/**
 * APIエラーメッセージを整形して返す
 * @param string $message エラーメッセージ
 * @param mixed $debugData デバッグ情報（省略可）
 * @return array エラー情報の配列
 */
function formatApiError($message, $debugData = null) {
    $error = [
        'status' => 'error',
        'error' => $message
    ];
    
    if (DEBUG_MODE && $debugData !== null) {
        $error['debug'] = $debugData;
    }
    
    return $error;
} 