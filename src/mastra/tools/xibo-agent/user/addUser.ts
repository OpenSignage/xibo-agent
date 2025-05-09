/*
 * Copyright (C) 2025 Open Source Digital Signage Initiative.
 *
 * You can redistribute it and/or modify
 * it under the terms of the Elastic License 2.0 (ELv2) as published by
 * the Search AI Company, either version 3 of the License, or
 * any later version.
 *
 * You should have received a copy of the GElastic License 2.0 (ELv2).
 * see <https://www.elastic.co/licensing/elastic-license>.
 */

/**
 * Xibo CMS User Creation Tool
 * 
 * This module provides functionality to create new users in the Xibo CMS system.
 * It implements the user creation API endpoint and handles the necessary validation
 * and data transformation for creating users with appropriate permissions and settings.
 */

import { z } from "zod";
import { createTool } from "@mastra/core/tools";
import { config } from "../config";
import { getAuthHeaders } from "../auth";
import { logger } from '../../../index';

/**
 * Schema for user data returned from the API
 * 
 * This defines the structure of user data as returned from Xibo CMS
 * after successfully creating a new user.
 */
const userSchema = z.object({
  userId: z.number(),
  userName: z.string(),
  email: z.string().optional().nullable(),
  userTypeId: z.number(),
  homePageId: z.number(),
  homeFolderId: z.number(),
  lastAccessed: z.string().nullable(),
  newUserWizard: z.number(),
  retired: z.number(),
  isPasswordChangeRequired: z.number(),
  groupId: z.number(),
  group: z.string(),
  libraryQuota: z.number(),
  firstName: z.string().nullable(),
  lastName: z.string().nullable(),
  phone: z.string().nullable(),
  ref1: z.string().nullable(),
  ref2: z.string().nullable(),
  ref3: z.string().nullable(),
  ref4: z.string().nullable(),
  ref5: z.string().nullable(),
  isSystemNotification: z.number(),
  isDisplayNotification: z.number(),
  isDataSetNotification: z.number(),
  isLayoutNotification: z.number(),
  isLibraryNotification: z.number(),
  isReportNotification: z.number(),
  isScheduleNotification: z.number(),
  isCustomNotification: z.number(),
  twoFactorTypeId: z.number(),
  homeFolder: z.string(),
  // Added arrays as empty arrays are expected
  groups: z.array(z.any()),
  campaigns: z.array(z.any()),
  layouts: z.array(z.any()),
  media: z.array(z.any()),
  events: z.array(z.any()),
  playlists: z.array(z.any()),
  displayGroups: z.array(z.any()),
  dayParts: z.array(z.any()),
});

/**
 * Schema for API response after creating a user
 */
const apiResponseSchema = z.object({
  success: z.boolean().optional(),
  data: userSchema.optional(),
  id: z.number().optional(), // Some endpoints might return just an ID
  status: z.number().optional(),
  message: z.string().optional(),
  error: z.number().optional(),
}).or(userSchema); // Handle case where response is directly the user object

/**
 * Create a safe version of data for logging without sensitive information
 * 
 * @param data The original data object
 * @returns A copy with password replaced by asterisks
 */
function getSafeDataForLogging(data: any): any {
  if (!data) return data;
  const safeCopy = { ...data };
  if (safeCopy.password) {
    safeCopy.password = '********';
  }
  return safeCopy;
}

/**
 * Base64 encode a string
 * 
 * @param str String to encode
 * @returns Base64 encoded string
 */
function base64Encode(str: string): string {
  return Buffer.from(str).toString('base64');
}

/**
 * Tool for creating new users in Xibo CMS
 * 
 * This tool accepts user details and creates a new user account
 * with appropriate permissions based on the userTypeId.
 * Default values are provided for common settings.
 */
