<?php
/**
 * Xibo API エージェント - メインアプリケーション
 */

// デバッグモードの設定
define('DEBUG_MODE', true);

// ベースパスの定義
define('BASE_PATH', __DIR__);

// 設定ファイルの読み込み
require_once BASE_PATH . '/config.php';
require_once BASE_PATH . '/includes/functions.php';

// セッション開始
session_start();

// 未ログインの場合はログインページへリダイレクト
if (!isset($_SESSION[SESSION_COOKIE_NAME])) {
    redirect('auth/login.php');
    exit;
}

// ログアウト処理（GETリクエストの場合）
if (isset($_GET['logout'])) {
    redirect('auth/logout.php');
    exit;
}

// 現在のタブを決定
$currentTab = $_GET['tab'] ?? 'dashboard';
$validTabs = ['dashboard', 'chat', 'settings'];
if (!in_array($currentTab, $validTabs)) {
    $currentTab = 'dashboard';
}

// ページタイトルの設定
$pageTitle = 'Xibo API エージェント'; // デフォルト値
switch ($currentTab) {
    case 'dashboard':
        $pageTitle = 'ダッシュボード';
        break;
    case 'chat':
        $pageTitle = 'チャット';
        break;
    case 'settings':
        $pageTitle = '設定';
        break;
}

// 追加のスタイルシートとスクリプト
$extraStyles = ['assets/css/style.css'];
$extraScripts = ['assets/js/common.js'];

// ヘッダーの読み込み
require_once BASE_PATH . '/includes/header.php';
?>

<div class="main-tabs">
    <div class="tab-buttons">
        <a href="?tab=dashboard" class="tab-btn <?php echo isActiveTab('dashboard', $currentTab); ?>" data-tab="dashboard">ダッシュボード</a>
        <a href="?tab=chat" class="tab-btn <?php echo isActiveTab('chat', $currentTab); ?>" data-tab="chat">チャット</a>
        <a href="?tab=settings" class="tab-btn <?php echo isActiveTab('settings', $currentTab); ?>" data-tab="settings">設定</a>
    </div>
    
    <div class="tab-contents">
        <?php
        // 対応するタブのコンテンツを読み込む
        $contentFile = ''; // 初期化
        switch ($currentTab) {
            case 'dashboard':
                $contentFile = 'dashboard/dashboard_content.php';
                break;
            case 'chat':
                $contentFile = 'chat/chat_content.php';
                break;
            case 'settings':
                $contentFile = 'settings/settings_content.php';
                break;
            default:
                $contentFile = 'dashboard/dashboard_content.php';
                break;
        }
        // ファイルが存在するか確認してから読み込む
        if (file_exists(BASE_PATH . '/' . $contentFile)) {
            require_once BASE_PATH . '/' . $contentFile;
        } else {
            echo '<div class="error-message">コンテンツが見つかりません: ' . escape($contentFile) . '</div>';
            // デフォルトのダッシュボードを表示
            if ($contentFile !== 'dashboard/dashboard_content.php' && file_exists(BASE_PATH . '/dashboard/dashboard_content.php')) {
                require_once BASE_PATH . '/dashboard/dashboard_content.php';
            }
        }
        ?>
    </div>
</div>

<?php
// フッターの読み込み
require_once BASE_PATH . '/includes/footer.php';
?> 
