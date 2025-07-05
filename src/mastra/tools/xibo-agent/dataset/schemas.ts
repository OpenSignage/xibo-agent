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
  isRemote: z.preprocess((val) => !!val, z.boolean()).optional().describe("Flag indicating if the dataset is remote."),
  method: z.string().nullable().optional().describe("The HTTP method for remote datasets (e.g., GET, POST)."),
  uri: z.string().nullable().optional().describe("The URI for the remote data source."),
  postData: z.string().nullable().optional().describe("The data to send with a POST request for remote datasets."),
  authentication: z.string().nullable().optional().describe("Authentication details for the remote source."),
  username: z.string().nullable().optional().describe("Username for remote authentication."),
  password: z.string().nullable().optional().describe("Password for remote authentication."),
  refreshRate: z.number().nullable().optional().describe("The refresh rate in seconds for the remote dataset."),
  clearRate: z.number().nullable().optional().describe("The rate at which old data is cleared."),
  runsAfter: z.union([z.string(), z.number()]).nullable().describe("Specifies when the dataset synchronization runs."),
  dataRoot: z.string().nullable().describe("The root element in the remote data source."),
  lastSync: z.union([z.string(), z.number()]).nullable().describe("The timestamp of the last synchronization."),
  isProcessed: z.preprocess((val) => !!val, z.boolean()).optional().describe("Flag indicating if the dataset has been processed."),
  remoteUrl: z.string().nullable().optional().describe("The full URL for the remote data source."),
  settings: z.string().nullable().optional().describe("Additional settings for the dataset."),
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
  dataSetColumnTypeId: z.number().nullable().optional().describe("The ID of the column type."),
  listContent: z.string().nullable().describe("Content for list-based data types."),
  columnOrder: z.number().optional().describe("The display order of the column."),
  formula: z.string().nullable().describe("A formula used to calculate the column's value."),
  dataType: z.string().nullable().optional().describe("The name of the data type."),
  remoteField: z.string().nullable().describe("The field name in the remote data source."),
  showFilter: z.number().nullable().optional().describe("Flag to show a filter for this column (0 or 1)."),
  showSort: z.number().nullable().optional().describe("Flag to enable sorting for this column (0 or 1)."),
  dataSetColumnType: z.string().nullable().optional().describe("The name of the column type."),
  tooltip: z.string().nullable().optional().describe("Help text displayed when entering data."),
  isRequired: z.number().nullable().optional().describe("Flag indicating if a value is required."),
  dateFormat: z.string().nullable().optional().describe("PHP date format for remote date sources."),
}).catchall(z.any());

/**
 * Schema for a row of data within a Xibo CMS DataSet.
 * This represents a single row as a flat object where keys are column headings.
 */
export const dataSetDataSchema = z.object({
  id: z.number().describe("The unique identifier for the data row."),
}).catchall(z.any());

/**
 * Schema for a Xibo CMS DataSet RSS feed.
 * This represents the configuration and status of an RSS feed associated with a dataset.
 */
export const dataSetRssSchema = z.object({
  rssId: z.number().describe("The ID of the RSS feed."),
  title: z.string().describe("The title of the RSS feed."),
  url: z.string().url().optional().describe("The URL to the RSS feed, if externally sourced."),
  cacheTimeout: z.number().nullable().optional().describe("The cache timeout in seconds."),
  lastSync: z.string().nullable().optional().describe("Timestamp of the last sync."),
  lastSyncStatus: z.number().nullable().optional().describe("Status code of the last sync."),
  lastSyncMessage: z.string().nullable().optional().describe("Message from the last sync."),
  summaryColumnId: z.number().optional().describe("The columnId used as each item's summary."),
  contentColumnId: z.number().optional().describe("The columnId used as each item's content."),
  publishedDateColumnId: z.number().optional().describe("The columnId used as each item's published date."),
}).catchall(z.any());

/**
 * Schema for a Xibo CMS DataSet Connector.
 * This defines the configuration and status for a data connector linked to a dataset.
 */
export const dataSetConnectorSchema = z.object({
  dataSetId: z.number().describe("The ID of the dataset."),
  dataSet: z.string().describe("The name of the dataset."),
  description: z.string().nullable().optional().describe("The description for the dataset."),
  userId: z.number().describe("The ID of the user who owns the dataset."),
  lastDataEdit: z.number().nullable().optional().describe("Timestamp of the last data edit."),
  owner: z.string().describe("The name of the owner."),
  groupsWithPermissions: z.string().nullable().optional().describe("Groups with permissions."),
  code: z.string().nullable().optional().describe("A code for the dataset."),
  isLookup: z.number().describe("Flag indicating if the dataset is a lookup table (0 or 1)."),
  isRemote: z.number().describe("Flag indicating if the dataset uses a remote data source (0 or 1)."),
  isRealTime: z.number().describe("Flag indicating if the dataset is a real-time dataset (0 or 1)."),
  dataConnectorSource: z.string().nullable().optional().describe("The source of the data connector."),
  method: z.string().nullable().optional().describe("The HTTP method for remote requests (e.g., 'GET', 'POST')."),
  uri: z.string().nullable().optional().describe("The URI for the remote data source."),
  postData: z.string().nullable().optional().describe("The POST data for remote requests."),
  authentication: z.string().nullable().optional().describe("The authentication method."),
  username: z.string().nullable().optional().describe("The username for authentication."),
  password: z.string().nullable().optional().describe("The password for authentication."),
  customHeaders: z.string().nullable().optional().describe("Custom HTTP headers for the request."),
  userAgent: z.string().nullable().optional().describe("The user agent for the request."),
  refreshRate: z.number().describe("The refresh rate in seconds."),
  clearRate: z.number().describe("The clear rate in seconds."),
  truncateOnEmpty: z.number().describe("Flag to truncate the dataset if the remote source returns no data (0 or 1)."),
  runsAfter: z.number().describe("The ID of another data connector that should run before this one."),
  lastSync: z.number().nullable().optional().describe("Timestamp of the last synchronization."),
  lastClear: z.number().nullable().optional().describe("Timestamp of the last clear operation."),
  dataRoot: z.string().nullable().optional().describe("The root element in the data source (e.g., for JSON/XML)."),
  summarize: z.string().nullable().optional().describe("Summarization setting."),
  summarizeField: z.string().nullable().optional().describe("The field to summarize by."),
  sourceId: z.number().nullable().optional().describe("The ID of the source."),
  ignoreFirstRow: z.number().describe("Flag to ignore the first row of data (e.g., for CSV headers) (0 or 1)."),
  rowLimit: z.number().describe("The maximum number of rows to import."),
  limitPolicy: z.string().nullable().optional().describe("The policy for handling row limits."),
  csvSeparator: z.string().nullable().optional().describe("The separator character for CSV data."),
  folderId: z.number().describe("The ID of the folder containing the dataset."),
  permissionsFolderId: z.number().describe("The ID of the folder for permissions."),
}).catchall(z.any()); 