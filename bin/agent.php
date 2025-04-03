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
 * Xibo API エージェント - 処理ロジック
 * Google Gemini AIを活用したXiboデジタルサイネージAPIインターフェース
 */

// 直接アクセス防止
if (!defined('XIBO_AGENT')) {
    die('直接アクセスは許可されていません');
}

// タイムアウト設定
set_time_limit(120);

// 設定ファイルは既にhandler.phpで読み込み済み ($config変数が利用可能)

// デバッグログ出力関数
function debugLog($message, $data = null) {
    $logFile = __DIR__ . '/../logs/debug.log';
    
    // ログディレクトリが存在しない場合は作成
    $logDir = dirname($logFile);
    if (!file_exists($logDir)) {
        mkdir($logDir, 0755, true);
    }
    
    // タイムスタンプ付きメッセージを作成
    $timestamp = date('Y-m-d H:i:s');
    $logMessage = "[$timestamp] $message";
    
    // データがある場合はJSON形式で追加
    if ($data !== null) {
        $jsonData = json_encode($data, JSON_UNESCAPED_UNICODE | JSON_PRETTY_PRINT);
        $logMessage .= "\nData: $jsonData";
    }
    
    $logMessage .= "\n" . str_repeat('-', 80) . "\n";
    
    // ファイルに書き込み
    file_put_contents($logFile, $logMessage, FILE_APPEND);
}

// APIトークンの取得（または保存済みの使用）
function getXiboAccessToken() {
    global $config;
    
    debugLog("getXiboAccessToken: トークン取得開始");
    
    // セッションにトークンが存在し、有効期限内であれば再利用
    if (isset($_SESSION['xibo_token']) && isset($_SESSION['xibo_token_expires']) && 
        $_SESSION['xibo_token_expires'] > time()) {
        debugLog("getXiboAccessToken: セッションから既存のトークンを使用", [
            'expires_in' => $_SESSION['xibo_token_expires'] - time()
        ]);
        return $_SESSION['xibo_token'];
    }
    
    // 新しいトークンを取得
    $auth_data = [
        'client_id' => $config['xibo_client_id'],
        'client_secret' => $config['xibo_client_secret'],
        'grant_type' => 'client_credentials'
    ];
    
    debugLog("getXiboAccessToken: 新規トークンのリクエスト", [
        'api_url' => $config['xibo_api_url'] . '/oauth/access_token'
    ]);
    
    $ch = curl_init($config['xibo_api_url'] . '/oauth/access_token');
    curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
    curl_setopt($ch, CURLOPT_POST, true);
    curl_setopt($ch, CURLOPT_POSTFIELDS, http_build_query($auth_data));
    
    $response = curl_exec($ch);
    $http_code = curl_getinfo($ch, CURLINFO_HTTP_CODE);
    $curl_error = curl_error($ch);
    curl_close($ch);
    
    if ($http_code != 200) {
        debugLog("getXiboAccessToken: トークン取得エラー", [
            'http_code' => $http_code,
            'curl_error' => $curl_error,
            'response' => $response
        ]);
        error_log('Xiboトークン取得エラー: ' . $response);
        return false;
    }
    
    $result = json_decode($response, true);
    
    if (isset($result['access_token'])) {
        $_SESSION['xibo_token'] = $result['access_token'];
        $_SESSION['xibo_token_expires'] = time() + $result['expires_in'];
        
        debugLog("getXiboAccessToken: 新しいトークンを取得", [
            'expires_in' => $result['expires_in']
        ]);
        
        return $result['access_token'];
    }
    
    debugLog("getXiboAccessToken: 応答からトークンを取得できませんでした", [
        'response' => $result
    ]);
    
    return false;
}

