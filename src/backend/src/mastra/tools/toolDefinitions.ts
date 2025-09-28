import {
  createMastraToolForFrontendTool,
  createMastraToolForStateSetter,
  createRequestAdditionalContextTool,
} from '@cedar-os/backend';
import { streamJSONEvent } from '../../utils/streamUtils';
import { z } from 'zod';

// Define the schemas for our tools based on what we registered in page.tsx

// Schema for the addNewTextLine frontend tool
export const AddNewTextLineSchema = z.object({
  text: z.string().min(1, 'Text cannot be empty').describe('The text to add to the screen'),
  style: z
    .enum(['normal', 'bold', 'italic', 'highlight'])
    .optional()
    .describe('Text style to apply'),
});

// Schema for the changeText state setter
export const ChangeTextSchema = z.object({
  newText: z.string().min(1, 'Text cannot be empty').describe('The new text to display'),
});

// Error response schema
export const ErrorResponseSchema = z.object({
  error: z.string(),
  details: z.string().optional(),
});

// Create backend tools for the frontend tool
export const addNewTextLineTool = createMastraToolForFrontendTool(
  'addNewTextLine',
  AddNewTextLineSchema,
  {
    description:
      'Add a new line of text to the screen with optional styling. This tool allows the agent to dynamically add text content that will be displayed on the user interface with different visual styles.',
    toolId: 'addNewTextLine',
    streamEventFn: streamJSONEvent,
    errorSchema: ErrorResponseSchema,
  },
);

// Create backend tools for the state setter
export const changeTextTool = createMastraToolForStateSetter(
  'mainText', // The state key
  'changeText', // The state setter name
  ChangeTextSchema,
  {
    description:
      'Change the main text displayed on the screen. This tool allows the agent to modify the primary text content that users see, replacing the current text with new content.',
    toolId: 'changeText',
    streamEventFn: streamJSONEvent,
    errorSchema: ErrorResponseSchema,
  },
);

export const requestAdditionalContextTool = createRequestAdditionalContextTool();

/* ---------------- NEW: Rectangle tool ---------------- */

/**
 * Accepts simple rectangle specs from the agent and transforms them into the
 * frontend setter args shape: { newElement: <ExcalidrawElement> }.
 *
 * Notes:
 * - Defaults keep the tool usable with minimal prompts ("add a rectangle").
 * - The structure matches your Excalidraw element reference.
 */
export const AddRectangleSchema = z
  .object({
    // position & size
    x: z.number().default(100).describe('Left (x) position in pixels'),
    y: z.number().default(100).describe('Top (y) position in pixels'),
    width: z.number().default(200).describe('Rectangle width in pixels'),
    height: z.number().default(150).describe('Rectangle height in pixels'),

    // styling
    angle: z.number().optional().default(0).describe('Rotation in radians'),
    strokeColor: z.string().optional().default('#000000').describe('Stroke (border) color'),
    backgroundColor: z.string().optional().default('#ffffff').describe('Fill color'),
    fillStyle: z
      .enum(['solid', 'hachure', 'cross-hatch'])
      .optional()
      .default('solid')
      .describe('Fill style'),
    strokeWidth: z.number().optional().default(2).describe('Stroke thickness'),
    roughness: z.number().min(0).max(2).optional().default(1).describe('Sketchiness 0–2'),
    opacity: z.number().min(0).max(1).optional().default(1).describe('Opacity 0–1'),

    // advanced/optional
    id: z.string().optional().describe('Optional custom element id'),
  })
  .transform((args) => {
    const now = Date.now();

    // DEBUGGING: Log input args and transformation process
    console.log('🔧 AddRectangleSchema.transform() called with args:', args);
    console.log('🔧 Args type:', typeof args, 'Is object:', typeof args === 'object');
    console.log('🔧 Args keys:', args ? Object.keys(args) : 'no keys');

    // Ensure defaults are applied even if args is empty/undefined
    const safeArgs = args || {};
    const processedArgs = {
      id: safeArgs.id ?? `rect_${now}_${Math.random().toString(36).substr(2, 9)}`,
      x: safeArgs.x ?? 100,
      y: safeArgs.y ?? 100,
      width: safeArgs.width ?? 200,
      height: safeArgs.height ?? 150,
      angle: safeArgs.angle ?? 0,
      strokeColor: safeArgs.strokeColor ?? '#000000',
      backgroundColor: safeArgs.backgroundColor ?? '#ffffff',
      fillStyle: safeArgs.fillStyle ?? 'solid',
      strokeWidth: safeArgs.strokeWidth ?? 2,
      roughness: safeArgs.roughness ?? 1,
      opacity: safeArgs.opacity ?? 1,
    };

    const result = {
      newElement: {
        id: processedArgs.id,
        type: 'rectangle',
        x: processedArgs.x,
        y: processedArgs.y,
        width: processedArgs.width,
        height: processedArgs.height,
        angle: processedArgs.angle,
        strokeColor: processedArgs.strokeColor,
        backgroundColor: processedArgs.backgroundColor,
        fillStyle: processedArgs.fillStyle,
        strokeWidth: processedArgs.strokeWidth,
        roughness: processedArgs.roughness,
        opacity: processedArgs.opacity,
      },
    };

    console.log('🚀 AddRectangleSchema.transform() returning:', result);
    console.log('🚀 newElement structure:', result.newElement);

    return result;
  });

