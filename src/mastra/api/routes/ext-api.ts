/*
 * Copyright (C) 2024 OpenSignage Project.
 * All rights reserved.
 *
 * This software is licensed under the Elastic License 2.0 (ELv2).
 * You may obtain a copy of the license at:
 * https://www.elastic.co/licensing/elastic-license
 */

import { Hono } from 'hono';
import { helloHandler } from '../handlers/hello';
import { getImageHandler } from '../handlers/getImage';
import { getVideoHandler } from '../handlers/getVideo';
import { swaggerHandler } from '../handlers/swagger';
import { getFontImageHandler } from '../handlers/getFontImage';

const router = new Hono();

// Swagger UI
router.get('/swagger-ui', swaggerHandler);

// Hello World API
router.get('/hello', helloHandler);

// Get Image API
router.get('/getImage/:filename', getImageHandler);

// Get Video API
router.get('/getVideo/:filename', getVideoHandler);

// Get Font Image API
router.get('/getFontImage/:filename', getFontImageHandler);

export default router; 