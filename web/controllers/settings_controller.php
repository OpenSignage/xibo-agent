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
 * Xibo API エージェント - 設定コントローラー
 */

require_once 'base_controller.php';

class SettingsController extends BaseController {
    public function __construct() {
        $this->requireAuth();
    }
    
    // 設定画面の表示
    public function index() {
        $this->render('settings/index', [
            'pageTitle' => '設定'
        ]);
    }
    
    // 設定の保存
    public function save() {
        try {
            $settings = [
                'apiUrl' => filter_input(INPUT_POST, 'apiUrl', FILTER_VALIDATE_URL),
                'apiKey' => filter_input(INPUT_POST, 'apiKey', FILTER_SANITIZE_STRING),
                'clientId' => filter_input(INPUT_POST, 'clientId', FILTER_SANITIZE_STRING),
                'clientSecret' => filter_input(INPUT_POST, 'clientSecret', FILTER_SANITIZE_STRING),
                'refreshInterval' => filter_input(INPUT_POST, 'refreshInterval', FILTER_VALIDATE_INT),
                'logLevel' => filter_input(INPUT_POST, 'logLevel', FILTER_SANITIZE_STRING)
            ];
            
            // 必須項目の検証
            $requiredFields = ['apiUrl', 'apiKey', 'clientId', 'clientSecret'];
            foreach ($requiredFields as $field) {
                if (empty($settings[$field])) {
                    throw new Exception("{$field}は必須項目です");
                }
            }
            
            // API呼び出しによる設定保存
            $response = callApi([
                'action' => 'saveSettings',
                'settings' => $settings,
                'userId' => $_SESSION[SESSION_COOKIE_NAME]['id'] ?? null
            ]);
            
            if ($response['status'] !== 'success') {
                throw new Exception($response['error'] ?? '設定の保存に失敗しました');
            }
            
            // 設定が保存されたことをセッションに記録
            $_SESSION['settings_saved'] = true;
            
            // セッション内のユーザー設定を更新
            if (isset($_SESSION[SESSION_COOKIE_NAME]['settings'])) {
                $_SESSION[SESSION_COOKIE_NAME]['settings'] = $settings;
            }
            
            $this->redirect('/settings');
            
        } catch (Exception $e) {
            $_SESSION['settings_error'] = $e->getMessage();
            $this->redirect('/settings');
        }
    }
} 