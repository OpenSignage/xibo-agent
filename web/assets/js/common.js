/**
 * Xibo API エージェント - 共通JavaScript機能
 */
document.addEventListener('DOMContentLoaded', function() {
    // タブ切り替え機能
    const tabs = document.querySelectorAll('.tab-buttons .tab-btn');
    if (tabs.length > 0) {
        tabs.forEach(tab => {
            tab.addEventListener('click', function(e) {
                e.preventDefault();
                
                // クリックされたタブをアクティブにする
                document.querySelectorAll('.tab-btn').forEach(t => {
                    t.classList.remove('active');
                });
                this.classList.add('active');
                
                // 対応するコンテンツを表示
                const targetId = this.getAttribute('data-tab');
                document.querySelectorAll('.tab-content').forEach(content => {
                    content.style.display = 'none';
                });
                document.getElementById(targetId).style.display = 'block';
                
                // URLのタブパラメータを更新
                const url = new URL(window.location);
                url.searchParams.set('tab', targetId);
                window.history.replaceState({}, '', url);
            });
        });
    }
    
    // フラッシュメッセージ自動閉じ機能
    const flashMessages = document.querySelectorAll('.flash-message');
    if (flashMessages.length > 0) {
        flashMessages.forEach(message => {
            // 3秒後にメッセージを消す
            setTimeout(() => {
                message.style.opacity = '0';
                setTimeout(() => {
                    message.style.display = 'none';
                }, 500);
            }, 3000);
            
            // 閉じるボタンのイベント
            const closeBtn = message.querySelector('.close-btn');
            if (closeBtn) {
                closeBtn.addEventListener('click', function() {
                    message.style.opacity = '0';
                    setTimeout(() => {
                        message.style.display = 'none';
                    }, 500);
                });
            }
        });
    }
    
    // トグルボタン機能
    const toggleButtons = document.querySelectorAll('.toggle-btn');
    if (toggleButtons.length > 0) {
        toggleButtons.forEach(btn => {
            btn.addEventListener('click', function() {
                const targetId = this.getAttribute('data-target');
                const target = document.getElementById(targetId);
                
                if (target) {
                    if (target.style.display === 'none') {
                        target.style.display = 'block';
                        this.classList.add('active');
                    } else {
                        target.style.display = 'none';
                        this.classList.remove('active');
                    }
                }
            });
        });
    }
    
    // フォームのバリデーション
    const forms = document.querySelectorAll('form[data-validate="true"]');
    if (forms.length > 0) {
        forms.forEach(form => {
            form.addEventListener('submit', function(e) {
                let isValid = true;
                
                // 必須項目のチェック
                const requiredFields = form.querySelectorAll('[required]');
                requiredFields.forEach(field => {
                    if (!field.value.trim()) {
                        isValid = false;
                        field.classList.add('error');
                        
                        // エラーメッセージの表示
                        let errorMsg = field.getAttribute('data-error-message') || '必須項目です';
                        let errorElement = document.createElement('span');
                        errorElement.className = 'field-error';
                        errorElement.textContent = errorMsg;
                        
                        // 既存のエラーメッセージを削除
                        const existingError = field.parentNode.querySelector('.field-error');
                        if (existingError) {
                            field.parentNode.removeChild(existingError);
                        }
                        
                        // エラーメッセージの追加
                        field.parentNode.appendChild(errorElement);
                    } else {
                        field.classList.remove('error');
                        const existingError = field.parentNode.querySelector('.field-error');
                        if (existingError) {
                            field.parentNode.removeChild(existingError);
                        }
                    }
                });
                
                if (!isValid) {
                    e.preventDefault();
                }
            });
        });
    }
}); 