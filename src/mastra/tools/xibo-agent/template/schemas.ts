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
 * @module
 * This module defines common Zod schemas for the Template tools in the Xibo Agent.
 * These schemas are used for data validation and type inference across template-related operations.
 */

import { z } from "zod";

/**
 * Schema for permission information associated with various entities.
 */
export const permissionSchema = z.object({
  permissionId: z.number().describe("The unique ID of the permission."),
  entityId: z.number().describe("The ID of the entity (user or group)."),
  groupId: z.number().describe("The ID of the group."),
  objectId: z.number().describe("The ID of the object this permission applies to."),
  isUser: z.number().describe("Flag indicating if the entity is a user (1) or a group (0)."),
  entity: z.string().describe("The name of the entity."),
  objectIdString: z.string().describe("The object ID as a string."),
  group: z.string().describe("The name of the group."),
  view: z.number().describe("View permission flag."),
  edit: z.number().describe("Edit permission flag."),
  delete: z.number().describe("Delete permission flag."),
  modifyPermissions: z.number().describe("Permission to modify permissions flag."),
});

/**
 * Schema for tag information.
 */
export const tagSchema = z.object({
  tag: z.string().describe("The name of the tag."),
  tagId: z.number().describe("The unique ID of the tag."),
  value: z.string().nullable().describe("An optional value associated with the tag."),
});

/**
 * Schema for options associated with a region.
 */
export const regionOptionSchema = z.object({
  regionId: z.number().describe("The ID of the region."),
  option: z.string().describe("The name of the option."),
  value: z.string().describe("The value of the option."),
});

/**
 * Schema for options associated with a widget.
 */
export const widgetOptionSchema = z.object({
  widgetId: z.number().describe("The ID of the widget."),
  type: z.string().describe("The type of the option."),
  option: z.string().describe("The name of the option."),
  value: z.string().describe("The value of the option."),
});

/**
 * Schema for audio settings within a widget.
 */
export const audioSchema = z.object({
  widgetId: z.number().describe("The ID of the widget."),
  mediaId: z.number().describe("The ID of the audio media."),
  volume: z.number().describe("The volume level (0-100)."),
  loop: z.number().describe("Flag to indicate if the audio should loop."),
});

/**
 * Schema for widget information.
 */
export const widgetSchema = z.object({
  widgetId: z.number().describe("The unique ID of the widget."),
  playlistId: z.number().describe("The ID of the playlist this widget belongs to."),
  ownerId: z.number().describe("The ID of the widget's owner."),
  type: z.string().describe("The type of the widget."),
  duration: z.number().describe("The duration of the widget in seconds."),
  displayOrder: z.number().describe("The display order of the widget."),
  useDuration: z.number().describe("Flag indicating if the widget uses its own duration."),
  calculatedDuration: z.number().optional().describe("The calculated duration, if applicable."),
  createdDt: z.string().describe("The creation timestamp."),
  modifiedDt: z.string().describe("The last modification timestamp."),
  fromDt: z.number().nullable().describe("The start timestamp for scheduling."),
  toDt: z.number().nullable().describe("The end timestamp for scheduling."),
  schemaVersion: z.number().describe("The schema version of the widget."),
  transitionIn: z.number().nullable().describe("The transition-in effect ID."),
  transitionOut: z.number().nullable().describe("The transition-out effect ID."),
  transitionDurationIn: z.number().nullable().describe("The duration of the transition-in effect."),
  transitionDurationOut: z.number().nullable().describe("The duration of the transition-out effect."),
  widgetOptions: z.array(widgetOptionSchema).optional().describe("An array of widget options."),
  mediaIds: z.array(z.number()).optional().describe("An array of media IDs used by the widget."),
  audio: z.array(audioSchema).optional().describe("An array of audio settings."),
  permissions: z.array(permissionSchema).optional().describe("An array of permissions for the widget."),
  playlist: z.string().optional().describe("The name of the playlist."),
});

/**
 * Schema for playlist information.
 */
