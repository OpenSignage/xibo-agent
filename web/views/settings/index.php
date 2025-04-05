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
 * 設定画面のビュー
 */

// ヘッダーの読み込み
require_once '../includes/header.php';
?>

<div class="container py-4">
    <div class="row justify-content-center">
        <div class="col-lg-8">
            <div class="card shadow-sm">
                <div class="card-header bg-white py-3">
                    <h5 class="mb-0">設定</h5>
                </div>
                <div class="card-body">
                    <form id="settings-form" method="post" action="/settings/save">
                        <!-- API設定 -->
                        <div class="mb-4">
                            <h6 class="fw-bold mb-3">API設定</h6>
                            <div class="mb-3">
                                <label for="api_url" class="form-label">API URL</label>
                                <input type="url" class="form-control" id="api_url" name="api_url" 
                                       value="<?php echo htmlspecialchars($settings['api_url'] ?? ''); ?>" required>
                                <div class="form-text">Xibo CMSのAPIエンドポイントURL</div>
                            </div>
                            <div class="mb-3">
                                <label for="api_key" class="form-label">API Key</label>
                                <input type="password" class="form-control" id="api_key" name="api_key" 
                                       value="<?php echo htmlspecialchars($settings['api_key'] ?? ''); ?>" required>
                                <div class="form-text">Xibo CMSのAPIキー</div>
                            </div>
                        </div>
                        
                        <!-- ディスプレイ設定 -->
                        <div class="mb-4">
                            <h6 class="fw-bold mb-3">ディスプレイ設定</h6>
                            <div class="mb-3">
                                <label for="display_name" class="form-label">ディスプレイ名</label>
                                <input type="text" class="form-control" id="display_name" name="display_name" 
                                       value="<?php echo htmlspecialchars($settings['display_name'] ?? ''); ?>" required>
                                <div class="form-text">このディスプレイの識別名</div>
                            </div>
                            <div class="mb-3">
                                <label for="display_group" class="form-label">ディスプレイグループ</label>
                                <input type="text" class="form-control" id="display_group" name="display_group" 
                                       value="<?php echo htmlspecialchars($settings['display_group'] ?? ''); ?>">
                                <div class="form-text">ディスプレイのグループ名（オプション）</div>
                            </div>
                        </div>
                        
                        <!-- 更新設定 -->
                        <div class="mb-4">
                            <h6 class="fw-bold mb-3">更新設定</h6>
                            <div class="mb-3">
                                <label for="update_interval" class="form-label">更新間隔（秒）</label>
                                <input type="number" class="form-control" id="update_interval" name="update_interval" 
                                       value="<?php echo htmlspecialchars($settings['update_interval'] ?? '60'); ?>" 
                                       min="30" max="3600" required>
                                <div class="form-text">コンテンツの更新間隔（30秒〜3600秒）</div>
                            </div>
                            <div class="mb-3">
                                <div class="form-check form-switch">
                                    <input class="form-check-input" type="checkbox" id="auto_update" name="auto_update" 
                                           <?php echo ($settings['auto_update'] ?? true) ? 'checked' : ''; ?>>
                                    <label class="form-check-label" for="auto_update">自動更新を有効にする</label>
                                </div>
                            </div>
                        </div>
                        
                        <!-- システム設定 -->
                        <div class="mb-4">
                            <h6 class="fw-bold mb-3">システム設定</h6>
                            <div class="mb-3">
                                <div class="form-check form-switch">
                                    <input class="form-check-input" type="checkbox" id="debug_mode" name="debug_mode" 
                                           <?php echo ($settings['debug_mode'] ?? false) ? 'checked' : ''; ?>>
                                    <label class="form-check-label" for="debug_mode">デバッグモードを有効にする</label>
                                </div>
                            </div>
                            <div class="mb-3">
                                <label for="log_level" class="form-label">ログレベル</label>
                                <select class="form-select" id="log_level" name="log_level">
                                    <option value="error" <?php echo ($settings['log_level'] ?? 'error') === 'error' ? 'selected' : ''; ?>>エラー</option>
                                    <option value="warning" <?php echo ($settings['log_level'] ?? 'error') === 'warning' ? 'selected' : ''; ?>>警告</option>
                                    <option value="info" <?php echo ($settings['log_level'] ?? 'error') === 'info' ? 'selected' : ''; ?>>情報</option>
                                    <option value="debug" <?php echo ($settings['log_level'] ?? 'error') === 'debug' ? 'selected' : ''; ?>>デバッグ</option>
                                </select>
                            </div>
                        </div>
                        
                        <div class="d-grid gap-2">
                            <button type="submit" class="btn btn-primary">
                                <i class="fas fa-save me-1"></i>設定を保存
                            </button>
                            <button type="reset" class="btn btn-outline-secondary">
                                <i class="fas fa-undo me-1"></i>変更を元に戻す
                            </button>
                        </div>
                    </form>
                </div>
            </div>
        </div>
    </div>
</div>

<script>
document.addEventListener('DOMContentLoaded', function() {
    const settingsForm = document.getElementById('settings-form');
    
    // フォーム送信
    settingsForm.addEventListener('submit', function(e) {
        e.preventDefault();
        
        // フォームデータの収集
        const formData = new FormData(settingsForm);
        
        // 設定を保存
        fetch('/settings/save', {
            method: 'POST',
            body: formData
        })
        .then(response => response.json())
        .then(data => {
            if (data.status === 'success') {
                alert('設定を保存しました');
            } else {
                alert(data.message || 'エラーが発生しました');
            }
        })
        .catch(error => {
            console.error('Error:', error);
            alert('設定の保存に失敗しました');
        });
    });
});
</script>

<?php
// フッターの読み込み
require_once '../includes/footer.php';
?> 