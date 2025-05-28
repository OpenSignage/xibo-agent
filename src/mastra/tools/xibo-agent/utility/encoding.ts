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
 * Utility functions for encoding and decoding data
 */

/**
 * Base64 encode a string
 * 
 * @param str String to encode
 * @returns Base64 encoded string
 */
export function base64Encode(str: string): string {
  return Buffer.from(str).toString('base64');
}

/**
 * Base64 decode a string
 * 
 * @param str Base64 encoded string to decode
 * @returns Decoded string
 */
export function base64Decode(str: string): string {
  return Buffer.from(str, 'base64').toString();
} 