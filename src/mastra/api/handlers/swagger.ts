/*
 * Copyright (C) 2024 OpenSignage Project.
 * All rights reserved.
 *
 * This software is licensed under the Elastic License 2.0 (ELv2).
 * You may obtain a copy of the license at:
 * https://www.elastic.co/licensing/elastic-license
 */

/**
 * Swagger UI Handler
 * Serves the Swagger UI interface with embedded OpenAPI specification
 * URL: /ext-api/swagger-ui
 * 
 * The handler:
 * 1. Reads the OpenAPI specification from public/openapi.json
 * 2. Embeds the specification into the Swagger UI HTML
 * 3. Serves the complete HTML page with Swagger UI from CDN
 */

import { Context } from 'hono';
import * as fs from 'fs';
import * as path from 'path';
import { logger } from '../logger';

export const swaggerHandler = async (c: Context) => {
  try {
    // Read OpenAPI specification from the project root
    const specPath = path.join(process.cwd(), '../../public/openapi.json');
    const openApiSpec = JSON.parse(fs.readFileSync(specPath, 'utf-8'));

    // Generate HTML with embedded OpenAPI spec and Swagger UI from CDN
    const html = `
      <!DOCTYPE html>
      <html>
        <head>
          <title>Xibo Agent API</title>
          <link rel="stylesheet" type="text/css" href="https://unpkg.com/swagger-ui-dist@5.11.0/swagger-ui.css" />
          <script src="https://unpkg.com/swagger-ui-dist@5.11.0/swagger-ui-bundle.js"></script>
        </head>
        <body>
          <div id="swagger-ui"></div>
          <script>
            window.onload = () => {
              const spec = ${JSON.stringify(openApiSpec)};
              SwaggerUIBundle({
                spec: spec,
                dom_id: '#swagger-ui',
                deepLinking: true,
                presets: [
                  SwaggerUIBundle.presets.apis,
                  SwaggerUIBundle.SwaggerUIStandalonePreset
                ],
              });
            };
          </script>
        </body>
      </html>
    `;
    return c.html(html);
  } catch (error) {
    logger.error('Swagger UI: Failed to load OpenAPI specification:', { error: error instanceof Error ? error.message : String(error) });
    return c.json({ error: 'Failed to load API documentation' }, 500);
  }
}; 