export const addRectangleTool = createMastraToolForStateSetter(
  'excalidrawElements',    // state key
  'addElement',            // state setter name on the frontend
  AddRectangleSchema,      // Zod schema that transforms to { newElement }
  {
    description:
      'Spawn a rectangle on the Excalidraw canvas at (x, y) with given dimensions and optional style.',
    toolId: 'addRectangle',
    streamEventFn: streamJSONEvent,
    errorSchema: ErrorResponseSchema,
  },
);

/* ---------------- NEW: Text tool ---------------- */

/**
 * Schema for adding text elements to the Excalidraw canvas.
 * Transforms simple text specs into the frontend setter args shape: { newElement: <ExcalidrawElement> }.
 */
export const AddTextSchema = z
  .object({
    // text content
    text: z.string().min(1, 'Text cannot be empty').describe('The text content to display'),

    // position
    x: z.number().default(150).describe('Left (x) position in pixels'),
    y: z.number().default(150).describe('Top (y) position in pixels'),

    // styling
    fontSize: z.number().optional().default(20).describe('Font size in pixels'),
    strokeColor: z.string().optional().default('#000000').describe('Text color'),
    backgroundColor: z.string().optional().default('transparent').describe('Text background color'),
    opacity: z.number().min(0).max(1).optional().default(1).describe('Text opacity 0–1'),

    // advanced/optional
    id: z.string().optional().describe('Optional custom element id'),
  })
  .transform((args) => {
    const now = Date.now();

    console.log('🔧 AddTextSchema.transform() called with args:', args);

    // Ensure defaults are applied
    const safeArgs = args || {};
    const processedArgs = {
      id: safeArgs.id ?? `text_${now}_${Math.random().toString(36).substr(2, 9)}`,
      text: safeArgs.text || 'Sample Text',
      x: safeArgs.x ?? 150,
      y: safeArgs.y ?? 150,
      fontSize: safeArgs.fontSize ?? 20,
      strokeColor: safeArgs.strokeColor ?? '#000000',
      backgroundColor: safeArgs.backgroundColor ?? 'transparent',
      opacity: safeArgs.opacity ?? 1,
    };

    const result = {
      newElement: {
        id: processedArgs.id,
        type: 'text',
        x: processedArgs.x,
        y: processedArgs.y,
        width: Math.max(50, processedArgs.text.length * (processedArgs.fontSize * 0.6)), // Minimum width with better calculation
        height: processedArgs.fontSize * 1.4, // Better height calculation
        angle: 0,
        strokeColor: processedArgs.strokeColor,
        backgroundColor: processedArgs.backgroundColor,
        fillStyle: 'solid',
        strokeWidth: 1,
        roughness: 0, // Text should be clean, not sketchy
        opacity: processedArgs.opacity,
        text: processedArgs.text,
        fontSize: processedArgs.fontSize,
        fontFamily: 1, // Default font family in Excalidraw
        textAlign: 'left',
        verticalAlign: 'top',
        baseline: processedArgs.fontSize, // Add baseline for consistent text positioning
        containerId: null, // Standalone text element
        originalText: processedArgs.text, // Add original text property
      },
    };

    console.log('🚀 AddTextSchema.transform() returning:', result);
    return result;
  });

