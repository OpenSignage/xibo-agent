<?php
/**
 * Xibo API エージェント - API ハンドラプロキシ
 * 
 * このファイルはウェブからのリクエストをcontroller/handler.phpに中継します
 */

// エラー表示の設定
ini_set('display_errors', 0);

// コンテンツタイプをJSONに設定
header('Content-Type: application/json');

// POSTデータの取得
$input = file_get_contents('php://input');
$data = json_decode($input, true);

// JSONデコードエラーのチェック
if (json_last_error() !== JSON_ERROR_NONE) {
    echo json_encode([
        'status' => 'error',
        'error' => 'JSONデコードエラー: ' . json_last_error_msg()
    ]);
    exit;
}

// ハンドラファイルへのパス
$handlerPath = realpath(__DIR__ . '/../controller/handler.php');

if (!file_exists($handlerPath)) {
    echo json_encode([
        'status' => 'error',
        'error' => 'APIハンドラファイルが見つかりません: ' . $handlerPath
    ]);
    exit;
}

// データをグローバル変数に設定（handler.php内で使用される）
$_POST = $data;
$_SERVER['REQUEST_METHOD'] = 'POST';
$_SERVER['CONTENT_TYPE'] = 'application/json';

// 出力バッファリングを開始
ob_start();

// ハンドラスクリプトをインクルード
require $handlerPath;

// 出力バッファの内容をクライアントに返す
$output = ob_get_clean();
echo $output; 