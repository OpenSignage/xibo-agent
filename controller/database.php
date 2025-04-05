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
 * データベース接続クラス
 */
class Database {
    private static $instance = null;
    private $pdo;
    
    /**
     * データベース接続の初期化
     */
    private function __construct() {
        global $db_config;
        
        try {
            $dsn = 'mysql:host=' . $db_config['host'] . ';dbname=' . $db_config['database'] . ';charset=' . $db_config['charset'];
            $options = [
                PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION,
                PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
                PDO::ATTR_EMULATE_PREPARES => false,
            ];
            
            $this->pdo = new PDO($dsn, $db_config['username'], $db_config['password'], $options);
            
        } catch (PDOException $e) {
            debugLog('データベース接続エラー', ['error' => $e->getMessage()], 'error');
            throw new Exception('データベースに接続できませんでした');
        }
    }
    
    /**
     * データベース接続のシングルトンインスタンスを取得
     */
    public static function getInstance() {
        if (self::$instance === null) {
            self::$instance = new self();
        }
        return self::$instance;
    }
    
    /**
     * PDOインスタンスを取得
     */
    public function getPdo() {
        return $this->pdo;
    }
    
    /**
     * データベーステーブルの初期化
     */
    public function initializeTables() {
        try {
            // ユーザーテーブルの作成
            $sql = "CREATE TABLE IF NOT EXISTS users (
                id INT AUTO_INCREMENT PRIMARY KEY,
                username VARCHAR(50) NOT NULL UNIQUE,
                email VARCHAR(100) NOT NULL UNIQUE,
                password VARCHAR(255) NOT NULL,
                role ENUM('admin', 'editor', 'user') NOT NULL DEFAULT 'user',
                created_at DATETIME NOT NULL,
                updated_at DATETIME NOT NULL
            )";
            $this->pdo->exec($sql);

            // ユーザー設定テーブルの作成
            $sql = "CREATE TABLE IF NOT EXISTS user_settings (
                id INT AUTO_INCREMENT PRIMARY KEY,
                user_id INT NOT NULL,
                settings JSON,
                created_at DATETIME NOT NULL,
                updated_at DATETIME NOT NULL,
                FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
            )";
            $this->pdo->exec($sql);

            // 会話履歴テーブルの作成
            $sql = "CREATE TABLE IF NOT EXISTS chat_history (
                id INT AUTO_INCREMENT PRIMARY KEY,
                user_id INT NOT NULL,
                message TEXT NOT NULL,
                is_user BOOLEAN NOT NULL,
                created_at DATETIME NOT NULL,
                FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
            )";
            $this->pdo->exec($sql);

            debugLog('データベーステーブルを初期化しました');
            return true;
        } catch (PDOException $e) {
            debugLog('データベーステーブルの初期化に失敗しました', ['error' => $e->getMessage()], 'error');
            throw new Exception('データベーステーブルの初期化に失敗しました');
        }
    }
}

/**
 * ユーザー管理クラス
 */
class UserManager {
    private $db;
    
    /**
     * コンストラクタ
     */
    public function __construct() {
        $this->db = Database::getInstance()->getPdo();
    }
    
    /**
     * ユーザー登録
     */
    public function registerUser($username, $email, $password, $role = 'user') {
        try {
            // ユーザー名とメールアドレスの重複チェック
            $stmt = $this->db->prepare("SELECT COUNT(*) FROM users WHERE username = ? OR email = ?");
            $stmt->execute([$username, $email]);
            if ($stmt->fetchColumn() > 0) {
                return ['status' => 'error', 'error' => 'ユーザー名またはメールアドレスが既に使用されています'];
            }

            // パスワードのハッシュ化
            $hashedPassword = password_hash($password, PASSWORD_DEFAULT);

            // ユーザーの登録
            $stmt = $this->db->prepare("INSERT INTO users (username, email, password, role, created_at, updated_at) VALUES (?, ?, ?, ?, NOW(), NOW())");
            $stmt->execute([$username, $email, $hashedPassword, $role]);

            $userId = $this->db->lastInsertId();

            return [
                'status' => 'success',
                'user_id' => $userId,
                'user' => [
                    'id' => $userId,
                    'username' => $username,
                    'email' => $email,
                    'role' => $role
                ]
            ];
        } catch (PDOException $e) {
            debugLog('ユーザー登録に失敗しました', ['error' => $e->getMessage()], 'error');
            return ['status' => 'error', 'error' => 'ユーザー登録に失敗しました'];
        }
    }
    
