/**
 * Xibo API エージェント - 認証関連のJavaScript
 */

// 認証モジュール
const Auth = {
    /**
     * ユーザーのログイン状態を確認
     * @returns {Promise<Object>} ログイン状態を含むオブジェクト
     */
    checkLoginStatus: async function() {
        try {
            const response = await fetch(API_URL, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ action: 'checkAuth' })
            });
            
            if (!response.ok) {
                throw new Error('APIサーバーエラー: ' + response.status);
            }
            
            const text = await response.text();
            try {
                return JSON.parse(text);
            } catch (e) {
                throw new Error('レスポンスの解析に失敗しました: ' + text.substring(0, 100));
            }
        } catch (error) {
            console.error('認証確認エラー:', error);
            return { status: 'error', error: error.message, isLoggedIn: false };
        }
    },
    
    /**
     * ログアウト処理
     * @returns {Promise<boolean>} ログアウト成功ならtrue
     */
    logout: async function() {
        try {
            const response = await fetch(API_URL, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ action: 'logout' })
            });
            
            if (!response.ok) {
                throw new Error('サーバーエラー: ' + response.status);
            }
            
            const text = await response.text();
            let data;
            try {
                data = JSON.parse(text);
            } catch (e) {
                throw new Error('レスポンスの解析に失敗しました: ' + text.substring(0, 100));
            }
            
            if (data.status === 'success') {
                window.location.reload();
                return true;
            } else {
                alert('ログアウト中にエラーが発生しました: ' + (data.error || '不明なエラー'));
                return false;
            }
        } catch (error) {
            alert('リクエスト中にエラーが発生しました: ' + error.message);
            console.error('ログアウトエラー:', error);
            return false;
        }
    },
    
    /**
     * ログイン必須ページの検証
     * 未ログインの場合はログインページにリダイレクト
     */
    requireLogin: async function() {
        const authStatus = await this.checkLoginStatus();
        if (!authStatus.isLoggedIn) {
            const currentPath = window.location.pathname;
            window.location.href = `${BASE_URL}/auth/login.php?redirect=${encodeURIComponent(currentPath)}`;
        }
    }
};

// DOMが読み込まれた時の処理
document.addEventListener('DOMContentLoaded', function() {
    // ログアウトボタンのイベント設定
    const logoutButton = document.getElementById('logout-button');
    if (logoutButton) {
        logoutButton.addEventListener('click', function(e) {
            e.preventDefault();
            if (confirm('ログアウトしますか？')) {
                Auth.logout();
            }
        });
    }
    
    // 認証ページのタブ切り替え機能
    const tabButtons = document.querySelectorAll('.tabs .tab-btn');
    if (tabButtons.length > 0) {
        tabButtons.forEach(btn => {
            btn.addEventListener('click', function() {
                // すべてのタブからアクティブクラスを削除
                tabButtons.forEach(b => b.classList.remove('active'));
                
                // クリックされたタブをアクティブにする
                this.classList.add('active');
                
                // フォームの表示/非表示を切り替え
                const targetId = this.getAttribute('data-target');
                document.querySelectorAll('.auth-form').forEach(form => {
                    form.classList.add('hidden');
                });
                document.getElementById(targetId).classList.remove('hidden');
                
                // 登録フォーム表示時はURLパラメータを変更
                const url = new URL(window.location);
                if (targetId === 'register-form') {
                    url.searchParams.set('register', 'true');
                } else {
                    url.searchParams.delete('register');
                }
                window.history.replaceState({}, '', url);
            });
        });
    }
}); 