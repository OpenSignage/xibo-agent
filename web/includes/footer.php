<?php
/**
 * Xibo API エージェント - フッター
 */

// 直接アクセス禁止
if (!defined('BASE_PATH')) {
    http_response_code(403);
    exit('直接アクセスは禁止されています');
}
?>
        </div><!-- .container -->
    </main><!-- .main-content -->
    
    <footer class="main-footer">
        <div class="container">
            <p>&copy; <?php echo date('Y'); ?> Xibo API エージェント</p>
        </div>
    </footer>
    
    <!-- 基本JavaScript -->
    <script src="<?php echo BASE_PATH; ?>/assets/js/common.js"></script>
    
    <!-- 追加JavaScript -->
    <?php foreach ($extraScripts as $script): ?>
    <script src="<?php echo $script; ?>"></script>
    <?php endforeach; ?>
</body>
</html> 