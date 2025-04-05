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
 * Xibo API エージェント - APIハンドラー
 * Google Gemini AIを活用したXiboデジタルサイネージAPIインターフェース
 */

// Xiboエージェントの定義
define('XIBO_AGENT', true);

// エラーレポーティングの設定
ini_set('display_errors', 0);
error_reporting(E_ALL & ~E_NOTICE & ~E_WARNING);

// 設定ファイルの読み込み
$configFile = __DIR__ . '/../config/config.php';

if (!file_exists($configFile)) {
    header('Content-Type: application/json');
    echo json_encode([
        'status' => 'error',
        'error' => '設定ファイルが見つかりません'
    ]);
    exit;
}

require_once $configFile;

// セッション開始
if (session_status() === PHP_SESSION_NONE) {
    session_start();
}

// Agentスクリプトの読み込み
require_once __DIR__ . '/../controller/agent.php';

// コンテンツタイプをJSONに設定
header('Content-Type: application/json');
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: GET, POST, PUT, DELETE');
header('Access-Control-Allow-Headers: Content-Type, Authorization');

// デバッグモード（本番環境では無効化すること）
$debug = true;

// タイムアウト設定
set_time_limit(120);

try {
    // データベースライブラリ
    if (!file_exists(__DIR__ . '/../controller/database.php')) {
        throw new Exception('データベースライブラリが見つかりません: ' . __DIR__ . '/../controller/database.php');
    }
    require_once __DIR__ . '/../controller/database.php';

    // データベースを初期化
    try {
        $db = Database::getInstance();
        $db->initializeTables();
    } catch (Exception $e) {
        $errorMessage = 'データベース接続エラー: ';
        if (strpos($e->getMessage(), 'Access denied') !== false) {
            $errorMessage .= 'データベースのユーザー名またはパスワードが正しくありません。';
        } elseif (strpos($e->getMessage(), 'Unknown database') !== false) {
            $errorMessage .= 'データベースが存在しません。データベースを作成してください。';
        } elseif (strpos($e->getMessage(), 'Connection refused') !== false) {
            $errorMessage .= 'データベースサーバーに接続できません。サーバーが起動しているか確認してください。';
        } else {
            $errorMessage .= $e->getMessage();
        }
        throw new Exception($errorMessage);
    }

    // ユーザーとセッションマネージャーのインスタンス化
    $userManager = new UserManager();
    $sessionManager = new SessionManager();

    // ハンドラーリクエストをログに記録
    debugLog("handler.php: リクエスト受信", [
        'method' => $_SERVER['REQUEST_METHOD'],
        'query_string' => $_SERVER['QUERY_STRING'],
        'remote_addr' => $_SERVER['REMOTE_ADDR'],
        'user_agent' => $_SERVER['HTTP_USER_AGENT'] ?? 'なし'
    ], 'info');

    // 認証済みユーザーのチェック
    $currentUserId = null;
    $sessionId = $_COOKIE['xibo_session'] ?? null;

    if ($sessionId) {
        $currentUserId = $sessionManager->validateSession($sessionId);
    }

    // 応答データの初期化
    $response = ['status' => 'waiting'];

    // リクエスト処理
    if ($_SERVER['REQUEST_METHOD'] === 'POST') {
        debugLog("handler.php: POSTリクエスト処理開始", null, 'info');
        
        // リクエストボディの取得
        $requestBody = file_get_contents('php://input');
        $data = json_decode($requestBody, true);
        
        if ($data === null) {
            $response = [
                'status' => 'error',
                'error' => 'リクエストの解析に失敗しました'
            ];
        } else {
            switch ($data['action'] ?? '') {
                case 'register':
                    // ユーザー登録処理
                    if (isset($data['username'], $data['email'], $data['password'])) {
                        $result = $userManager->registerUser($data['username'], $data['email'], $data['password']);
                        
                        if (isset($result['user_id'])) {
                            // 登録成功、セッション作成
                            $sessionId = $sessionManager->createSession($result['user_id']);
                            setcookie('xibo_session', $sessionId, time() + $session_lifetime, '/', '', false, true);
                            
                            $response = [
                                'status' => 'success',
                                'message' => 'ユーザー登録が完了しました'
                            ];
                        } else {
                            $response = [
                                'status' => 'error',
                                'error' => $result['error']
                            ];
                        }
                    } else {
                        $response = [
                            'status' => 'error',
                            'error' => 'ユーザー名、メールアドレス、パスワードが必要です'
                        ];
                    }
                    break;
                    
                case 'login':
                    // ログイン処理
                    if (isset($data['username'], $data['password'])) {
                        $result = $userManager->loginUser($data['username'], $data['password']);
                        
                        if (isset($result['user_id'])) {
                            // ログイン成功、セッション作成
                            $sessionId = $sessionManager->createSession($result['user_id']);
                            setcookie('xibo_session', $sessionId, time() + $session_lifetime, '/', '', false, true);
                            
                            $response = [
                                'status' => 'success',
                                'message' => 'ログインに成功しました'
                            ];
                        } else {
                            $response = [
                                'status' => 'error',
                                'error' => $result['error']
                            ];
                        }
                    } else {
                        $response = [
                            'status' => 'error',
                            'error' => 'ユーザー名とパスワードが必要です'
                        ];
                    }
                    break;
                    
                case 'logout':
                    // ログアウト処理
                    if ($sessionId) {
                        $sessionManager->deleteSession($sessionId);
                        setcookie('xibo_session', '', time() - 3600, '/', '', false, true);
                    }
                    
                    $response = [
                        'status' => 'success',
                        'message' => 'ログアウトしました'
                    ];
                    break;
                    
                case 'save_config':
                    // 設定保存処理
                    if ($currentUserId) {
                        if (isset($data['config']) && is_array($data['config'])) {
                            $result = $userManager->updateUserSettings($currentUserId, $data['config']);
                            
                            if ($result) {
                                $response = [
                                    'status' => 'success',
                                    'message' => '設定が保存されました'
                                ];
                            } else {
                                $response = [
                                    'status' => 'error',
                                    'error' => '設定の保存に失敗しました'
                                ];
                            }
                        } else {
                            $response = [
                                'status' => 'error',
                                'error' => '無効な設定データです'
                            ];
                        }
                    } else {
                        $response = [
                            'status' => 'error',
                            'error' => 'ログインが必要です'
                        ];
                    }
                    break;
                    
                default:
                    // Xiboへのプロンプト送信
                    if ($currentUserId) {
                        if (isset($data['prompt'])) {
                            // ユーザー設定の取得
                            $userSettings = $userManager->getUserSettings($currentUserId);
                            
                            if ($userSettings && 
                                !empty($userSettings['xibo_api_url']) && 
                                !empty($userSettings['xibo_client_id']) && 
                                !empty($userSettings['xibo_client_secret']) && 
                                !empty($userSettings['gemini_api_key'])) {
                                
                                // ユーザー固有の設定を使用
                                $config = [
                                    'xibo_api_url' => $userSettings['xibo_api_url'],
                                    'xibo_client_id' => $userSettings['xibo_client_id'],
                                    'xibo_client_secret' => $userSettings['xibo_client_secret'],
                                    'gemini_api_key' => $userSettings['gemini_api_key'],
                                    'gemini_model' => $userSettings['gemini_model']
                                ];
                                
                                // プロンプト処理をここで実装
                                // この部分は既存の処理を再利用
                                // 例: $response = processPrompt($data['prompt'], $config);
                                
                                // テスト用のダミー応答
                                $response = [
                                    'status' => 'success',
                                    'description' => 'プロンプトが処理されました',
                                    'data' => [
                                        ['id' => 1, 'name' => 'テスト結果', 'status' => 'アクティブ']
                                    ]
                                ];
                            } else {
                                $response = [
                                    'status' => 'error',
                                    'error' => 'Xibo APIとGemini APIの設定が必要です'
                                ];
                            }
                        } else {
                            $response = [
                                'status' => 'error',
                                'error' => 'プロンプトが入力されていません'
                            ];
                        }
                    } else {
                        $response = [
                            'status' => 'error',
                            'error' => 'ログインが必要です'
                        ];
                    }
            }
        }
        
        debugLog("handler.php: POSTリクエスト処理完了", [
            'response_status' => isset($response['error']) ? 'error' : 'success'
        ], 'info');
        
    } else if ($_SERVER['REQUEST_METHOD'] === 'GET') {
        debugLog("handler.php: GETリクエスト処理開始", null, 'info');
        
        if ($currentUserId) {
            // ログイン済みの場合
            $user = $userManager->getUserById($currentUserId);
            $userSettings = $userManager->getUserSettings($currentUserId);
            
            $isConfigured = $userSettings && 
                            !empty($userSettings['xibo_api_url']) && 
                            !empty($userSettings['xibo_client_id']) && 
                            !empty($userSettings['xibo_client_secret']) && 
                            !empty($userSettings['gemini_api_key']);
            
            $response = [
                'status' => 'ready',
                'is_authenticated' => true,
                'user' => [
                    'id' => $user['id'],
                    'username' => $user['username'],
                    'email' => $user['email']
                ],
                'is_configured' => $isConfigured,
                'config' => [
                    'gemini_model' => $userSettings['gemini_model'] ?? 'gemini-1.5-pro'
                ]
            ];
        } else {
            // 未ログインの場合
            $response = [
                'status' => 'ready',
                'is_authenticated' => false,
                'is_configured' => false
            ];
        }
        
        debugLog("handler.php: GETリクエスト処理完了", [
            'is_authenticated' => $response['is_authenticated'] ?? false,
            'is_configured' => $response['is_configured'] ?? false
        ], 'info');
    }

    // 追加のデバッグ情報（デバッグモードの場合のみ）
    if ($debug) {
        $response['debug'] = [
            'server' => $_SERVER['SERVER_NAME'] ?? 'unknown',
            'request_uri' => $_SERVER['REQUEST_URI'] ?? 'unknown',
            'script_filename' => $_SERVER['SCRIPT_FILENAME'] ?? 'unknown',
            'document_root' => $_SERVER['DOCUMENT_ROOT'] ?? 'unknown',
            'php_self' => $_SERVER['PHP_SELF'] ?? 'unknown',
            'directory' => __DIR__,
            'included_files' => get_included_files()
        ];
    }

    // JSONレスポンスを返す
    debugLog("handler.php: レスポンス送信", [
        'response_size' => strlen(json_encode($response))
    ], 'debug');
    
    echo json_encode($response);
    
} catch (Exception $e) {
    // 例外処理
    $errorResponse = [
        'status' => 'error',
        'error' => $e->getMessage()
    ];
    
    if ($debug) {
        $errorResponse['debug'] = [
            'exception' => get_class($e),
            'trace' => $e->getTraceAsString(),
            'file' => $e->getFile(),
            'line' => $e->getLine(),
            'server' => $_SERVER
        ];
    }
    
    echo json_encode($errorResponse);
}
exit; 
