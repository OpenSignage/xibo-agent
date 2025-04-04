<?php
/*
 * Xibo API エージェント - 設定ファイル
 * Google Gemini AIを活用したXiboデジタルサイネージAPIインターフェース
 */

// デバッグモードを有効化（実稼働環境では無効化する）
define('DEBUG_MODE', true);

// API関連設定
define('API_PATH', '../controller/handler.php'); // APIエンドポイントへのパス
define('API_URL', API_PATH); // APIエンドポイントのURL

// セッション設定
define('SESSION_COOKIE_NAME', 'xibo_session');

// パス設定
define('BASE_PATH', __DIR__);
define('INCLUDES_PATH', BASE_PATH . '/includes');
define('AUTH_PATH', BASE_PATH . '/auth');
define('SETTINGS_PATH', BASE_PATH . '/settings');
define('CHAT_PATH', BASE_PATH . '/chat');

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