// Xibo APIにリクエストを送信
function callXiboApi($endpoint, $method = 'GET', $data = null) {
    global $config;
    
    debugLog("callXiboApi: APIリクエスト開始", [
        'endpoint' => $endpoint,
        'method' => $method,
        'data' => $data
    ]);
    
    $token = getXiboAccessToken();
    if (!$token) {
        debugLog("callXiboApi: APIトークンの取得に失敗");
        return ['error' => 'APIトークンの取得に失敗しました。'];
    }
    
    $url = $config['xibo_api_url'] . $endpoint;
    debugLog("callXiboApi: リクエストURL", ['url' => $url]);
    
    $ch = curl_init($url);
    
    curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
    curl_setopt($ch, CURLOPT_HTTPHEADER, [
        'Authorization: Bearer ' . $token,
        'Content-Type: application/json',
        'Accept: application/json'
    ]);
    
    if ($method == 'POST') {
        curl_setopt($ch, CURLOPT_POST, true);
        if ($data) {
            curl_setopt($ch, CURLOPT_POSTFIELDS, json_encode($data));
        }
    } else if ($method == 'PUT') {
        curl_setopt($ch, CURLOPT_CUSTOMREQUEST, 'PUT');
        if ($data) {
            curl_setopt($ch, CURLOPT_POSTFIELDS, json_encode($data));
        }
    } else if ($method == 'DELETE') {
        curl_setopt($ch, CURLOPT_CUSTOMREQUEST, 'DELETE');
    }
    
    $response = curl_exec($ch);
    $http_code = curl_getinfo($ch, CURLINFO_HTTP_CODE);
    $curl_error = curl_error($ch);
    curl_close($ch);
    
    if ($http_code >= 400) {
        debugLog("callXiboApi: APIリクエストエラー", [
            'http_code' => $http_code,
            'curl_error' => $curl_error,
            'response' => $response
        ]);
        error_log('Xibo API エラー (' . $http_code . '): ' . $response);
        return ['error' => 'APIリクエストエラー: ' . $http_code];
    }
    
    $result = json_decode($response, true);
    debugLog("callXiboApi: APIリクエスト完了", [
        'http_code' => $http_code,
        'response_size' => strlen($response)
    ]);
    
    return $result;
}

