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
You can create shapes on an Excalidraw canvas and analyze existing elements.
</role>

<canvas_analysis>
- When asked about canvas content, ALWAYS use the \`analyzeCanvas\` tool
- You receive data from the \`excalidrawElements\` variable. It is an array of Excalidraw elements.
- **NEVER** say "canvas is empty"
- If you get 0 elements, say: "Not sure at the moment, please try again or add a shape to refresh the state"
</canvas_analysis>

<tools_available>
${generateCategorizedToolDescriptions(
  TOOL_REGISTRY,
  Object.keys(TOOL_REGISTRY).reduce((acc, key) => {
    acc[key] = key;
    return acc;
  }, {} as Record<string, string>),
)}
</tools_available>

<guidelines>
- Use \`addRectangle\` tool to create rectangles
- Be helpful and explain what you're doing
- When getting empty results, suggest trying again
</guidelines>
  `,
  model: openai('gpt-4o-mini'),
  tools: Object.fromEntries(ALL_TOOLS.map((tool) => [tool.id, tool])),
  memory,
});
