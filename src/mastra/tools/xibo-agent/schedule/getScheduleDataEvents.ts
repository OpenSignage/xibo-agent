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

export const getScheduleDataEvents = createTool({
  id: 'get-schedule-data-events',
  description: 'カレンダーに表示するイベント一覧を取得します',
  inputSchema: z.object({
    displayGroupIds: z.array(z.number()).describe('イベント一覧を取得する表示グループIDの配列（-1は全ての表示グループ）'),
    from: z.string().optional().describe('開始日時（Y-m-d H:i:s形式、指定しない場合は当月の開始日時）'),
    to: z.string().optional().describe('終了日時（Y-m-d H:i:s形式、指定しない場合は翌月の開始日時）')
  }),

  outputSchema: z.string(),
  execute: async ({ context }) => {
    try {
      console.log("[DEBUG] getScheduleDataEvents: 開始");
      console.log("[DEBUG] getScheduleDataEvents: config =", config);
      
      if (!config.cmsUrl) {
        console.error("[DEBUG] getScheduleDataEvents: CMSのURLが設定されていません");
        throw new Error("CMSのURLが設定されていません");
      }
      console.log(`[DEBUG] getScheduleDataEvents: CMS URL = ${config.cmsUrl}`);

      const headers = await getAuthHeaders();
      console.log("[DEBUG] getScheduleDataEvents: 認証ヘッダーを取得しました");
      console.log("[DEBUG] getScheduleDataEvents: 認証ヘッダー =", headers);

      console.log("[DEBUG] getScheduleDataEvents: 検索条件 =", context);

      // クエリパラメータの構築
      const params = new URLSearchParams();
      params.append('displayGroupIds', context.displayGroupIds.join(','));
      if (context.from) {
        const fromDate = new Date(context.from);
        params.append('from', fromDate.toISOString().slice(0, 19).replace('T', ' '));
      }
      if (context.to) {
        const toDate = new Date(context.to);
        params.append('to', toDate.toISOString().slice(0, 19).replace('T', ' '));
      }

      const url = `${config.cmsUrl}/api/schedule/data/events?${params.toString()}`;
      console.log(`[DEBUG] getScheduleDataEvents: リクエストURL = ${url}`);

      const response = await fetch(url, {
        method: 'GET',
        headers
      });

      console.log(`[DEBUG] getScheduleDataEvents: レスポンスステータス = ${response.status}`);
      if (!response.ok) {
        const errorData = await response.json().catch(() => null);
        console.error(`[DEBUG] getScheduleDataEvents: HTTPエラーが発生しました: ${response.status}`, errorData);
        throw new Error(`HTTP error! status: ${response.status}${errorData ? `, message: ${JSON.stringify(errorData)}` : ''}`);
      }

      const data = await response.json();
      console.log("[DEBUG] getScheduleDataEvents: レスポンスデータを取得しました");
      console.log("[DEBUG] getScheduleDataEvents: レスポンスデータの構造:");
      console.log("生データ:", JSON.stringify(data, null, 2));
      console.log("データ型:", typeof data);
      console.log("キー一覧:", Object.keys(data));

      const validatedData = responseSchema.parse(data);
      console.log("[DEBUG] getScheduleDataEvents: データの検証が成功しました");

      return JSON.stringify(validatedData, null, 2);
    } catch (error) {
      console.error("[DEBUG] getScheduleDataEvents: エラーが発生しました", error);
      return `エラーが発生しました: ${error instanceof Error ? error.message : "不明なエラー"}`;
    }
  },
});
