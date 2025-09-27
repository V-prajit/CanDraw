// ---------------------------------------------
// Workflows are a Mastra primitive to orchestrate agents and complex sequences of tasks
// Docs: https://mastra.ai/en/docs/workflows/overview
// ---------------------------------------------

import { createWorkflow, createStep } from '@mastra/core/workflows';
import { RuntimeContext } from '@mastra/core/di';
import { z } from 'zod';
import { starterAgent } from '../agents/starterAgent';
import { handleTextStream, streamJSONEvent } from '../../utils/streamUtils';
import { ActionSchema } from './chatWorkflowTypes';

export const ChatInputSchema = z.object({
  prompt: z.string(),
  temperature: z.number().optional(),
  maxTokens: z.number().optional(),
  systemPrompt: z.string().optional(),
  streamController: z.instanceof(ReadableStreamDefaultController).optional(),
  additionalContext: z.any().optional(),
  resourceId: z.string().optional(),
  threadId: z.string().optional(),
});

export const ChatOutputSchema = z.object({
  content: z.string(),
  // TODO: Add any structured output fields your application needs
  object: ActionSchema.optional(),
  usage: z.any().optional(),
});

export type ChatOutput = z.infer<typeof ChatOutputSchema>;

const callAgent = createStep({
  id: 'callAgent',
  description: 'Invoke the chat agent with the user prompt using streamVNext',
  inputSchema: ChatInputSchema,
  outputSchema: ChatOutputSchema,
  execute: async ({ inputData }) => {
    const {
      prompt,
      temperature,
      maxTokens,
      systemPrompt,
      streamController,
      additionalContext,
      resourceId,
      threadId,
    } = inputData;

    if (!streamController) {
      throw new Error('Stream controller is required');
    }

    console.log('Chat workflow received input data', inputData);

    // Create runtime context with additionalContext and streamController
    const runtimeContext = new RuntimeContext();
    runtimeContext.set('additionalContext', additionalContext);
    runtimeContext.set('streamController', streamController);

    const messages = [
      'User message: ' + prompt,
      'Additional context (for background knowledge): ' + JSON.stringify(additionalContext),
    ];

    let responseText = '';
    /**
     * Using Mastra streamVNext for enhanced streaming capabilities.
     * streamVNext returns a stream result that we can iterate over to get chunks
     * and properly handle different event types such as text-delta, tool calls, etc.
     */
    const streamResult = await starterAgent.streamVNext(messages, {
      // If system prompt is provided, overwrite the default system prompt for this agent
      ...(systemPrompt ? ({ instructions: systemPrompt } as const) : {}),
      modelSettings: {
        temperature,
        maxOutputTokens: maxTokens,
      },
      runtimeContext,
      ...(threadId && resourceId
        ? {
            memory: {
              thread: threadId,
              resource: resourceId,
            },
          }
        : {}),
    });

    for await (const chunk of streamResult.fullStream) {
      if (chunk.type === 'text-delta') {
        await handleTextStream(chunk.payload.text, streamController);
        responseText += chunk.payload.text;
      } else if (chunk.type === 'tool-result' || chunk.type === 'tool-call') {
        streamJSONEvent(streamController, chunk.type, chunk);
      }
    }

    const usage = await streamResult.usage;

    console.log('Chat workflow result', {
      content: responseText,
      usage: usage,
    });

    return {
      content: responseText,
      usage: usage,
    };
  },
});

export const chatWorkflow = createWorkflow({
  id: 'chatWorkflow',
  description: 'Chat workflow that handles agent interactions with optional streaming support',
  inputSchema: ChatInputSchema,
  outputSchema: ChatOutputSchema,
})
  .then(callAgent)
  .commit();
