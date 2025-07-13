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
 * Utility functions for error handling in Xibo CMS tools
 */

/**
 * Function to decode URL-encoded JSON error messages
 * 
 * @param text Response text that may contain URL-encoded messages
 * @returns Decoded text with readable error messages
 */
export function decodeErrorMessage(text: string): string {
  try {
    // Try to parse as JSON
    const errorObj = JSON.parse(text);
    
    // Decode the message property if exists
    if (errorObj.message && typeof errorObj.message === 'string') {
      try {
        errorObj.message = decodeURIComponent(errorObj.message);
      } catch (e) {
        // If decoding fails, keep original message
      }
      return JSON.stringify(errorObj);
    }
    
    return text;
  } catch (e) {
    // If not valid JSON, return as is
    return text;
  }
}

/**
 * Processes an unknown error object and returns a serializable error representation.
 *
 * @param error The unknown error object to process.
 * @returns A serializable object containing the error details.
 */
export function processError(error: unknown): { name: string; message: string; stack?: string } {
  if (error instanceof Error) {
    return {
      name: error.name,
      message: error.message,
      stack: error.stack,
    };
  }
  return {
    name: "UnknownError",
    message: typeof error === "string" ? error : JSON.stringify(error),
  };
} 