'use client';

import React from 'react';
import dynamic from 'next/dynamic';
import { z } from 'zod';
import {
  useCedarState,
  useRegisterFrontendTool,
  useSubscribeStateToAgentContext,
} from 'cedar-os';

import { ChatModeSelector } from '@/components/ChatModeSelector';
import { CedarCaptionChat } from '@/cedar/components/chatComponents/CedarCaptionChat';
import { FloatingCedarChat } from '@/cedar/components/chatComponents/FloatingCedarChat';
import { SidePanelCedarChat } from '@/cedar/components/chatComponents/SidePanelCedarChat';
import { DebuggerPanel } from '@/cedar/components/debugger';

type ChatMode = 'floating' | 'sidepanel' | 'caption';
const ExcalidrawCanvas = dynamic(() => import('@/components/ExcalidrawCanvas'), { ssr: false });

export default function HomePage() {
  const [chatMode, setChatMode] = React.useState<ChatMode>('sidepanel');

  // ✅ Register canvas state directly in Cedar (no race with subscriptions)
  const [excalidrawElements, setExcalidrawElements] = useCedarState(
    'excalidrawElements',
    [] as any[],
    'The elements on the Excalidraw canvas',
    {
      // IMPORTANT: current API is (currentState, args) — no setValue param
      addElement: {
        name: 'addElement',
        description: 'Add an Excalidraw element to the canvas',
        argsSchema: z.object({
          newElement: z
            .object({
              id: z.string().optional(),
              type: z.enum(['rectangle', 'ellipse', 'diamond', 'text', 'arrow', 'line']),
              x: z.number(),
              y: z.number(),
              width: z.number().optional(),
              height: z.number().optional(),
              angle: z.number().optional(),
              strokeColor: z.string().optional(),
              backgroundColor: z.string().optional(),
              fillStyle: z.enum(['solid', 'hachure', 'cross-hatch']).optional(),
              strokeWidth: z.number().optional(),
              roughness: z.number().min(0).max(2).optional(),
              opacity: z.number().min(0).max(1).optional(),
              text: z.string().optional(), // for text elements
            })
            .describe('A valid Excalidraw element'),
        }),
        execute: (current, args) => {
          setExcalidrawElements([...current, args.newElement]);
        },
      },
    }
  );

  // ✅ Make this state visible to the agent's input context
  useSubscribeStateToAgentContext(
    'excalidrawElements',
    (elements: any[]) => ({
      'excalidraw-elements': elements.map((e) => ({
        id: e.id,
        type: e.type,
        x: e.x,
        y: e.y,
        w: e.width ?? 0,
        h: e.height ?? 0,
      })),
    }),
    { color: '#4F46E5' }
  );

  // ✅ Register the missing FRONTEND tool so "Tool addNewTextLine not found" goes away
  useRegisterFrontendTool({
    name: 'addNewTextLine', // must match your backend toolId
    description: 'Add a new text line to the Excalidraw canvas',
    argsSchema: z.object({
      text: z.string().min(1).describe('The text to add'),
      style: z.enum(['normal', 'bold', 'italic', 'highlight']).optional(),
    }),
    execute: ({ text, style }) => {
      const now = Date.now();
      const textEl = {
        id: `text_${now}`,
        type: 'text',
        x: 120,
        y: 120,
        text,
        angle: 0,
        width: 0,    // Excalidraw will measure
        height: 0,   // Excalidraw will measure
        strokeColor: '#000000',
        backgroundColor: style === 'highlight' ? '#fff59d' : 'transparent',
        // you can add font props in your ExcalidrawCanvas if you handle them
      };
      setExcalidrawElements((prev) => [...prev, textEl]);
      return { ok: true };
    },
  });

  const renderContent = () => (
    <div className="relative h-screen w-full">
      <ChatModeSelector currentMode={chatMode} onModeChange={setChatMode} />

      <ExcalidrawCanvas elements={excalidrawElements} onElementsChange={setExcalidrawElements} />

      {chatMode === 'caption' && <CedarCaptionChat />}

      {chatMode === 'floating' && (
        <FloatingCedarChat side="right" title="Cedarling Chat" collapsedLabel="Chat with Cedar" />
      )}
    </div>
  );

  if (chatMode === 'sidepanel') {
    return (
      <SidePanelCedarChat
        side="right"
        title="Cedarling Chat"
        collapsedLabel="Chat with Cedar"
        showCollapsedButton={true}
      >
        <DebuggerPanel />
        {renderContent()}
      </SidePanelCedarChat>
    );
  }

  return renderContent();
}
