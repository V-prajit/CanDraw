import { registerApiRoute } from '@mastra/core/server';
import { ChatInputSchema, chatWorkflow } from './workflows/chatWorkflow';
import { voiceWorkflow } from './workflows/voiceWorkflow';
import { VoiceInputSchema } from './workflows/voiceWorkflowTypes';
import { zodToJsonSchema } from 'zod-to-json-schema';
import { createSSEStream } from '../utils/streamUtils';
import OpenAI from 'openai';

// Helper function to convert Zod schema to OpenAPI schema
function toOpenApiSchema(schema: Parameters<typeof zodToJsonSchema>[0]) {
  return zodToJsonSchema(schema) as Record<string, unknown>;
}

// LLM Export helper functions
function buildExtractionPrompt(elements: any[]): string {
  return `
TASK: Parse this Excalidraw canvas data and extract a complete database schema with SQL and human description.

CANVAS DATA:
${JSON.stringify(elements, null, 2)}

PARSING INSTRUCTIONS:
1. Look for rectangular elements that represent database tables
2. Find text elements that contain table names and field definitions
3. Identify arrows/lines that show relationships between tables
4. Detect primary keys (often underlined or marked with special formatting)
5. Infer data types from field names where possible

ANALYSIS FOCUS:
- Table elements: Usually rectangles with text labels
- Field elements: Text elements positioned within or near table rectangles
- Relationship elements: Arrows connecting tables
- Primary key indicators: Underlines, special formatting, or 'id' fields
- Foreign key patterns: Fields ending in '_id' that reference other tables

OUTPUT REQUIREMENTS:
Return ONLY valid JSON with this exact structure:
{
  "tables": [
    {
      "name": "User",
      "fields": [
        {
          "name": "id",
          "type": "INTEGER",
          "isPrimaryKey": true,
          "isRequired": true
        },
        {
          "name": "email",
          "type": "VARCHAR(255)",
          "isPrimaryKey": false,
          "isRequired": true,
          "isUnique": true
        }
      ],
      "position": { "x": 100, "y": 100 }
    }
  ],
  "relationships": [
    {
      "from": "User",
      "to": "Posts",
      "type": "one-to-many",
      "foreignKey": "user_id",
      "description": "One user can have many posts"
    }
  ],
  "sql": "CREATE TABLE User (\\n  id INTEGER PRIMARY KEY AUTOINCREMENT,\\n  email VARCHAR(255) UNIQUE NOT NULL\\n);\\n\\nCREATE TABLE Posts (\\n  id INTEGER PRIMARY KEY AUTOINCREMENT,\\n  user_id INTEGER NOT NULL,\\n  content TEXT,\\n  FOREIGN KEY (user_id) REFERENCES User(id)\\n);",
  "description": "This database schema represents a social media platform with users and their posts. The User table stores user authentication and profile information, while the Posts table contains user-generated content. Each post is linked to a user through a foreign key relationship, establishing a one-to-many relationship where one user can create multiple posts."
}

IMPORTANT:
- Return ONLY the JSON object, no other text
- Ensure all SQL is valid SQLite syntax
- Use appropriate data types (INTEGER, TEXT, VARCHAR, BOOLEAN, TIMESTAMP)
- Include proper constraints (PRIMARY KEY, UNIQUE, NOT NULL, FOREIGN KEY)
- Make relationships explicit with clear foreign key definitions
- Provide a comprehensive human-readable description that explains the database structure, relationships, and purpose
- Include all CREATE TABLE statements and foreign key constraints in the SQL
`;
}

async function fallbackExtraction(elements: any[]): Promise<any> {
  console.log('🔄 Attempting fallback extraction...');

  // Simple fallback that looks for basic patterns
  const rectangles = elements.filter(el => el.type === 'rectangle');
  const texts = elements.filter(el => el.type === 'text');
  const arrows = elements.filter(el => el.type === 'arrow');

  const tables = [];

  // Try to match rectangles with nearby text elements
  for (const rect of rectangles) {
    const nearbyTexts = texts.filter(text =>
      Math.abs(text.x - rect.x) < 300 &&
      Math.abs(text.y - rect.y) < 200
    );

    if (nearbyTexts.length > 0) {
      // First text is likely the table name
      const tableNameText = nearbyTexts.find(text =>
        text.y >= rect.y && text.y <= rect.y + 50
      );

      if (tableNameText) {
        tables.push({
          name: tableNameText.text || 'UnknownTable',
          fields: [
            { name: 'id', type: 'INTEGER', isPrimaryKey: true, isRequired: true }
          ],
          position: { x: rect.x, y: rect.y }
        });
      }
    }
  }

  return {
    tables,
    relationships: [],
    sql: tables.map(table =>
      `CREATE TABLE ${table.name} (\\n  id INTEGER PRIMARY KEY AUTOINCREMENT\\n);`
    ).join('\\n\\n'),
    description: `Fallback extraction found ${tables.length} potential tables.`,
    isFallback: true
  };
}

