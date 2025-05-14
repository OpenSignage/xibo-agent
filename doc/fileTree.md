# Xibo Agent ファイル構造

```
src/mastra/tools/xibo-agent/
├── displayVenue/
│   ├── index.ts (266B, 4 lines)
│   ├── deleteDisplayVenue.ts (1.1KB, 42 lines)
│   ├── editDisplayVenue.ts (2.2KB, 71 lines)
│   ├── addDisplayVenue.ts (2.2KB, 70 lines)
│   └── getDisplayVenues.ts (1.3KB, 51 lines)
├── syncGroup/
│   ├── getSyncGroupDisplays.ts (1.6KB, 61 lines)
│   ├── index.ts (394B, 6 lines)
│   ├── assignSyncGroupMembers.ts (1.4KB, 51 lines)
│   ├── deleteSyncGroup.ts (1.1KB, 43 lines)
│   ├── editSyncGroup.ts (2.3KB, 72 lines)
│   ├── addSyncGroup.ts (1.8KB, 65 lines)
│   └── getSyncGroups.ts (1.9KB, 66 lines)
├── font/
│   ├── index.ts (278B, 5 lines)                            ;Reviewed 2025/5/13
│   ├── deleteFont.ts (1.0KB, 43 lines)
│   ├── downloadFont.ts (1.1KB, 44 lines)
│   ├── getFontDetails.ts (1.2KB, 46 lines)
│   ├── uploadFont.ts (1.5KB, 61 lines)                     ;Reviewed 2025/5/13
│   └── getFonts.ts (1.5KB, 60 lines)                       ;Reviewed 2025/5/13
├── action/
│   ├── addAction.ts (2.3KB, 77 lines)
│   ├── getActions.ts (2.8KB, 79 lines)
│   ├── index.ts (164B, 3 lines)
│   └── deleteAction.ts (1.0KB, 44 lines)
├── menuBoard/
│   ├── deleteMenuBoardProduct.ts (1.2KB, 44 lines)
│   ├── editMenuBoardProduct.ts (2.6KB, 80 lines)
│   ├── index.ts (926B, 15 lines)
│   ├── selectMenuBoardFolder.ts (1.6KB, 61 lines)
│   ├── addMenuBoardProduct.ts (3.1KB, 93 lines)
│   ├── getMenuBoardProducts.ts (2.0KB, 67 lines)
│   ├── deleteMenuBoardCategory.ts (1.1KB, 44 lines)
│   ├── editMenuBoardCategory.ts (1.6KB, 56 lines)
│   ├── addMenuBoardCategory.ts (1.9KB, 64 lines)
│   ├── getMenuBoardCategories.ts (1.8KB, 60 lines)
│   ├── deleteMenuBoard.ts (1.0KB, 44 lines)
│   ├── editMenuBoard.ts (1.5KB, 56 lines)
│   ├── addMenuBoard.ts (1.9KB, 66 lines)
│   └── getMenuBoards.ts (2.0KB, 66 lines)
├── tags/
│   ├── index.ts (194B, 4 lines)
│   ├── deleteTag.ts (1023B, 44 lines)
│   ├── editTag.ts (1.6KB, 61 lines)
│   ├── addTag.ts (1.6KB, 60 lines)
│   └── getTags.ts (2.0KB, 64 lines)
├── playerSoftware/
│   ├── downloadPlayerVersion.ts (1.2KB, 45 lines)
│   ├── index.ts (290B, 4 lines)
│   ├── deletePlayerVersion.ts (1.1KB, 44 lines)
│   ├── editPlayerVersion.ts (1.9KB, 65 lines)
│   └── uploadPlayerSoftware.ts (1.6KB, 60 lines)
├── dayPart/
│   ├── index.ts (226B, 4 lines)
│   ├── deleteDayPart.ts (1.0KB, 44 lines)
│   ├── editDayPart.ts (2.4KB, 80 lines)
│   ├── addDayPart.ts (2.4KB, 79 lines)
│   └── getDayParts.ts (1.8KB, 63 lines)
├── command/
│   ├── deleteCommand.ts (1.0KB, 44 lines)
│   ├── editCommand.ts (2.4KB, 74 lines)
│   ├── addCommand.ts (2.4KB, 75 lines)
│   └── getCommands.ts (2.6KB, 73 lines)
├── modules/
│   ├── index.ts (154B, 4 lines)                                ;Reviewed 2025/5/9
│   ├── getModuleTemplateProperties.ts (1.6KB, 58 lines)
│   ├── getModuleTemplates.ts (2.3KB, 90 lines)
│   ├── getModuleProperties.ts (1.4KB, 51 lines)
│   └── getModules.ts (3.3KB, 90 lines)                         ;Reviewed 2025/5/9
├── usergroup/
│   ├── copyUserGroup.ts (2.0KB, 66 lines)
│   ├── unassignUserFromGroup.ts (1.9KB, 64 lines)
│   ├── assignUserToGroup.ts (1.8KB, 64 lines)
│   ├── deleteUserGroup.ts (1.1KB, 44 lines)
│   ├── editUserGroup.ts (2.9KB, 78 lines)
│   ├── addUserGroup.ts (2.9KB, 77 lines)
│   └── getUserGroups.ts (1.8KB, 61 lines)
├── user/
│   ├── getUsers.ts (3.6KB, 115 lines)                          ;Reviewd 2025/5/9
│   ├── index.ts (411B, 12 lines)
│   ├── setMultiEntityPermissions.ts (1.6KB, 58 lines)
│   ├── getMultiEntityPermissions.ts (1.4KB, 53 lines)
│   ├── setUserPreferences.ts (1.2KB, 50 lines)
│   ├── getUserPreferences.ts (1.3KB, 49 lines)
│   ├── setUserPermissions.ts (1.4KB, 55 lines)
│   ├── getUserPermissions.ts (1.3KB, 52 lines)
│   ├── deleteUser.ts (1.4KB, 52 lines)
│   ├── editUser.ts (2.3KB, 76 lines)
│   ├── addUser.ts (2.2KB, 75 lines)
│   ├── getUser.ts (4.8KB, 132 lines)                           ;Reviewed 2025/5/9
│   └── getUserMe.ts (4.2KB, 119 lines)                         ;Reviewed 2025/5/8
├── statistics/
│   ├── getExportStatsCount.ts (1.5KB, 50 lines)
│   ├── getTimeDisconnected.ts (1.7KB, 59 lines)
│   ├── getStats.ts (3.3KB, 89 lines)
│   └── index.ts (106B, 3 lines)
├── folder/
│   ├── addFolder.ts (1.4KB, 59 lines)                          ;Reviewed 2025/5/9
│   ├── deleteFolder.ts (1.3KB, 53 lines)                       ;Reviewed 2025/5/9
│   ├── editFolder.ts (1.3KB, 58 lines)                         ;Reviewed 2025/5/9
│   ├── getFolders.ts (1.8KB, 63 lines)                         ;Reviewed 2025/5/9
│   └── index.ts (121B, 4 lines)                                ;Reviewed 2025/5/9
├── dataset/
│   ├── selectDataSetFolder.ts (2.2KB, 76 lines)
│   ├── addDataSet.ts (1.8KB, 62 lines)
│   ├── deleteDataSetData.ts (1.0KB, 36 lines)
│   ├── index.ts (677B, 19 lines)
│   ├── schemas.ts (1.3KB, 48 lines)
│   ├── copyDataSet.ts (1.1KB, 44 lines)
│   ├── manageDataSetConnector.ts (2.1KB, 82 lines)
│   ├── manageDataSetRss.ts (2.5KB, 88 lines)
│   ├── importDataSetDataJson.ts (1.4KB, 50 lines)
│   ├── exportDataSetData.ts (1.1KB, 40 lines)
│   ├── importDataSetData.ts (1.3KB, 44 lines)
│   ├── editDataSetData.ts (1.3KB, 47 lines)
│   ├── addDataSetData.ts (1.3KB, 46 lines)
│   ├── getDataSetData.ts (1.0KB, 35 lines)
│   ├── deleteDataSetColumn.ts (1.1KB, 36 lines)
│   ├── editDataSetColumn.ts (1.6KB, 54 lines)
│   ├── addDataSetColumn.ts (1.5KB, 53 lines)
│   ├── getDataSetColumns.ts (1.0KB, 35 lines)
│   ├── deleteDataSet.ts (991B, 35 lines)
│   ├── editDataSet.ts (1.9KB, 63 lines)
│   └── getDataSets.ts (943B, 33 lines)
├── display/
│   ├── index.ts (258B, 8 lines)                                ;Reviewed 2025/5/9
│   ├── wakeOnLan.ts (911B, 33 lines)
│   ├── purgeAll.ts (925B, 33 lines)
│   ├── getDisplayStatus.ts (986B, 34 lines)
│   ├── checkLicence.ts (942B, 33 lines)
│   ├── setDefaultLayout.ts (1.1KB, 38 lines)
│   ├── toggleAuthorise.ts (960B, 33 lines)
│   ├── editDisplay.ts (2.9KB, 71 lines)
│   └── getDisplays.ts (4.9KB, 153 lines)                       ;Reviewd 2025/5/9
├── misc/
│   ├── index.ts (58B, 2 lines)                                 ;Reviewed 2025/5/8
│   ├── getAbout.ts (2.3KB, 60 lines)                           ;Reviewed 2025/5/8
│   └── getCmsTime.ts (2.0KB, 52 lines)                         ;Reviewed 2025/5/8
├── displayprofile/
│   ├── index.ts (297B, 5 lines)
│   ├── copyDisplayProfile.ts (1.1KB, 39 lines)
│   ├── deleteDisplayProfile.ts (1013B, 34 lines)
│   ├── editDisplayProfile.ts (1.3KB, 43 lines)
│   ├── addDisplayProfile.ts (1.2KB, 42 lines)
│   └── getDisplayProfiles.ts (1.4KB, 42 lines)
├── displayGroup/
│   ├── index.ts (681B, 13 lines)
│   ├── triggerWebhook.ts (1.1KB, 39 lines)
│   ├── selectFolder.ts (1.1KB, 39 lines)
│   ├── copyDisplayGroup.ts (1.4KB, 43 lines)
│   ├── sendCommand.ts (1.2KB, 41 lines)
│   ├── revertToSchedule.ts (996B, 34 lines)
│   ├── clearStatsAndLogs.ts (999B, 34 lines)
│   ├── collectNow.ts (974B, 34 lines)
│   ├── unassignDisplays.ts (1.2KB, 41 lines)
│   ├── assignDisplays.ts (1.2KB, 41 lines)
│   ├── deleteDisplayGroup.ts (995B, 34 lines)
│   ├── editDisplayGroup.ts (1.6KB, 47 lines)
│   ├── addDisplayGroup.ts (1.6KB, 46 lines)
│   └── getDisplayGroups.ts (1.6KB, 44 lines)
├── library/
│   ├── index.ts (368B, 8 lines)
│   ├── tagMedia.ts (1.1KB, 41 lines)
│   ├── downloadThumbnail.ts (981B, 34 lines)
│   ├── downloadMedia.ts (1003B, 35 lines)
│   ├── searchAllLibrary.ts (918B, 32 lines)
│   ├── deleteMedia.ts (1.1KB, 40 lines)
│   ├── editMedia.ts (1.3KB, 45 lines)
│   ├── addMedia.ts (1.5KB, 48 lines)
│   └── getLibrary.ts (1.7KB, 48 lines)
├── resolution/
│   ├── index.ts (206B, 4 lines)                                ;Reviewed 2025/5/10
│   ├── addResolution.ts (1.2KB, 42 lines)                      ;Reviewed 2025/5/10
│   ├── deleteResolution.ts (933B, 33 lines)                    ;Reviewed 2025/5/10
│   ├── editResolution.ts (1.2KB, 43 lines)                     ;Reviewed 2025/5/10
│   └── getResolutions.ts (1.6KB, 46 lines)                     ;Reviewed 2025/5/10
├── template/
│   ├── index.ts (216B, 4 lines)
│   ├── addTemplateFromLayout.ts (2.3KB, 53 lines)
│   ├── searchAllTemplates.ts (1.5KB, 40 lines)
│   ├── addTemplate.ts (2.2KB, 52 lines)
│   └── getTemplates.ts (1.4KB, 40 lines)
├── widget/
│   ├── index.ts (736B, 14 lines)
│   ├── getWidgetDataTypes.ts (1.5KB, 40 lines)
│   ├── deleteWidgetData.ts (1.7KB, 42 lines)
│   ├── editWidgetData.ts (2.1KB, 49 lines)
│   ├── addWidgetData.ts (2.1KB, 49 lines)
│   ├── getWidgetData.ts (1.7KB, 51 lines)
│   ├── setWidgetDataType.ts (1.7KB, 43 lines)
│   ├── saveWidgetElements.ts (1.7KB, 43 lines)
│   ├── setWidgetRegion.ts (1.8KB, 46 lines)
│   ├── deleteWidgetAudio.ts (1.7KB, 41 lines)
│   ├── editWidgetAudio.ts (2.2KB, 51 lines)
│   ├── editWidgetTransition.ts (2.5KB, 51 lines)
│   ├── deleteWidget.ts (1.5KB, 41 lines)
│   ├── editWidget.ts (2.3KB, 52 lines)
│   └── addWidget.ts (2.1KB, 50 lines)
├── notification/
│   ├── index.ts (222B, 4 lines)
│   ├── getNotifications.ts (3.7KB, 95 lines)
│   ├── deleteNotification.ts (2.7KB, 65 lines)
│   ├── putNotification.ts (3.9KB, 97 lines)
│   └── postNotification.ts (3.9KB, 96 lines)
├── schedule/
│   ├── index.ts (362B, 6 lines)
│   ├── getSchedule.ts (6.5KB, 172 lines)
│   ├── getScheduleDataEvents.ts (5.8KB, 165 lines)
│   ├── getScheduleDisplayGroupIdEvents.ts (5.4KB, 156 lines)
│   ├── putSchedule.ts (7.8KB, 192 lines)
│   ├── deleteScheduleRecurrence.ts (3.1KB, 71 lines)
│   └── deleteSchedule.ts (2.6KB, 66 lines)
├── playlist/
│   ├── index.ts (652B, 12 lines)
│   ├── convertPlaylist.ts (1.9KB, 46 lines)
│   ├── selectPlaylistFolder.ts (1.9KB, 46 lines)
│   ├── setPlaylistEnableStat.ts (1.9KB, 46 lines)
│   ├── getPlaylistUsageByLayouts.ts (1.7KB, 42 lines)
│   ├── getPlaylistUsage.ts (1.6KB, 42 lines)
│   ├── orderWidgets.ts (2.0KB, 54 lines)
│   ├── assignLibraryItems.ts (2.5KB, 55 lines)
│   ├── copyPlaylist.ts (2.0KB, 49 lines)
│   ├── deletePlaylist.ts (1.6KB, 41 lines)
│   ├── putPlaylist.ts (3.3KB, 64 lines)
│   ├── postPlaylist.ts (3.2KB, 64 lines)
│   └── getPlaylists.ts (4.1KB, 101 lines)
├── layout/
│   ├── index.ts (1.2KB, 23 lines)                             ;Reviewed 2025/5/11
│   ├── checkoutLayout.ts (1.6KB, 41 lines)
│   ├── positionRegions.ts (2.0KB, 56 lines)
│   ├── clearLayout.ts (1.6KB, 41 lines)
│   ├── getFullscreenLayout.ts (1.0B, 1 lines)
│   ├── discardLayout.ts (1.6KB, 41 lines)
│   ├── getLayoutStatus.ts (2.0KB, 56 lines)                    ;Reviewd 2025/5/12
│   ├── untagLayout.ts (1.7KB, 48 lines)
│   ├── tagLayout.ts (1.7KB, 48 lines)
│   ├── setLayoutEnableStat.ts (1.9KB, 46 lines)
│   ├── applyLayoutTemplate.ts (1.8KB, 46 lines)
│   ├── setLayoutBackground.ts (1.9KB, 46 lines)
│   ├── copyLayout.ts (3.8KB, 82 lines)
│   ├── unretireLayout.ts (1.6KB, 41 lines)                     ;Reviewd 2025/5/12
│   ├── retireLayout.ts (2.1KB, 53 lines)                       ;Reviewd 2025/5/12
│   ├── publishLayout.ts (1.5KB, 41 lines)                      
│   ├── getLayouts.ts (13KB, 238 lines)                         ;Reviewd 2025/5/12
│   ├── deleteLayout.ts (2.0KB, 52 lines)                       ;Reviewed 2025/5/11
│   ├── putLayout.ts (6.7KB, 128 lines)
│   └── addLayout.ts (5.5KB, 113 lines)                         ;Reviewed 2025/5/11
├── campaign/
│   ├── selectCampaignFolder.ts (1.9KB, 47 lines)
│   ├── removeLayout.ts (2.0KB, 48 lines)
│   ├── assignLayout.ts (2.4KB, 52 lines)
│   ├── deleteCampaign.ts (1.0B, 1 lines)
│   ├── putCampaign.ts (3.5KB, 63 lines)
│   ├── postCampaign.ts (3.4KB, 62 lines)
│   └── getCampaigns.ts (3.6KB, 66 lines)
├── etc/
│   ├── index.ts                                                ;Reviewd 2025/5/13
│   ├── getGoogleFonts.ts                                       ;Reviewd 2025/5/13
│   └── getNews.ts                                              ;Reviewd 2025/5/13
``` 