export const addTextTool = createMastraToolForStateSetter(
  'excalidrawElements',    // state key
  'addElement',            // state setter name on the frontend
  AddTextSchema,           // Zod schema that transforms to { newElement }
  {
    description:
      'Add text elements to the Excalidraw canvas at specified position with customizable styling.',
    toolId: 'addText',
    streamEventFn: streamJSONEvent,
    errorSchema: ErrorResponseSchema,
  },
);

/* ---------------- NEW: Database Table Tool ---------------- */

/**
 * Schema for creating complete database tables with name and fields.
 * Creates a table structure with header and field rows automatically positioned.
 */
export const CreateDatabaseTableSchema = z
  .object({
    // table info
    tableName: z.string().min(1, 'Table name cannot be empty').describe('The name of the database table'),
    fields: z.array(z.object({ name: z.string(), type: z.string().optional() })).default([]).describe('Array of field objects for the table, each with a name and optional type'),
    primaryKeys: z.array(z.string()).optional().describe('Array of primary key field names'),

    // position
    x: z.number().default(100).describe('Left (x) position for the table'),
    y: z.number().default(100).describe('Top (y) position for the table'),

    // styling
    tableWidth: z.number().default(250).describe('Width of the table rectangle'),
    headerHeight: z.number().default(40).describe('Height of the table header'),
    fieldHeight: z.number().default(30).describe('Height of each field row'),

    // colors
    headerColor: z.string().default('#e3f2fd').describe('Header background color'),
    fieldColor: z.string().default('#ffffff').describe('Field background color'),
    borderColor: z.string().default('#1976d2').describe('Table border color'),
    textColor: z.string().default('#000000').describe('Text color'),

    // advanced/optional
    tableId: z.string().optional().describe('Optional custom table id prefix'),
  })
  .transform((args) => {
    const now = Date.now();
    const random = Math.random().toString(36).substr(2, 9);

    console.log('🔧 CreateDatabaseTableSchema.transform() called with args:', args);

    // Ensure defaults are applied
    const safeArgs = args || {};
    const processedArgs = {
      tableName: safeArgs.tableName || 'NewTable',
      fields: safeArgs.fields || [],
      primaryKeys: safeArgs.primaryKeys || [],
      x: safeArgs.x ?? 100,
      y: safeArgs.y ?? 100,
      tableWidth: safeArgs.tableWidth ?? 250,
      headerHeight: safeArgs.headerHeight ?? 40,
      fieldHeight: safeArgs.fieldHeight ?? 30,
      headerColor: safeArgs.headerColor ?? '#e3f2fd',
      fieldColor: safeArgs.fieldColor ?? '#ffffff',
      borderColor: safeArgs.borderColor ?? '#1976d2',
      textColor: safeArgs.textColor ?? '#000000',
      tableId: safeArgs.tableId ?? `table_${now}_${random}`,
    };

    // Auto-detect 'id' as primary key if no primary keys are provided
    if (processedArgs.primaryKeys.length === 0 && processedArgs.fields.map(f => f.name).includes('id')) {
      processedArgs.primaryKeys.push('id');
    }

    // Calculate total table height
    const totalHeight = processedArgs.headerHeight + (processedArgs.fields.length * processedArgs.fieldHeight);

    // Create unique group ID for this table so all elements move together
    const tableGroupId = `${processedArgs.tableId}_group`;

    // Create elements array
    const elements = [];

    // 1. Main table rectangle (background)
    elements.push({
      id: `${processedArgs.tableId}_bg`,
      type: 'rectangle',
      x: processedArgs.x,
      y: processedArgs.y,
      width: processedArgs.tableWidth,
      height: totalHeight,
      angle: 0,
      strokeColor: processedArgs.borderColor,
      backgroundColor: processedArgs.fieldColor,
      fillStyle: 'solid',
      strokeWidth: 2,
      roughness: 0, // Clean lines for database tables
      opacity: 1,
      groupIds: [tableGroupId], // Group with other table elements
    });

    // 2. Header rectangle
    elements.push({
      id: `${processedArgs.tableId}_header`,
      type: 'rectangle',
      x: processedArgs.x,
      y: processedArgs.y,
      width: processedArgs.tableWidth,
      height: processedArgs.headerHeight,
      angle: 0,
      strokeColor: processedArgs.borderColor,
      backgroundColor: processedArgs.headerColor,
      fillStyle: 'solid',
      strokeWidth: 2,
      roughness: 0,
      opacity: 1,
      groupIds: [tableGroupId], // Group with other table elements
    });

    // 3. Header text (table name)
    elements.push({
      id: `${processedArgs.tableId}_header_text`,
      type: 'text',
      x: processedArgs.x + 10, // Left-aligned with padding for better visibility
      y: processedArgs.y + 10, // Top-aligned with padding
      width: processedArgs.tableWidth - 20, // Set explicit width
      height: processedArgs.headerHeight - 20, // Set explicit height
      angle: 0,
      strokeColor: processedArgs.textColor,
      backgroundColor: 'transparent',
      fillStyle: 'solid',
      strokeWidth: 1,
      roughness: 0,
      opacity: 1,
      text: processedArgs.tableName,
      fontSize: 16,
      fontFamily: 1,
      textAlign: 'left',
      verticalAlign: 'top',
      baseline: 16, // Add baseline for text positioning
      containerId: null, // Standalone text element
      originalText: processedArgs.tableName, // Add original text property
      groupIds: [tableGroupId], // Group with other table elements
    });

    // 4. Field separators and text
    processedArgs.fields.forEach((field, index) => {
      const fieldY = processedArgs.y + processedArgs.headerHeight + (index * processedArgs.fieldHeight);
      const isPrimaryKey = processedArgs.primaryKeys.includes(field.name);
      const fieldTextContent = field.type ? `${field.name} (${field.type})` : field.name;

      // Field separator line (except for the last field)
      if (index > 0) {
        elements.push({
          id: `${processedArgs.tableId}_separator_${index}`,
          type: 'line',
          x: processedArgs.x,
          y: fieldY,
          width: processedArgs.tableWidth,
          height: 0,
          angle: 0,
          strokeColor: processedArgs.borderColor,
          backgroundColor: 'transparent',
          fillStyle: 'solid',
          strokeWidth: 1,
          roughness: 0,
          opacity: 1,
          points: [[0, 0], [processedArgs.tableWidth, 0]],
          groupIds: [tableGroupId], // Group with other table elements
        });
      }

      // Field text
      const fieldText = {
        id: `${processedArgs.tableId}_field_${index}`,
        type: 'text',
        x: processedArgs.x + 10, // Left-aligned with padding
        y: fieldY + 5, // Top-aligned within field with small padding
        width: processedArgs.tableWidth - 20, // Set explicit width
        height: processedArgs.fieldHeight - 10, // Set explicit height
        angle: 0,
        strokeColor: processedArgs.textColor,
        backgroundColor: 'transparent',
        fillStyle: 'solid',
        strokeWidth: 1,
        roughness: 0,
        opacity: 1,
        text: fieldTextContent,
        fontSize: 14,
        fontFamily: 1,
        textAlign: 'left',
        verticalAlign: 'top',
        baseline: 14, // Add baseline for text positioning
        containerId: null, // Standalone text element
        originalText: fieldTextContent, // Add original text property
        groupIds: [tableGroupId], // Group with other table elements
      };
      elements.push(fieldText);

      if (isPrimaryKey) {
        elements.push({
            id: `${processedArgs.tableId}_field_${index}_underline`,
            type: 'line',
            x: fieldText.x,
            y: fieldText.y + fieldText.height - 2,
            width: field.name.length * 8,
            height: 0,
            angle: 0,
            strokeColor: processedArgs.textColor,
            backgroundColor: 'transparent',
            fillStyle: 'solid',
            strokeWidth: 1,
            roughness: 0,
            opacity: 1,
            points: [[0, 0], [field.name.length * 7, 0]],
            groupIds: [tableGroupId],
        });
      }
    });

    const result = {
      elements: elements, // Return multiple elements
    };

    console.log('🚀 CreateDatabaseTableSchema.transform() returning:', result);
    console.log('🚀 Created', elements.length, 'elements for table:', processedArgs.tableName);

    return result;
  });

