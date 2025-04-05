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
 * Xibo API エージェント - 設定ページコンテンツ
 */

// 直接アクセス禁止
if (!defined('BASE_PATH')) {
    http_response_code(403);
    exit('直接アクセスは禁止されています');
}

// 初期値の設定
$settings = $_SESSION[SESSION_COOKIE_NAME]['settings'] ?? [];
$settingsError = '';
$settingsSuccess = false;

// 設定が保存された場合のメッセージ処理
if (isset($_SESSION['settings_saved'])) {
    $settingsSuccess = true;
    unset($_SESSION['settings_saved']);
}

// 設定エラーメッセージの処理
if (isset($_SESSION['settings_error'])) {
    $settingsError = $_SESSION['settings_error'];
    unset($_SESSION['settings_error']);
}
?>

<div class="settings-container">
    <h2>ユーザー設定</h2>
    
    <?php if ($settingsSuccess): ?>
        <div class="success-message">設定が保存されました</div>
    <?php endif; ?>
    
    <?php if (!empty($settingsError)): ?>
        <div class="error-message"><?php echo htmlspecialchars($settingsError); ?></div>
    <?php endif; ?>
    
    <form action="settings/save_settings.php" method="post" id="settingsForm">
        <div class="form-group">
            <label for="apiUrl">Xibo API URL:</label>
            <input type="url" id="apiUrl" name="apiUrl" value="<?php echo htmlspecialchars($settings['apiUrl'] ?? ''); ?>" required>
            <small>例: https://example.com/xibo/api</small>
        </div>
        
        <div class="form-group">
            <label for="apiKey">API キー:</label>
            <input type="text" id="apiKey" name="apiKey" value="<?php echo htmlspecialchars($settings['apiKey'] ?? ''); ?>" required>
        </div>
        
        <div class="form-group">
            <label for="clientId">クライアントID:</label>
            <input type="text" id="clientId" name="clientId" value="<?php echo htmlspecialchars($settings['clientId'] ?? ''); ?>" required>
        </div>
        
        <div class="form-group">
            <label for="clientSecret">クライアントシークレット:</label>
            <input type="password" id="clientSecret" name="clientSecret" value="<?php echo htmlspecialchars($settings['clientSecret'] ?? ''); ?>" required>
        </div>
        
        <div class="form-group">
            <label for="refreshInterval">更新間隔 (秒):</label>
            <input type="number" id="refreshInterval" name="refreshInterval" min="5" value="<?php echo htmlspecialchars($settings['refreshInterval'] ?? '60'); ?>">
        </div>
        
        <div class="form-group">
            <label for="logLevel">ログレベル:</label>
            <select id="logLevel" name="logLevel">
                <option value="error" <?php echo (($settings['logLevel'] ?? '') === 'error') ? 'selected' : ''; ?>>エラーのみ</option>
                <option value="warning" <?php echo (($settings['logLevel'] ?? '') === 'warning') ? 'selected' : ''; ?>>警告以上</option>
                <option value="info" <?php echo (($settings['logLevel'] ?? '') === 'info') ? 'selected' : ''; ?>>情報以上</option>
                <option value="debug" <?php echo (($settings['logLevel'] ?? '') === 'debug') ? 'selected' : ''; ?>>デバッグ</option>
            </select>
        </div>
        
        <div class="form-actions">
            <button type="submit" class="btn btn-primary">設定を保存</button>
            <button type="button" class="btn btn-secondary" id="testConnection">接続テスト</button>
        </div>
    </form>
    
    <div id="connectionResult" class="connection-result" style="display: none;"></div>
</div>

<script src="settings/settings.js"></script> 