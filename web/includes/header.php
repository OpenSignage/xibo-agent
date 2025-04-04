<?php
/**
 * Xibo API エージェント - ヘッダー
 */

// 直接アクセス禁止
if (!defined('BASE_PATH')) {
    http_response_code(403);
    exit('直接アクセスは禁止されています');
}

// デフォルト値の設定
$pageTitle = $pageTitle ?? 'Xibo API エージェント';
$extraStyles = $extraStyles ?? [];
$extraScripts = $extraScripts ?? [];
?>
<!DOCTYPE html>
<html lang="ja">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title><?php echo escape($pageTitle); ?></title>
    
    <!-- 基本CSS -->
    <link rel="stylesheet" href="<?php echo BASE_PATH; ?>/assets/css/style.css">
    
    <!-- 追加CSS -->
    <?php foreach ($extraStyles as $style): ?>
    <link rel="stylesheet" href="<?php echo $style; ?>">
    <?php endforeach; ?>
</head>
<body>
    <header class="main-header">
        <div class="container">
            <div class="logo">
                <h1>Xibo API エージェント</h1>
            </div>
            
            <?php if (isAuthenticated()): ?>
            <div class="user-info">
                <span class="username"><?php echo escape(getCurrentUser()['username'] ?? ''); ?></span>
                <a href="<?php echo BASE_PATH; ?>/auth/logout.php" class="logout-btn">ログアウト</a>
            </div>
            <?php endif; ?>
        </div>
    </header>
    
    <main class="main-content">
        <div class="container"><?php // メインコンテンツ開始 ?> 