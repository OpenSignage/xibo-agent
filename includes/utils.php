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
 * Xibo API エージェント - 共通ユーティリティ関数
 */

/**
 * デバッグログを記録する
 * @param string $message ログメッセージ
 * @param mixed $data 追加データ（省略可）
 * @param string $level ログレベル（debug, info, warning, error）
 * @return void
 */
function debugLog($message, $data = null, $level = 'debug') {
    if (!defined('DEBUG_MODE') || !DEBUG_MODE) {
        return;
    }
    
    $logDir = __DIR__ . '/../logs';
    if (!is_dir($logDir)) {
        mkdir($logDir, 0755, true);
    }
    
    $logFile = $logDir . '/debug.log';
    $timestamp = date('Y-m-d H:i:s');
    $logLevel = strtoupper($level);
    
    $logMessage = "[{$timestamp}] [{$logLevel}] {$message}";
    if ($data !== null) {
        $logMessage .= "\n" . print_r($data, true);
    }
    $logMessage .= "\n";
    
    file_put_contents($logFile, $logMessage, FILE_APPEND);
}

/**
 * エラーログを記録する
 * @param string $message エラーメッセージ
 * @param mixed $data 追加データ（省略可）
 * @return void
 */
function errorLog($message, $data = null) {
    debugLog($message, $data, 'error');
}

/**
 * 情報ログを記録する
 * @param string $message 情報メッセージ
 * @param mixed $data 追加データ（省略可）
 * @return void
 */
function infoLog($message, $data = null) {
    debugLog($message, $data, 'info');
}

/**
 * 警告ログを記録する
 * @param string $message 警告メッセージ
 * @param mixed $data 追加データ（省略可）
 * @return void
 */
function warningLog($message, $data = null) {
    debugLog($message, $data, 'warning');
} 