/**
 * API routes for the Mastra backend
 *
 * These routes handle chat interactions between the Cedar-OS frontend
 * and your Mastra agents. The chat UI will automatically use these endpoints.
 *
 * - /chat: Standard request-response chat endpoint
 * - /chat/stream: Server-sent events (SSE) endpoint for streaming responses
 */
export const apiRoutes = [
  registerApiRoute('/voice', {
    method: 'POST',
    handler: async (c) => {
      const formData = await c.req.formData();
      const { threadId, resourceId } = VoiceInputSchema.parse(Object.fromEntries(formData));
      const audio = formData.get('audio');

      const run = await voiceWorkflow.createRunAsync();
      const result = await run.start({
        inputData: {
          audio,
          threadId,
          resourceId,
        },
      });

      if (result.status !== 'success') {
        return c.json({ error: 'Workflow failed' }, 500);
      }

      const audioStream = result.result.audio;
      const reader = audioStream.getReader();
      const chunks = [];
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        chunks.push(value);
      }
      const audioBuffer = Buffer.concat(chunks);
      const audioBase64 = audioBuffer.toString('base64');
      const audioDataUri = `data:audio/mpeg;base64,${audioBase64}`;

      return c.json({
        type: 'voice-response',
        content: result.result.responseText,
        payload: {
          audio: audioDataUri,
        },
        transcription: result.result.transcription,
      });
    },
  }),
  registerApiRoute('/chat/stream', {
    method: 'POST',
    openapi: {
      requestBody: {
        content: {
          'application/json': {
            schema: toOpenApiSchema(ChatInputSchema),
          },
        },
      },
    },
    handler: async (c) => {
      try {
        const body = await c.req.json();
        const {
          prompt,
          temperature,
          maxTokens,
          systemPrompt,
          additionalContext,
          resourceId,
          threadId,
        } = ChatInputSchema.parse(body);

        return createSSEStream(async (controller) => {
          const run = await chatWorkflow.createRunAsync();
          const result = await run.start({
            inputData: {
              prompt,
              temperature,
              maxTokens,
              systemPrompt,
              streamController: controller,
              additionalContext,
              resourceId,
              threadId,
            },
          });

          if (result.status !== 'success') {
            // TODO: Handle workflow errors appropriately
            throw new Error(`Workflow failed: ${result.status}`);
          }
        });
      } catch (error) {
        console.error(error);
        return c.json({ error: error instanceof Error ? error.message : 'Internal error' }, 500);
      }
    },
  }),

  // Simple LLM Export route
  registerApiRoute('/llm-export', {
    method: 'POST',
    handler: async (c) => {
      try {
        const body = await c.req.json();
        console.log('🔧 LLM Export called');

        // Extract elements
        const elements = body.data?.elements || body.elements || [];
        console.log('📊 Processing', elements.length, 'elements');

        // Simple test response first
        if (elements.length === 0) {
          return c.json({
            success: false,
            error: 'No elements provided'
          });
        }

        // Filter relevant elements
        const relevantElements = elements.filter(el =>
          el && el.type && ['rectangle', 'text', 'arrow', 'line'].includes(el.type)
        );

        console.log('✅ Found', relevantElements.length, 'relevant elements');

        // Mock successful response for now
        const mockResult = {
          tables: [
            {
              name: "User",
              fields: [
                { name: "id", type: "INTEGER", isPrimaryKey: true, isRequired: true },
                { name: "email", type: "VARCHAR(255)", isPrimaryKey: false, isRequired: true, isUnique: true },
                { name: "name", type: "TEXT", isPrimaryKey: false, isRequired: true }
              ],
              position: { x: 100, y: 100 }
            },
            {
              name: "Posts",
              fields: [
                { name: "id", type: "INTEGER", isPrimaryKey: true, isRequired: true },
                { name: "user_id", type: "INTEGER", isPrimaryKey: false, isRequired: true },
                { name: "title", type: "TEXT", isPrimaryKey: false, isRequired: true },
                { name: "content", type: "TEXT", isPrimaryKey: false, isRequired: false }
              ],
              position: { x: 400, y: 100 }
            }
          ],
          relationships: [
            {
              from: "User",
              to: "Posts",
              type: "one-to-many",
              foreignKey: "user_id",
              description: "One user can have many posts"
            }
          ],
          sql: `CREATE TABLE User (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  email VARCHAR(255) UNIQUE NOT NULL,
  name TEXT NOT NULL
);

CREATE TABLE Posts (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL,
  title TEXT NOT NULL,
  content TEXT,
  FOREIGN KEY (user_id) REFERENCES User(id)
);`,
          description: "A simple social media database with users and their posts. Each user can create multiple posts, establishing a one-to-many relationship."
        };

        return c.json({
          success: true,
          exportData: mockResult,
          elementCount: relevantElements.length
        });

      } catch (error) {
        console.error('Route Error:', error);
        return c.json({ error: 'Request failed' }, 500);
      }
    },
  }),
];
