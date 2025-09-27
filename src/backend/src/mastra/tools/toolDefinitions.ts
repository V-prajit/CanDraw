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
        width: processedArgs.text.length * (processedArgs.fontSize * 0.6), // Approximate width
        height: processedArgs.fontSize * 1.2, // Approximate height
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
    fields: z.array(z.string()).default([]).describe('Array of field names for the table'),

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

    // Calculate total table height
    const totalHeight = processedArgs.headerHeight + (processedArgs.fields.length * processedArgs.fieldHeight);

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
    });

    // 3. Header text (table name)
    elements.push({
      id: `${processedArgs.tableId}_header_text`,
      type: 'text',
      x: processedArgs.x + 10,
      y: processedArgs.y + 8,
      width: processedArgs.tableWidth - 20,
      height: processedArgs.headerHeight - 16,
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
      textAlign: 'center',
      verticalAlign: 'middle',
    });

    // 4. Field separators and text
    processedArgs.fields.forEach((field, index) => {
      const fieldY = processedArgs.y + processedArgs.headerHeight + (index * processedArgs.fieldHeight);

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
        });
      }

      // Field text
      elements.push({
        id: `${processedArgs.tableId}_field_${index}`,
        type: 'text',
        x: processedArgs.x + 10,
        y: fieldY + 5,
        width: processedArgs.tableWidth - 20,
        height: processedArgs.fieldHeight - 10,
        angle: 0,
        strokeColor: processedArgs.textColor,
        backgroundColor: 'transparent',
        fillStyle: 'solid',
        strokeWidth: 1,
        roughness: 0,
        opacity: 1,
        text: field,
        fontSize: 14,
        fontFamily: 1,
        textAlign: 'left',
        verticalAlign: 'middle',
      });
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
};

// Export all tools as an array for easy registration
export const ALL_TOOLS = [
  changeTextTool,
  addNewTextLineTool,
  addRectangleTool, // NEW
  addTextTool, // NEW
  createDatabaseTableTool, // NEW
];
