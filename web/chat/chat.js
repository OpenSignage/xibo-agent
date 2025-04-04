/**
 * Xibo API エージェント - チャット処理用JavaScript
 */

// チャットモジュール
const Chat = {
    // 設定値
    config: {
        messageLimit: 100,     // チャット履歴の最大保持数
        refreshInterval: 3000, // 更新間隔（ミリ秒）
        typingTimeout: 1000,   // 入力中の表示タイムアウト
    },
    
    // 状態管理
    state: {
        messages: [],          // メッセージ履歴
        lastMessageId: 0,      // 最後に取得したメッセージID
        refreshTimer: null,    // 更新用タイマー
        isTyping: false,       // 入力中フラグ
        typingTimer: null,     // 入力中表示用タイマー
        isInitialized: false,  // 初期化フラグ
    },
    
    // DOM要素
    elements: {
        chatContainer: null,    // チャットコンテナ
        messageList: null,      // メッセージリスト
        messageInput: null,     // メッセージ入力欄
        sendButton: null,       // 送信ボタン
        typingIndicator: null,  // 入力中インジケータ
    },
    
    /**
     * チャットの初期化
     */
    initialize: function() {
        if (this.state.isInitialized) return;
        
        // DOM要素の取得
        this.elements.chatContainer = document.getElementById('chat-container');
        if (!this.elements.chatContainer) return;
        
        this.elements.messageList = document.getElementById('message-list');
        this.elements.messageInput = document.getElementById('message-input');
        this.elements.sendButton = document.getElementById('send-button');
        this.elements.typingIndicator = document.getElementById('typing-indicator');
        
        // イベントリスナーの設定
        this.setupEventListeners();
        
        // 初期メッセージの読み込み
        this.loadMessages();
        
        // 定期更新の開始
        this.startRefreshTimer();
        
        this.state.isInitialized = true;
        console.log('チャットが初期化されました');
    },
    
    /**
     * イベントリスナーの設定
     */
    setupEventListeners: function() {
        // 送信ボタンのクリックイベント
        if (this.elements.sendButton) {
            this.elements.sendButton.addEventListener('click', (e) => {
                e.preventDefault();
                this.sendMessage();
            });
        }
        
        // メッセージ入力欄のキーダウンイベント
        if (this.elements.messageInput) {
            this.elements.messageInput.addEventListener('keydown', (e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault();
                    this.sendMessage();
                }
            });
            
            // 入力中の状態を送信
            this.elements.messageInput.addEventListener('input', () => {
                this.sendTypingStatus(true);
            });
        }
    },
    
    /**
     * メッセージ送信処理
     */
    sendMessage: async function() {
        if (!this.elements.messageInput) return;
        
        const messageText = this.elements.messageInput.value.trim();
        if (messageText === '') return;
        
        try {
            // メッセージの送信
            const response = await fetch(API_URL, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    action: 'sendMessage',
                    message: messageText
                })
            });
            
            if (!response.ok) {
                throw new Error('サーバーエラー: ' + response.status);
            }
            
            const result = await response.json();
            
            if (result.status === 'success') {
                // 入力欄をクリア
                this.elements.messageInput.value = '';
                
                // 最新メッセージを取得
                this.loadMessages();
                
                // 入力中状態をクリア
                this.sendTypingStatus(false);
            } else {
                console.error('メッセージ送信エラー:', result.error);
                alert('メッセージの送信に失敗しました: ' + result.error);
            }
        } catch (error) {
            console.error('メッセージ送信エラー:', error);
            alert('メッセージの送信に失敗しました: ' + error.message);
        }
    },
    
    /**
     * メッセージの読み込み
     */
    loadMessages: async function() {
        try {
            const response = await fetch(API_URL, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    action: 'getMessages',
                    lastId: this.state.lastMessageId
                })
            });
            
            if (!response.ok) {
                throw new Error('サーバーエラー: ' + response.status);
            }
            
            const result = await response.json();
            
            if (result.status === 'success') {
                // 新しいメッセージがある場合
                if (result.messages && result.messages.length > 0) {
                    // メッセージを追加
                    this.state.messages = [...this.state.messages, ...result.messages];
                    
                    // メッセージ数が上限を超えた場合、古いメッセージを削除
                    if (this.state.messages.length > this.config.messageLimit) {
                        this.state.messages = this.state.messages.slice(-this.config.messageLimit);
                    }
                    
                    // 最後のメッセージIDを更新
                    if (result.messages.length > 0) {
                        const lastMsg = result.messages[result.messages.length - 1];
                        this.state.lastMessageId = lastMsg.id;
                    }
                    
                    // メッセージを表示
                    this.renderMessages();
                }
                
                // 入力中のユーザー情報を更新
                if (result.typingUsers) {
                    this.updateTypingIndicator(result.typingUsers);
                }
            } else {
                console.error('メッセージ取得エラー:', result.error);
            }
        } catch (error) {
            console.error('メッセージ取得エラー:', error);
        }
    },
    
    /**
     * メッセージの描画
     */
    renderMessages: function() {
        if (!this.elements.messageList) return;
        
        // メッセージリストをクリア
        this.elements.messageList.innerHTML = '';
        
        // メッセージを追加
        this.state.messages.forEach(msg => {
            const messageEl = document.createElement('div');
            messageEl.className = 'chat-message ' + (msg.isCurrentUser ? 'current-user' : 'other-user');
            
            const usernameEl = document.createElement('div');
            usernameEl.className = 'message-username';
            usernameEl.textContent = msg.username;
            
            const contentEl = document.createElement('div');
            contentEl.className = 'message-content';
            contentEl.textContent = msg.message;
            
            const timeEl = document.createElement('div');
            timeEl.className = 'message-time';
            timeEl.textContent = new Date(msg.timestamp * 1000).toLocaleString();
            
            messageEl.appendChild(usernameEl);
            messageEl.appendChild(contentEl);
            messageEl.appendChild(timeEl);
            
            this.elements.messageList.appendChild(messageEl);
        });
        
        // スクロールを最下部に移動
        this.elements.messageList.scrollTop = this.elements.messageList.scrollHeight;
    },
    
    /**
     * 入力中状態の送信
     * @param {boolean} isTyping 入力中かどうか
     */
    sendTypingStatus: function(isTyping) {
        // 状態が変わらない場合は何もしない
        if (this.state.isTyping === isTyping) return;
        
        this.state.isTyping = isTyping;
        
        // タイマーをクリア
        if (this.state.typingTimer) {
            clearTimeout(this.state.typingTimer);
            this.state.typingTimer = null;
        }
        
        // 入力中の場合はタイマーをセット
        if (isTyping) {
            this.state.typingTimer = setTimeout(() => {
                this.state.isTyping = false;
                this.sendTypingStatus(false);
            }, this.config.typingTimeout);
        }
        
        // 入力中状態をサーバーに送信
        fetch(API_URL, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                action: 'updateTypingStatus',
                isTyping: isTyping
            })
        }).catch(error => {
            console.error('入力状態の送信エラー:', error);
        });
    },
    
    /**
     * 入力中インジケータの更新
     * @param {Array} typingUsers 入力中のユーザーリスト
     */
    updateTypingIndicator: function(typingUsers) {
        if (!this.elements.typingIndicator) return;
        
        if (typingUsers && typingUsers.length > 0) {
            let text = '';
            if (typingUsers.length === 1) {
                text = `${typingUsers[0]}が入力中...`;
            } else if (typingUsers.length === 2) {
                text = `${typingUsers[0]}と${typingUsers[1]}が入力中...`;
            } else {
                text = `${typingUsers.length}人のユーザーが入力中...`;
            }
            
            this.elements.typingIndicator.textContent = text;
            this.elements.typingIndicator.style.display = 'block';
        } else {
            this.elements.typingIndicator.style.display = 'none';
        }
    },
    
    /**
     * 定期更新タイマーの開始
     */
    startRefreshTimer: function() {
        // 既存のタイマーをクリア
        if (this.state.refreshTimer) {
            clearInterval(this.state.refreshTimer);
        }
        
        // 新しいタイマーをセット
        this.state.refreshTimer = setInterval(() => {
            this.loadMessages();
        }, this.config.refreshInterval);
    },
    
    /**
     * 定期更新タイマーの停止
     */
    stopRefreshTimer: function() {
        if (this.state.refreshTimer) {
            clearInterval(this.state.refreshTimer);
            this.state.refreshTimer = null;
        }
    }
};

// DOMが読み込まれた時の処理
document.addEventListener('DOMContentLoaded', function() {
    // チャットの初期化
    Chat.initialize();
}); 