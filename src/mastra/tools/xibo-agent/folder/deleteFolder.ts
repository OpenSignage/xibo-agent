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
 * Xibo CMS Folder Deletion Tool
 * 
 * This module provides functionality to delete folders from the Xibo CMS system.
 * It implements the folder deletion API endpoint and handles proper response validation.
 */

import { z } from "zod";
import { getAuthHeaders } from "../auth";
import { logger } from '../../../index';
import { decodeErrorMessage } from "../utility/error";

/**
 * Tool to delete a folder from Xibo CMS
 */
export const deleteFolder = {
  name: "delete-folder",
  description: "Delete a folder from Xibo CMS",
  parameters: z.object({
    folderId: z.number().describe("ID of the folder to delete"),
  }),
  execute: async (params: { folderId: number }) => {
    try {
      const { folderId } = params;
      const url = `${process.env.XIBO_API_URL}/folder/delete/${folderId}`;
      const formData = new URLSearchParams();
      formData.append("folderId", folderId.toString());

      const response = await fetch(url, {
        method: "POST",
        headers: {
          "Content-Type": "application/x-www-form-urlencoded",
        },
        body: formData.toString(),
      });

      const text = await response.text();
      if (!response.ok) {
        throw new Error(decodeErrorMessage(text));
      }

      return { success: true, message: "Folder deleted successfully" };
    } catch (error) {
      logger.error("Error deleting folder:", { error: error instanceof Error ? error.message : String(error) });
      throw error;
    }
  },
};

export default deleteFolder; 