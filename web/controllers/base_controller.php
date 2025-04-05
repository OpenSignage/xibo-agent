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
 * Xibo API エージェント - ベースコントローラー
 */

class BaseController {
    protected $viewData = [];
    
    // ビューのレンダリング
    protected function render($view, $data = []) {
        $this->viewData = array_merge($this->viewData, $data);
        extract($this->viewData);
        
        $viewFile = "views/{$view}.php";
        if (file_exists($viewFile)) {
            require_once $viewFile;
        } else {
            throw new Exception("View file not found: {$viewFile}");
        }
    }
    
    // JSONレスポンスの送信
    protected function jsonResponse($data) {
        header('Content-Type: application/json');
        echo json_encode($data);
        exit;
    }
    
    // リダイレクト
    protected function redirect($url) {
        header("Location: {$url}");
        exit;
    }
    
    // 認証チェック
    protected function requireAuth() {
        if (!isset($_SESSION[SESSION_COOKIE_NAME])) {
            $this->redirect('/auth/login');
        }
    }
} 