    /**
     * ユーザーログイン
     * @param string $username ユーザー名またはメールアドレス
     * @param string $password パスワード
     * @return array|false 成功時はユーザー情報、失敗時はfalse
     */
    public function loginUser($username, $password) {
        try {
            // ユーザーの検索（ユーザー名またはメールアドレスで）
            $stmt = $this->db->prepare("SELECT id, username, email, password, role FROM users WHERE username = ? OR email = ?");
            $stmt->execute([$username, $username]);
            $user = $stmt->fetch();
            
            if (!$user) {
                return ['error' => 'ユーザー名またはパスワードが正しくありません'];
            }
            
            // パスワードの検証
            if (!password_verify($password, $user['password'])) {
                return ['error' => 'ユーザー名またはパスワードが正しくありません'];
            }
            
            return ['user_id' => $user['id'], 'role' => $user['role']];
        } catch (PDOException $e) {
            debugLog('ログインエラー', ['error' => $e->getMessage()], 'error');
            return ['error' => 'ログイン中にエラーが発生しました'];
        }
    }
    
    /**
     * ユーザー情報の取得
     * @param int $userId ユーザーID
     * @return array|false 成功時はユーザー情報、失敗時はfalse
     */
    public function getUserById($userId) {
        try {
            $stmt = $this->db->prepare("SELECT id, username, email, role, created_at, updated_at FROM users WHERE id = ?");
            $stmt->execute([$userId]);
            return $stmt->fetch();
        } catch (PDOException $e) {
            debugLog('ユーザー情報取得エラー', ['error' => $e->getMessage()], 'error');
            return null;
        }
    }
    
    /**
     * ユーザー設定の取得
     * @param int $userId ユーザーID
     * @return array|false 成功時はユーザー設定、失敗時はfalse
     */
    public function getUserSettings($userId) {
        try {
            $stmt = $this->db->prepare("SELECT * FROM user_settings WHERE user_id = ?");
            $stmt->execute([$userId]);
            return $stmt->fetch();
        } catch (PDOException $e) {
            debugLog('ユーザー設定取得エラー', ['error' => $e->getMessage()], 'error');
            return null;
        }
    }
    
    /**
     * ユーザー設定の更新
     * @param int $userId ユーザーID
     * @param array $settings 更新する設定
     * @return bool 成功/失敗
     */
    public function updateUserSettings($userId, $settings) {
        try {
            $validFields = ['xibo_api_url', 'xibo_client_id', 'xibo_client_secret', 'gemini_api_key', 'gemini_model'];
            $updateFields = [];
            $updateValues = [];
            
            foreach ($validFields as $field) {
                if (isset($settings[$field])) {
                    $updateFields[] = "$field = ?";
                    $updateValues[] = $settings[$field];
                }
            }
            
            if (empty($updateFields)) {
                return false;
            }
            
            $updateValues[] = $userId;
            
            $sql = "UPDATE user_settings SET " . implode(', ', $updateFields) . " WHERE user_id = ?";
            $stmt = $this->db->prepare($sql);
            $stmt->execute($updateValues);
            
            return $stmt->rowCount() > 0;
        } catch (PDOException $e) {
            debugLog('ユーザー設定更新エラー', ['error' => $e->getMessage()], 'error');
            return false;
        }
    }
    
