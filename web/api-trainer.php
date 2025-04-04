<?php
/*
 * Xibo-agent - Open Source Digital Signage - https://www.open-signage.org
 * Copyright (C) 2025 Open Source Digital Signage Initiative
 *
 * This file is part of Xibo-agent.
 */

// セッション開始
session_start();

// 定数定義
define('XIBO_AGENT', true);

// 設定ファイルの読み込み
require_once '../config/config.php';
if (file_exists('../config/config-local.php')) {
    require_once '../config/config-local.php';
}

// 必要なファイルの読み込み
require_once '../controller/agent.php';

// ログファイルパス
$logFile = __DIR__ . '/../logs/api-trainer.log';

// ログ出力関数
function logMessage($message) {
    global $logFile;
    $timestamp = date('Y-m-d H:i:s');
    $logMessage = "[$timestamp] $message\n";
    file_put_contents($logFile, $logMessage, FILE_APPEND);
}

// APIファイルをGeminiに学習させる
function trainGeminiWithApiFile($apiFilePath) {
    global $config;
    
    // APIファイルが存在するか確認
    if (!file_exists($apiFilePath)) {
        return ['error' => 'APIファイルが見つかりません: ' . $apiFilePath];
    }
    
    // APIファイルを読み込む
    $apiJson = file_get_contents($apiFilePath);
    if ($apiJson === false) {
        return ['error' => 'APIファイルの読み込みに失敗しました'];
    }
    
    // JSONとして解析
    $apiData = json_decode($apiJson, true);
    if (json_last_error() !== JSON_ERROR_NONE) {
        return ['error' => 'JSONデコードエラー: ' . json_last_error_msg()];
    }
    
    // APIパスとメソッドの数を数える
    $pathCount = isset($apiData['paths']) ? count($apiData['paths']) : 0;
    
    // Gemini APIキーの確認
    if (empty($config['gemini_api_key'])) {
        return ['error' => 'Gemini API キーが設定されていません'];
    }
    
    // APIの概要を作成
    $apiSummary = [
        'info' => $apiData['info'] ?? [],
        'paths' => []
    ];
    
    // 全パスの基本情報を取得
    if (isset($apiData['paths'])) {
        foreach ($apiData['paths'] as $path => $methods) {
            $apiSummary['paths'][$path] = [];
            foreach ($methods as $method => $details) {
                $apiSummary['paths'][$path][$method] = [
                    'summary' => $details['summary'] ?? '',
                    'description' => $details['description'] ?? '',
                    'parameters' => array_map(function($param) {
                        return [
                            'name' => $param['name'] ?? '',
                            'description' => $param['description'] ?? '',
                            'required' => $param['required'] ?? false,
                            'type' => $param['type'] ?? ''
                        ];
                    }, $details['parameters'] ?? [])
                ];
            }
        }
    }
    
    // システムプロンプトファイルの更新
    $systemPromptFile = __DIR__ . '/../controller/systemPrompt.txt';
    if (!file_exists($systemPromptFile)) {
        return ['error' => 'システムプロンプトファイルが見つかりません'];
    }
    
    $systemPrompt = file_get_contents($systemPromptFile);
    if ($systemPrompt === false) {
        return ['error' => 'システムプロンプトファイルの読み込みに失敗しました'];
    }
    
    // API参照を更新
    $updatedPrompt = preg_replace(
        '/Xibo APIの定義は.*?にあります。\r?\nこのファイルにはXiboの全APIエンドポイント、パラメータ、レスポンス形式が定義されています。/s',
        "以下はXibo APIの定義です:\n" . json_encode($apiSummary, JSON_UNESCAPED_UNICODE | JSON_PRETTY_PRINT) . "\n\nこのAPIを参照して適切なエンドポイントとパラメータを選択してください。",
        $systemPrompt
    );
    
    // 更新されたシステムプロンプトを保存
    if (file_put_contents($systemPromptFile, $updatedPrompt) === false) {
        return ['error' => 'システムプロンプトファイルの保存に失敗しました'];
    }
    
    logMessage("APIファイル " . basename($apiFilePath) . " を学習させました（パス数: $pathCount）");
    
    return [
        'success' => true,
        'message' => 'APIファイルをGeminiに学習させました',
        'details' => [
            'file' => basename($apiFilePath),
            'paths' => $pathCount,
            'prompt_size' => strlen($updatedPrompt)
        ]
    ];
}

// リクエスト処理
$result = ['status' => 'idle'];

