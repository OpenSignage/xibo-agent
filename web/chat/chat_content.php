<?php
/*
 * Xibo API エージェント - チャットコンテンツ
 */

// 直接アクセスを防止
if (!defined('BASE_PATH')) {
    exit('直接アクセスは許可されていません');
}

// APIステータスの確認
$apiStatus = getApiStatus();
$isConnected = ($apiStatus['status'] === 'success');

// ページコンテンツのキャプチャを開始
ob_start();
?>

<div class="chat-page">
    <h2>Xiboエージェントチャット</h2>
    
    <?php if (!$isConnected): ?>
        <div class="error-panel">
            <div class="error-message">
                APIサーバーに接続できません。設定を確認してください。
            </div>
        </div>
    <?php else: ?>
        <div id="chat-container" class="chat-container">
            <div id="message-list" class="message-list">
                <div class="welcome-message">
                    <h3>Xiboエージェントへようこそ</h3>
                    <p>以下に指示を入力してください。例:</p>
                    <ul>
                        <li>接続されているディスプレイの一覧を表示して</li>
                        <li>最近更新されたレイアウトを5つ表示して</li>
                        <li>スケジュールの一覧を取得して</li>
                    </ul>
                </div>
            </div>
            
            <div id="typing-indicator" class="typing-indicator" style="display: none;"></div>
            
            <div class="message-input-container">
                <textarea id="message-input" placeholder="メッセージを入力..." rows="2"></textarea>
                <button id="send-button" class="btn btn-primary">送信</button>
            </div>
        </div>
    <?php endif; ?>
</div>

<script>
document.addEventListener('DOMContentLoaded', function() {
    // チャットの初期化処理
    const chatContainer = document.getElementById('chat-container');
    const messageList = document.getElementById('message-list');
    const messageInput = document.getElementById('message-input');
    const sendButton = document.getElementById('send-button');
    
    if (!chatContainer || !messageList || !messageInput || !sendButton) {
        console.error('チャット要素が見つかりません');
        return;
    }
    
    // メッセージ送信処理
    function sendMessage() {
        const messageText = messageInput.value.trim();
        if (messageText === '') return;
        
        // ユーザーメッセージを表示
        addMessage(messageText, true);
        
        // 入力欄をクリア
        messageInput.value = '';
        
        // ローディングメッセージを表示
        const loadingMessage = document.createElement('div');
        loadingMessage.className = 'chat-message other-user loading';
        loadingMessage.innerHTML = '<div class="loading">処理中...</div>';
        messageList.appendChild(loadingMessage);
        
        // 自動スクロール
        messageList.scrollTop = messageList.scrollHeight;
        
        // APIリクエスト
        fetch(API_URL, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                action: 'chatPrompt',
                prompt: messageText
            })
        })
        .then(response => {
            if (!response.ok) {
                throw new Error('サーバーエラー: ' + response.status);
            }
            return response.text().then(text => {
                try {
                    return JSON.parse(text);
                } catch (e) {
                    throw new Error('レスポンスの解析に失敗しました: ' + text.substring(0, 100));
                }
            });
        })
        .then(data => {
            // ローディングメッセージを削除
            messageList.removeChild(loadingMessage);
            
            // 応答を表示
            if (data.status === 'success') {
                // メッセージコンテンツの作成
                let responseContent = '';
                
                if (data.description) {
                    responseContent += `<div class="response-description">${data.description}</div>`;
                }
                
                if (data.data) {
                    if (Array.isArray(data.data) && data.data.length > 0) {
                        // 配列データをテーブルで表示
                        responseContent += '<div class="table-container"><table class="data-table">';
                        
                        // テーブルヘッダー
                        responseContent += '<thead><tr>';
                        const keys = Object.keys(data.data[0]);
                        keys.forEach(key => {
                            responseContent += `<th>${escape(key)}</th>`;
                        });
                        responseContent += '</tr></thead>';
                        
                        // テーブルボディ
                        responseContent += '<tbody>';
                        data.data.forEach(item => {
                            responseContent += '<tr>';
                            keys.forEach(key => {
                                responseContent += `<td>${formatValue(item[key])}</td>`;
                            });
                            responseContent += '</tr>';
                        });
                        responseContent += '</tbody></table></div>';
                    } else if (typeof data.data === 'object') {
                        // オブジェクトデータを表示
                        responseContent += '<div class="data-display">';
                        for (const [key, value] of Object.entries(data.data)) {
                            responseContent += `<div class="data-item">
                                <span class="data-label">${escape(key)}:</span>
                                <span class="data-value">${formatValue(value)}</span>
                            </div>`;
                        }
                        responseContent += '</div>';
                    } else {
                        // その他のデータ型
                        responseContent += `<div class="data-value">${formatValue(data.data)}</div>`;
                    }
                }
                
                addMessage(responseContent, false, true);
            } else {
                // エラーメッセージを表示
                const errorContent = `<div class="error-message">エラー: ${data.error || '不明なエラーが発生しました'}</div>`;
                addMessage(errorContent, false, true);
            }
        })
        .catch(error => {
            // ローディングメッセージを削除
            messageList.removeChild(loadingMessage);
            
            // エラーメッセージを表示
            const errorContent = `<div class="error-message">リクエスト中にエラーが発生しました: ${error.message}</div>`;
            addMessage(errorContent, false, true);
            console.error('チャットエラー:', error);
        });
    }
    
    // メッセージの追加
    function addMessage(content, isUser = false, isHTML = false) {
        const messageEl = document.createElement('div');
        messageEl.className = 'chat-message ' + (isUser ? 'current-user' : 'other-user');
        
        if (isHTML) {
            messageEl.innerHTML = content;
        } else {
            messageEl.textContent = content;
        }
        
        messageList.appendChild(messageEl);
        
        // 自動スクロール
        messageList.scrollTop = messageList.scrollHeight;
    }
    
    // 値のフォーマット処理
    function formatValue(value) {
        if (value === null || value === undefined) {
            return '-';
        } else if (typeof value === 'boolean') {
            return value ? '✓' : '✗';
        } else if (typeof value === 'object') {
            return escape(JSON.stringify(value));
        } else {
            return escape(String(value));
        }
    }
    
    // HTML特殊文字のエスケープ
    function escape(str) {
        if (str === null || str === undefined) {
            return '';
        }
        return String(str)
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#039;');
    }
    
    // イベントリスナーの設定
    sendButton.addEventListener('click', sendMessage);
    
    messageInput.addEventListener('keydown', function(e) {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            sendMessage();
        }
    });
    
    // 初期フォーカス
    messageInput.focus();
});
</script>

<?php
// ページコンテンツのキャプチャを終了し、pageContentに設定
$pageContent = ob_get_clean();
?>