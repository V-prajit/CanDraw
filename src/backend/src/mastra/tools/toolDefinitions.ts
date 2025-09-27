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
    return {
      newElement: {
        id: args.id ?? `rect_${now}`,
        type: 'rectangle',
        x: args.x,
        y: args.y,
        width: args.width,
        height: args.height,
        angle: args.angle ?? 0,
        strokeColor: args.strokeColor ?? '#000000',
        backgroundColor: args.backgroundColor ?? '#ffffff',
        fillStyle: args.fillStyle ?? 'solid',
        strokeWidth: args.strokeWidth ?? 2,
        roughness: args.roughness ?? 1,
        opacity: args.opacity ?? 1,
      },
    };
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

// Schema for relative positioning tool
export const AddRelativeElementSchema = z.object({
  relativeToId: z.string().describe('ID of the existing element to position relative to'),
  position: z.enum(['right', 'left', 'above', 'below', 'above-right', 'above-left', 'below-right', 'below-left'])
    .default('right')
    .describe('Position relative to the reference element'),
  spacing: z.number().default(50).describe('Spacing between elements in pixels'),
  width: z.number().default(200).describe('Rectangle width in pixels'),
  height: z.number().default(150).describe('Rectangle height in pixels'),
  strokeColor: z.string().optional().default('#000000').describe('Stroke (border) color'),
  backgroundColor: z.string().optional().default('#ffffff').describe('Fill color'),
  label: z.string().optional().describe('Optional label for the element'),
  id: z.string().optional().describe('Optional custom element id'),
});

export const addRelativeElementTool = createMastraToolForStateSetter(
  'excalidrawElements',    // state key
  'addRelativeElement',    // state setter name on the frontend
  AddRelativeElementSchema,
  {
    description:
      'Add a rectangle positioned relative to an existing element on the canvas. Use this when the user wants to place elements "next to", "below", or "above" existing elements.',
    toolId: 'addRelativeElement',
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
    addRelativeElementTool,
  },
};

// Export all tools as an array for easy registration
export const ALL_TOOLS = [
  changeTextTool,
  addNewTextLineTool,
  addRectangleTool, // NEW
  addRelativeElementTool, // NEW
];
