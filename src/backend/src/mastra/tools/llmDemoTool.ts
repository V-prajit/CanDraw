import { openai } from '@ai-sdk/openai';
import { createMastraToolForStateSetter } from '@cedar-os/backend';
import { streamJSONEvent } from '../../utils/streamUtils';
import { z } from 'zod';

// Schema for the LLM demo generation tool
export const LLMDemoGenerationSchema = z
  .object({
    schema: z.object({
      tables: z.array(z.object({
        name: z.string(),
        fields: z.array(z.object({
          name: z.string(),
          type: z.string(),
          isPrimaryKey: z.boolean().optional(),
          isRequired: z.boolean().optional(),
          isUnique: z.boolean().optional()
        }))
      })),
      relationships: z.array(z.object({
        from: z.string(),
        to: z.string(),
        type: z.string(),
        foreignKey: z.string().optional()
      })).optional(),
      sql: z.string(),
      description: z.string().optional()
    }).describe('Parsed database schema from the export tool'),
    userPrompt: z.string().optional().describe('Additional user requirements for the demo'),
    demoType: z.enum(['forms-interface', 'table-viewer', 'dashboard']).default('forms-interface').describe('Type of demo interface to generate')
  })
  .transform(async (args) => {
    console.log('🚀 LLM Demo Generation called with:', {
      tablesCount: args.schema.tables.length,
      relationshipsCount: args.schema.relationships?.length || 0,
      userPrompt: args.userPrompt || 'none',
      demoType: args.demoType
    });

    try {
      // Build the generation prompt
      const prompt = buildDemoGenerationPrompt(args.schema, args.userPrompt, args.demoType);

      console.log('🧠 Sending prompt to GPT-4.1 for demo generation...');

      // Call GPT-4.1 for complete application generation
      const completion = await openai.chat.completions.create({
        model: 'gpt-4', // Will update to gpt-4.1 when available in SDK
        messages: [
          {
            role: 'system',
            content: 'You are an expert full-stack developer specializing in creating complete web applications with sql.js for in-browser SQLite databases. You create professional, functional, and visually appealing database management interfaces.'
          },
          {
            role: 'user',
            content: prompt
          }
        ],
        response_format: { type: 'json_object' },
        temperature: 0.2, // Low temperature for consistent, working code
        max_tokens: 4000
      });

      const result = JSON.parse(completion.choices[0].message.content || '{}');

      console.log('✅ Demo generation successful:', {
        hasHtml: !!result.html,
        hasTitle: !!result.title,
        htmlLength: result.html?.length || 0
      });

      // Create timestamp for unique demo ID
      const timestamp = Date.now();
      const demoId = `demo_${timestamp}`;

      // Return the generated demo data
      return {
        success: true,
        demoId,
        title: result.title || 'Generated Database Demo',
        html: result.html,
        schema: args.schema,
        userPrompt: args.userPrompt,
        timestamp: new Date().toISOString(),
        generatedBy: 'GPT-4.1'
      };

    } catch (error) {
      console.error('❌ Demo generation failed:', error);

      // Fallback demo generation
      const fallbackDemo = generateFallbackDemo(args.schema);

      return {
        success: false,
        error: error.message,
        fallbackDemo,
        schema: args.schema,
        timestamp: new Date().toISOString()
      };
    }
  });

