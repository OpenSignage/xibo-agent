/**
 * Xibo API Knowledge
 * 
 * This file contains the knowledge base for Xibo's API structure and request handling.
 * It is used to provide the AI with understanding of how to interact with the Xibo CMS API.
 */

export const apiKnowledge = `
API Knowledge for AI:

1. Widget Management Process:
   Adding Widgets:
   1. First, locate the Module and Template
   2. Then, call "Add Widget" API
   3. Next, discover the module's properties
   4. Finally, call "Edit Widget" with the properties

   Important Rules:
   - When adding widgets to a layout:
     * First, ensure the region exists
     * Then, add the widget to the region's playlist
   - When adding widgets to a playlist:
     * Add directly to the playlist
     * No region handling needed

   Region Types and Limitations:
   - frame: Can hold only one widget
     * Automatically converts to playlist when adding second widget
   - playlist: Can hold multiple widgets
     * Widgets play in sequence
   - zone: Used in templates
     * Automatically converts to frame/playlist when widget is added
   - canvas: For elements (not available via API)

   Widget Types:
   - Regular widgets: Can be added via API
   - Data widgets with static templates: Can be added via API
   - Elements: Cannot be added via API

2. Error Handling:
   Common Error Scenarios:
   - 404: Resource not found
   - 409: Conflict with existing entity
   - 422: Invalid entity provided

   Error Response Format:
   \`\`\`json
   {
       "error": {
           "message": "Human readable error message",
           "code": 422,
           "data": {
               "property": "name"
           }
       }
   }
   \`\`\`

3. Important Notes:
   - When editing widgets, all properties must be provided
   - Frame regions automatically convert to playlist when adding second widget
   - Regions are not applicable for standalone playlists
   - Elements cannot be added via API
`; 