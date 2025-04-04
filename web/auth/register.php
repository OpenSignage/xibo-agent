<?php
/*
 * Xibo API エージェント - ユーザー登録処理
 */

// ベースパスの定義
define('BASE_PATH', dirname(__DIR__));

// 設定ファイルの読み込み
require_once BASE_PATH . '/config.php';
require_once BASE_PATH . '/includes/functions.php';

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
    
    // 入力検証
    if (empty($username) || empty($email) || empty($password)) {
        $registerError = 'すべての項目を入力してください';
    } elseif (strlen($password) < 8) {
        $registerError = 'パスワードは8文字以上である必要があります';
    } elseif (!filter_var($email, FILTER_VALIDATE_EMAIL)) {
        $registerError = '有効なメールアドレスを入力してください';
    } else {
        // API登録リクエスト
        $response = callApi([
            'action' => 'register',
            'username' => $username,
            'email' => $email,
            'password' => $password
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
$extraStyles = ['../assets/css/style.css'];

// 追加のJavaScript
$extraScripts = ['../assets/js/common.js', 'auth.js'];

// ヘッダーの読み込み
require_once BASE_PATH . '/includes/header.php';
?>

<div class="container">
    <div class="register-container">
        <?php if ($registerSuccess): ?>
            <div class="success-message">
                <h2>登録が完了しました</h2>
                <p>アカウントが正常に作成されました。メインページにリダイレクトします...</p>
            </div>
        <?php else: ?>
            <?php if (!empty($registerError)): ?>
                <div class="error-message"><?php echo htmlspecialchars($registerError); ?></div>
            <?php endif; ?>
            
            <h2>登録に失敗しました</h2>
            <p>申し訳ありませんが、登録処理中にエラーが発生しました。</p>
            <div class="form-actions">
                <a href="login.php?register=true" class="btn btn-primary">登録画面に戻る</a>
                <a href="login.php" class="btn btn-link">ログインに戻る</a>
            </div>
        <?php endif; ?>
    </div>
</div>

<?php
// フッターの読み込み
require_once BASE_PATH . '/includes/footer.php';
?> 