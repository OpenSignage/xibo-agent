/*
 * Copyright (C) 2025 Open Source Digital Signage Initiative.
 *
 * You can redistribute it and/or modify
 * it under the terms of the Elastic License 2.0 (ELv2) as published by
 * the Search AI Company, either version 3 of the License,
 * any later version.
 *
 * You should have received a copy of the GElastic License 2.0 (ELv2).
 * see <https://www.elastic.co/licensing/elastic-license>.
 */

/**
 * @module DataSetSchemas
 * @description Provides shared Zod schemas for dataset-related tools in the Xibo Agent,
 * ensuring data consistency and validation against the Xibo CMS API.
 */
import { z } from "zod";

// Schema for a Xibo CMS DataSet based on xibo-api.json definitions.
export const dataSetSchema = z.object({
  dataSetId: z.number().describe("The unique identifier for the dataset."),
  dataSet: z.string().describe("The name of the dataset."),
  description: z.string().nullable().describe("A description for the dataset."),
  userId: z.number().optional().describe("The ID of the user who owns the dataset."),
  lastDataEdit: z.number().nullable().optional().describe("Timestamp of the last data edit."),
  owner: z.string().optional().describe("The name of the owner."),
  groupsWithPermissions: z.string().nullable().optional().describe("Groups with permissions."),
  code: z.string().nullable().describe("A code for the dataset, used for filtering."),
  isLookup: z.number().optional().describe("Flag indicating if the dataset is a lookup table (0 or 1)."),
  isRemote: z.preprocess((val) => !!val, z.boolean()).optional().describe("Flag indicating if the dataset is remote."),
  isRealTime: z.preprocess((val) => !!val, z.boolean()).optional().describe("Flag indicating if the dataset is real-time."),
  dataConnectorSource: z.string().nullable().optional().describe("The source of the data connector."),
  method: z.string().nullable().optional().describe("The HTTP method for remote datasets (e.g., GET, POST)."),
  uri: z.string().nullable().optional().describe("The URI for the remote data source."),
  postData: z.string().nullable().optional().describe("The data to send with a POST request for remote datasets."),
  authentication: z.string().nullable().optional().describe("Authentication details for the remote source."),
  username: z.string().nullable().optional().describe("Username for remote authentication."),
  password: z.string().nullable().optional().describe("Password for remote authentication."),
  customHeaders: z.string().nullable().optional().describe("Custom HTTP headers for the request."),
  userAgent: z.string().nullable().optional().describe("The user agent for the request."),
  refreshRate: z.number().nullable().optional().describe("The refresh rate in seconds for the remote dataset."),
  clearRate: z.number().nullable().optional().describe("The rate at which old data is cleared."),
  truncateOnEmpty: z.number().optional().describe("Flag to truncate the dataset if the remote source returns no data (0 or 1)."),
  runsAfter: z.union([z.string(), z.number()]).nullable().describe("Specifies when the dataset synchronization runs."),
  lastSync: z.union([z.string(), z.number()]).nullable().describe("The timestamp of the last synchronization."),
  lastClear: z.number().nullable().optional().describe("Timestamp of the last clear operation."),
  dataRoot: z.string().nullable().describe("The root element in the remote data source."),
  summarize: z.string().nullable().optional().describe("Summarization setting."),
  summarizeField: z.string().nullable().optional().describe("The field to summarize by."),
  sourceId: z.number().nullable().optional().describe("The ID of the source."),
  ignoreFirstRow: z.number().optional().describe("Flag to ignore the first row of data (e.g., for CSV headers) (0 or 1)."),
  rowLimit: z.number().nullable().optional().describe("The maximum number of rows to import."),
  limitPolicy: z.string().nullable().optional().describe("The policy for handling row limits."),
  csvSeparator: z.string().nullable().optional().describe("The separator character for CSV data."),
  isProcessed: z.preprocess((val) => !!val, z.boolean()).optional().describe("Flag indicating if the dataset has been processed."),
  remoteUrl: z.string().nullable().optional().describe("The full URL for the remote data source."),
  settings: z.string().nullable().optional().describe("Additional settings for the dataset."),
  folderId: z.number().optional().describe("The ID of the folder containing the dataset."),
  permissionsFolderId: z.number().optional().describe("The ID of the folder for permissions."),
  columns: z.array(z.any()).optional().describe("Array of column definitions if embedded."),
}).catchall(z.any());

// Schema for a Xibo CMS DataSet Column based on xibo-api.json definitions.
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

// Schema for a row of data within a Xibo CMS DataSet.
export const dataSetDataSchema = z.object({
  id: z.number().describe("The unique identifier for the data row."),
}).catchall(z.any());

// Schema for a Xibo CMS DataSet RSS feed configuration based on observed API responses.
export const dataSetRssSchema = z.object({
  id: z.number().describe("The ID of the RSS configuration."),
  dataSetId: z.number().describe("The ID of the parent dataset."),
  title: z.string().describe("The title of the RSS feed."),
  author: z.string().optional().describe("The author of the RSS feed."),
  titleColumnId: z.number().optional().describe("The column ID for the title."),
  summaryColumnId: z.number().optional().describe("The columnId used as each item's summary."),
  contentColumnId: z.number().optional().describe("The columnId used as each item's content."),
  publishedDateColumnId: z.number().optional().describe("The columnId used as each item's published date."),
  psk: z.string().optional().describe("Pre-Shared Key for the feed."),
  sort: z.string().optional().describe("Sort order configuration."),
  filter: z.string().optional().describe("Filter configuration."),
  url: z.string().url().optional().describe("The URL to the RSS feed, if externally sourced."),
  cacheTimeout: z.number().nullable().optional().describe("The cache timeout in seconds."),
  lastSync: z.string().nullable().optional().describe("Timestamp of the last sync."),
  lastSyncStatus: z.number().nullable().optional().describe("Status code of the last sync."),
  lastSyncMessage: z.string().nullable().optional().describe("Message from the last sync."),
}).catchall(z.any()).transform((data) => ({
    ...data,
    rssId: data.id,
}));

// Schema for a Xibo CMS DataSet Connector configuration.
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