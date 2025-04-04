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
            // ユーザーテーブル
            $this->pdo->exec("CREATE TABLE IF NOT EXISTS users (
                id INT AUTO_INCREMENT PRIMARY KEY,
                username VARCHAR(50) NOT NULL UNIQUE,
                email VARCHAR(100) NOT NULL UNIQUE,
                password VARCHAR(255) NOT NULL,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
            )");
            
            // ユーザー設定テーブル
            $this->pdo->exec("CREATE TABLE IF NOT EXISTS user_settings (
                id INT AUTO_INCREMENT PRIMARY KEY,
                user_id INT NOT NULL,
                xibo_api_url VARCHAR(255),
                xibo_client_id VARCHAR(255),
                xibo_client_secret VARCHAR(255),
                gemini_api_key VARCHAR(255),
                gemini_model VARCHAR(50) DEFAULT 'gemini-1.5-pro',
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
                FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
            )");
            
            // セッションテーブル
            $this->pdo->exec("CREATE TABLE IF NOT EXISTS sessions (
                id VARCHAR(255) PRIMARY KEY,
                user_id INT NOT NULL,
                ip_address VARCHAR(45),
                user_agent TEXT,
                expires_at TIMESTAMP,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
            )");
            
            return true;
        } catch (PDOException $e) {
            debugLog('テーブル初期化エラー', ['error' => $e->getMessage()], 'error');
            return false;
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
     * @param string $username ユーザー名
     * @param string $email メールアドレス
     * @param string $password パスワード
     * @return array 成功時はユーザーID、失敗時はエラーメッセージ
     */
    public function registerUser($username, $email, $password) {
        try {
            // 入力検証
            if (empty($username) || empty($email) || empty($password)) {
                return ['error' => 'すべての項目を入力してください'];
            }
            
            if (!filter_var($email, FILTER_VALIDATE_EMAIL)) {
                return ['error' => '有効なメールアドレスを入力してください'];
            }
            
            if (strlen($password) < 8) {
                return ['error' => 'パスワードは8文字以上である必要があります'];
            }
            
            // ユーザー名とメールアドレスの重複チェック
            $stmt = $this->db->prepare("SELECT id FROM users WHERE username = ? OR email = ?");
            $stmt->execute([$username, $email]);
            if ($stmt->rowCount() > 0) {
                return ['error' => 'このユーザー名またはメールアドレスは既に使用されています'];
            }
            
            // パスワードのハッシュ化
            $hashedPassword = password_hash($password, PASSWORD_DEFAULT);
            
            // ユーザーの登録
            $stmt = $this->db->prepare("INSERT INTO users (username, email, password) VALUES (?, ?, ?)");
            $stmt->execute([$username, $email, $hashedPassword]);
            
            $userId = $this->db->lastInsertId();
            
            // 空の設定を作成
            $stmt = $this->db->prepare("INSERT INTO user_settings (user_id) VALUES (?)");
            $stmt->execute([$userId]);
            
            return ['user_id' => $userId];
        } catch (PDOException $e) {
            debugLog('ユーザー登録エラー', ['error' => $e->getMessage()], 'error');
            return ['error' => 'ユーザー登録中にエラーが発生しました'];
        }
    }
    
    /**
     * ユーザーログイン
     * @param string $username ユーザー名またはメールアドレス
     * @param string $password パスワード
     * @return array 成功時はユーザーID、失敗時はエラーメッセージ
     */
    public function loginUser($username, $password) {
        try {
            // ユーザーの検索（ユーザー名またはメールアドレスで）
            $stmt = $this->db->prepare("SELECT id, password FROM users WHERE username = ? OR email = ?");
            $stmt->execute([$username, $username]);
            $user = $stmt->fetch();
            
            if (!$user) {
                return ['error' => 'ユーザー名またはパスワードが正しくありません'];
            }
            
            // パスワードの検証
            if (!password_verify($password, $user['password'])) {
                return ['error' => 'ユーザー名またはパスワードが正しくありません'];
            }
            
            return ['user_id' => $user['id']];
        } catch (PDOException $e) {
            debugLog('ログインエラー', ['error' => $e->getMessage()], 'error');
            return ['error' => 'ログイン中にエラーが発生しました'];
        }
    }
    
    /**
     * ユーザー情報の取得
     * @param int $userId ユーザーID
     * @return array ユーザー情報
     */
    public function getUserById($userId) {
        try {
            $stmt = $this->db->prepare("SELECT id, username, email, created_at FROM users WHERE id = ?");
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
     * @return array ユーザー設定
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
     * @return string セッションID
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
     * @return int|null ユーザーID
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