export const playlistSchema = z.object({
  playlistId: z.number().describe("The unique ID of the playlist."),
  ownerId: z.number().describe("The ID of the playlist's owner."),
  name: z.string().describe("The name of the playlist."),
  regionId: z.number().optional().describe("The ID of the region this playlist belongs to."),
  isDynamic: z.number().describe("Flag indicating if the playlist is dynamic."),
  filterMediaName: z.string().nullable().describe("Filter for media name."),
  filterMediaNameLogicalOperator: z.string().nullable().describe("Logical operator for media name filter."),
  filterMediaTags: z.string().nullable().describe("Filter for media tags."),
  filterExactTags: z.number().nullable().describe("Flag for exact tag matching."),
  filterMediaTagsLogicalOperator: z.string().nullable().describe("Logical operator for media tag filter."),
  filterFolderId: z.number().nullable().describe("Filter for folder ID."),
  maxNumberOfItems: z.number().nullable().describe("Maximum number of items in the playlist."),
  createdDt: z.string().describe("The creation timestamp."),
  modifiedDt: z.string().describe("The last modification timestamp."),
  duration: z.number().describe("The total duration of the playlist."),
  requiresDurationUpdate: z.number().describe("Flag indicating if duration needs to be recalculated."),
  enableStat: z.string().nullable().describe("Statistic collection flag."),
  tags: z.array(tagSchema).optional().describe("An array of tags for the playlist."),
  widgets: z.array(widgetSchema).optional().describe("An array of widgets in the playlist."),
  permissions: z.array(permissionSchema).optional().describe("An array of permissions for the playlist."),
  folderId: z.number().nullable().describe("The ID of the folder containing the playlist."),
  permissionsFolderId: z.number().nullable().describe("The ID of the folder for permissions."),
});

/**
 * Schema for region information within a template.
 */
export const regionSchema = z.object({
  regionId: z.number().describe("The unique ID of the region."),
  layoutId: z.number().describe("The ID of the layout this region belongs to."),
  ownerId: z.number().describe("The ID of the region's owner."),
  type: z.string().nullable().describe("The type of the region."),
  name: z.string().describe("The name of the region."),
  width: z.number().describe("The width of the region."),
  height: z.number().describe("The height of the region."),
  top: z.number().describe("The top position of the region."),
  left: z.number().describe("The left position of the region."),
  zIndex: z.number().describe("The z-index of the region."),
  syncKey: z.string().nullable().describe("Synchronization key for the region."),
  regionOptions: z.array(regionOptionSchema).optional().describe("An array of region options."),
  permissions: z.array(permissionSchema).optional().describe("An array of permissions for the region."),
  duration: z.number().describe("The duration of the region."),
  isDrawer: z.number().optional().describe("Flag indicating if the region is a drawer."),
  regionPlaylist: playlistSchema.optional().describe("The playlist associated with the region."),
});

/**
 * Schema for a complete template object.
 */
export const templateSchema = z.object({
  layoutId: z.number().describe("The unique ID of the template (layout)."),
  ownerId: z.number().describe("The ID of the template's owner."),
  campaignId: z.number().describe("The ID of the campaign this template belongs to."),
  parentId: z.number().nullable().describe("The ID of the parent layout, if any."),
  publishedStatusId: z.number().describe("The ID of the published status."),
  publishedStatus: z.string().describe("The description of the published status."),
  publishedDate: z.string().nullable().describe("The date the template was published."),
  backgroundImageId: z.number().nullable().describe("The ID of the background image."),
  schemaVersion: z.number().describe("The schema version of the template."),
  layout: z.string().describe("The name of the template."),
  description: z.string().nullable().describe("The description of the template."),
  backgroundColor: z.string().describe("The background color of the template."),
  createdDt: z.string().describe("The creation timestamp."),
  modifiedDt: z.string().describe("The last modification timestamp."),
  status: z.number().describe("The status of the template."),
  retired: z.number().describe("Flag indicating if the template is retired."),
  backgroundzIndex: z.number().describe("The z-index of the background."),
  width: z.number().describe("The width of the template."),
  height: z.number().describe("The height of the template."),
  orientation: z.string().describe("The orientation of the template."),
  displayOrder: z.number().nullable().describe("The display order."),
  duration: z.number().describe("The duration of the template."),
  statusMessage: z.string().nullable().describe("A status message, if any."),
  enableStat: z.number().describe("Statistic collection flag."),
  autoApplyTransitions: z.number().describe("Flag for auto-applying transitions."),
  code: z.string().nullable().describe("An optional code for the template."),
  isLocked: z.boolean().nullable().describe("Flag indicating if the template is locked."),
  regions: z.array(regionSchema).describe("An array of regions within the template."),
  tags: z.array(tagSchema).describe("An array of tags for the template."),
  folderId: z.number().describe("The ID of the folder containing the template."),
  permissionsFolderId: z.number().describe("The ID of the folder for permissions."),
}); 