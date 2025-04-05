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
 * Xibo API エージェント - ログアウト処理
 */

// 直接アクセスの禁止
if (!defined('BASE_PATH')) {
    define('BASE_PATH', '..');
    
    // 設定と関数を読み込み
    require_once '../config.php';
    require_once '../includes/functions.php';
    
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