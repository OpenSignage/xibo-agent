/*
 * Copyright (C) 2024 OpenSignage Project.
 * All rights reserved.
 *
 * This software is licensed under the Elastic License 2.0 (ELv2).
 * You may obtain a copy of the license at:
 * https://www.elastic.co/licensing/elastic-license
 */

/**
 * Xibo Agent Integration Module
 * 
 * このモジュールはxibo-agentと他のツールとの統合機能を提供します。
 * 特にxibo-manualツールをxibo-agentから直接利用できるようにします。
 */

// xibo-manualツールを再エクスポート
export { xiboManualTool } from '../xibo-manual';

/**
 * 利用可能な統合ツールをすべて返します
 * 
 * 注意: 実際に使用する際には、インポート元のToolExecutionContextなどの型も
 * 含めて適切に処理する必要があります。
 */
export function getIntegrationTools() {
  const { xiboManualTool } = require('../xibo-manual');
  
  return {
    'xibo-manual': xiboManualTool,
  };
} 