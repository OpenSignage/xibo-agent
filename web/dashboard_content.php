<?php
/*
 * Xibo API エージェント - ダッシュボードコンテンツ
 */

// 直接アクセスを防止
if (!defined('BASE_PATH')) {
    exit('直接アクセスは許可されていません');
}

// APIステータスの取得
$apiStatus = getApiStatus();
$isConnected = ($apiStatus['status'] === 'success');
$configStatus = $apiStatus['config'] ?? [];

// ページコンテンツのキャプチャを開始
ob_start();
?>

<div class="dashboard">
    <h2>ダッシュボード</h2>
    
    <div class="dashboard-summary">
        <div class="summary-card <?php echo $isConnected ? 'success' : 'error'; ?>">
            <h3>API接続状態</h3>
            <div class="status-indicator">
                <span class="status-icon"><?php echo $isConnected ? '✓' : '✗'; ?></span>
                <span class="status-text"><?php echo $isConnected ? '接続済み' : '未接続'; ?></span>
            </div>
            <?php if (!$isConnected && isset($apiStatus['error'])): ?>
                <div class="error-message"><?php echo escape($apiStatus['error']); ?></div>
            <?php endif; ?>
        </div>
        
        <div class="summary-card">
            <h3>Xiboサーバー情報</h3>
            <?php if ($isConnected && isset($configStatus['xibo_api_url'])): ?>
                <div class="info-item">
                    <span class="info-label">サーバーURL:</span>
                    <span class="info-value"><?php echo escape($configStatus['xibo_api_url']); ?></span>
                </div>
                <?php if (isset($configStatus['xibo_version'])): ?>
                    <div class="info-item">
                        <span class="info-label">Xiboバージョン:</span>
                        <span class="info-value"><?php echo escape($configStatus['xibo_version']); ?></span>
                    </div>
                <?php endif; ?>
            <?php else: ?>
                <div class="not-available">情報が利用できません</div>
            <?php endif; ?>
        </div>
        
        <div class="summary-card">
            <h3>ユーザー情報</h3>
            <?php if (isset($currentUser) && $currentUser): ?>
                <div class="info-item">
                    <span class="info-label">ユーザー名:</span>
                    <span class="info-value"><?php echo escape($currentUser['username']); ?></span>
                </div>
                <div class="info-item">
                    <span class="info-label">ユーザーID:</span>
                    <span class="info-value"><?php echo escape($currentUser['userId']); ?></span>
                </div>
                <div class="info-item">
                    <span class="info-label">権限:</span>
                    <span class="info-value"><?php echo $currentUser['isAdmin'] ? '管理者' : '一般ユーザー'; ?></span>
                </div>
            <?php else: ?>
                <div class="not-available">ユーザー情報が利用できません</div>
            <?php endif; ?>
        </div>
    </div>
    
    <?php if ($isConnected): ?>
        <div class="dashboard-actions">
            <h3>クイックアクション</h3>
            <div class="action-buttons">
                <button class="btn btn-action" data-action="refreshDisplays">
                    <span class="icon">🖥️</span>
                    ディスプレイ更新
                </button>
                <button class="btn btn-action" data-action="checkStatus">
                    <span class="icon">📊</span>
                    システム状態確認
                </button>
                <button class="btn btn-action" data-action="recentLayouts">
                    <span class="icon">📋</span>
                    最近のレイアウト
                </button>
                <button class="btn btn-action" data-action="checkSchedule">
                    <span class="icon">📅</span>
                    スケジュール確認
                </button>
            </div>
        </div>
        
        <div id="action-result" class="action-result hidden">
            <h3>実行結果</h3>
            <div id="result-content" class="result-content"></div>
        </div>
    <?php endif; ?>
</div>

