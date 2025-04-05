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