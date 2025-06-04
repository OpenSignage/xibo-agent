/*
 * Copyright (C) 2024 OpenSignage Project.
 * All rights reserved.
 *
 * This software is licensed under the Elastic License 2.0 (ELv2).
 * You may obtain a copy of the license at:
 * https://www.elastic.co/licensing/elastic-license
 */

/**
 * API Configuration
 * This file contains configuration settings for the API
 */

// デフォルトの設定
const defaultConfig = {
  upload: {
    maxFileSize: 4 * 1024 * 1024 * 1024, // 4GB
    allowedTypes: {
      image: [
        'image/jpeg',
        'image/png',
        'image/gif',
        'image/webp',
        'image/bmp',
        'image/svg+xml'
      ],
      video: [
        'video/mp4',
        'video/webm',
        'video/x-ms-wmv',
        'video/x-msvideo',
        'video/quicktime'
      ],
      font: [
        'font/ttf',
        'font/otf',
        'font/eot',
        'font/woff',
        'font/woff2',
        'application/x-font-ttf',
        'application/x-font-otf',
        'application/x-font-eot',
        'application/x-font-woff',
        'application/x-font-woff2'
      ],
      document: [
        'application/pdf',
        'application/vnd.ms-powerpoint',
        'application/vnd.openxmlformats-officedocument.presentationml.presentation'
      ]
    },
    allowedExtensions: {
      image: ['.jpg', '.jpeg', '.png', '.bmp', '.gif', '.webp', '.svg'],
      video: ['.mp4', '.webm', '.wmv', '.avi'],
      font: ['.ttf', '.otf', '.eot', '.svg', '.woff', '.woff2'],
      document: ['.pdf', '.ppt', '.pptx']
    }
  }
} as const;

// 環境変数から設定を読み込む
export const config = {
  upload: {
    maxFileSize: process.env.MAX_FILE_SIZE 
      ? parseInt(process.env.MAX_FILE_SIZE) 
      : defaultConfig.upload.maxFileSize,
    allowedTypes: {
      image: process.env.ALLOWED_IMAGE_TYPES 
        ? process.env.ALLOWED_IMAGE_TYPES.split(',') 
        : defaultConfig.upload.allowedTypes.image,
      video: process.env.ALLOWED_VIDEO_TYPES 
        ? process.env.ALLOWED_VIDEO_TYPES.split(',') 
        : defaultConfig.upload.allowedTypes.video,
      font: process.env.ALLOWED_FONT_TYPES 
        ? process.env.ALLOWED_FONT_TYPES.split(',') 
        : defaultConfig.upload.allowedTypes.font,
      document: process.env.ALLOWED_DOCUMENT_TYPES 
        ? process.env.ALLOWED_DOCUMENT_TYPES.split(',') 
        : defaultConfig.upload.allowedTypes.document
    },
    allowedExtensions: {
      image: process.env.ALLOWED_IMAGE_EXTENSIONS 
        ? process.env.ALLOWED_IMAGE_EXTENSIONS.split(',') 
        : defaultConfig.upload.allowedExtensions.image,
      video: process.env.ALLOWED_VIDEO_EXTENSIONS 
        ? process.env.ALLOWED_VIDEO_EXTENSIONS.split(',') 
        : defaultConfig.upload.allowedExtensions.video,
      font: process.env.ALLOWED_FONT_EXTENSIONS 
        ? process.env.ALLOWED_FONT_EXTENSIONS.split(',') 
        : defaultConfig.upload.allowedExtensions.font,
      document: process.env.ALLOWED_DOCUMENT_EXTENSIONS 
        ? process.env.ALLOWED_DOCUMENT_EXTENSIONS.split(',') 
        : defaultConfig.upload.allowedExtensions.document
    }
  }
} as const;

export type Config = typeof config; 