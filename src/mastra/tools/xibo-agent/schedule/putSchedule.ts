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
const responseSchema = eventSchema;

export const putSchedule = createTool({
  id: 'put-schedule',
  description: 'スケジュールを更新します',
  inputSchema: z.object({
    eventId: z.number().describe('更新するスケジュールのイベントID'),
    eventTypeId: z.number().optional().describe('イベントタイプID (1=Layout, 2=Command, 3=Overlay, 4=Interrupt, 5=Campaign, 6=Action, 7=Media Library, 8=Playlist)'),
    fromDt: z.string().optional().describe('開始日時 (Y-m-d H:i:s format)'),
    toDt: z.string().optional().describe('終了日時 (Y-m-d H:i:s format)'),
    displayGroupIds: z.array(z.number()).optional().describe('表示グループIDの配列'),
    campaignId: z.number().optional().describe('キャンペーンID'),
    commandId: z.number().optional().describe('コマンドID'),
    isPriority: z.number().optional().describe('優先度フラグ (0-1)'),
    displayOrder: z.number().optional().describe('表示順序'),
    recurrenceType: z.string().optional().describe('繰り返しタイプ (None, Daily, Weekly, Monthly, Yearly)'),
    recurrenceDetail: z.number().optional().describe('繰り返しの詳細'),
    recurrenceRange: z.number().optional().describe('繰り返しの範囲'),
    recurrenceRepeatsOn: z.string().optional().describe('繰り返しの曜日'),
    recurrenceMonthlyRepeatsOn: z.number().optional().describe('月次繰り返しの日'),
    dayPartId: z.number().optional().describe('時間帯ID'),
    isAlways: z.number().optional().describe('常時表示フラグ (0-1)'),
    isCustom: z.number().optional().describe('カスタムフラグ (0-1)'),
    syncEvent: z.number().optional().describe('同期イベントフラグ (0-1)'),
    syncTimezone: z.number().optional().describe('タイムゾーン同期フラグ (0-1)'),
    shareOfVoice: z.number().optional().describe('シェアオブボイス'),
    maxPlaysPerHour: z.number().optional().describe('1時間あたりの最大再生回数'),
    isGeoAware: z.number().optional().describe('ジオロケーション対応フラグ (0-1)'),
    geoLocation: z.string().optional().describe('ジオロケーション情報'),
    actionTriggerCode: z.string().optional().describe('アクショントリガーコード'),
    actionType: z.string().optional().describe('アクションタイプ'),
    actionLayoutCode: z.string().optional().describe('アクションレイアウトコード'),
    parentCampaignId: z.number().optional().describe('親キャンペーンID'),
    syncGroupId: z.number().optional().describe('同期グループID'),
    dataSetId: z.number().optional().describe('データセットID'),
    dataSetParams: z.number().optional().describe('データセットパラメータ'),
    name: z.string().optional().describe('スケジュール名')
  }),

  outputSchema: z.string(),
  execute: async ({ context }) => {
    try {
      console.log("[DEBUG] putSchedule: 開始");
      console.log("[DEBUG] putSchedule: config =", config);
      
      if (!config.cmsUrl) {
        console.error("[DEBUG] putSchedule: CMSのURLが設定されていません");
        throw new Error("CMSのURLが設定されていません");
      }
      console.log(`[DEBUG] putSchedule: CMS URL = ${config.cmsUrl}`);

      const headers = await getAuthHeaders();
      console.log("[DEBUG] putSchedule: 認証ヘッダーを取得しました");
      console.log("[DEBUG] putSchedule: 認証ヘッダー =", headers);

      const { eventId, ...updateData } = context;
      console.log(`[DEBUG] putSchedule: イベントID = ${eventId}`);
      console.log("[DEBUG] putSchedule: 更新データ =", updateData);

      // 日付文字列をタイムスタンプに変換
      const requestBody = {
        ...updateData,
        fromDt: updateData.fromDt ? Math.floor(new Date(updateData.fromDt).getTime() / 1000) : undefined,
        toDt: updateData.toDt ? Math.floor(new Date(updateData.toDt).getTime() / 1000) : undefined
      };

      console.log("[DEBUG] putSchedule: リクエストボディ =", requestBody);

      const response = await fetch(`${config.cmsUrl}/api/schedule/${eventId}`, {
        method: 'PUT',
        headers: {
          ...headers,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(requestBody)
      });

      console.log(`[DEBUG] putSchedule: レスポンスステータス = ${response.status}`);
      if (!response.ok) {
        const errorData = await response.json().catch(() => null);
        console.error(`[DEBUG] putSchedule: HTTPエラーが発生しました: ${response.status}`, errorData);
        throw new Error(`HTTP error! status: ${response.status}${errorData ? `, message: ${JSON.stringify(errorData)}` : ''}`);
      }

      const data = await response.json();
      console.log("[DEBUG] putSchedule: レスポンスデータを取得しました");
      console.log("[DEBUG] putSchedule: レスポンスデータの構造:");
      console.log("生データ:", JSON.stringify(data, null, 2));
      console.log("データ型:", typeof data);
      console.log("キー一覧:", Object.keys(data));

      const validatedData = responseSchema.parse(data);
      console.log("[DEBUG] putSchedule: データの検証が成功しました");

      return JSON.stringify(validatedData, null, 2);
    } catch (error) {
      console.error("[DEBUG] putSchedule: エラーが発生しました", error);
      return `エラーが発生しました: ${error instanceof Error ? error.message : "不明なエラー"}`;
    }
  },
}); 