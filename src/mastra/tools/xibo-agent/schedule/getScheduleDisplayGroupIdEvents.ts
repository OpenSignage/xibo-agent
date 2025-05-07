import { z } from "zod";
import { createTool } from '@mastra/core/tools';
import { config } from "../config";
import { getAuthHeaders } from "../auth";

const tagSchema = z.object({
  tag: z.string(),
  tagId: z.number(),
  value: z.string()
});

const displayGroupSchema = z.object({
  displayGroupId: z.number(),
  displayGroup: z.string(),
  description: z.string(),
  isDisplaySpecific: z.number(),
  isDynamic: z.number(),
  dynamicCriteria: z.string(),
  dynamicCriteriaLogicalOperator: z.string(),
  dynamicCriteriaTags: z.string(),
  dynamicCriteriaExactTags: z.number(),
  dynamicCriteriaTagsLogicalOperator: z.string(),
  userId: z.number(),
  tags: z.array(tagSchema),
  bandwidthLimit: z.number(),
  groupsWithPermissions: z.string(),
  createdDt: z.string(),
  modifiedDt: z.string(),
  folderId: z.number(),
  permissionsFolderId: z.number(),
  ref1: z.string(),
  ref2: z.string(),
  ref3: z.string(),
  ref4: z.string(),
  ref5: z.string()
});

const scheduleReminderSchema = z.object({
  scheduleReminderId: z.number(),
  eventId: z.number(),
  value: z.number(),
  type: z.number(),
  option: z.number(),
  isEmail: z.number(),
  reminderDt: z.number(),
  lastReminderDt: z.number()
});

const eventSchema = z.object({
  eventId: z.number(),
  eventTypeId: z.number(),
  campaignId: z.number(),
  commandId: z.number(),
  displayGroups: z.array(displayGroupSchema),
  scheduleReminders: z.array(scheduleReminderSchema),
  criteria: z.array(z.string()),
  userId: z.number(),
  fromDt: z.number(),
  toDt: z.number(),
  isPriority: z.number(),
  displayOrder: z.number(),
  recurrenceType: z.string(),
  recurrenceDetail: z.number(),
  recurrenceRange: z.number(),
  recurrenceRepeatsOn: z.string(),
  recurrenceMonthlyRepeatsOn: z.number(),
  campaign: z.string(),
  command: z.string(),
  dayPartId: z.number(),
  isAlways: z.number(),
  isCustom: z.number(),
  syncEvent: z.number(),
  syncTimezone: z.number(),
  shareOfVoice: z.number(),
  maxPlaysPerHour: z.number(),
  isGeoAware: z.number(),
  geoLocation: z.string(),
  actionTriggerCode: z.string(),
  actionType: z.string(),
  actionLayoutCode: z.string(),
  parentCampaignId: z.number(),
  syncGroupId: z.number(),
  dataSetId: z.number(),
  dataSetParams: z.number(),
  modifiedBy: z.number(),
  createdOn: z.string(),
  updatedOn: z.string(),
  name: z.string()
});

// APIレスポンスのスキーマ
const responseSchema = z.array(eventSchema);

export const getScheduleDisplayGroupIdEvents = createTool({
  id: 'get-schedule-display-group-id-events',
  description: '指定された表示グループのイベント一覧を取得します',
  inputSchema: z.object({
    displayGroupId: z.number().describe('イベント一覧を取得する表示グループID'),
    date: z.string().describe('日付（Y-m-d H:i:s形式）')
  }),

  outputSchema: z.string(),
  execute: async ({ context }) => {
    try {
      console.log("[DEBUG] getScheduleDisplayGroupIdEvents: 開始");
      console.log("[DEBUG] getScheduleDisplayGroupIdEvents: config =", config);
      
      if (!config.cmsUrl) {
        console.error("[DEBUG] getScheduleDisplayGroupIdEvents: CMSのURLが設定されていません");
        throw new Error("CMSのURLが設定されていません");
      }
      console.log(`[DEBUG] getScheduleDisplayGroupIdEvents: CMS URL = ${config.cmsUrl}`);

      const headers = await getAuthHeaders();
      console.log("[DEBUG] getScheduleDisplayGroupIdEvents: 認証ヘッダーを取得しました");
      console.log("[DEBUG] getScheduleDisplayGroupIdEvents: 認証ヘッダー =", headers);

      console.log("[DEBUG] getScheduleDisplayGroupIdEvents: 検索条件 =", context);

      // 日付文字列をY-m-d H:i:s形式に変換
      const date = new Date(context.date);
      const formattedDate = date.toISOString().slice(0, 19).replace('T', ' ');

      const url = `${config.cmsUrl}/api/schedule/displaygroup/${context.displayGroupId}/events?date=${formattedDate}`;
      console.log(`[DEBUG] getScheduleDisplayGroupIdEvents: リクエストURL = ${url}`);

      const response = await fetch(url, {
        method: 'GET',
        headers
      });

      console.log(`[DEBUG] getScheduleDisplayGroupIdEvents: レスポンスステータス = ${response.status}`);
      if (!response.ok) {
        const errorData = await response.json().catch(() => null);
        console.error(`[DEBUG] getScheduleDisplayGroupIdEvents: HTTPエラーが発生しました: ${response.status}`, errorData);
        throw new Error(`HTTP error! status: ${response.status}${errorData ? `, message: ${JSON.stringify(errorData)}` : ''}`);
      }

      const data = await response.json();
      console.log("[DEBUG] getScheduleDisplayGroupIdEvents: レスポンスデータを取得しました");
      console.log("[DEBUG] getScheduleDisplayGroupIdEvents: レスポンスデータの構造:");
      console.log("生データ:", JSON.stringify(data, null, 2));
      console.log("データ型:", typeof data);
      console.log("キー一覧:", Object.keys(data));

      const validatedData = responseSchema.parse(data);
      console.log("[DEBUG] getScheduleDisplayGroupIdEvents: データの検証が成功しました");

      return JSON.stringify(validatedData, null, 2);
    } catch (error) {
      console.error("[DEBUG] getScheduleDisplayGroupIdEvents: エラーが発生しました", error);
      return `エラーが発生しました: ${error instanceof Error ? error.message : "不明なエラー"}`;
    }
  },
});
