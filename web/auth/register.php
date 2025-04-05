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
 * Xibo API エージェント - ユーザー登録処理
 */

// ベースパスの定義
define('BASE_PATH', '..');

// 設定ファイルの読み込み
require_once '../config.php';
require_once '../includes/functions.php';

// セッション開始
session_start();

// すでにログイン済みの場合はメインページにリダイレクト
if (isset($_SESSION[SESSION_COOKIE_NAME])) {
    redirect('../index.php');
    exit;
}

// 登録エラーメッセージとステータスの初期化
$registerError = '';
$registerSuccess = false;

// 登録フォームが送信された場合の処理
if ($_SERVER['REQUEST_METHOD'] === 'POST' && isset($_POST['action']) && $_POST['action'] === 'register') {
    $username = $_POST['username'] ?? '';
    $email = $_POST['email'] ?? '';
    $password = $_POST['password'] ?? '';
    $role = $_POST['role'] ?? 'user';
    
    // 入力検証
    if (empty($username) || empty($email) || empty($password)) {
        $registerError = 'すべての項目を入力してください';
    } elseif (strlen($password) < 8) {
        $registerError = 'パスワードは8文字以上である必要があります';
    } elseif (!filter_var($email, FILTER_VALIDATE_EMAIL)) {
        $registerError = '有効なメールアドレスを入力してください';
    } elseif (!in_array($role, ['admin', 'editor', 'user'])) {
        $registerError = '無効なロールが指定されました';
    } else {
        // API登録リクエスト
        $response = callApi([
            'action' => 'register',
            'username' => $username,
            'email' => $email,
            'password' => $password,
            'role' => $role
        ]);
        
        if ($response['status'] === 'success') {
            // 登録成功
            $registerSuccess = true;
            
            // 自動ログインするか、ログインページにリダイレクト
            if (isset($response['user'])) {
                // セッションにユーザー情報を保存（自動ログイン）
                $_SESSION[SESSION_COOKIE_NAME] = $response['user'];
                
                // 少し待ってからメインページにリダイレクト
                header('Refresh: 2; URL=../index.php');
            } else {
                // ログインページにリダイレクト（手動ログイン）
                header('Refresh: 2; URL=login.php');
            }
        } else {
            $registerError = $response['error'] ?? '登録に失敗しました';
        }
    }
}

// ログインページに直接リダイレクト（登録フォームからの送信でない場合）
if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    redirect('login.php?register=true');
    exit;
}

// ページタイトル
$pageTitle = 'ユーザー登録 - Xibo API エージェント';

// 追加のCSS
$extraStyles = ['../assets/css/customStyle.css'];

// 追加のJavaScript
$extraScripts = ['../assets/js/common.js', 'auth.js'];

// ヘッダーの読み込み
require_once '../includes/header.php';
?>

<div class="container">
    <div class="row justify-content-center mt-5">
        <div class="col-md-6 col-lg-5">
            <div class="card shadow-sm">
                <div class="card-body p-4">
                    <?php if ($registerSuccess): ?>
                        <div class="alert alert-success">
                            <h4 class="alert-heading">登録が完了しました</h4>
                            <p class="mb-0">アカウントが正常に作成されました。メインページにリダイレクトします...</p>
                        </div>
                    <?php else: ?>
                        <?php if (!empty($registerError)): ?>
                            <div class="alert alert-danger"><?php echo htmlspecialchars($registerError); ?></div>
                        <?php endif; ?>
                        
                        <h2 class="text-center mb-4">ユーザー登録</h2>
                        <form method="post" action="register.php">
                            <input type="hidden" name="action" value="register">
                            
                            <div class="mb-3">
                                <label for="username" class="form-label">ユーザー名</label>
                                <input type="text" class="form-control" id="username" name="username" required>
                            </div>
                            
                            <div class="mb-3">
                                <label for="email" class="form-label">メールアドレス</label>
                                <input type="email" class="form-control" id="email" name="email" required>
                            </div>
                            
                            <div class="mb-3">
                                <label for="password" class="form-label">パスワード</label>
                                <input type="password" class="form-control" id="password" name="password" required>
                                <div class="form-text">8文字以上で入力してください</div>
                            </div>
                            
                            <div class="mb-3">
                                <label for="role" class="form-label">ロール</label>
                                <select class="form-select" id="role" name="role" required>
                                    <option value="user">一般ユーザー</option>
                                    <option value="editor">編集者</option>
                                    <option value="admin">管理者</option>
                                </select>
                            </div>
                            
                            <div class="d-grid gap-2">
                                <button type="submit" class="btn btn-primary">登録</button>
                                <a href="login.php" class="btn btn-link">ログインに戻る</a>
                            </div>
                        </form>
                    <?php endif; ?>
                </div>
            </div>
        </div>
    </div>
</div>

<?php
// フッターの読み込み
require_once '../includes/footer.php';
?> 
