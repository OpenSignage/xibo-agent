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
    <div class="login-container">
        <?php if (!empty($loginError)): ?>
            <div class="error-message"><?php echo escape($loginError); ?></div>
        <?php endif; ?>
        
        <div class="tabs">
            <button class="tab-btn <?php echo $showRegisterForm ? '' : 'active'; ?>" data-target="login-form">ログイン</button>
            <button class="tab-btn <?php echo $showRegisterForm ? 'active' : ''; ?>" data-target="register-form">ユーザー登録</button>
        </div>
        
        <!-- ログインフォーム -->
        <div id="login-form" class="auth-form <?php echo $showRegisterForm ? 'hidden' : ''; ?>">
            <form method="post" action="login.php">
                <input type="hidden" name="action" value="login">
                
                <div class="form-group">
                    <label for="username">ユーザー名またはメールアドレス:</label>
                    <input type="text" id="username" name="username" required>
                </div>
                
                <div class="form-group">
                    <label for="password">パスワード:</label>
                    <input type="password" id="password" name="password" required>
                </div>
                
                <div class="form-actions">
                    <button type="submit" class="btn btn-primary">ログイン</button>
                </div>
            </form>
        </div>
        
        <!-- 登録フォーム -->
        <div id="register-form" class="auth-form <?php echo $showRegisterForm ? '' : 'hidden'; ?>">
            <form method="post" action="register.php">
                <input type="hidden" name="action" value="register">
                
                <div class="form-group">
                    <label for="reg-username">ユーザー名:</label>
                    <input type="text" id="reg-username" name="username" required>
                </div>
                
                <div class="form-group">
                    <label for="reg-email">メールアドレス:</label>
                    <input type="email" id="reg-email" name="email" required>
                </div>
                
                <div class="form-group">
                    <label for="reg-password">パスワード:</label>
                    <input type="password" id="reg-password" name="password" required>
                    <small>8文字以上で入力してください</small>
                </div>
                
                <div class="form-actions">
                    <button type="submit" class="btn btn-primary">登録</button>
                </div>
            </form>
        </div>
    </div>
</div>

<script>
// ページ読み込み時にタブ切り替え機能を初期化
document.addEventListener('DOMContentLoaded', function() {
    // タブボタンのイベント設定
    const tabButtons = document.querySelectorAll('.tab-btn');
    tabButtons.forEach(button => {
        button.addEventListener('click', function() {
            // すべてのタブからアクティブクラスを削除
            tabButtons.forEach(btn => btn.classList.remove('active'));
            // クリックされたタブをアクティブに
            this.classList.add('active');
            
            // すべてのフォームを非表示
            const forms = document.querySelectorAll('.auth-form');
            forms.forEach(form => form.classList.add('hidden'));
            
            // 対応するフォームを表示
            const targetId = this.getAttribute('data-target');
            document.getElementById(targetId).classList.remove('hidden');
            
            // URLパラメータを更新
            const url = new URL(window.location);
            if (targetId === 'register-form') {
                url.searchParams.set('register', 'true');
            } else {
                url.searchParams.delete('register');
            }
            history.replaceState({}, '', url);
        });
    });
});
</script>

<?php
// フッターの読み込み
require_once '../includes/footer.php';
?> 