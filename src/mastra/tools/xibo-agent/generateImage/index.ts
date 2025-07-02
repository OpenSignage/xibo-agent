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
 * Xibo CMS Generation Tools
 * 
 * This module exports tools for generating content including images, videos, and QR codes.
 * It provides functionality to generate content using various APIs and libraries,
 * saving them to persistent storage and managing their history.
 */

export { generateImage } from './imageGeneration';
export { updateImage } from './imageUpdate';
export { getImageHistory } from './getImageHistory';
export * as imageHistory from './imageHistory';