export const createDatabaseTableTool = createMastraToolForStateSetter(
  'excalidrawElements',    // state key
  'addMultipleElements',   // NEW: state setter for multiple elements
  CreateDatabaseTableSchema,
  {
    description:
      'Create a complete database table with header and fields on the Excalidraw canvas. Automatically generates table structure with proper positioning and styling.',
    toolId: 'createDatabaseTable',
    streamEventFn: streamJSONEvent,
    errorSchema: ErrorResponseSchema,
  },
);

/* ---------------- NEW: Connect Tables with Arrow Tool ---------------- */

/**
 * Schema for connecting two tables with a relationship arrow.
 * Creates arrows that represent foreign key relationships and other UML connections.
 */
export const ConnectTablesArrowSchema = z
  .object({
    // Source and target positions
    sourceX: z.number().describe('X coordinate of the source table center or edge'),
    sourceY: z.number().describe('Y coordinate of the source table center or edge'),
    targetX: z.number().describe('X coordinate of the target table center or edge'),
    targetY: z.number().describe('Y coordinate of the target table center or edge'),

    // Table binding (optional - will auto-detect if not provided)
    sourceTableId: z.string().optional().describe('ID of the source table element to bind to'),
    targetTableId: z.string().optional().describe('ID of the target table element to bind to'),

    // Relationship type
    relationshipType: z
      .enum(['one-to-one', 'one-to-many', 'many-to-one', 'many-to-many', 'simple'])
      .default('simple')
      .describe('Type of database relationship'),

    // Styling
    strokeColor: z.string().default('#1976d2').describe('Arrow color'),
    strokeWidth: z.number().default(2).describe('Arrow thickness'),
    label: z.string().optional().describe('Optional relationship label'),

    // Table detection (optional - for auto-binding)
    existingElements: z.array(z.record(z.unknown())).optional().describe('Current canvas elements for auto-detecting tables at coordinates'),

    // Advanced/optional
    id: z.string().optional().describe('Optional custom arrow id'),
  })
  .transform((args) => {
    const now = Date.now();
    const random = Math.random().toString(36).substr(2, 9);

    console.log('🔧 ConnectTablesArrowSchema.transform() called with args:', args);

    // Ensure defaults are applied
    const safeArgs = args || {};
    const processedArgs = {
      sourceX: safeArgs.sourceX ?? 100,
      sourceY: safeArgs.sourceY ?? 100,
      targetX: safeArgs.targetX ?? 300,
      targetY: safeArgs.targetY ?? 100,
      sourceTableId: safeArgs.sourceTableId,
      targetTableId: safeArgs.targetTableId,
      relationshipType: safeArgs.relationshipType ?? 'simple',
      strokeColor: safeArgs.strokeColor ?? '#1976d2',
      strokeWidth: safeArgs.strokeWidth ?? 2,
      label: safeArgs.label,
      existingElements: safeArgs.existingElements,
      id: safeArgs.id ?? `arrow_${now}_${random}`,
    };

    // Helper function to find table at given coordinates
    function findTableAtCoordinates(x, y, existingElements) {
      if (!existingElements || !Array.isArray(existingElements)) {
        console.log('🔍 No existing elements provided for table detection');
        return null;
      }

      console.log(`🔍 Looking for table at coordinates (${x}, ${y}) among ${existingElements.length} elements`);

      // Look for table background elements (ID pattern: *_bg)
      const tableElements = existingElements.filter(el =>
        el && el.id && el.id.endsWith('_bg') && el.type === 'rectangle'
      );

      console.log(`🔍 Found ${tableElements.length} table background elements:`,
        tableElements.map(t => ({ id: t.id, x: t.x, y: t.y, w: t.width, h: t.height }))
      );

      // Check if coordinates fall within any table bounds
      for (const table of tableElements) {
        const withinBounds = (
          x >= table.x &&
          x <= table.x + table.width &&
          y >= table.y &&
          y <= table.y + table.height
        );

        console.log(`🔍 Checking table ${table.id}: bounds (${table.x}, ${table.y}, ${table.width}, ${table.height}) - match: ${withinBounds}`);

        if (withinBounds) {
          console.log(`🎯 Found table at coordinates: ${table.id}`);
          return table.id;
        }
      }

      console.log('❌ No table found at the given coordinates');
      return null;
    }

    // Calculate arrow points and dimensions
    const deltaX = processedArgs.targetX - processedArgs.sourceX;
    const deltaY = processedArgs.targetY - processedArgs.sourceY;

    // Create points array for arrow (relative to arrow's x,y position)
    const points = [
      [0, 0], // Start point (relative to arrow position)
      [deltaX, deltaY], // End point (relative to arrow position)
    ];

    // Determine arrowhead style based on relationship type
    let startArrowhead = null;
    let endArrowhead = 'arrow';

    if (processedArgs.relationshipType === 'one-to-many') {
      startArrowhead = null; // One side - no arrowhead
      endArrowhead = 'arrow'; // Many side - standard arrow
    } else if (processedArgs.relationshipType === 'many-to-one') {
      startArrowhead = 'arrow'; // Many side - arrow
      endArrowhead = null; // One side - no arrowhead
    } else if (processedArgs.relationshipType === 'many-to-many') {
      startArrowhead = 'arrow'; // Both sides have arrows
      endArrowhead = 'arrow';
    } else if (processedArgs.relationshipType === 'one-to-one') {
      startArrowhead = null; // Clean line for 1:1
      endArrowhead = null;
    } else {
      // 'simple' - standard arrow
      startArrowhead = null;
      endArrowhead = 'arrow';
    }

    // Create element bindings for connected arrows
    let startBinding = null;
    let endBinding = null;

    // Auto-detect table IDs if not provided and existingElements available
    if (!processedArgs.sourceTableId && processedArgs.existingElements) {
      const detectedSourceTableId = findTableAtCoordinates(
        processedArgs.sourceX,
        processedArgs.sourceY,
        processedArgs.existingElements
      );
      if (detectedSourceTableId) {
        processedArgs.sourceTableId = detectedSourceTableId;
        console.log('🎯 Auto-detected source table:', detectedSourceTableId);
      }
    }

    if (!processedArgs.targetTableId && processedArgs.existingElements) {
      const detectedTargetTableId = findTableAtCoordinates(
        processedArgs.targetX,
        processedArgs.targetY,
        processedArgs.existingElements
      );
      if (detectedTargetTableId) {
        processedArgs.targetTableId = detectedTargetTableId;
        console.log('🎯 Auto-detected target table:', detectedTargetTableId);
      }
    }

    // Create bindings using explicit or detected table IDs
    if (processedArgs.sourceTableId) {
      startBinding = {
        elementId: processedArgs.sourceTableId,
        focus: 0.5, // Middle of the edge
        gap: 0
      };
      console.log('🔗 Created start binding with table ID:', startBinding);
    }

    if (processedArgs.targetTableId) {
      endBinding = {
        elementId: processedArgs.targetTableId,
        focus: 0.5, // Middle of the edge
        gap: 0
      };
      console.log('🔗 Created end binding with table ID:', endBinding);
    }

    // Log available context for debugging
    console.log('🔍 Arrow tool context:', {
      sourceCoords: [processedArgs.sourceX, processedArgs.sourceY],
      targetCoords: [processedArgs.targetX, processedArgs.targetY],
      hasSourceTableId: !!processedArgs.sourceTableId,
      hasTargetTableId: !!processedArgs.targetTableId
    });

    const result = {
      newElement: {
        id: processedArgs.id,
        type: 'arrow',
        x: processedArgs.sourceX, // Arrow position starts at source
        y: processedArgs.sourceY,
        width: Math.abs(deltaX), // Calculate proper width/height for bounding box
        height: Math.abs(deltaY),
        angle: 0,
        strokeColor: processedArgs.strokeColor,
        backgroundColor: 'transparent',
        fillStyle: 'solid',
        strokeWidth: processedArgs.strokeWidth,
        roughness: 0, // Clean arrows for database diagrams
        opacity: 1,
        points: points,
        lastCommittedPoint: null,
        start: processedArgs.sourceTableId ? { id: processedArgs.sourceTableId } : undefined,
        end: processedArgs.targetTableId ? { id: processedArgs.targetTableId } : undefined,
        startArrowhead: startArrowhead,
        endArrowhead: endArrowhead,
      },
    };

    console.log('🚀 ConnectTablesArrowSchema.transform() returning:', result);
    console.log('🚀 Arrow type:', processedArgs.relationshipType, 'Start:', startArrowhead, 'End:', endArrowhead);
    console.log('🔗 Final binding:', {
      sourceTableId: processedArgs.sourceTableId,
      targetTableId: processedArgs.targetTableId,
      start: result.newElement.start,
      end: result.newElement.end
    });

    return result;
  });

