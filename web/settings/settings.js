/**
 * 設定ページのJavaScript機能
 */
document.addEventListener('DOMContentLoaded', function() {
    // 接続テストボタンのイベント処理
    const testConnectionBtn = document.getElementById('testConnection');
    const connectionResult = document.getElementById('connectionResult');
    const settingsForm = document.getElementById('settingsForm');
    
    if (testConnectionBtn && connectionResult) {
        testConnectionBtn.addEventListener('click', function() {
            // 接続テスト実行前にフォームのバリデーションを確認
            if (!settingsForm.checkValidity()) {
                settingsForm.reportValidity();
                return;
            }
            
            // フォームデータの取得
            const formData = new FormData(settingsForm);
            const settings = {
                apiUrl: formData.get('apiUrl'),
                apiKey: formData.get('apiKey'),
                clientId: formData.get('clientId'),
                clientSecret: formData.get('clientSecret')
            };
            
            // テスト開始メッセージを表示
            connectionResult.innerHTML = '<div class="loading">接続テスト中...</div>';
            connectionResult.style.display = 'block';
            
            // APIリクエストの実行
            fetch('../handler.php', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    action: 'testConnection',
                    settings: settings
                })
            })
            .then(response => response.json())
            .then(data => {
                // 接続テスト結果の表示
                if (data.status === 'success') {
                    connectionResult.innerHTML = `
                        <div class="success-message">
                            <h4>接続成功</h4>
                            <p>${data.message || 'Xibo APIに正常に接続できました。'}</p>
                            ${data.details ? `<pre>${JSON.stringify(data.details, null, 2)}</pre>` : ''}
                        </div>
                    `;
                } else {
                    connectionResult.innerHTML = `
                        <div class="error-message">
                            <h4>接続失敗</h4>
                            <p>${data.error || '接続に失敗しました。設定を確認してください。'}</p>
                            ${data.details ? `<pre>${JSON.stringify(data.details, null, 2)}</pre>` : ''}
                        </div>
                    `;
                }
            })
            .catch(error => {
                // エラー発生時の処理
                connectionResult.innerHTML = `
                    <div class="error-message">
                        <h4>エラー発生</h4>
                        <p>APIリクエスト中にエラーが発生しました: ${error.message}</p>
                    </div>
                `;
            });
        });
    }
    
    // フォーム送信前の確認
    if (settingsForm) {
        settingsForm.addEventListener('submit', function(event) {
            const confirmed = confirm('設定を保存してもよろしいですか？');
            if (!confirmed) {
                event.preventDefault();
            }
        });
    }
}); 