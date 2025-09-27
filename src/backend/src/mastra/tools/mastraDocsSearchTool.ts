// ---------------------------------------------
// Tools are a Mastra primitive to interact with external systems
// Docs: https://mastra.ai/en/docs/tools-mcp/overview
// ---------------------------------------------

import { createTool } from '@mastra/core/tools';
import { z } from 'zod';

export const mastraDocsSearchTool = createTool({
  id: 'mastra-docs-search',
  description:
    'Search the Mastra documentation for a given query string and return a short answer.',
  inputSchema: z.object({ query: z.string() }),
  outputSchema: z.object({ answer: z.string() }),

  execute: async ({ context }) => {
    // Extract the query from the validated input
    const { query } = context as { query: string };
    // TODO: Replace with real documentation search
    return { answer: `Documentation search not yet implemented for query: ${query}` };
  },
});
