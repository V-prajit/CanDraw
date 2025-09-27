import React from 'react';
import { createMessageRenderer, CustomMessage } from 'cedar-os';
import { ShimmerText } from './text/ShimmerText';

// Define custom message types for tool events
type ToolCallMessage = CustomMessage<
  'tool-call',
  {
    payload?: {
      toolName?: string;
      args?: unknown;
    };
  }
>;

type ToolResultMessage = CustomMessage<
  'tool-result',
  {
    payload?: {
      toolName?: string;
      result?: unknown;
      error?: string;
    };
  }
>;

// Tool Call Renderer
export const ToolCallRenderer = createMessageRenderer<ToolCallMessage>({
  type: 'tool-call',
  namespace: 'agent-tools',
  render: (message) => {
    return <ShimmerText text="agent tool call" state="in_progress" payload={message.payload} />;
  },
  validateMessage: (msg): msg is ToolCallMessage => {
    return msg.type === 'tool-call';
  },
});

// Tool Result Renderer
export const ToolResultRenderer = createMessageRenderer<ToolResultMessage>({
  type: 'tool-result',
  namespace: 'agent-tools',
  render: (message) => {
    // Check if there's an error to determine the state
    const hasError = message.payload?.error;

    return (
      <ShimmerText
        text="agent tool result"
        state={hasError ? 'error' : 'complete'}
        payload={message.payload}
      />
    );
  },
  validateMessage: (msg): msg is ToolResultMessage => {
    return msg.type === 'tool-result';
  },
});

// Export all renderers for easy registration
export const messageRenderers = [ToolCallRenderer, ToolResultRenderer];
