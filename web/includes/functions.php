<?php
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
        return [
            'status' => 'error',
            'error' => $e->getMessage(),
            'debug' => $debug ? [
                'trace' => $e->getTraceAsString(),
                'file' => $e->getFile(),
                'line' => $e->getLine()
            ] : null
        ];
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
    return isAuthenticated() ? $_SESSION[SESSION_COOKIE_NAME] : null;
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
?> 