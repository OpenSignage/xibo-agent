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
 * Xibo API エージェント - 共通関数
 */

/**
 * APIを呼び出す関数
 * @param array $data 送信データ
 * @return array レスポンス
 */
function callApi($data) {
    // ハンドラファイルへの絶対パス（webディレクトリ内のファイルを参照）
    $handlerPath = realpath(__DIR__ . '/../handler.php');
    $debug = defined('DEBUG_MODE') && DEBUG_MODE;
    
    try {
        if (!file_exists($handlerPath)) {
            throw new Exception('APIハンドラファイルが見つかりません: ' . $handlerPath);
        }
        
        // データをグローバル変数に設定（handler.php内で使用される）
        $_POST = $data;
        $_SERVER['REQUEST_METHOD'] = 'POST';
        $_SERVER['CONTENT_TYPE'] = 'application/json';
        
        // 出力バッファリングを開始して、ハンドラスクリプトからの出力を捕捉
        ob_start();
        include $handlerPath;
        $response = ob_get_clean();
        
        // レスポンスのデコード
        $result = json_decode($response, true);
        
        // JSONデコードエラーのチェック
        if ($result === null && json_last_error() !== JSON_ERROR_NONE) {
            $errorMsg = json_last_error_msg();
            if ($debug) {
                $responsePreview = substr($response, 0, 1000);
                throw new Exception("JSONデコードエラー: {$errorMsg}, レスポンス: {$responsePreview}");
            } else {
                throw new Exception("JSONデコードエラー: {$errorMsg}");
            }
        }
        
        return $result;
        
    } catch (Exception $e) {
        // エラー時のレスポンス
        $errorMessage = $e->getMessage();
        $debug = null;
        
        if (defined('DEBUG_MODE') && DEBUG_MODE) {
            $debug = [
                'exception' => get_class($e),
                'trace' => $e->getTraceAsString(),
                'file' => $e->getFile(),
                'line' => $e->getLine(),
                'server' => $_SERVER
            ];
        }
        
        displayError($errorMessage, $debug);
    }
}

/**
 * 指定されたURLにリダイレクトする
 * @param string $url リダイレクト先URL
 * @return void
 */
function redirect($url) {
    header("Location: {$url}");
    exit;
}

/**
 * 文字列をHTML出力用にエスケープする
 * @param string $str エスケープする文字列
 * @return string エスケープされた文字列
 */
function escape($str) {
    return htmlspecialchars($str, ENT_QUOTES, 'UTF-8');
}

/**
 * デバッグ情報を出力する
 * @param mixed $data 出力するデータ
 * @param string $title タイトル（省略可）
 * @param bool $exit 出力後に処理を終了するか
 * @return void
 */
function debug($data, $title = null, $exit = false) {
    if (defined('DEBUG_MODE') && DEBUG_MODE) {
        echo '<div class="debug-info">';
        if ($title) {
            echo '<h4>' . escape($title) . '</h4>';
        }
        echo '<pre>';
        if (is_array($data) || is_object($data)) {
            print_r($data);
        } else {
            echo escape($data);
        }
        echo '</pre>';
        echo '</div>';
        
        if ($exit) {
            exit;
        }
    }
}

/**
 * 現在のユーザーが認証済みかチェックする
 * @return bool 認証済みの場合はtrue
 */
function isAuthenticated() {
    return isset($_SESSION[SESSION_COOKIE_NAME]);
}

/**
 * 現在のユーザー情報を取得する
 * @return array|null ユーザー情報（未認証の場合はnull）
 */
function getCurrentUser() {
    if (!isset($_SESSION['user'])) {
        return null;
    }
    
    try {
        // データベースから最新のユーザー情報を取得
        $db = Database::getInstance();
        $stmt = $db->prepare("SELECT * FROM users WHERE id = ?");
        $stmt->execute([$_SESSION['user']['id']]);
        $user = $stmt->fetch(PDO::FETCH_ASSOC);
        
        if ($user) {
            // セッションのユーザー情報を更新
            $_SESSION['user'] = $user;
            return $user;
        }
    } catch (Exception $e) {
        // データベースエラーの場合はセッションの情報を返す
        return $_SESSION['user'];
    }
    
    return null;
}

/**
 * ファイルが存在するかチェックし、存在しない場合はエラーメッセージを表示する
 * @param string $filePath ファイルパス
 * @param string $errorMessage エラーメッセージ
 * @return bool ファイルが存在する場合はtrue
 */