// Gemini AIにリクエストを送信
function callGeminiApi($userPrompt) {
    global $config;
    
    debugLog("callGeminiApi: AIリクエスト開始", [
        'prompt_length' => strlen($userPrompt),
        'model' => $config['gemini_model']
    ]);
    
    if (empty($config['gemini_api_key'])) {
        debugLog("callGeminiApi: API キーが設定されていません");
        return ['error' => 'Gemini API キーが設定されていません。'];
    }
    
    // APIエンドポイント
    $url = 'https://generativelanguage.googleapis.com/v1beta/models/' . 
           $config['gemini_model'] . ':generateContent?key=' . 
           $config['gemini_api_key'];
    
    // systemPrompt.txtファイルからシステムプロンプトを読み込む
    $systemPromptFile = __DIR__ . '/systemPrompt.txt';
    if (!file_exists($systemPromptFile)) {
        debugLog("callGeminiApi: システムプロンプトファイルが見つかりません", [
            'file_path' => $systemPromptFile
        ]);
        return ['error' => 'システムプロンプトファイルが見つかりません。'];
    }
    
    $systemPrompt = file_get_contents($systemPromptFile);
    if ($systemPrompt === false) {
        debugLog("callGeminiApi: システムプロンプトファイルの読み込みに失敗");
        return ['error' => 'システムプロンプトファイルの読み込みに失敗しました。'];
    }
    
    debugLog("callGeminiApi: システムプロンプト読み込み完了", [
        'prompt_length' => strlen($systemPrompt)
    ]);
    
    // リクエストデータ
    $data = [
        'contents' => [
            [
                'role' => 'user',
                'parts' => [
                    ['text' => $systemPrompt]
                ]
            ],
            [
                'role' => 'model',
                'parts' => [
                    ['text' => 'わかりました。ユーザーの要求に基づいてXibo APIエンドポイントと必要なパラメータをJSON形式で返します。']
                ]
            ],
            [
                'role' => 'user',
                'parts' => [
                    ['text' => $userPrompt]
                ]
            ]
        ],
        'generationConfig' => [
            'temperature' => 0.2,
            'topK' => 40,
            'topP' => 0.95,
            'maxOutputTokens' => 1024
        ]
    ];
    
    debugLog("callGeminiApi: Gemini APIリクエスト送信", [
        'url' => $url,
        'data_structure' => array_keys($data)
    ]);
    
    // cURLリクエストの設定
    $ch = curl_init($url);
    curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
    curl_setopt($ch, CURLOPT_POST, true);
    curl_setopt($ch, CURLOPT_POSTFIELDS, json_encode($data));
    curl_setopt($ch, CURLOPT_HTTPHEADER, [
        'Content-Type: application/json'
    ]);
    
    $response = curl_exec($ch);
    $http_code = curl_getinfo($ch, CURLINFO_HTTP_CODE);
    $curl_error = curl_error($ch);
    curl_close($ch);
    
    if ($http_code != 200) {
        debugLog("callGeminiApi: APIリクエストエラー", [
            'http_code' => $http_code,
            'curl_error' => $curl_error,
            'response' => $response
        ]);
        error_log('Gemini API エラー: ' . $response);
        return ['error' => 'Gemini APIリクエストエラー'];
    }
    
    $result = json_decode($response, true);
    debugLog("callGeminiApi: レスポンス受信", [
        'response_structure' => isset($result['candidates']) ? 'candidates有り' : 'candidates無し'
    ]);
    
    if (isset($result['candidates'][0]['content']['parts'][0]['text'])) {
        $aiResponse = $result['candidates'][0]['content']['parts'][0]['text'];
        debugLog("callGeminiApi: テキスト応答取得", [
            'response_length' => strlen($aiResponse)
        ]);
        
        // JSONデータの抽出（AI出力からJSONを抽出）
        if (preg_match('/```json\s*(.*?)\s*```/s', $aiResponse, $matches)) {
            $jsonData = $matches[1];
            debugLog("callGeminiApi: コードブロック内のJSONを抽出");
        } else if (preg_match('/{.*}/s', $aiResponse, $matches)) {
            $jsonData = $matches[0];
            debugLog("callGeminiApi: 応答内のJSON構造を抽出");
        } else {
            debugLog("callGeminiApi: レスポンスからJSONを抽出できませんでした", [
                'response' => $aiResponse
            ]);
            return ['error' => 'AIからの応答をJSONとして解析できませんでした。', 'raw_response' => $aiResponse];
        }
        
        try {
            $parsedData = json_decode($jsonData, true, 512, JSON_THROW_ON_ERROR);
            debugLog("callGeminiApi: JSON解析完了", [
                'parsed_structure' => array_keys($parsedData)
            ]);
            return $parsedData;
        } catch (Exception $e) {
            debugLog("callGeminiApi: JSONデコードエラー", [
                'error' => $e->getMessage(),
                'json_data' => $jsonData
            ]);
            return ['error' => 'JSONデコードエラー: ' . $e->getMessage(), 'raw_response' => $aiResponse];
        }
    }
    
    debugLog("callGeminiApi: 応答から有効なテキストを取得できませんでした");
    return ['error' => 'Gemini APIからの応答が不正な形式です。'];
}

