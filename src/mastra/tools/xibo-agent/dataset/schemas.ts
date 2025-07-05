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
 * @module DataSetSchemas
 * @description Provides shared Zod schemas for dataset-related tools in the Xibo Agent.
 */
import { z } from "zod";

/**
 * Schema for a Xibo CMS DataSet.
 * This represents the structure of a dataset, including its properties and configuration.
 */
export const dataSetSchema = z.object({
  dataSetId: z.number().describe("The unique identifier for the dataset."),
  dataSet: z.string().describe("The name of the dataset."),
  description: z.string().nullable().describe("A description for the dataset."),
  code: z.string().nullable().describe("A code for the dataset, used for filtering."),
  isRemote: z.boolean().optional().describe("Flag indicating if the dataset is remote."),
  method: z.string().optional().describe("The HTTP method for remote datasets (e.g., GET, POST)."),
  uri: z.string().optional().describe("The URI for the remote data source."),
  postData: z.string().optional().describe("The data to send with a POST request for remote datasets."),
  authentication: z.string().optional().describe("Authentication details for the remote source."),
  username: z.string().optional().describe("Username for remote authentication."),
  password: z.string().optional().describe("Password for remote authentication."),
  refreshRate: z.number().optional().describe("The refresh rate in seconds for the remote dataset."),
  clearRate: z.number().optional().describe("The rate at which old data is cleared."),
  runsAfter: z.string().nullable().describe("Specifies when the dataset synchronization runs."),
  dataRoot: z.string().nullable().describe("The root element in the remote data source."),
  lastSync: z.string().nullable().describe("The timestamp of the last synchronization."),
  isProcessed: z.boolean().optional().describe("Flag indicating if the dataset has been processed."),
  remoteUrl: z.string().nullable().describe("The full URL for the remote data source."),
  settings: z.string().nullable().describe("Additional settings for the dataset."),
}).catchall(z.any());

/**
 * Schema for a Xibo CMS DataSet Column.
 * This represents a single column within a dataset.
 */
export const dataSetColumnSchema = z.object({
  dataSetColumnId: z.number().describe("The unique identifier for the dataset column."),
  dataSetId: z.number().describe("The ID of the dataset this column belongs to."),
  heading: z.string().describe("The heading/name of the column."),
  dataTypeId: z.number().describe("The ID representing the data type of the column."),
  listContent: z.string().nullable().describe("Content for list-based data types."),
  columnOrder: z.number().optional().describe("The display order of the column."),
  formula: z.string().nullable().describe("A formula used to calculate the column's value."),
  remoteField: z.string().nullable().describe("The field name in the remote data source."),
  showFilter: z.boolean().optional().describe("Flag to show a filter for this column."),
  showSort: z.boolean().optional().describe("Flag to enable sorting for this column."),
}).catchall(z.any());

/**
 * Schema for a row of data within a Xibo CMS DataSet.
 */
export const dataSetDataSchema = z.object({
  id: z.number().optional().describe("The unique identifier for the data row (if it exists)."),
  dataSetId: z.number().describe("The ID of the dataset this data belongs to."),
  rowData: z.record(z.string(), z.any()).describe("An object representing the row data, with column headings as keys."),
}); 