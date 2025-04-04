<?php
/*
 * Xibo API エージェント - 設定保存処理
 */

// ベースパスの定義
define('BASE_PATH', dirname(__DIR__));

// 設定ファイルの読み込み
require_once BASE_PATH . '/config.php';
require_once BASE_PATH . '/includes/functions.php';

// セッション開始
session_start();

// 未ログインの場合はログインページへリダイレクト
if (!isset($_SESSION[SESSION_COOKIE_NAME])) {
    redirect('../auth/login.php');
    exit;
}

// POSTリクエスト以外の場合はメインページへリダイレクト
if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    redirect('../index.php?tab=settings');
    exit;
}

try {
    // 設定データの取得と検証
    $settings = [
        'apiUrl' => filter_input(INPUT_POST, 'apiUrl', FILTER_VALIDATE_URL),
        'apiKey' => filter_input(INPUT_POST, 'apiKey', FILTER_SANITIZE_STRING),
        'clientId' => filter_input(INPUT_POST, 'clientId', FILTER_SANITIZE_STRING),
        'clientSecret' => filter_input(INPUT_POST, 'clientSecret', FILTER_SANITIZE_STRING),
        'refreshInterval' => filter_input(INPUT_POST, 'refreshInterval', FILTER_VALIDATE_INT),
        'logLevel' => filter_input(INPUT_POST, 'logLevel', FILTER_SANITIZE_STRING)
    ];
    
    // 必須項目の検証
    $requiredFields = ['apiUrl', 'apiKey', 'clientId', 'clientSecret'];
    foreach ($requiredFields as $field) {
        if (empty($settings[$field])) {
            throw new Exception("{$field}は必須項目です");
        }
    }
    
    // API呼び出しによる設定保存
    $response = callApi([
        'action' => 'saveSettings',
        'settings' => $settings,
        'userId' => $_SESSION[SESSION_COOKIE_NAME]['id'] ?? null
    ]);
    
    if ($response['status'] !== 'success') {
        throw new Exception($response['error'] ?? '設定の保存に失敗しました');
    }
    
    // 設定が保存されたことをセッションに記録
    $_SESSION['settings_saved'] = true;
    
    // セッション内のユーザー設定を更新
    if (isset($_SESSION[SESSION_COOKIE_NAME]['settings'])) {
        $_SESSION[SESSION_COOKIE_NAME]['settings'] = $settings;
    }
    
    // 設定ページにリダイレクト
    redirect('../index.php?tab=settings');
    
} catch (Exception $e) {
    // エラーメッセージをセッションに保存
    $_SESSION['settings_error'] = $e->getMessage();
    
    // 設定ページにリダイレクト
    redirect('../index.php?tab=settings');
}
?> 