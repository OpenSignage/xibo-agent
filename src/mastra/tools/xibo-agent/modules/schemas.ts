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
 * @module moduleSchemas
 * @description This module contains shared Zod schemas for Xibo module tools,
 * defining the structure of module and property data.
 */
import { z } from 'zod';

/**
 * Schema for a single module property.
 */
export const propertySchema = z.object({
  id: z.string().describe('The property ID.'),
  type: z.string().describe('The type of the property field.'),
  title: z.string().nullable().describe('The display title for the property.'),
  helpText: z.string().nullable().describe('Help text for the property.'),
  options: z.array(z.any()).optional().nullable().describe('Available options for dropdowns or selects.'),
  default: z.any().optional().nullable().describe('An optional default value for the property.'),
});

/**
 * Schema for the full module structure, based on the GET /module API response.
 */
export const moduleSchema = z.object({
  moduleId: z.union([z.string(), z.number()]).nullable().describe('The ID of the module (can be string or number). Note: This can be null in API responses.'),
  name: z.string().nullable().describe('The name of the module.'),
  author: z.string().nullable().describe('The author of the module.'),
  description: z.string().nullable().describe('A description of the module.'),
  icon: z.string().nullable().describe('An icon for the module.'),
  type: z.string().nullable().describe('The type code for this module (e.g., "text", "image").'),
  legacyTypes: z.array(z.union([z.string(), z.object({})])).nullable().describe('Legacy type codes for this module.'),
  dataType: z.string().nullable().describe('The data type expected by the module (if any).'),
  group: z.union([z.array(z.string()), z.object({})]).nullable().describe('Grouping details for the module.'),
  dataCacheKey: z.string().nullable().describe('The cache key used when requesting data.'),
  fallbackData: z.coerce.number().describe('Flag indicating if fallback data is allowed.'),
  regionSpecific: z.coerce.number().describe('Flag indicating if the module is specific to a Layout.'),
  schemaVersion: z.coerce.number().describe('The schema version of the module.'),
  compatibilityClass: z.string().nullable().describe('The compatibility class of the module.'),
  showIn: z.string().nullable().describe('Indicates where the module should be shown.'),
  assignable: z.coerce.number().describe('Flag indicating if the module is assignable to a Layout.'),
  hasThumbnail: z.coerce.number().describe('Flag indicating if the module has a thumbnail.'),
  thumbnail: z.string().nullable().describe('Path to the module thumbnail.'),
  renderAs: z.string().nullable().describe('Rendering mode (native or html).'),
  class: z.string().nullable().describe('The module class name.'),
  validatorClass: z.array(z.string()).nullable().describe('Validator class name.'),
  properties: z.array(propertySchema).nullable().describe('Properties to display in the editor.'),
  onInitialize: z.string().nullable().describe('JavaScript function run on initialization.'),
  onParseData: z.string().nullable().describe('JavaScript function for parsing data.'),
  onDataLoad: z.string().nullable().describe('JavaScript function run on data load.'),
  onRender: z.string().nullable().describe('JavaScript function run on render.'),
  onVisible: z.string().nullable().describe('JavaScript function run when visible.'),
  sampleData: z.any().nullable().describe('Optional sample data for the module.'),
  enabled: z.coerce.number().describe('Flag indicating if the module is enabled.'),
  previewEnabled: z.coerce.number().describe('Flag indicating if preview is enabled.'),
  defaultDuration: z.coerce.number().describe('The default duration in seconds.'),
  settings: z.array(propertySchema).nullable().describe('An array of additional module-specific settings.'),
  propertyGroups: z.array(z.string()).nullable().describe('An array of property groups.'),
  requiredElements: z.array(z.string()).nullable().describe('An array of required elements.'),
  isInstalled: z.boolean().describe('Flag indicating if the module is installed.'),
  isError: z.boolean().describe('Flag indicating if the module has an error state.'),
  errors: z.array(z.string()).nullable().describe('An array of errors for this module.'),
});

/**
 * Schema for the 'stencil' object within a module template.
 */
const stencilSchema = z.object({
  elementGroups: z.array(z.any()).optional(),
}).nullable();

/**
 * Schema for the 'extends' object, defining template inheritance.
 */
const extendsSchema = z.object({
  templateId: z.string().optional(),
  type: z.string().optional(),
}).nullable();

/**
 * Schema for the main module template structure.
 */
export const moduleTemplateSchema = z.object({
  templateId: z.string().describe('The ID of the template.'),
  type: z.string().describe('The type of the template (e.g., "static", "element").'),
  extends: extendsSchema.describe('Defines if this template extends another.'),
  dataType: z.string().describe('The data type this template is for.'),
  title: z.string().describe('The title of the template.'),
  description: z.string().nullable().describe('A description of the template.'),
  icon: z.string().nullable().describe('An icon for the template.'),
  thumbnail: z.string().nullable().describe('A thumbnail for the template.'),
  showIn: z.string().nullable().describe('Indicates where the template should be shown.'),
  properties: z.array(propertySchema).describe('An array of properties for this template.'),
  isVisible: z.boolean().describe('Flag indicating if the template is visible.'),
  isEnabled: z.boolean().describe('Flag indicating if the template is enabled.'),
  propertyGroups: z.array(z.string()).describe('An array of property groups.'),
  stencil: stencilSchema.describe('A stencil, if needed.'),
  assets: z.array(z.any()).describe('An array of assets used by the template.'),
  groupsWithPermissions: z.string().nullable().describe('A comma-separated list of groups/users with permissions.'),
}); 