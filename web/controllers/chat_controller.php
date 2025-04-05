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
 * Xibo API エージェント - チャットコントローラー
 */

require_once 'base_controller.php';
require_once __DIR__ . '/../../controller/chat_manager.php';

class ChatController extends BaseController {
    private $chatManager;
    
    public function __construct() {
        $this->requireAuth();
        $this->chatManager = new ChatManager();
    }
    
    // チャット画面の表示
    public function index() {
        $userId = $_SESSION['user_id'];
        $chatHistory = $this->chatManager->getChatHistory($userId);
        
        $this->render('chat/index', [
            'pageTitle' => 'チャット',
            'chatHistory' => $chatHistory
        ]);
    }
    
    // メッセージの送信
    public function sendMessage() {
        $this->requireAuth();
        $this->requirePost();
        
        $userId = $_SESSION['user_id'];
        $message = $_POST['message'] ?? '';
        
        if (empty($message)) {
            $this->jsonResponse(['status' => 'error', 'message' => 'メッセージを入力してください']);
            return;
        }
        
        // ユーザーのメッセージを保存
        $this->chatManager->addChatMessage($userId, $message, true);
        
        // AIの応答を生成（ここではダミーの応答）
        $aiResponse = "これはAIからの応答です。実際のAI応答生成ロジックを実装してください。";
        
        // AIの応答を保存
        $this->chatManager->addChatMessage($userId, $aiResponse, false);
        
        // 更新された会話履歴を取得
        $chatHistory = $this->chatManager->getChatHistory($userId);
        
        $this->jsonResponse([
            'status' => 'success',
            'message' => 'メッセージが送信されました',
            'chatHistory' => $chatHistory
        ]);
    }
    
    // 会話履歴のクリア
    public function clearHistory() {
        $this->requireAuth();
        $this->requirePost();
        
        $userId = $_SESSION['user_id'];
        
        if ($this->chatManager->clearChatHistory($userId)) {
            $this->jsonResponse(['status' => 'success', 'message' => '会話履歴をクリアしました']);
        } else {
            $this->jsonResponse(['status' => 'error', 'message' => '会話履歴のクリアに失敗しました']);
        }
    }
} 