function checkFileExists($filePath, $errorMessage = null) {
    if (!file_exists($filePath)) {
        if ($errorMessage) {
            echo '<div class="error-message">' . escape($errorMessage) . '</div>';
        }
        return false;
    }
    return true;
}

/**
 * HTTPリクエストのメソッドを確認する
 * @param string $method 確認するHTTPメソッド
 * @return bool メソッドが一致する場合はtrue
 */
function isRequestMethod($method) {
    return strtoupper($_SERVER['REQUEST_METHOD']) === strtoupper($method);
}

/**
 * GETパラメータを取得する
 * @param string $key パラメータキー
 * @param mixed $default デフォルト値
 * @return mixed パラメータ値
 */
function getQueryParam($key, $default = null) {
    return $_GET[$key] ?? $default;
}

/**
 * POSTパラメータを取得する
 * @param string $key パラメータキー
 * @param mixed $default デフォルト値
 * @return mixed パラメータ値
 */
function getPostParam($key, $default = null) {
    return $_POST[$key] ?? $default;
}

/**
 * CSRFトークンを生成する
 * @return string CSRFトークン
 */
function generateCsrfToken() {
    if (!isset($_SESSION['csrf_token'])) {
        $_SESSION['csrf_token'] = bin2hex(random_bytes(32));
    }
    return $_SESSION['csrf_token'];
}

/**
 * CSRFトークンを検証する
 * @param string $token 検証するトークン
 * @return bool 有効な場合はtrue
 */
function validateCsrfToken($token) {
    if (!isset($_SESSION['csrf_token']) || $token !== $_SESSION['csrf_token']) {
        return false;
    }
    return true;
}

/**
 * アクティブなタブを判定する
 * @param string $tabName タブ名
 * @param string $currentTab 現在のタブ
 * @return string アクティブな場合はactive、それ以外は空文字
 */
function isActiveTab($tabName, $currentTab) {
    return ($tabName === $currentTab) ? 'active' : '';
}

/**
 * エラーメッセージを表示する
 * @param string $message エラーメッセージ
 * @param array $debug デバッグ情報（省略可）
 * @return void
 */
function displayError($message, $debug = null) {
    $response = [
        'status' => 'error',
        'error' => $message
    ];
    
    if (defined('DEBUG_MODE') && DEBUG_MODE && $debug) {
        $response['debug'] = $debug;
    }
    
    header('Content-Type: application/json; charset=utf-8');
    echo json_encode($response, JSON_UNESCAPED_UNICODE);
    exit;
}

/**
 * 認証が必要なルートかどうかをチェックする
 * @param string $controller コントローラー名
 * @param string $action アクション名
 * @return bool 認証が必要な場合はtrue
 */
function requiresAuth($controller, $action) {
    // 認証が不要なルート
    $publicRoutes = [
        'auth' => ['login', 'register', 'logout'],
        'error' => ['404', '500']
    ];
    
    return !isset($publicRoutes[$controller]) || !in_array($action, $publicRoutes[$controller]);
}

/**
 * ログインページにリダイレクトする
 * @return void
 */
function redirectToLogin() {
    // シンボリックリンク環境でのリダイレクト
    $loginUrl = '/agent/auth/login.php';
    
    // デバッグ情報の出力
    error_log('=== Redirect Debug Info ===');
    error_log('Login URL: ' . $loginUrl);
    error_log('SCRIPT_NAME: ' . $_SERVER['SCRIPT_NAME']);
    error_log('REQUEST_URI: ' . $_SERVER['REQUEST_URI']);
    error_log('PHP_SELF: ' . $_SERVER['PHP_SELF']);
    error_log('HTTP_HOST: ' . $_SERVER['HTTP_HOST']);
    error_log('REQUEST_SCHEME: ' . $_SERVER['REQUEST_SCHEME']);
    error_log('HTTP_X_FORWARDED_PROTO: ' . ($_SERVER['HTTP_X_FORWARDED_PROTO'] ?? 'not set'));
    error_log('HTTP_X_FORWARDED_HOST: ' . ($_SERVER['HTTP_X_FORWARDED_HOST'] ?? 'not set'));
    error_log('HTTP_REFERER: ' . ($_SERVER['HTTP_REFERER'] ?? 'not set'));
    error_log('========================');
    
    // リダイレクト
    header('Location: ' . $loginUrl);
    exit;
}
?> 