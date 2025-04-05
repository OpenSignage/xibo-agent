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
 * Xibo API エージェント - メインルーティング
 */

// ベースパスの定義
define('BASE_PATH', '.');

// 設定ファイルの読み込み
require_once 'config.php';
require_once 'includes/functions.php';

// セッション開始
session_start();

// リクエストURIからパスを取得
$requestUri = $_SERVER['REQUEST_URI'];
$baseDir = dirname($_SERVER['SCRIPT_NAME']);
$path = substr($requestUri, strlen($baseDir));
$path = trim($path, '/');

// パスの解析
$segments = explode('/', $path);
$controller = $segments[0] ?? '';
$action = $segments[1] ?? '';

// ルーティングテーブル
$routes = [
    '' => ['controller' => 'dashboard', 'action' => 'index'],
    'auth' => [
        'login' => ['controller' => 'auth', 'action' => 'login'],
        'register' => ['controller' => 'auth', 'action' => 'register'],
        'logout' => ['controller' => 'auth', 'action' => 'logout']
    ],
    'settings' => [
        'save' => ['controller' => 'settings', 'action' => 'save'],
        'index' => ['controller' => 'settings', 'action' => 'index']
    ],
    'chat' => [
        'index' => ['controller' => 'chat', 'action' => 'index'],
        'sendMessage' => ['controller' => 'chat', 'action' => 'sendMessage'],
        'clearHistory' => ['controller' => 'chat', 'action' => 'clearHistory']
    ]
];

// ルーティングの処理
$route = null;
if (empty($controller)) {
    $route = $routes[''];
} elseif (isset($routes[$controller])) {
    if (is_array($routes[$controller]) && isset($routes[$controller][$action])) {
        $route = $routes[$controller][$action];
    } elseif (is_array($routes[$controller]) && isset($routes[$controller]['index'])) {
        $route = $routes[$controller]['index'];
    }
}

// ルートが見つからない場合は404エラー
if (!$route) {
    header("HTTP/1.0 404 Not Found");
    include 'includes/404.php';
    exit;
}

// コントローラーとアクションの取得
$controllerName = $route['controller'];
$actionName = $route['action'];

// コントローラーファイルのパス
$controllerFile = "controllers/{$controllerName}_controller.php";

// コントローラーの読み込みと実行
if (file_exists($controllerFile)) {
    require_once $controllerFile;
    $controllerClass = ucfirst($controllerName) . 'Controller';
    if (class_exists($controllerClass)) {
        $controller = new $controllerClass();
        if (method_exists($controller, $actionName)) {
            $controller->$actionName();
        } else {
            header("HTTP/1.0 404 Not Found");
            include 'includes/404.php';
        }
    } else {
        header("HTTP/1.0 404 Not Found");
        include 'includes/404.php';
    }
} else {
    header("HTTP/1.0 404 Not Found");
    include 'includes/404.php';
} 