    /**
     * ユーザーの役割を更新
     * @param int $userId ユーザーID
     * @param string $role 新しい役割（admin, editor, user）
     * @return bool 成功時はtrue、失敗時はfalse
     */
    public function updateUserRole($userId, $role) {
        try {
            // 役割の値が有効かチェック
            $validRoles = ['admin', 'editor', 'user'];
            if (!in_array($role, $validRoles)) {
                debugLog("ユーザー役割更新失敗: 無効な役割", [
                    'user_id' => $userId,
                    'role' => $role
                ], 'warning');
                return false;
            }
            
            $stmt = $this->db->prepare("UPDATE users SET role = ? WHERE id = ?");
            $stmt->execute([$role, $userId]);
            
            if ($stmt->rowCount() === 0) {
                debugLog("ユーザー役割更新失敗: ユーザーが見つかりません", [
                    'user_id' => $userId
                ], 'warning');
                return false;
            }
            
            debugLog("ユーザー役割更新成功", [
                'user_id' => $userId,
                'role' => $role
            ], 'info');
            
            return true;
        } catch (PDOException $e) {
            debugLog("ユーザー役割更新エラー", [
                'error' => $e->getMessage(),
                'user_id' => $userId
            ], 'error');
            return false;
        }
    }
}

/**
 * セッション管理クラス
 */
class SessionManager {
    private $db;
    
    /**
     * コンストラクタ
     */
    public function __construct() {
        $this->db = Database::getInstance()->getPdo();
    }
    
    /**
     * セッションの作成
     * @param int $userId ユーザーID
     * @return string|false 成功時はセッションID、失敗時はfalse
     */
    public function createSession($userId) {
        global $session_lifetime;
        
        try {
            // 古いセッションの削除
            $stmt = $this->db->prepare("DELETE FROM sessions WHERE user_id = ?");
            $stmt->execute([$userId]);
            
            // 新しいセッションの作成
            $sessionId = bin2hex(random_bytes(32));
            $ipAddress = $_SERVER['REMOTE_ADDR'] ?? '0.0.0.0';
            $userAgent = $_SERVER['HTTP_USER_AGENT'] ?? '';
            $expiresAt = date('Y-m-d H:i:s', time() + $session_lifetime);
            
            $stmt = $this->db->prepare("INSERT INTO sessions (id, user_id, ip_address, user_agent, expires_at) VALUES (?, ?, ?, ?, ?)");
            $stmt->execute([$sessionId, $userId, $ipAddress, $userAgent, $expiresAt]);
            
            return $sessionId;
        } catch (Exception $e) {
            debugLog('セッション作成エラー', ['error' => $e->getMessage()], 'error');
            return null;
        }
    }
    
    /**
     * セッションの検証
     * @param string $sessionId セッションID
     * @return array|false 成功時はユーザー情報、失敗時はfalse
     */
    public function validateSession($sessionId) {
        try {
            $stmt = $this->db->prepare("SELECT user_id, expires_at FROM sessions WHERE id = ?");
            $stmt->execute([$sessionId]);
            $session = $stmt->fetch();
            
            if (!$session) {
                return null;
            }
            
            // 有効期限の確認
            if (strtotime($session['expires_at']) < time()) {
                // 期限切れのセッションを削除
                $this->deleteSession($sessionId);
                return null;
            }
            
            return $session['user_id'];
        } catch (PDOException $e) {
            debugLog('セッション検証エラー', ['error' => $e->getMessage()], 'error');
            return null;
        }
    }
    
    /**
     * セッションの削除
     * @param string $sessionId セッションID
     * @return bool 成功/失敗
     */
    public function deleteSession($sessionId) {
        try {
            $stmt = $this->db->prepare("DELETE FROM sessions WHERE id = ?");
            $stmt->execute([$sessionId]);
            return true;
        } catch (PDOException $e) {
            debugLog('セッション削除エラー', ['error' => $e->getMessage()], 'error');
            return false;
        }
    }
} 