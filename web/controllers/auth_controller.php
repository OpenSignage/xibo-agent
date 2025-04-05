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
 * Xibo API エージェント - 認証コントローラー
 */

require_once 'base_controller.php';

class AuthController extends BaseController {
    // ログイン画面の表示
    public function login() {
        if (isset($_SESSION[SESSION_COOKIE_NAME])) {
            $this->redirect('/');
        }
        
        $error = '';
        if ($_SERVER['REQUEST_METHOD'] === 'POST') {
            $username = $_POST['username'] ?? '';
            $password = $_POST['password'] ?? '';
            
            if (empty($username) || empty($password)) {
                $error = 'ユーザー名とパスワードを入力してください';
            } else {
                $response = callApi([
                    'action' => 'login',
                    'username' => $username,
                    'password' => $password
                ]);
                
                if ($response['status'] === 'success') {
                    $_SESSION[SESSION_COOKIE_NAME] = $response['user'] ?? ['username' => $username];
                    $this->redirect('/');
                } else {
                    $error = $response['error'] ?? 'ログインに失敗しました';
                }
            }
        }
        
        $this->render('auth/login', ['error' => $error]);
    }
    
    // ユーザー登録画面の表示
    public function register() {
        if (isset($_SESSION[SESSION_COOKIE_NAME])) {
            $this->redirect('/');
        }
        
        $error = '';
        $success = false;
        
        if ($_SERVER['REQUEST_METHOD'] === 'POST') {
            $username = $_POST['username'] ?? '';
            $email = $_POST['email'] ?? '';
            $password = $_POST['password'] ?? '';
            
            if (empty($username) || empty($email) || empty($password)) {
                $error = 'すべての項目を入力してください';
            } elseif (strlen($password) < 8) {
                $error = 'パスワードは8文字以上である必要があります';
            } elseif (!filter_var($email, FILTER_VALIDATE_EMAIL)) {
                $error = '有効なメールアドレスを入力してください';
            } else {
                $response = callApi([
                    'action' => 'register',
                    'username' => $username,
                    'email' => $email,
                    'password' => $password
                ]);
                
                if ($response['status'] === 'success') {
                    $success = true;
                    if (isset($response['user'])) {
                        $_SESSION[SESSION_COOKIE_NAME] = $response['user'];
                        $this->redirect('/');
                    }
                } else {
                    $error = $response['error'] ?? '登録に失敗しました';
                }
            }
        }
        
        $this->render('auth/register', [
            'error' => $error,
            'success' => $success
        ]);
    }
    
    // ログアウト処理
    public function logout() {
        session_unset();
        session_destroy();
        callApi(['action' => 'logout']);
        $this->redirect('/auth/login');
    }
} 