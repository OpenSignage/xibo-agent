import { z } from "zod";

export const dataSetSchema = z.object({
  dataSetId: z.number(),
  dataSet: z.string(),
  description: z.string().optional(),
  code: z.string().optional(),
  isRemote: z.boolean().optional(),
  method: z.string().optional(),
  uri: z.string().optional(),
  postData: z.string().optional(),
  authentication: z.string().optional(),
  username: z.string().optional(),
  password: z.string().optional(),
  refreshRate: z.number().optional(),
  clearRate: z.number().optional(),
  runsAfter: z.string().optional(),
  dataRoot: z.string().optional(),
  lastSync: z.string().optional(),
  isProcessed: z.boolean().optional(),
  remoteUrl: z.string().optional(),
  settings: z.string().optional(),
});

export const dataSetColumnSchema = z.object({
  dataSetColumnId: z.number(),
  dataSetId: z.number(),
  heading: z.string(),
  dataTypeId: z.number(),
  listContent: z.string().optional(),
  columnOrder: z.number().optional(),
  formula: z.string().optional(),
  remoteField: z.string().optional(),
  showFilter: z.boolean().optional(),
  showSort: z.boolean().optional(),
});

export const dataSetDataSchema = z.object({
  id: z.number(),
  dataSetId: z.number(),
  rowData: z.record(z.string(), z.any()),
});

export const apiResponseSchema = z.object({
  success: z.boolean(),
  error: z.string().optional(),
  data: z.any().optional(),
}); 