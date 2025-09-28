import {
  createMastraToolForFrontendTool,
  createMastraToolForStateSetter,
  createRequestAdditionalContextTool,
} from '@cedar-os/backend';
import { createTool } from '@mastra/core/tools';
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
export const analyzeCanvasTool = createTool({
  id: 'analyzeCanvas',
  description: 'Analyze what elements are currently on the canvas with validation',
  inputSchema: z.object({}),
  outputSchema: z.object({
    analysis: z.string(),
    elementCount: z.number(),
    debug: z.string().optional(),
  }),
  execute: async ({ context }: { context: any }) => {
    const runtimeContext = context?.runtimeContext;
    const additionalContext = runtimeContext?.get('additionalContext');
    
    // Enhanced debugging
    console.log('🔍 Backend analyzeCanvas - Full additionalContext keys:', Object.keys(additionalContext || {}));
    console.log('🔍 Backend analyzeCanvas - canvasElements raw:', additionalContext?.canvasElements);
    console.log('🔍 Backend analyzeCanvas - elementCount from context:', additionalContext?.elementCount);
    
    const canvasElementsString = additionalContext?.canvasElements || '[]';
    const contextElementCount = additionalContext?.elementCount || 0;
    
    let elements = [];
    let parseError = null;
    
    try {
      elements = JSON.parse(canvasElementsString);
    } catch (error: any) {
      parseError = error.message;
      console.error('🚨 JSON parse error:', error);
    }
    
    const foundCount = elements.length;
    
    // VALIDATION: Check for inconsistencies
    let debugInfo = '';
    let finalAnalysis = '';
    
    if (foundCount === 0 && contextElementCount > 0) {
      // FLAKY CASE: Context says there should be elements but we found none
      debugInfo = `⚠️  INCONSISTENCY DETECTED: Context reports ${contextElementCount} elements but received empty array. Possible state sync issue.`;
      finalAnalysis = `Canvas analysis is unreliable - context indicates ${contextElementCount} elements exist but received empty data. Please try adding a new element to refresh the state, or there may be a temporary sync issue.`;
      
      console.warn('🚨 FLAKY BEHAVIOR DETECTED:', {
        contextElementCount,
        foundCount,
        canvasElementsString: canvasElementsString.substring(0, 100)
      });
    } else if (foundCount === 0) {
      // CONFIRMED EMPTY: Both counts agree it's empty
      finalAnalysis = 'Canvas is confirmed empty - no elements detected.';
      debugInfo = '✅ Confirmed empty state';
    } else {
      // SUCCESS: Found elements
      const elementSummary = elements.map((e, i) => {
        const pos = e.x !== undefined && e.y !== undefined ? ` at (${Math.round(e.x)}, ${Math.round(e.y)})` : '';
        const size = e.width && e.height ? ` [${Math.round(e.width)}×${Math.round(e.height)}]` : '';
        return `${i+1}. ${e.type}${pos}${size}`;
      }).join('\n');
      
      finalAnalysis = `Found ${foundCount} element${foundCount === 1 ? '' : 's'} on canvas:\n${elementSummary}`;
      debugInfo = `✅ Successfully parsed ${foundCount} elements`;
      
      console.log('✅ Canvas analysis successful:', {
        foundCount,
        types: elements.map(e => e.type)
      });
    }
    
    return {
      analysis: finalAnalysis,
      elementCount: foundCount,
      debug: debugInfo + (parseError ? ` | Parse error: ${parseError}` : '')
    };
  },
});

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
  },
  // NEW category for canvas analysis
  canvasAnalysis: {
    analyzeCanvasTool,
  },
};

// Export all tools as an array for easy registration
export const ALL_TOOLS = [
  changeTextTool,
  addNewTextLineTool,
  addRectangleTool, // NEW
  analyzeCanvasTool,
];