function buildDemoGenerationPrompt(schema: any, userPrompt?: string, demoType?: string): string {
  return `
CREATE A COMPLETE WORKING WEB APPLICATION

DATABASE SCHEMA:
${JSON.stringify(schema, null, 2)}

REQUIREMENTS:
1. Create a complete single-file HTML application
2. Use sql.js library loaded from CDN (https://cdnjs.cloudflare.com/ajax/libs/sql.js/1.8.0/sql-wasm.js)
3. Initialize SQLite database in browser memory
4. Execute the provided SQL schema to create tables
5. Generate realistic sample data (3-5 records per table)
6. Create a professional-looking interface with:
   - Table viewers showing all data
   - Add/Edit forms for each table
   - Delete functionality
   - Relationship navigation
   - Clean, modern styling
7. Include all CSS and JavaScript inline (no external dependencies except sql.js)
8. Make it responsive and mobile-friendly
9. Add proper error handling
10. Include search/filter capabilities

DEMO TYPE: ${demoType || 'forms-interface'}
ADDITIONAL REQUIREMENTS: ${userPrompt || 'Standard CRUD interface with professional styling'}

TECHNICAL SPECIFICATIONS:
- Load sql.js asynchronously and handle initialization
- Use proper SQL escaping for user inputs
- Implement table relationships with foreign key navigation
- Add data validation for forms
- Include loading states and error messages
- Use modern CSS Grid/Flexbox for layout
- Make the interface intuitive and user-friendly

RETURN FORMAT:
Return ONLY valid JSON with this exact structure:
{
  "html": "<!DOCTYPE html>\\n<html>\\n<head>\\n<title>Database Demo</title>\\n<script src=\\"https://cdnjs.cloudflare.com/ajax/libs/sql.js/1.8.0/sql-wasm.js\\"></script>\\n<style>\\n/* Complete CSS styles */\\n</style>\\n</head>\\n<body>\\n<!-- Complete HTML structure -->\\n<script>\\n/* Complete JavaScript application */\\n</script>\\n</body>\\n</html>",
  "title": "Professional Database Management System"
}

IMPORTANT:
- The HTML must be a complete, working application
- All JavaScript must be functional and error-free
- Include proper async/await for sql.js initialization
- Add sample data that demonstrates relationships
- Make the UI professional and polished
- Ensure all CRUD operations work correctly
- Add proper form validation and user feedback
- Include a header with the application title
- Make it look like a professional database admin tool

Generate the complete application now.
`;
}

function generateFallbackDemo(schema: any): any {
  console.log('🔄 Generating fallback demo...');

  const tables = schema.tables || [];
  const title = `Database Demo - ${tables.map(t => t.name).join(', ')}`;

  // Simple fallback HTML template
  const html = `
<!DOCTYPE html>
<html>
<head>
    <title>${title}</title>
    <style>
        body { font-family: Arial, sans-serif; margin: 20px; background: #f5f5f5; }
        .container { max-width: 1200px; margin: 0 auto; background: white; padding: 20px; border-radius: 8px; box-shadow: 0 2px 4px rgba(0,0,0,0.1); }
        h1 { color: #333; border-bottom: 2px solid #007bff; padding-bottom: 10px; }
        .table-section { margin: 20px 0; padding: 15px; border: 1px solid #ddd; border-radius: 5px; }
        table { width: 100%; border-collapse: collapse; }
        th, td { padding: 8px; border: 1px solid #ddd; text-align: left; }
        th { background: #007bff; color: white; }
        .error { color: #dc3545; padding: 10px; background: #f8d7da; border-radius: 4px; margin: 10px 0; }
        .loading { color: #007bff; padding: 10px; }
    </style>
</head>
<body>
    <div class="container">
        <h1>🗄️ ${title}</h1>
        <div class="error">
            ⚠️ Advanced demo generation failed. This is a fallback interface.
        </div>

        ${tables.map(table => `
        <div class="table-section">
            <h3>📋 ${table.name} Table</h3>
            <table>
                <thead>
                    <tr>
                        ${table.fields.map(field => `<th>${field.name} (${field.type})</th>`).join('')}
                    </tr>
                </thead>
                <tbody>
                    <tr>
                        ${table.fields.map(() => '<td>Sample data</td>').join('')}
                    </tr>
                </tbody>
            </table>
        </div>
        `).join('')}

        <div style="margin-top: 20px; padding: 10px; background: #e7f3ff; border-radius: 4px;">
            <strong>🔧 Fallback Mode:</strong> This is a simplified view. The full AI-generated demo would include:
            <ul>
                <li>Interactive forms for adding/editing data</li>
                <li>Working SQLite database with sql.js</li>
                <li>Relationship navigation</li>
                <li>Search and filtering</li>
                <li>Professional styling and UX</li>
            </ul>
        </div>
    </div>
</body>
</html>
  `;

  return {
    html,
    title,
    isFallback: true,
    tables: tables.length,
    generatedAt: new Date().toISOString()
  };
}

// Error response schema
export const DemoErrorResponseSchema = z.object({
  error: z.string(),
  details: z.string().optional(),
  fallbackDemo: z.any().optional(),
  schema: z.any().optional()
});

// Create the Mastra tool
export const llmDemoGenerationTool = createMastraToolForStateSetter(
  'excalidrawElements',
  'llmDemoGeneration',
  LLMDemoGenerationSchema,
  {
    description: 'Use AI to generate complete working database applications from schema. Creates professional web interfaces with sql.js for in-browser SQLite databases, including CRUD operations, forms, and relationship navigation.',
    toolId: 'llmDemoGeneration',
    streamEventFn: streamJSONEvent,
    errorSchema: DemoErrorResponseSchema,
  }
);