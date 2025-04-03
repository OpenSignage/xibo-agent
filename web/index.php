<?php
/*
 * Xibo API エージェント - フロントエンドUI
 * Google Gemini AIを活用したXiboデジタルサイネージAPIインターフェース
 */

// 最低限のPHP処理（必要に応じて変更可能）
// この部分は設定ステータスの確認のために最初のロード時にのみ使用
$apiUrl = '../api/handler.php';
$configStatus = ['is_configured' => false];

// API設定状態を確認
$ch = curl_init($apiUrl);
curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
curl_setopt($ch, CURLOPT_HEADER, false);
$response = curl_exec($ch);
curl_close($ch);

if ($response) {
    $configStatus = json_decode($response, true);
}

$isConfigured = isset($configStatus['is_configured']) ? $configStatus['is_configured'] : false;
?>
<!DOCTYPE html>
<html lang="ja">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Xibo APIエージェント</title>
    <link rel="stylesheet" href="style.css">
</head>
<body>
    <div class="container">
        <header>
            <h1>Xibo APIエージェント</h1>
            <p>Google Gemini AIを活用したXiboデジタルサイネージAPIインターフェース</p>
        </header>

        <div class="settings-panel">
            <h2>設定</h2>
            <?php if (!$isConfigured): ?>
                <div class="warning">APIの設定が完了していません。以下の情報を入力してください。</div>
            <?php endif; ?>
            
            <button id="toggle-settings" class="btn"><?php echo $isConfigured ? '設定を表示' : '設定を入力'; ?></button>
            
            <form id="config-form" class="<?php echo $isConfigured ? 'hidden' : ''; ?>" method="post">
                <input type="hidden" name="action" value="save_config">
                
                <div class="form-group">
                    <label for="xibo_api_url">Xibo API URL:</label>
                    <input type="text" id="xibo_api_url" name="xibo_api_url" value="" required>
                    <small>例: https://your-xibo-cms.com/api</small>
                </div>
                
                <div class="form-group">
                    <label for="xibo_client_id">Xibo Client ID:</label>
                    <input type="text" id="xibo_client_id" name="xibo_client_id" value="" required>
                </div>
                
                <div class="form-group">
                    <label for="xibo_client_secret">Xibo Client Secret:</label>
                    <input type="password" id="xibo_client_secret" name="xibo_client_secret" value="" required>
                </div>
                
                <div class="form-group">
                    <label for="gemini_api_key">Google Gemini API Key:</label>
                    <input type="password" id="gemini_api_key" name="gemini_api_key" value="" required>
                </div>
                
                <div class="form-group">
                    <label for="gemini_model">Gemini Model:</label>
                    <select id="gemini_model" name="gemini_model">
                        <option value="gemini-1.5-pro">Gemini 1.5 Pro</option>
                        <option value="gemini-1.5-flash">Gemini 1.5 Flash</option>
                        <option value="gemini-pro">Gemini Pro</option>
                    </select>
                </div>
                
                <button type="submit" class="btn primary">設定を保存</button>
            </form>
        </div>

        <?php if ($isConfigured): ?>
            <div class="chat-container">
                <div class="chat-history" id="chat-history">
                    <div class="welcome-message">
                        <h2>Xiboエージェントへようこそ</h2>
                        <p>以下に指示を入力してください。例:</p>
                        <ul>
                            <li>接続されているディスプレイの一覧を表示して</li>
                            <li>最近更新されたレイアウトを5つ表示して</li>
                            <li>スケジュールの一覧を取得して</li>
                        </ul>
                    </div>
                </div>
                
                <div class="chat-input">
                    <form id="prompt-form">
                        <textarea id="user-prompt" placeholder="Xiboに対する指示を入力してください..." required></textarea>
                        <button type="submit" class="btn primary">送信</button>
                    </form>
                </div>
            </div>
        <?php endif; ?>
    </div>

    <script>
        // API URLの設定
        const API_URL = '../api/handler.php';
        
        // 設定切り替え
        document.getElementById('toggle-settings').addEventListener('click', function() {
            const form = document.getElementById('config-form');
            form.classList.toggle('hidden');
            this.textContent = form.classList.contains('hidden') ? '設定を表示' : '設定を隠す';
        });

        // 設定フォームの送信処理
        document.getElementById('config-form').addEventListener('submit', function(e) {
            e.preventDefault();
            
            const formData = new FormData(this);
            const formValues = {};
            
            for (const [key, value] of formData.entries()) {
                formValues[key] = value;
            }
            
            // 設定保存APIリクエスト
            fetch(API_URL, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    action: 'save_config',
                    config: formValues
                })
            })
            .then(response => response.json())
            .then(data => {
                if (data.status === 'success') {
                    alert('設定が保存されました');
                    location.reload();
                } else {
                    alert('エラー: ' + (data.error || '設定の保存に失敗しました'));
                }
            })
            .catch(error => {
                alert('リクエスト中にエラーが発生しました: ' + error.message);
            });
        });

        <?php if ($isConfigured): ?>
        // プロンプト送信処理
        document.getElementById('prompt-form').addEventListener('submit', function(e) {
            e.preventDefault();
            
            const promptInput = document.getElementById('user-prompt');
            const chatHistory = document.getElementById('chat-history');
            const userPrompt = promptInput.value.trim();
            
            if (userPrompt === '') {
                return;
            }
            
            // ユーザーの質問を表示
            const userDiv = document.createElement('div');
            userDiv.className = 'chat-message user-message';
            userDiv.textContent = userPrompt;
            chatHistory.appendChild(userDiv);
            
            // 処理中メッセージ
            const loadingDiv = document.createElement('div');
            loadingDiv.className = 'chat-message agent-message loading';
            loadingDiv.innerHTML = '<div class="loading-spinner"></div><div>処理中...</div>';
            chatHistory.appendChild(loadingDiv);
            
            // 自動スクロール
            chatHistory.scrollTop = chatHistory.scrollHeight;
            
            // 入力欄をクリア
            promptInput.value = '';
            
            // APIリクエスト
            fetch(API_URL, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    prompt: userPrompt
                })
            })
            .then(response => response.json())
            .then(data => {
                // ローディングメッセージを削除
                chatHistory.removeChild(loadingDiv);
                
                // 結果を表示
                const responseDiv = document.createElement('div');
                responseDiv.className = 'chat-message agent-message';
                
                if (data.error) {
                    responseDiv.innerHTML = `<div class="error">エラー: ${data.error}</div>`;
                    if (data.raw_response) {
                        responseDiv.innerHTML += `<details>
                            <summary>AI応答の詳細</summary>
                            <pre>${data.raw_response}</pre>
                        </details>`;
                    }
                } else {
                    // 成功した場合の表示
                    responseDiv.innerHTML = `<div class="response-description">${data.description || 'APIリクエスト完了'}</div>`;
                    
                    if (data.data) {
                        if (Array.isArray(data.data)) {
                            // 配列データの表示（テーブル形式）
                            if (data.data.length > 0) {
                                const keys = Object.keys(data.data[0]);
                                
                                responseDiv.innerHTML += `
                                <details open>
                                    <summary>結果データ: ${data.data.length}件</summary>
                                    <div class="table-container">
                                        <table>
                                            <thead>
                                                <tr>
                                                    ${keys.map(k => `<th>${k}</th>`).join('')}
                                                </tr>
                                            </thead>
                                            <tbody>
                                                ${data.data.map(item => `
                                                    <tr>
                                                        ${keys.map(k => `<td>${formatTableCell(item[k])}</td>`).join('')}
                                                    </tr>
                                                `).join('')}
                                            </tbody>
                                        </table>
                                    </div>
                                </details>`;
                            } else {
                                responseDiv.innerHTML += `<div class="info">データが見つかりませんでした。</div>`;
                            }
                        } else {
                            // オブジェクトデータの表示
                            responseDiv.innerHTML += `
                            <details>
                                <summary>結果データ</summary>
                                <pre>${JSON.stringify(data.data, null, 2)}</pre>
                            </details>`;
                        }
                    }
                }
                
                chatHistory.appendChild(responseDiv);
                chatHistory.scrollTop = chatHistory.scrollHeight;
            })
            .catch(error => {
                // ローディングメッセージを削除
                chatHistory.removeChild(loadingDiv);
                
                // エラーメッセージを表示
                const errorDiv = document.createElement('div');
                errorDiv.className = 'chat-message agent-message';
                errorDiv.innerHTML = `<div class="error">リクエスト中にエラーが発生しました: ${error.message}</div>`;
                chatHistory.appendChild(errorDiv);
                chatHistory.scrollTop = chatHistory.scrollHeight;
            });
        });
        
        // テーブルセル内のデータを適切に表示するためのヘルパー関数
        function formatTableCell(value) {
            if (value === null || value === undefined) {
                return '-';
            } else if (typeof value === 'object') {
                return JSON.stringify(value);
            } else if (typeof value === 'boolean') {
                return value ? '✓' : '✗';
            } else {
                return String(value);
            }
        }
        <?php endif; ?>
    </script>
</body>
</html> 