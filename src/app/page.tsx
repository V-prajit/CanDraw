'use client';

import React from 'react';
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

import dynamic from 'next/dynamic';

const ExcalidrawCanvas = dynamic(() => import('@/components/ExcalidrawCanvas'), { ssr: false });

export default function HomePage() {
  // Cedar-OS chat components with mode selector
  // Choose between caption, floating, or side panel chat modes
  const [chatMode, setChatMode] = React.useState<ChatMode>('sidepanel');

  const [excalidrawElements, setExcalidrawElements] = React.useState([]);

  useRegisterState({
    key: 'excalidrawElements',
    description: 'The elements on the Excalidraw canvas',
    value: excalidrawElements,
    setValue: setExcalidrawElements,
    stateSetters: {
      addElement: {
        name: 'addElement',
        description: 'Add an element to the canvas',
        argsSchema: z.object({
          newElement: z.any().describe("The new element to add"),
        }),
        execute: (currentElements, setValue, args) => {
          setValue([...currentElements, args.newElement]);
        },
      },
    },
  });

  useSubscribeStateToAgentContext('excalidrawElements', (elements) => ({ elements }), {
    showInChat: true,
    color: '#4F46E5',
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