<script>
document.addEventListener('DOMContentLoaded', function() {
    // アクションボタンのイベント設定
    const actionButtons = document.querySelectorAll('.btn-action');
    actionButtons.forEach(button => {
        button.addEventListener('click', function() {
            const action = this.getAttribute('data-action');
            executeAction(action);
        });
    });
    
    /**
     * ダッシュボードアクションの実行
     * @param {string} action 実行するアクション名
     */
    function executeAction(action) {
        // 結果表示領域の準備
        const resultArea = document.getElementById('action-result');
        const resultContent = document.getElementById('result-content');
        
        // ローディング表示
        resultArea.classList.remove('hidden');
        resultContent.innerHTML = '<div class="loading">処理中...</div>';
        
        // APIリクエスト
        fetch(API_URL, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                action: 'dashboardAction',
                dashboardAction: action
            })
        })
        .then(response => {
            if (!response.ok) {
                throw new Error('サーバーエラー: ' + response.status);
            }
            return response.text().then(text => {
                try {
                    return JSON.parse(text);
                } catch (e) {
                    throw new Error('レスポンスの解析に失敗しました: ' + text.substring(0, 100));
                }
            });
        })
        .then(data => {
            if (data.status === 'success') {
                displayActionResult(action, data.data);
            } else {
                resultContent.innerHTML = `<div class="error-message">エラー: ${data.error || '不明なエラーが発生しました'}</div>`;
            }
        })
        .catch(error => {
            resultContent.innerHTML = `<div class="error-message">リクエスト中にエラーが発生しました: ${error.message}</div>`;
            console.error('アクション実行エラー:', error);
        });
    }
    
    /**
     * アクション結果の表示
     * @param {string} action 実行されたアクション
     * @param {object} data 結果データ
     */
    function displayActionResult(action, data) {
        const resultContent = document.getElementById('result-content');
        let html = '';
        
        switch (action) {
            case 'refreshDisplays':
                html = '<h4>ディスプレイ更新結果</h4>';
                if (Array.isArray(data) && data.length > 0) {
                    html += '<table class="data-table"><thead><tr><th>ディスプレイ名</th><th>状態</th><th>最終接続</th></tr></thead><tbody>';
                    data.forEach(display => {
                        html += `<tr>
                            <td>${escape(display.display)}</td>
                            <td class="${display.status === 'オンライン' ? 'success' : 'warning'}">${escape(display.status)}</td>
                            <td>${escape(display.lastConnection || '不明')}</td>
                        </tr>`;
                    });
                    html += '</tbody></table>';
                } else {
                    html += '<div class="info-message">表示できるディスプレイがありません</div>';
                }
                break;
                
            case 'checkStatus':
                html = '<h4>システム状態</h4>';
                if (data) {
                    html += '<div class="status-grid">';
                    for (const [key, value] of Object.entries(data)) {
                        const statusClass = typeof value === 'boolean' ? (value ? 'success' : 'error') : '';
                        html += `<div class="status-item ${statusClass}">
                            <span class="status-label">${escape(key)}</span>
                            <span class="status-value">${formatValue(value)}</span>
                        </div>`;
                    }
                    html += '</div>';
                } else {
                    html += '<div class="info-message">システム状態を取得できませんでした</div>';
                }
                break;
                
            case 'recentLayouts':
                html = '<h4>最近のレイアウト</h4>';
                if (Array.isArray(data) && data.length > 0) {
                    html += '<table class="data-table"><thead><tr><th>レイアウト名</th><th>作成日</th><th>更新日</th></tr></thead><tbody>';
                    data.forEach(layout => {
                        html += `<tr>
                            <td>${escape(layout.name)}</td>
                            <td>${escape(layout.createdDate || '不明')}</td>
                            <td>${escape(layout.modifiedDate || '不明')}</td>
                        </tr>`;
                    });
                    html += '</tbody></table>';
                } else {
                    html += '<div class="info-message">表示できるレイアウトがありません</div>';
                }
                break;
                
            case 'checkSchedule':
                html = '<h4>現在のスケジュール</h4>';
                if (Array.isArray(data) && data.length > 0) {
                    html += '<table class="data-table"><thead><tr><th>スケジュール名</th><th>開始日時</th><th>終了日時</th><th>状態</th></tr></thead><tbody>';
                    data.forEach(schedule => {
                        html += `<tr>
                            <td>${escape(schedule.name)}</td>
                            <td>${escape(schedule.fromDt || '指定なし')}</td>
                            <td>${escape(schedule.toDt || '指定なし')}</td>
                            <td class="${schedule.isActive ? 'success' : ''}">${schedule.isActive ? 'アクティブ' : '非アクティブ'}</td>
                        </tr>`;
                    });
                    html += '</tbody></table>';
                } else {
                    html += '<div class="info-message">表示できるスケジュールがありません</div>';
                }
                break;
                
            default:
                html = `<div class="info-message">アクション「${escape(action)}」の処理が完了しました</div>`;
        }
        
        resultContent.innerHTML = html;
    }
    
    /**
     * 値のフォーマット
     * @param {*} value フォーマットする値
     * @returns {string} フォーマット済みの値
     */
    function formatValue(value) {
        if (value === null || value === undefined) {
            return '-';
        } else if (typeof value === 'boolean') {
            return value ? '✓' : '✗';
        } else if (typeof value === 'object') {
            return JSON.stringify(value);
        } else {
            return String(value);
        }
    }
    
    /**
     * HTML特殊文字のエスケープ
     * @param {string} str エスケープする文字列
     * @returns {string} エスケープ済みの文字列
     */
    function escape(str) {
        if (str === null || str === undefined) {
            return '';
        }
        return String(str)
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#039;');
    }
});
</script>

<?php
// ページコンテンツのキャプチャを終了し、pageContentに設定
$pageContent = ob_get_clean();
?> 