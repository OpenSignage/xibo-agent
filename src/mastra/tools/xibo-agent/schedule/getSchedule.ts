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

export const getSchedule = createTool({
  id: 'get-schedule',
  description: 'スケジュールイベントの一覧を取得します',
  inputSchema: z.object({
    eventTypeId: z.number().optional().describe('イベントタイプID（1=レイアウト、2=コマンド、3=オーバーレイ、4=割り込み、5=キャンペーン、6=アクション、7=メディアライブラリ、8=プレイリスト）'),
    fromDt: z.string().optional().describe('開始日時（Y-m-d H:i:s形式）'),
    toDt: z.string().optional().describe('終了日時（Y-m-d H:i:s形式）'),
    geoAware: z.number().optional().describe('地理的位置情報を使用するイベントを取得するかどうか（0-1）'),
    recurring: z.number().optional().describe('繰り返しイベントを取得するかどうか（0-1）'),
    campaignId: z.number().optional().describe('特定のキャンペーンIDでフィルタリング'),
    displayGroupIds: z.array(z.number()).optional().describe('表示グループIDの配列でフィルタリング')
  }),

  outputSchema: z.string(),
  execute: async ({ context }) => {
    try {
      console.log("[DEBUG] getSchedule: 開始");
      console.log("[DEBUG] getSchedule: config =", config);
      
      if (!config.cmsUrl) {
        console.error("[DEBUG] getSchedule: CMSのURLが設定されていません");
        throw new Error("CMSのURLが設定されていません");
      }
      console.log(`[DEBUG] getSchedule: CMS URL = ${config.cmsUrl}`);

      const headers = await getAuthHeaders();
      console.log("[DEBUG] getSchedule: 認証ヘッダーを取得しました");
      console.log("[DEBUG] getSchedule: 認証ヘッダー =", headers);

      console.log("[DEBUG] getSchedule: 検索条件 =", context);

      // クエリパラメータの構築
      const params = new URLSearchParams();
      if (context.eventTypeId !== undefined) params.append('eventTypeId', context.eventTypeId.toString());
      if (context.fromDt) {
        const fromDate = new Date(context.fromDt);
        params.append('fromDt', fromDate.toISOString().slice(0, 19).replace('T', ' '));
      }
      if (context.toDt) {
        const toDate = new Date(context.toDt);
        params.append('toDt', toDate.toISOString().slice(0, 19).replace('T', ' '));
      }
      if (context.geoAware !== undefined) params.append('geoAware', context.geoAware.toString());
      if (context.recurring !== undefined) params.append('recurring', context.recurring.toString());
      if (context.campaignId !== undefined) params.append('campaignId', context.campaignId.toString());
      if (context.displayGroupIds) params.append('displayGroupIds', context.displayGroupIds.join(','));

      const url = `${config.cmsUrl}/api/schedule?${params.toString()}`;
      console.log(`[DEBUG] getSchedule: リクエストURL = ${url}`);

      const response = await fetch(url, {
        method: 'GET',
        headers
      });

      console.log(`[DEBUG] getSchedule: レスポンスステータス = ${response.status}`);
      if (!response.ok) {
        const errorData = await response.json().catch(() => null);
        console.error(`[DEBUG] getSchedule: HTTPエラーが発生しました: ${response.status}`, errorData);
        throw new Error(`HTTP error! status: ${response.status}${errorData ? `, message: ${JSON.stringify(errorData)}` : ''}`);
      }

      const data = await response.json();
      console.log("[DEBUG] getSchedule: レスポンスデータを取得しました");
      console.log("[DEBUG] getSchedule: レスポンスデータの構造:");
      console.log("生データ:", JSON.stringify(data, null, 2));
      console.log("データ型:", typeof data);
      console.log("キー一覧:", Object.keys(data));

      const validatedData = responseSchema.parse(data);
      console.log("[DEBUG] getSchedule: データの検証が成功しました");

      return JSON.stringify(validatedData, null, 2);
    } catch (error) {
      console.error("[DEBUG] getSchedule: エラーが発生しました", error);
      return `エラーが発生しました: ${error instanceof Error ? error.message : "不明なエラー"}`;
    }
  },
}); 