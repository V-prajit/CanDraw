import { registerApiRoute } from '@mastra/core/server';
import { ChatInputSchema, chatWorkflow } from './workflows/chatWorkflow';
import { voiceWorkflow } from './workflows/voiceWorkflow';
import { VoiceInputSchema } from './workflows/voiceWorkflowTypes';
import { zodToJsonSchema } from 'zod-to-json-schema';
import { createSSEStream } from '../utils/streamUtils';

// Helper function to convert Zod schema to OpenAPI schema
function toOpenApiSchema(schema: Parameters<typeof zodToJsonSchema>[0]) {
  return zodToJsonSchema(schema) as Record<string, unknown>;
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
];
