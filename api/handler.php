<?php
/*
 * Xibo API エージェント - APIハンドラー
 * Google Gemini AIを活用したXiboデジタルサイネージAPIインターフェース
 */

// アプリケーション定数を定義
define('XIBO_AGENT', true);

// CORS設定（必要に応じて調整）
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: POST, GET, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type');
header('Content-Type: application/json');

// OPTIONSリクエストの処理
if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    exit(0);
}

// セッション開始
session_start();

// エラー表示設定
ini_set('display_errors', 1);
error_reporting(E_ALL);

// タイムアウト設定
set_time_limit(120);

// 設定ファイルの読み込み
require_once __DIR__ . '/../config/config.php';

// エージェント処理ロジックを読み込み
require_once __DIR__ . '/../bin/agent.php';

// ハンドラーリクエストをログに記録
debugLog("handler.php: リクエスト受信", [
    'method' => $_SERVER['REQUEST_METHOD'],
    'query_string' => $_SERVER['QUERY_STRING'],
    'remote_addr' => $_SERVER['REMOTE_ADDR'],
    'user_agent' => $_SERVER['HTTP_USER_AGENT'] ?? 'なし'
]);

// 応答データの初期化
$response = ['status' => 'waiting'];

// リクエスト処理
if ($_SERVER['REQUEST_METHOD'] === 'POST') {
    debugLog("handler.php: POSTリクエスト処理開始");
    $response = handlePostRequest();
    debugLog("handler.php: POSTリクエスト処理完了", [
        'response_status' => isset($response['error']) ? 'error' : 'success'
    ]);
} else if ($_SERVER['REQUEST_METHOD'] === 'GET') {
    debugLog("handler.php: GETリクエスト処理開始");
    // 設定情報の確認（機密情報は除外）
    $isConfigured = !empty($config['xibo_api_url']) && 
                    !empty($config['xibo_client_id']) && 
                    !empty($config['xibo_client_secret']) && 
                    !empty($config['gemini_api_key']);
    
    $response = [
        'status' => 'ready',
        'is_configured' => $isConfigured,
        'config' => [
            'gemini_model' => $config['gemini_model']
        ]
    ];
    debugLog("handler.php: GETリクエスト処理完了", [
        'is_configured' => $isConfigured
    ]);
}

// JSONレスポンスを返す
debugLog("handler.php: レスポンス送信", [
    'response_size' => strlen(json_encode($response))
]);
echo json_encode($response);
exit; 