/**
 * Xibo Layout Structure Knowledge
 * 
 * This file contains the knowledge base for Xibo's layout structure and content management.
 * It is used to provide the AI with understanding of how to create and manage layouts.
 */

export const layoutStructureKnowledge = `
Layout Structure Knowledge:
1. Basic Layout Components:
   - Layout: Root element with width, height, and background
   - Regions: Areas within the layout that can contain media
   - Media: Content items (widgets) that are displayed in regions
   - Drawer: Hidden container for media used in interactive actions

2. Layout Creation Process:
   - First, create a layout with basic properties
   - Then, add regions to the layout
   - Finally, add media items to the regions

3. Media Types and Properties:
   - Text: For displaying text content
   - Image: For displaying images
   - Video: For playing video content
   - Webpage: For displaying web content
   - Dataset: For displaying data from datasets

4. Interactive Features:
   - Actions: Can be attached to layout, region, or media
   - Triggers: Can be touch or webhook based
   - Targets: Can be region or screen

5. Content Distribution Flow:
   1. Create layout structure
   2. Add regions
   3. Add media items
   4. Configure transitions
   5. Set up scheduling
   6. Assign to displays

When handling layout-related requests:
1. Always verify layout structure requirements
2. Check region compatibility
3. Validate media type support
4. Consider interactive features if needed
5. Ensure proper scheduling setup

Layout XML Structure:
\`\`\`xml
<layout schemaVersion="3" width="1920" height="1080" background="126.jpg" bgcolor="#FF3399">
    <action layoutCode="" widgetId="" triggerCode="" targetId="" target="" sourceId="" source="layout" actionType="" triggerType="" id=""/>
    <region id="1" width="1920" height="1080" top="0" left="0" zindex="1">
        <action layoutCode="" widgetId="" triggerCode="" targetId="" target="" sourceId="" source="region" actionType="" triggerType="" id=""/>
        <media/>
        <options>
            <loop>0</loop>
            <transitionType></transitionType>
            <transitionDuration></transitionDuration>
            <transitionDirection></transitionDirection>
        </options>
    </region>
    <drawer id="">
        <media/>
    </drawer>
    <tags>
        <tag>default</tag>
    </tags>
</layout>
\`\`\`

Region Properties:
- id: Unique identifier for the region
- width: Width of the region
- height: Height of the region
- top: Position from the top of the layout
- left: Position from the left of the layout
- zindex: Drawing order (0 first, with each new region on top)

Media Properties:
- id: Unique identifier for the media
- duration: Playback duration in seconds
- type: Type of media (text, image, video, etc.)
- render: Render type (native or html)
- enableStat: Whether to record proof of play

Transition Properties:
- Type: Fade In, Fade Out, Fly
- Duration: Duration in milliseconds
- Direction: Compass point (N, NE, E, SE, S, SW, W, NW)

Interactive Action Properties:
- id: Action identifier
- actionType: Type of action
- triggerType: touch or webhook
- source: layout, region, or widget
- sourceId: ID of the source
- target: region or screen
- targetId: ID of the target region
- widgetId: ID of the media node in the drawer
`; 