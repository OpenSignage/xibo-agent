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
 * Xibo API エージェント - ログインページ
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

// ログインエラーメッセージの初期化
$loginError = '';
$showRegisterForm = isset($_GET['register']) && $_GET['register'] === 'true';

// ログインフォームが送信された場合の処理
if ($_SERVER['REQUEST_METHOD'] === 'POST' && isset($_POST['action']) && $_POST['action'] === 'login') {
    $username = $_POST['username'] ?? '';
    $password = $_POST['password'] ?? '';
    
    // 入力検証
    if (empty($username) || empty($password)) {
        $loginError = 'ユーザー名とパスワードを入力してください';
    } else {
        // APIログインリクエスト
        $response = callApi([
            'action' => 'login',
            'username' => $username,
            'password' => $password
        ]);
        
        if ($response['status'] === 'success') {
            // セッションにユーザー情報を保存
            $_SESSION[SESSION_COOKIE_NAME] = $response['user'] ?? ['username' => $username];
            
            // メインページにリダイレクト
            redirect('../index.php');
            exit;
        } else {
            $loginError = $response['error'] ?? 'ログインに失敗しました';
        }
    }
}

// ページタイトル
$pageTitle = 'ログイン - Xibo API エージェント';

// 追加のCSS
$extraStyles = ['../style.css'];

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
                    <?php if (!empty($loginError)): ?>
                        <div class="alert alert-danger"><?php echo escape($loginError); ?></div>
                    <?php endif; ?>
                    
                    <ul class="nav nav-tabs mb-4" role="tablist">
                        <li class="nav-item" role="presentation">
                            <button class="nav-link <?php echo $showRegisterForm ? '' : 'active'; ?>" 
                                    data-bs-toggle="tab" 
                                    data-bs-target="#login-form" 
                                    type="button" 
                                    role="tab">ログイン</button>
                        </li>
                        <li class="nav-item" role="presentation">
                            <button class="nav-link <?php echo $showRegisterForm ? 'active' : ''; ?>" 
                                    data-bs-toggle="tab" 
                                    data-bs-target="#register-form" 
                                    type="button" 
                                    role="tab">ユーザー登録</button>
                        </li>
                    </ul>
                    
                    <div class="tab-content">
                        <!-- ログインフォーム -->
                        <div class="tab-pane fade <?php echo $showRegisterForm ? '' : 'show active'; ?>" 
                             id="login-form" 
                             role="tabpanel">
                            <form method="post" action="login.php">
                                <input type="hidden" name="action" value="login">
                                
                                <div class="mb-3">
                                    <label for="username" class="form-label">ユーザー名またはメールアドレス:</label>
                                    <input type="text" class="form-control" id="username" name="username" required>
                                </div>
                                
                                <div class="mb-3">
                                    <label for="password" class="form-label">パスワード:</label>
                                    <input type="password" class="form-control" id="password" name="password" required>
                                </div>
                                
                                <div class="d-grid">
                                    <button type="submit" class="btn btn-primary">ログイン</button>
                                </div>
                            </form>
                        </div>
                        
                        <!-- 登録フォーム -->
                        <div class="tab-pane fade <?php echo $showRegisterForm ? 'show active' : ''; ?>" 
                             id="register-form" 
                             role="tabpanel">
                            <form method="post" action="register.php">
                                <input type="hidden" name="action" value="register">
                                
                                <div class="mb-3">
                                    <label for="reg-username" class="form-label">ユーザー名:</label>
                                    <input type="text" class="form-control" id="reg-username" name="username" required>
                                </div>
                                
                                <div class="mb-3">
                                    <label for="reg-email" class="form-label">メールアドレス:</label>
                                    <input type="email" class="form-control" id="reg-email" name="email" required>
                                </div>
                                
                                <div class="mb-3">
                                    <label for="reg-password" class="form-label">パスワード:</label>
                                    <input type="password" class="form-control" id="reg-password" name="password" required>
                                    <div class="form-text">8文字以上で入力してください</div>
                                </div>
                                
                                <div class="d-grid">
                                    <button type="submit" class="btn btn-primary">登録</button>
                                </div>
                            </form>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    </div>
</div>

<?php
// フッターの読み込み
require_once '../includes/footer.php';
?> 