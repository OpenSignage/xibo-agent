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
    
    <!-- 基本CSS -->
    <link rel="stylesheet" href="../style.css">

    <!-- favicon -->
    <link href="../img/favicon.ico" rel="shortcut icon"/>

    <!-- Font Awsome -->
    <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.1.2/css/all.min.css">

    <!-- 追加CSS -->
    <?php foreach ($extraStyles as $style): ?>
    <link rel="stylesheet" href="<?php echo $style; ?>">
    <?php endforeach; ?>

    <!-- Bootstrap style sheet -->
    <link href="../vendor/twbs/bootstrap/dist/css/bootstrap.min.css" rel="stylesheet" media="screen">
    
    <!-- Bootstrap javascript -->
    <script src="../vendor/twbs/bootstrap/dist/js/bootstrap.bundle.min.js"></script>
</head>
<body>
    <header class="main-header">
        <nav id="top-nav" class="navbar navbar-inverse navbar-fixed-top" role="navigation">
            <div class="container">
                <div class="navbar-header">
                    <img class="img-responsive logo leftflush header-logo" src="../img/logo.png" alt="<?php echo $productName; ?>" style="margin-right:20px"/>
                    <button type="button" class="navbar-toggle" data-toggle="collapse" data-target="#ss-navbar">
                        <span class="sr-only">Toggle navigation</span>
                        <span class="icon-bar"></span>
                        <span class="icon-bar"></span>
                        <span class="icon-bar"></span>
                    </button>
                </div>
                <div class="collapse navbar-collapse" id="ss-navbar">
                    <ul class="nav navbar-nav">
                        <li class="active"><a href="#"> AI Engine </a></li>
<!--
                        <li><a href=""></a></li>
                        <li><a href=""></a></li>
                        <li><a href=""></a></li>
			<li><div class="fill-space">&nbsp;></div></li>
-->
                        <li class="navbar-right"><div class="gcse-search"></div></li>
                    </ul>
                </div>

            <?php if (isAuthenticated()): ?>
            <div class="user-info">
                <span class="username"><?php echo escape(getCurrentUser()['username'] ?? ''); ?></span>
                <a href="<?php echo BASE_PATH; ?>/auth/logout.php" class="logout-btn">ログアウト</a>
            </div>
            <?php endif; ?>
            </div>
        </div>
    </header>
    
    <main class="main-content">
        <div class="container"><?php // メインコンテンツ開始 ?> 