// エージェントのメイン処理
function processAgentRequest($userPrompt) {
    debugLog("processAgentRequest: 処理開始", [
        'prompt' => $userPrompt
    ]);
    
    // ユーザープロンプトをGeminiに送信してAPIコマンドを取得
    $geminiResponse = callGeminiApi($userPrompt);
    
    if (isset($geminiResponse['error'])) {
        debugLog("processAgentRequest: Gemini APIからエラーレスポンス", [
            'error' => $geminiResponse['error']
        ]);
        return $geminiResponse;
    }
    
    // レスポンスが正しい形式か確認
    if (!isset($geminiResponse['endpoint'])) {
        debugLog("processAgentRequest: 必要なデータがありません", [
            'response' => $geminiResponse
        ]);
        return ['error' => 'AIからの応答に必要なデータがありません。', 'ai_response' => $geminiResponse];
    }
    
    // APIコマンドを実行
    $endpoint = $geminiResponse['endpoint'];
    $method = $geminiResponse['method'] ?? 'GET';
    $parameters = $geminiResponse['parameters'] ?? null;
    $description = $geminiResponse['description'] ?? '';
    
    debugLog("processAgentRequest: Xiboへのリクエスト実行準備", [
        'endpoint' => $endpoint,
        'method' => $method,
        'has_parameters' => !empty($parameters)
    ]);
    
    // クエリパラメータの処理
    if (isset($parameters) && $method === 'GET' && !empty($parameters)) {
        $queryString = http_build_query($parameters);
        if (!empty($queryString)) {
            $endpoint .= '?' . $queryString;
            debugLog("processAgentRequest: GETパラメータをエンドポイントに追加", [
                'endpoint_with_query' => $endpoint
            ]);
        }
    }
    
    // XiboのAPIを呼び出し
    $apiResponse = callXiboApi($endpoint, $method, $method !== 'GET' ? $parameters : null);
    
    debugLog("processAgentRequest: 処理完了", [
        'success' => !isset($apiResponse['error']),
        'response_type' => gettype($apiResponse)
    ]);
    
    return [
        'success' => true,
        'description' => $description,
        'endpoint' => $endpoint,
        'method' => $method,
        'data' => $apiResponse
    ];
}

// POSTリクエストのハンドラー関数
function handlePostRequest() {
    debugLog("handlePostRequest: POSTリクエスト処理開始");
    
    // JSONリクエストの場合
    $input = file_get_contents('php://input');
    $postData = json_decode($input, true);
    
    // フォームからのPOSTリクエストのフォールバック
    if (json_last_error() !== JSON_ERROR_NONE) {
        debugLog("handlePostRequest: JSONデコードエラー、POSTデータを使用", [
            'json_error' => json_last_error_msg()
        ]);
        $postData = $_POST;
    } else {
        debugLog("handlePostRequest: JSONリクエスト受信", [
            'data_keys' => array_keys($postData)
        ]);
    }
    
    // 設定保存リクエスト
    if (isset($postData['action']) && $postData['action'] === 'save_config') {
        debugLog("handlePostRequest: 設定保存リクエスト");
        return handleSaveConfig($postData['config'] ?? []);
    }
    
    // AIプロンプトの処理
    if (isset($postData['prompt'])) {
        debugLog("handlePostRequest: プロンプト処理リクエスト");
        return processAgentRequest($postData['prompt']);
    }
    
    debugLog("handlePostRequest: 無効なリクエスト", [
        'post_data' => $postData
    ]);
    
    return ['error' => '無効なリクエスト'];
}

// 設定の保存
function handleSaveConfig($configData) {
    debugLog("handleSaveConfig: 設定保存処理開始", [
        'provided_keys' => array_keys($configData)
    ]);
    
    global $config;
    
    // 必須フィールドのチェック
    $requiredFields = ['xibo_api_url', 'xibo_client_id', 'xibo_client_secret', 'gemini_api_key'];
    foreach ($requiredFields as $field) {
        if (empty($configData[$field])) {
            debugLog("handleSaveConfig: 必須フィールドが不足", [
                'missing_field' => $field
            ]);
            return ['error' => $field . ' は必須項目です'];
        }
    }
    
    // 設定をマージ
    $newConfig = array_merge($config, $configData);
    
    // config-local.php ファイルに保存
    $configFile = __DIR__ . '/../config/config-local.php';
    $configContent = "<?php\n// 自動生成された設定ファイル - " . date('Y-m-d H:i:s') . "\n\n";
    $configContent .= "// ローカル設定（自動生成）\n";
    $configContent .= "\$config = " . var_export($newConfig, true) . ";\n";
    
    debugLog("handleSaveConfig: 設定ファイル保存", [
        'file_path' => $configFile
    ]);
    
    if (file_put_contents($configFile, $configContent) === false) {
        debugLog("handleSaveConfig: 設定ファイルの保存に失敗");
        return ['error' => '設定ファイルの保存に失敗しました'];
    }
    
    debugLog("handleSaveConfig: 設定保存完了");
    return ['status' => 'success', 'message' => '設定が保存されました'];
} 