export const connectTablesArrowTool = createMastraToolForStateSetter(
  'excalidrawElements',    // state key
  'addElement',            // state setter name on the frontend
  ConnectTablesArrowSchema,
  {
    description:
      'Connect two database tables with a relationship arrow. Supports different UML relationship types and automatically positions arrows between table coordinates.',
    toolId: 'connectTablesArrow',
    streamEventFn: streamJSONEvent,
    errorSchema: ErrorResponseSchema,
  },
);

/* ---------------- NEW: Add Relationship Arrow Tool ---------------- */

/**
 * Schema for adding standalone relationship arrows.
 * More flexible than connectTablesArrow - allows custom positioning and styling.
 */
export const AddRelationshipArrowSchema = z
  .object({
    // Start and end coordinates
    startX: z.number().default(100).describe('Arrow start X coordinate'),
    startY: z.number().default(100).describe('Arrow start Y coordinate'),
    endX: z.number().default(200).describe('Arrow end X coordinate'),
    endY: z.number().default(100).describe('Arrow end Y coordinate'),

    // Arrow styling
    arrowType: z
      .enum(['simple', 'double', 'none'])
      .default('simple')
      .describe('Arrow head style'),
    strokeColor: z.string().default('#1976d2').describe('Arrow color'),
    strokeWidth: z.number().default(2).describe('Arrow thickness'),
    style: z
      .enum(['solid', 'dashed', 'dotted'])
      .default('solid')
      .describe('Line style'),

    // Optional label
    label: z.string().optional().describe('Optional arrow label'),
    labelPosition: z
      .enum(['start', 'middle', 'end'])
      .default('middle')
      .describe('Label position along arrow'),

    // Advanced/optional
    id: z.string().optional().describe('Optional custom arrow id'),
  })
  .transform((args) => {
    const now = Date.now();
    const random = Math.random().toString(36).substr(2, 9);

    console.log('🔧 AddRelationshipArrowSchema.transform() called with args:', args);

    // Ensure defaults are applied
    const safeArgs = args || {};
    const processedArgs = {
      startX: safeArgs.startX ?? 100,
      startY: safeArgs.startY ?? 100,
      endX: safeArgs.endX ?? 200,
      endY: safeArgs.endY ?? 100,
      arrowType: safeArgs.arrowType ?? 'simple',
      strokeColor: safeArgs.strokeColor ?? '#1976d2',
      strokeWidth: safeArgs.strokeWidth ?? 2,
      style: safeArgs.style ?? 'solid',
      label: safeArgs.label,
      labelPosition: safeArgs.labelPosition ?? 'middle',
      id: safeArgs.id ?? `rel_arrow_${now}_${random}`,
    };

    // Calculate arrow dimensions
    const deltaX = processedArgs.endX - processedArgs.startX;
    const deltaY = processedArgs.endY - processedArgs.startY;

    // Create points array (relative to arrow position)
    const points = [[0, 0], [deltaX, deltaY]];

    // Determine arrowhead configuration
    let startArrowhead = null;
    let endArrowhead = null;

    if (processedArgs.arrowType === 'simple') {
      endArrowhead = 'arrow';
    } else if (processedArgs.arrowType === 'double') {
      startArrowhead = 'arrow';
      endArrowhead = 'arrow';
    }
    // 'none' keeps both null

    // Convert style to strokeStyle
    const strokeStyleMap = {
      solid: 'solid',
      dashed: 'dashed',
      dotted: 'dotted',
    };

    const result = {
      newElement: {
        id: processedArgs.id,
        type: 'arrow',
        x: processedArgs.startX,
        y: processedArgs.startY,
        width: Math.abs(deltaX),
        height: Math.abs(deltaY),
        angle: 0,
        strokeColor: processedArgs.strokeColor,
        backgroundColor: 'transparent',
        fillStyle: 'solid',
        strokeWidth: processedArgs.strokeWidth,
        strokeStyle: strokeStyleMap[processedArgs.style],
        roughness: 0, // Clean for UML diagrams
        opacity: 1,
        points: points,
        lastCommittedPoint: null,
        startBinding: null,
        endBinding: null,
        startArrowhead: startArrowhead,
        endArrowhead: endArrowhead,
      },
    };

    console.log('🚀 AddRelationshipArrowSchema.transform() returning:', result);
    console.log('🚀 Arrow from:', `(${processedArgs.startX}, ${processedArgs.startY})`, 'to:', `(${processedArgs.endX}, ${processedArgs.endY})`);

    return result;
  });

