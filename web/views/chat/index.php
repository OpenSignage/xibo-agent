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
 * チャット画面のビュー
 */
?>

<div class="container py-4">
    <div class="row justify-content-center">
        <div class="col-lg-8">
            <div class="card shadow-sm">
                <div class="card-header bg-white py-3 d-flex justify-content-between align-items-center">
                    <h5 class="mb-0">チャット</h5>
                    <button id="clear-history" class="btn btn-outline-danger btn-sm">
                        <i class="fas fa-trash-alt me-1"></i>履歴をクリア
                    </button>
                </div>
                <div class="card-body p-0">
                    <div class="chat-container">
                        <div id="chat-messages" class="chat-messages p-3">
                            <?php if (empty($chatHistory)): ?>
                                <div class="text-center text-muted my-5">
                                    <i class="fas fa-comments fa-3x mb-3"></i>
                                    <p>会話履歴がありません。メッセージを送信して会話を始めましょう。</p>
                                </div>
                            <?php else: ?>
                                <?php foreach ($chatHistory as $message): ?>
                                    <div class="chat-message <?php echo $message['is_user'] ? 'user-message' : 'ai-message'; ?>">
                                        <div class="message-content">
                                            <?php echo nl2br(htmlspecialchars($message['message'])); ?>
                                        </div>
                                        <div class="message-time">
                                            <?php echo date('Y/m/d H:i', strtotime($message['created_at'])); ?>
                                        </div>
                                    </div>
                                <?php endforeach; ?>
                            <?php endif; ?>
                        </div>
                        
                        <div class="chat-input-container border-top p-3">
                            <form id="chat-form" class="chat-form">
                                <div class="input-group">
                                    <textarea id="message-input" class="form-control" placeholder="メッセージを入力..." rows="2"></textarea>
                                    <button type="submit" class="btn btn-primary">
                                        <i class="fas fa-paper-plane"></i>
                                    </button>
                                </div>
                            </form>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    </div>
</div>

<style>
.chat-container {
    display: flex;
    flex-direction: column;
    height: 70vh;
}

.chat-messages {
    flex: 1;
    overflow-y: auto;
    display: flex;
    flex-direction: column;
}

.chat-message {
    max-width: 80%;
    margin-bottom: 1rem;
    padding: 0.75rem 1rem;
    border-radius: 1rem;
    position: relative;
}

.user-message {
    align-self: flex-end;
    background-color: var(--bs-primary);
    color: white;
}

.ai-message {
    align-self: flex-start;
    background-color: var(--bs-light);
    color: var(--bs-dark);
}

.message-time {
    font-size: 0.75rem;
    margin-top: 0.25rem;
    text-align: right;
    opacity: 0.8;
}

.chat-form .input-group {
    width: 100%;
}

#message-input {
    resize: none;
    border-right: none;
}

#message-input:focus {
    box-shadow: none;
    border-color: var(--bs-primary);
}

.chat-form .btn-primary {
    border-top-left-radius: 0;
    border-bottom-left-radius: 0;
}
</style>

<script>
document.addEventListener('DOMContentLoaded', function() {
    const chatForm = document.getElementById('chat-form');
    const messageInput = document.getElementById('message-input');
    const chatMessages = document.getElementById('chat-messages');
    const clearHistoryBtn = document.getElementById('clear-history');
    
    // メッセージ送信
    chatForm.addEventListener('submit', function(e) {
        e.preventDefault();
        
        const message = messageInput.value.trim();
        if (!message) return;
        
        // メッセージを送信
        fetch('/chat/sendMessage', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/x-www-form-urlencoded',
            },
            body: 'message=' + encodeURIComponent(message)
        })
        .then(response => response.json())
        .then(data => {
            if (data.status === 'success') {
                // 入力フィールドをクリア
                messageInput.value = '';
                
                // チャット履歴を更新
                updateChatHistory(data.chatHistory);
            } else {
                alert(data.message || 'エラーが発生しました');
            }
        })
        .catch(error => {
            console.error('Error:', error);
            alert('メッセージの送信に失敗しました');
        });
    });
    
    // 履歴クリア
    clearHistoryBtn.addEventListener('click', function() {
        if (!confirm('会話履歴をクリアしてもよろしいですか？')) {
            return;
        }
        
        fetch('/chat/clearHistory', {
            method: 'POST'
        })
        .then(response => response.json())
        .then(data => {
            if (data.status === 'success') {
                // チャット履歴をクリア
                chatMessages.innerHTML = '<div class="text-center text-muted my-5"><i class="fas fa-comments fa-3x mb-3"></i><p>会話履歴がありません。メッセージを送信して会話を始めましょう。</p></div>';
            } else {
                alert(data.message || 'エラーが発生しました');
            }
        })
        .catch(error => {
            console.error('Error:', error);
            alert('会話履歴のクリアに失敗しました');
        });
    });
    
    // チャット履歴の更新
    function updateChatHistory(history) {
        if (history.length === 0) {
            chatMessages.innerHTML = '<div class="text-center text-muted my-5"><i class="fas fa-comments fa-3x mb-3"></i><p>会話履歴がありません。メッセージを送信して会話を始めましょう。</p></div>';
            return;
        }
        
        let html = '';
        history.forEach(message => {
            html += `
                <div class="chat-message ${message.is_user ? 'user-message' : 'ai-message'}">
                    <div class="message-content">
                        ${message.message.replace(/\n/g, '<br>')}
                    </div>
                    <div class="message-time">
                        ${new Date(message.created_at).toLocaleString('ja-JP')}
                    </div>
                </div>
            `;
        });
        
        chatMessages.innerHTML = html;
        chatMessages.scrollTop = chatMessages.scrollHeight;
    }
});
</script> 