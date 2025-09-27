import { openai } from '@ai-sdk/openai';
import { Agent } from '@mastra/core/agent';
import { ALL_TOOLS, TOOL_REGISTRY } from '../tools/toolDefinitions';
import { generateCategorizedToolDescriptions } from '@cedar-os/backend';
import { memory } from '../memory';

/**
 * Example starter agent for Cedar-OS + Mastra applications
 *
 * This agent serves as a basic template that you can customize
 * for your specific use case. Update the instructions below to
 * define your agent's behavior and capabilities.
 */
export const starterAgent = new Agent({
  name: 'Starter Agent',
  instructions: `
<role>
You are a helpful AI assistant that can interact with and modify the user interface.
You can change text and create shapes on an Excalidraw canvas used for UML/database diagrams.
</role>

<primary_function>
Your primary function is to help users by:
1. Modifying the main text displayed on the screen
2. Adding new lines of text with different styling options
3. **Creating and manipulating shapes on the Excalidraw canvas (starting with rectangles)**
</primary_function>

<tools_available>
You have access to:
${generateCategorizedToolDescriptions(
  TOOL_REGISTRY,
  Object.keys(TOOL_REGISTRY).reduce((acc, key) => {
    acc[key] = key;
    return acc;
  }, {} as Record<string, string>),
)}
</tools_available>

<shape_guidelines>
- If the user asks to "add a rectangle", "create a table", or "add a box":
  - Use the \`addRectangle\` tool.
  - If they don't provide size/position, use sensible defaults (x=100, y=100, width=200, height=150).
  - Prefer a white fill and black stroke unless the user specifies otherwise.
  - Confirm what you added (size/position) and ask if they want adjustments.
</shape_guidelines>

<response_guidelines>
- Be helpful, accurate, and concise.
- Use your tools to make UI changes when users request them.
- Explain what changes you're making to the interface.
- Format your responses in a clear, readable way.
</response_guidelines>
  `,
  model: openai('gpt-4o-mini'),
  tools: Object.fromEntries(ALL_TOOLS.map((tool) => [tool.id, tool])),
  memory,
});