if ($_SERVER['REQUEST_METHOD'] === 'POST') {
    if (isset($_POST['action']) && $_POST['action'] === 'train') {
        $apiFilePath = __DIR__ . '/../controller/xibo-api.json';
        if (isset($_POST['api_file_path']) && !empty($_POST['api_file_path'])) {
            $apiFilePath = $_POST['api_file_path'];
        }
        
        $result = trainGeminiWithApiFile($apiFilePath);
        logMessage("APIトレーニングリクエスト: " . ($result['success'] ?? false ? '成功' : '失敗'));
    }
}
?>
<!DOCTYPE html>
<html lang="ja">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Xibo API トレーナー</title>
    <link rel="stylesheet" href="style.css">
    <style>
        .container {
            max-width: 800px;
            margin: 0 auto;
            padding: 20px;
        }
        .card {
            background: #fff;
            border-radius: 8px;
            box-shadow: 0 2px 10px rgba(0, 0, 0, 0.1);
            padding: 20px;
            margin-bottom: 20px;
        }
        .form-group {
            margin-bottom: 15px;
        }
        label {
            display: block;
            margin-bottom: 5px;
            font-weight: bold;
        }
        input[type="text"] {
            width: 100%;
            padding: 8px;
            border: 1px solid #ddd;
            border-radius: 4px;
        }
        .btn {
            padding: 10px 20px;
            background: #1a73e8;
            color: white;
            border: none;
            border-radius: 4px;
            cursor: pointer;
        }
        .alert {
            padding: 15px;
            border-radius: 4px;
            margin-bottom: 20px;
        }
        .alert-success {
            background-color: #d4edda;
            color: #155724;
        }
        .alert-danger {
            background-color: #f8d7da;
            color: #721c24;
        }
        .info-box {
            background: #f8f9fa;
            padding: 15px;
            border-radius: 4px;
            margin-bottom: 20px;
        }
    </style>
</head>
<body>
    <div class="container">
        <h1>Xibo API トレーナー</h1>
        
        <div class="card">
            <h2>Gemini AIにXibo APIを学習させる</h2>
            
            <div class="info-box">
                <p>このツールを使用して、Xibo APIの定義ファイル（JSONフォーマット）をGemini AIに学習させることができます。学習後、AIはAPIエンドポイントとパラメータについての知識を得て、より的確なレスポンスを返せるようになります。</p>
                <p><strong>注意:</strong> APIファイルが大きい場合、システムプロンプトも大きくなり、Gemini APIのリクエスト制限に達する可能性があります。その場合は、必要な部分のみを抽出するようにコードを調整してください。</p>
            </div>
            
            <?php if (isset($result['error'])): ?>
            <div class="alert alert-danger">
                <?php echo htmlspecialchars($result['error']); ?>
            </div>
            <?php elseif (isset($result['success']) && $result['success']): ?>
            <div class="alert alert-success">
                <?php echo htmlspecialchars($result['message']); ?>
                <ul>
                    <li>ファイル: <?php echo htmlspecialchars($result['details']['file']); ?></li>
                    <li>APIパス数: <?php echo htmlspecialchars($result['details']['paths']); ?></li>
                    <li>プロンプトサイズ: <?php echo htmlspecialchars($result['details']['prompt_size']); ?> バイト</li>
                </ul>
            </div>
            <?php endif; ?>
            
            <form method="post" action="">
                <div class="form-group">
                    <label for="api_file_path">APIファイルパス（デフォルト: ../controller/xibo-api.json）:</label>
                    <input type="text" id="api_file_path" name="api_file_path" placeholder="/絶対パス/または/相対パス/api-file.json">
                </div>
                
                <input type="hidden" name="action" value="train">
                <button type="submit" class="btn">APIを学習させる</button>
            </form>
        </div>
        
        <div class="card">
            <h2>現在のシステム情報</h2>
            <?php
            $systemPromptFile = __DIR__ . '/../controller/systemPrompt.txt';
            $apiJsonFile = __DIR__ . '/../controller/xibo-api.json';
            $systemPromptSize = file_exists($systemPromptFile) ? filesize($systemPromptFile) : 'ファイルが見つかりません';
            $apiJsonSize = file_exists($apiJsonFile) ? filesize($apiJsonFile) : 'ファイルが見つかりません';
            ?>
            
            <table>
                <tr>
                    <td>システムプロンプトファイル:</td>
                    <td><?php echo htmlspecialchars($systemPromptFile); ?></td>
                </tr>
                <tr>
                    <td>システムプロンプトサイズ:</td>
                    <td><?php echo is_numeric($systemPromptSize) ? number_format($systemPromptSize) . ' バイト' : $systemPromptSize; ?></td>
                </tr>
                <tr>
                    <td>APIファイル:</td>
                    <td><?php echo htmlspecialchars($apiJsonFile); ?></td>
                </tr>
                <tr>
                    <td>APIファイルサイズ:</td>
                    <td><?php echo is_numeric($apiJsonSize) ? number_format($apiJsonSize) . ' バイト' : $apiJsonSize; ?></td>
                </tr>
                <tr>
                    <td>Gemini API モデル:</td>
                    <td><?php echo htmlspecialchars($config['gemini_model'] ?? '未設定'); ?></td>
                </tr>
            </table>
        </div>
        
        <p><a href="index.php">← Xiboエージェントに戻る</a></p>
    </div>
</body>
</html> 