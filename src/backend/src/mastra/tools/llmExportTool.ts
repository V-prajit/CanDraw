import { openai } from '@ai-sdk/openai';
import { createMastraToolForStateSetter } from '@cedar-os/backend';
import { streamJSONEvent } from '../../utils/streamUtils';
import { z } from 'zod';

// Schema for the export tool
export const LLMExportSchema = z
  .object({
    elements: z.array(z.record(z.unknown())).describe('Raw Excalidraw elements from the canvas'),
  })
  .transform(async (args) => {
    console.log('Export called with:', {
      elementCount: args.elements.length
    });

    // Filter to only relevant Excalidraw elements for analysis
    const relevantElements = args.elements.filter(el =>
      el && el.type && ['rectangle', 'text', 'arrow', 'line'].includes(el.type)
    );

    console.log('Filtered to', relevantElements.length, 'relevant elements for analysis');

    // Build the prompt for schema extraction - always include relationships and sample data
    const prompt = buildExtractionPrompt(relevantElements);

    try {
      // Call language model for intelligent parsing
      const completion = await openai.chat.completions.create({
        model: 'gpt-4', // Language model for parsing
        messages: [
          {
            role: 'system',
            content: 'You are an expert database architect and Excalidraw diagram parser. You excel at extracting structured database schemas from visual diagram data.'
          },
          {
            role: 'user',
            content: prompt
          }
        ],
        response_format: { type: 'json_object' },
        temperature: 0.1, // Low temperature for consistent parsing
        max_tokens: 4000
      });

      const result = JSON.parse(completion.choices[0].message.content || '{}');

      console.log('Export successful:', {
        tablesFound: result.tables?.length || 0,
        relationshipsFound: result.relationships?.length || 0,
        hasSQL: !!result.sql,
        hasDescription: !!result.description
      });

      // Return structured export data
      return {
        success: true,
        exportData: result,
        timestamp: new Date().toISOString(),
        elementCount: relevantElements.length
      };

    } catch (error) {
      console.error('LLM Export failed:', error);

      // Fallback parsing attempt
      const fallbackResult = await fallbackExtraction(relevantElements);

      return {
        success: false,
        error: error.message,
        fallbackData: fallbackResult,
        timestamp: new Date().toISOString()
      };
    }
  });

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
  console.log('Attempting fallback extraction...');

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
      `CREATE TABLE ${table.name} (\n  id INTEGER PRIMARY KEY AUTOINCREMENT\n);`
    ).join('\n\n'),
    description: `Fallback extraction found ${tables.length} potential tables.`,
    isFallback: true
  };
}

// Error response schema
export const ErrorResponseSchema = z.object({
  error: z.string(),
  details: z.string().optional(),
  fallbackData: z.any().optional()
});

// Create the Mastra tool
export const llmExportTool = createMastraToolForStateSetter(
  'excalidrawElements',
  'llmExport',
  LLMExportSchema,
  {
    description: 'Use AI to intelligently parse Excalidraw diagrams and extract database schemas. Converts visual UML diagrams into structured SQL, JSON schemas, or human-readable descriptions.',
    toolId: 'llmExport',
    streamEventFn: streamJSONEvent,
    errorSchema: ErrorResponseSchema,
  }
);