export const addUser = createTool({
  id: "add-user",
  description: "Add a new user to Xibo CMS",
  inputSchema: z.object({
    userName: z.string(),
    email: z.string().optional(),
    userTypeId: z.number().default(3),
    homePageId: z.number().default(1),
    password: z.string(),
    groupId: z.number().default(1),
    newUserWizard: z.number().default(0),
    hideNavigation: z.number().default(0),
    // 以下は必須でないためコメントアウト
    // firstName: z.string().optional(),
    // lastName: z.string().optional(),
    // libraryQuota: z.number().default(4096),
    // isPasswordChangeRequired: z.number().optional().default(0)
  }),
  outputSchema: apiResponseSchema,
  execute: async ({ context }) => {
    if (!config.cmsUrl) {
      throw new Error("CMS URL is not configured");
    }

    // Use the standard API endpoint
    const url = new URL(`${config.cmsUrl}/api/user`);
    
    // ユーザー名を一意にするためにタイムスタンプを追加
    const uniqueUserName = `${context.userName}_${Date.now()}`;
    logger.info(`Creating new user with unique name: ${uniqueUserName}`);

    try {
      // すべての必須パラメータを含むリクエストデータを作成
      const requestData: Record<string, string | number> = {
        userName: uniqueUserName,  // タイムスタンプを含む一意のユーザー名を使用
        userTypeId: context.userTypeId,
        homePageId: context.homePageId,
        password: context.password,
        groupId: context.groupId,
        newUserWizard: context.newUserWizard,
        hideNavigation: context.hideNavigation,
      };
      
      // オプションパラメータがある場合は追加
      if (context.email) {
        requestData.email = context.email;
      }
      
      // Get authentication headers（getUser.tsと同様に設定）
      const headers = await getAuthHeaders();
      
      // ドキュメントの指示通りにContent-Typeヘッダーを追加
      const requestHeaders = {
        ...headers,
        'Content-Type': 'application/x-www-form-urlencoded'
      };
      
      // URLSearchParamsを使用してフォームデータを作成
      const formData = new URLSearchParams();
      for (const [key, value] of Object.entries(requestData)) {
        formData.append(key, String(value));
      }
      
      // 変換前と変換後のデータをログに出力
      logger.info(`Original request data: ${JSON.stringify(getSafeDataForLogging(requestData))}`);
      // 実際に送信されるフォームデータの形式をログに出力
      const formDataString = formData.toString();
      logger.info(`Form data being sent: ${formDataString.replace(/password=[^&]*/, 'password=********')}`);
      
      // Submit request to Xibo CMS API - Content-Typeヘッダーを含める
      logger.info(`Sending request to ${url.toString()}`);
      const response = await fetch(url.toString(), {
        method: "POST",
        headers: requestHeaders,  // Content-Typeを含むヘッダーを使用
        body: formDataString,
      });

      // Debug the request (safely)
      logger.info(`Request sent with headers: ${JSON.stringify(requestHeaders)}`);
      
      // Log the complete response
      const responseText = await response.text();
      logger.info(`Complete response: ${responseText}`);
      
      // Check if response is successful
      if (!response.ok) {
        // 詳細なエラー情報の取得を試みる
        try {
          const errorData = JSON.parse(responseText);
          
          // 特に422エラー（バリデーションエラー）の場合は詳細を記録
          if (response.status === 422 && errorData.error) {
            logger.error(`バリデーションエラー: ${errorData.error.message}`, {
              status: response.status,
              url: url.toString(),
              userName: context.userName,
              errorDetails: errorData.error,
              requestData: formDataString.replace(/password=[^&]*/, 'password=********')
            });
          } else {
            logger.error(`Failed to create user: ${responseText}`, { 
              status: response.status,
              url: url.toString(),
              userName: context.userName,
              email: context.email,
              requestData: formDataString.replace(/password=[^&]*/, 'password=********')
            });
          }
        } catch (parseError) {
          // JSONパースに失敗した場合は元のエラーメッセージを記録
          logger.error(`Failed to create user: ${responseText}`, { 
            status: response.status,
            url: url.toString(),
            userName: context.userName,
            email: context.email,
            requestData: formDataString.replace(/password=[^&]*/, 'password=********')
          });
        }
        
        throw new Error(`HTTP error! status: ${response.status}, message: ${responseText}`);
      }

      // If response is empty or no content
      if (!responseText || responseText.trim() === '') {
        logger.info('Server returned empty response but status was OK');
        // Return a minimal successful response
        return { 
          success: true,
          data: {
            userId: 0,
            userName: context.userName,
            // Fill in minimal required fields
            email: context.email,
            userTypeId: context.userTypeId,
            homePageId: context.homePageId,
            homeFolderId: 1,
            lastAccessed: null,
            newUserWizard: 0,
            retired: 0,
            isPasswordChangeRequired: 0,
            groupId: 0,
            group: context.userName,
            libraryQuota: 4096,
            firstName: null,
            lastName: null,
            phone: null,
            ref1: null,
            ref2: null,
            ref3: null,
            ref4: null,
            ref5: null,
            isSystemNotification: 0,
            isDisplayNotification: 0,
            isDataSetNotification: 0,
            isLayoutNotification: 0,
            isLibraryNotification: 0,
            isReportNotification: 0,
            isScheduleNotification: 0,
            isCustomNotification: 0,
            twoFactorTypeId: 0,
            homeFolder: "/",
            groups: [],
            campaigns: [],
            layouts: [],
            media: [],
            events: [],
            playlists: [],
            displayGroups: [],
            dayParts: []
          }
        };
      }

      // Try to parse the response as JSON
      try {
        const rawData = JSON.parse(responseText);
        
        // Log the parsed data for debugging
        logger.info(`Parsed response data: ${JSON.stringify(rawData)}`);
        
        // Try to validate with our schema
        try {
          const validatedData = apiResponseSchema.parse(rawData);
          logger.info(`User created successfully`);
          return validatedData;
        } catch (validationError) {
          logger.warn(`Response validation failed: ${validationError instanceof Error ? validationError.message : "Unknown error"}`, { 
            responseData: rawData 
          });
          
          // Return the raw data even if it doesn't match our exact schema
          return rawData;
        }
      } catch (parseError) {
        logger.error(`Failed to parse JSON response: ${parseError instanceof Error ? parseError.message : "Unknown error"}`, { 
          responseText,
          parseError 
        });
        throw new Error(`Invalid JSON response from server: ${parseError instanceof Error ? parseError.message : "Unknown error"}`);
      }
    } catch (error) {
      logger.error(`addUser: An error occurred: ${error instanceof Error ? error.message : "Unknown error"}`, { error });
      throw error;
    }
  },
});

export default addUser; 