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

/**
 * Xibo API エージェント - ヘッダー
 */

// 直接アクセス禁止
if (!defined('BASE_PATH')) {
    http_response_code(403);
    exit('直接アクセスは禁止されています');
}

// デフォルト値の設定
$productName = $productName ?? 'Xibo AI Agent';
$pageTitle = $pageTitle ?? 'Xibo AI Agent';
$extraStyles = $extraStyles ?? [];
$extraScripts = $extraScripts ?? [];

?>
<!DOCTYPE html>
<html lang="ja">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title><?php echo escape($pageTitle); ?></title>
    
    <!-- Bootstrap CSS -->
    <link href="https://cdn.jsdelivr.net/npm/bootstrap@5.3.0/dist/css/bootstrap.min.css" rel="stylesheet">
    
    <!-- Font Awesome -->
    <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.1.2/css/all.min.css">
    
    <!-- カスタムCSS -->
    <link rel="stylesheet" href="../style.css">
    
    <!-- favicon -->
    <link href="../img/favicon.ico" rel="shortcut icon"/>
    
    <!-- 追加CSS -->
    <?php foreach ($extraStyles as $style): ?>
    <link rel="stylesheet" href="<?php echo $style; ?>">
    <?php endforeach; ?>
</head>
<body>
    <header class="main-header">
        <nav class="navbar navbar-expand-lg navbar-dark bg-dark fixed-top">
            <div class="container">
                <a class="navbar-brand" href="#">
                    <img src="../img/logo.png" alt="<?php echo $productName; ?>" height="30" class="d-inline-block align-text-top">
                    <?php echo $productName; ?>
                </a>
                <button class="navbar-toggler" type="button" data-bs-toggle="collapse" data-bs-target="#navbarNav">
                    <span class="navbar-toggler-icon"></span>
                </button>
                <div class="collapse navbar-collapse" id="navbarNav">
                    <ul class="navbar-nav me-auto">
                        <li class="nav-item">
                            <a class="nav-link active" href="#">AI Engine</a>
                        </li>
                    </ul>
                    <?php if (isAuthenticated()): ?>
                    <div class="d-flex align-items-center">
                        <span class="text-light me-3"><?php echo escape(getCurrentUser()['username'] ?? ''); ?></span>
                        <a href="<?php echo BASE_PATH; ?>/auth/logout.php" class="btn btn-outline-light btn-sm">ログアウト</a>
                    </div>
                    <?php endif; ?>
                </div>
            </div>
        </nav>
    </header>
    
    <main class="main-content">
        <div class="container mt-5 pt-4"><?php // メインコンテンツ開始 ?> 
