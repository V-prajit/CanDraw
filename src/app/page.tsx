'use client';

import React from 'react';
import dynamic from 'next/dynamic';
import { z } from 'zod';
import {
  useRegisterState,
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

  // ✅ Manage state locally with React
  const [excalidrawElements, setExcalidrawElements] = React.useState<any[]>([]);

  // Debug: Log when React state changes
  React.useEffect(() => {
    console.log('🔄 React state updated:', excalidrawElements.length, 'elements:', excalidrawElements);
  }, [excalidrawElements]);

  // ✅ Register canvas state using legacy API for 0.0.12 backend compatibility
  useRegisterState({
    key: 'excalidrawElements',
    value: excalidrawElements,
    setValue: (newValue) => {
      console.log('🔧 useRegisterState setValue called:', newValue);
      setExcalidrawElements(newValue);
    },
    description: 'The elements on the Excalidraw canvas',
    stateSetters: {
      addElement: {
        name: 'addElement',
        description: 'Add an Excalidraw element to the canvas',
        execute: (current: any[], setValueFunc: any) => {
          console.log('🎯 EXECUTE CALLED:', { current, setValueFunc });
          const newElement = {
            type: 'rectangle',
            version: 1,
            versionNonce: Math.floor(Math.random() * 1000000),
            isDeleted: false,
            id: `rect_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
            fillStyle: 'solid',
            strokeWidth: 2,
            strokeStyle: 'solid',
            roughness: 1,
            opacity: 100,
            angle: 0,
            x: 400,
            y: 300,
            strokeColor: '#000000',
            backgroundColor: '#ffffff',
            width: 200,
            height: 150,
            seed: Math.floor(Math.random() * 1000000),
            groupIds: [],
            frameId: null,
            roundness: {
              type: 3
            },
            boundElements: null,
            updated: 1,
            link: null,
            locked: false
          };
          const newElements = [...current, newElement];
          console.log('🚀 About to call setValueFunc with:', newElements);
          setValueFunc(newElements);
        },
      },
    }
  });

  // ✅ Context subscription handled by legacy registration - backend already receives state

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

  return (
    <div className="relative h-screen w-full">
      {/* 1) Canvas is always mounted - never gets unmounted by chat UI changes */}
      <div className="absolute inset-0">
        <ExcalidrawCanvas
          elements={excalidrawElements}
          onElementsChange={setExcalidrawElements}
        />
      </div>

      {/* 2) Chat UI overlays; collapsing it must not unmount the canvas */}
      {chatMode === 'sidepanel' ? (
        <SidePanelCedarChat
          side="right"
          title="Cedarling Chat"
          collapsedLabel="Chat with Cedar"
          showCollapsedButton={true}
        >
          <DebuggerPanel />
          <ChatModeSelector currentMode={chatMode} onModeChange={setChatMode} />
        </SidePanelCedarChat>
      ) : (
        <>
          <ChatModeSelector currentMode={chatMode} onModeChange={setChatMode} />
          {chatMode === 'caption' && <CedarCaptionChat />}
          {chatMode === 'floating' && (
            <FloatingCedarChat side="right" title="Cedarling Chat" collapsedLabel="Chat with Cedar" />
          )}
        </>
      )}
    </div>
  );
}
