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
 * Xibo API エージェント設定ファイル
 */

// 直接アクセスを防止
if (!defined('XIBO_AGENT')) {
    if (basename($_SERVER['SCRIPT_FILENAME']) === basename(__FILE__)) {
        header('HTTP/1.0 403 Forbidden');
        exit;
    }
    define('XIBO_AGENT', true);
}

// 共通ユーティリティ関数の読み込み
require_once __DIR__ . '/../includes/utils.php';

// データベース設定
$db_config = [
    'host' => 'localhost',
    'database' => 'xibo_agent',
    'username' => 'xibo_user',
    'password' => 'xibo_password',
    'charset' => 'utf8mb4',
];

// セッションの有効期限（秒）
$session_lifetime = 3600 * 24; // 24時間

// Xibo API設定
$config = [
    'xibo_api_url' => '', // Xibo API URLを設定
    'xibo_client_id' => '', // Xibo Client IDを設定
    'xibo_client_secret' => '', // Xibo Client Secretを設定
    'gemini_api_key' => '', // Google Gemini APIキーを設定
    'gemini_model' => 'gemini-1.5-pro', // 使用するGeminiモデル
];

// config-local.php が存在する場合は読み込む（ローカル環境での設定上書き用）
$localConfigFile = __DIR__ . '/config-local.php';
if (file_exists($localConfigFile)) {
    require_once $localConfigFile;
} 