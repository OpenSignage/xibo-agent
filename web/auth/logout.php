<?php
/*
 * Xibo API エージェント - ログアウト処理
 */

// 直接アクセスの禁止
if (!defined('BASE_PATH')) {
    define('BASE_PATH', dirname(__DIR__));
    
    // 設定と関数を読み込み
    require_once BASE_PATH . '/config.php';
    require_once BASE_PATH . '/includes/functions.php';
    
    // セッション開始
    session_start();
}

// ログアウト処理
// セッションを破棄
session_unset();
session_destroy();

// APIログアウトリクエスト
callApi(['action' => 'logout']);

// 直接アクセスされた場合はログインページにリダイレクト
if (basename($_SERVER['SCRIPT_FILENAME']) === basename(__FILE__)) {
    redirect('login.php');
    exit;
} else {
    // index.phpから呼び出された場合
    redirect('auth/login.php');
    exit;
} 