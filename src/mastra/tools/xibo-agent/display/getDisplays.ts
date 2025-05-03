import { z } from "zod";
import { createTool } from '@mastra/core/tools';
import { config } from "../config";
import { getAuthHeaders } from "../auth";

const displayResponseSchema = z.array(z.object({
  displayId: z.number(),
  displayTypeId: z.number(),
  venueId: z.number(),
  address: z.string().nullable(),
  isMobile: z.number(),
  languages: z.string().nullable(),
  displayType: z.string().nullable(),
  screenSize: z.number(),
  isOutdoor: z.number(),
  customId: z.string().nullable(),
  costPerPlay: z.number(),
  impressionsPerPlay: z.number(),
  ref1: z.string().nullable(),
  ref2: z.string().nullable(),
  ref3: z.string().nullable(),
  ref4: z.string().nullable(),
  ref5: z.string().nullable(),
  auditingUntil: z.number(),
  display: z.string().nullable(),
  description: z.string().nullable(),
  defaultLayoutId: z.number(),
  license: z.string().nullable(),
  licensed: z.number(),
  loggedIn: z.number(),
  lastAccessed: z.number(),
  incSchedule: z.number(),
  emailAlert: z.number(),
  alertTimeout: z.number(),
  clientAddress: z.string().nullable(),
  mediaInventoryStatus: z.number(),
  macAddress: z.string().nullable(),
  lastChanged: z.number(),
  numberOfMacAddressChanges: z.number(),
  lastWakeOnLanCommandSent: z.number(),
  wakeOnLanEnabled: z.number(),
  wakeOnLanTime: z.string().nullable(),
  broadCastAddress: z.string().nullable(),
  secureOn: z.string().nullable(),
  cidr: z.string().nullable(),
  latitude: z.number(),
  longitude: z.number(),
  clientType: z.string().nullable(),
  clientVersion: z.string().nullable(),
  clientCode: z.number(),
  displayProfileId: z.number(),
  currentLayoutId: z.number(),
  screenShotRequested: z.number(),
  storageAvailableSpace: z.number(),
  storageTotalSpace: z.number(),
  displayGroupId: z.number(),
  currentLayout: z.string().nullable(),
  defaultLayout: z.string().nullable(),
  displayGroups: z.array(z.object({
    displayGroupId: z.number(),
    displayGroup: z.string().nullable(),
    description: z.string().nullable(),
    isDisplaySpecific: z.number(),
    isDynamic: z.number(),
    dynamicCriteria: z.string().nullable(),
    dynamicCriteriaLogicalOperator: z.string().nullable(),
    dynamicCriteriaTags: z.string().nullable(),
    dynamicCriteriaExactTags: z.number(),
    dynamicCriteriaTagsLogicalOperator: z.string().nullable(),
    userId: z.number(),
    tags: z.array(z.object({
      tag: z.string().nullable(),
      tagId: z.number(),
      value: z.string().nullable()
    })),
    bandwidthLimit: z.number(),
    groupsWithPermissions: z.string().nullable(),
    createdDt: z.string().nullable(),
    modifiedDt: z.string().nullable(),
    folderId: z.number(),
    permissionsFolderId: z.number(),
    ref1: z.string().nullable(),
    ref2: z.string().nullable(),
    ref3: z.string().nullable(),
    ref4: z.string().nullable(),
    ref5: z.string().nullable()
  })),
  xmrChannel: z.string().nullable(),
  xmrPubKey: z.string().nullable(),
  lastCommandSuccess: z.number(),
  deviceName: z.string().nullable(),
  timeZone: z.string().nullable(),
  tags: z.array(z.object({
    tag: z.string().nullable(),
    tagId: z.number(),
    value: z.string().nullable()
  })),
  overrideConfig: z.string().nullable(),
  bandwidthLimit: z.number(),
  newCmsAddress: z.string().nullable(),
  newCmsKey: z.string().nullable(),
  orientation: z.string().nullable(),
  resolution: z.string().nullable(),
  commercialLicence: z.number(),
  teamViewerSerial: z.string().nullable(),
  webkeySerial: z.string().nullable(),
  groupsWithPermissions: z.string().nullable(),
  createdDt: z.string().nullable(),
  modifiedDt: z.string().nullable(),
  folderId: z.number(),
  permissionsFolderId: z.number(),
  countFaults: z.number(),
  lanIpAddress: z.string().nullable(),
  syncGroupId: z.number(),
  osVersion: z.string().nullable(),
  osSdk: z.string().nullable(),
  manufacturer: z.string().nullable(),
  brand: z.string().nullable(),
  model: z.string().nullable()
}));

export const getDisplays = createTool({
  id: 'get-displays',
  description: 'Xiboのディスプレイ一覧を取得します  ',
  inputSchema: z.object({
    _placeholder: z.string().optional().describe('このツールは入力パラメータを必要としません')
  }),
  outputSchema: z.string(),
  execute: async ({ context }) => {
    try {
      if (!config.cmsUrl) {
        throw new Error("CMSのURLが設定されていません");
      }

      const headers = await getAuthHeaders();
      const response = await fetch(`${config.cmsUrl}/api/display`, {
        headers,
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const data = await response.json();
      const validatedData = displayResponseSchema.parse(data);

      return JSON.stringify(validatedData, null, 2);
    } catch (error) {
      return `エラーが発生しました: ${error instanceof Error ? error.message : "不明なエラー"}`;
    }
  },
});
  