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