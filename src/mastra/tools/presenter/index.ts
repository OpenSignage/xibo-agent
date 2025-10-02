/*
 * Copyright (C) 2025 Open Source Digital Signage Initiative.
 *
 * You can redistribute it and/or modify
 * it under the terms of the Elastic License 2.0 (ELv2) as published by
 * the Search AI Company, either version 3 of the License, or
 * any later version.
 *
 * You should have received a copy of the Elastic License 2.0 (ELv2).
 * see <https://www.elastic.co/licensing/elastic-license>.
 */
/**
 * Presenter tools index
 * Exports a set of tools used for generating presentation assets
 * (charts, PPTX documents, images, narration audio, and videos).
 */
export { generateChartTool } from './generateChart';
export { createPowerpointTool } from './createPowerpoint';
export { generateTemplateAiTool } from './generateTemplateAi';
export { createNarrationWavTool } from './createNarrationWav';
export { createPresentationVideoTool } from './createPresentationVideo';
export { generateImage } from './generateImage';