export const addRelationshipArrowTool = createMastraToolForStateSetter(
  'excalidrawElements',    // state key
  'addElement',            // state setter name on the frontend
  AddRelationshipArrowSchema,
  {
    description:
      'Add a standalone relationship arrow with custom positioning and styling. Ideal for creating custom UML relationships and annotations.',
    toolId: 'addRelationshipArrow',
    streamEventFn: streamJSONEvent,
    errorSchema: ErrorResponseSchema,
  },
);

/**
 * Registry of all available tools organized by category
 * This structure makes it easy to see tool organization and generate categorized descriptions
 */
export const TOOL_REGISTRY = {
  textManipulation: {
    changeTextTool,
    addNewTextLineTool,
  },
  // NEW category for shape tools
  shapeManipulation: {
    addRectangleTool,
    addTextTool,
    createDatabaseTableTool,
  },
  // NEW category for relationship tools
  relationshipManipulation: {
    connectTablesArrowTool,
    addRelationshipArrowTool,
  },
};

// Export all tools as an array for easy registration
export const ALL_TOOLS = [
  changeTextTool,
  addNewTextLineTool,
  addRectangleTool, // NEW
  addTextTool, // NEW
  createDatabaseTableTool, // NEW
  connectTablesArrowTool, // NEW
  addRelationshipArrowTool, // NEW
];
