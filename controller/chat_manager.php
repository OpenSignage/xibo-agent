<?php
/*
 * Xibo-agent - Open Source Digital Signage - https://www.open-signage.org
 * Copyright (C) 2025 Open Source Digital Signage Initiative
 *
 * This file is part of Xibo-agent.
 */

// 直接アクセスを防止
if (!defined('XIBO_AGENT')) {
    if (basename($_SERVER['SCRIPT_FILENAME']) === basename(__FILE__)) {
        header('HTTP/1.0 403 Forbidden');
        exit;
    }
    define('XIBO_AGENT', true);
}

/**
 * チャット履歴管理クラス
 */
class ChatManager {
    private $db;
    private $maxHistory = 20;
    
    /**
     * コンストラクタ
     */
    public function __construct() {
        $this->db = Database::getInstance()->getPdo();
    }
    
    /**
     * ユーザーの会話履歴を取得
     * @param int $userId ユーザーID
     * @param int $limit 取得する履歴の最大数
     * @return array 会話履歴の配列
     */
    public function getChatHistory($userId, $limit = null) {
        try {
            $limit = $limit ?? $this->maxHistory;
            $stmt = $this->db->prepare("SELECT * FROM chat_history WHERE user_id = ? ORDER BY created_at DESC LIMIT ?");
            $stmt->execute([$userId, $limit]);
            $history = $stmt->fetchAll();
            
            // 古い順に並べ替え
            return array_reverse($history);
        } catch (PDOException $e) {
            debugLog('会話履歴の取得に失敗しました', ['error' => $e->getMessage()], 'error');
            return [];
        }
    }
    
    /**
     * 会話履歴を追加
     * @param int $userId ユーザーID
     * @param string $message メッセージ内容
     * @param bool $isUser ユーザーからのメッセージかどうか
     * @return bool 成功/失敗
     */
    public function addChatMessage($userId, $message, $isUser = true) {
        try {
            // 会話履歴を追加
            $stmt = $this->db->prepare("INSERT INTO chat_history (user_id, message, is_user, created_at) VALUES (?, ?, ?, NOW())");
            $stmt->execute([$userId, $message, $isUser]);
            
            // 履歴が最大数を超えた場合、古い履歴を削除
            $this->trimHistory($userId);
            
            return true;
        } catch (PDOException $e) {
            debugLog('会話履歴の追加に失敗しました', ['error' => $e->getMessage()], 'error');
            return false;
        }
    }
    
    /**
     * 会話履歴を削除
     * @param int $userId ユーザーID
     * @return bool 成功/失敗
     */
    public function clearChatHistory($userId) {
        try {
            $stmt = $this->db->prepare("DELETE FROM chat_history WHERE user_id = ?");
            $stmt->execute([$userId]);
            return true;
        } catch (PDOException $e) {
            debugLog('会話履歴の削除に失敗しました', ['error' => $e->getMessage()], 'error');
            return false;
        }
    }
    
    /**
     * 会話履歴を最大数に制限
     * @param int $userId ユーザーID
     * @return bool 成功/失敗
     */
    private function trimHistory($userId) {
        try {
            // ユーザーの会話履歴数を取得
            $stmt = $this->db->prepare("SELECT COUNT(*) FROM chat_history WHERE user_id = ?");
            $stmt->execute([$userId]);
            $count = $stmt->fetchColumn();
            
            // 最大数を超えている場合、古い履歴を削除
            if ($count > $this->maxHistory) {
                $stmt = $this->db->prepare("DELETE FROM chat_history WHERE user_id = ? AND id NOT IN (
                    SELECT id FROM (
                        SELECT id FROM chat_history 
                        WHERE user_id = ? 
                        ORDER BY created_at DESC 
                        LIMIT ?
                    ) AS t
                )");
                $stmt->execute([$userId, $userId, $this->maxHistory]);
            }
            
            return true;
        } catch (PDOException $e) {
            debugLog('会話履歴の制限に失敗しました', ['error' => $e->getMessage()], 'error');
            return false;
        }
    }
} 