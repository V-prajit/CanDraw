'use client';

import React from 'react';
import dynamic from 'next/dynamic';
import { z } from 'zod';
import {
  useRegisterState,
  useRegisterFrontendTool,
  useSubscribeStateToAgentContext,
  useCedarStore,
  useCedarState
} from 'cedar-os';

import { ChatModeSelector } from '@/components/ChatModeSelector';
import { CedarCaptionChat } from '@/cedar/components/chatComponents/CedarCaptionChat';
import { FloatingCedarChat } from '@/cedar/components/chatComponents/FloatingCedarChat';
import { SidePanelCedarChat } from '@/cedar/components/chatComponents/SidePanelCedarChat';
import { DebuggerPanel } from '@/cedar/components/debugger';

type ChatMode = 'floating' | 'sidepanel' | 'caption';
const ExcalidrawCanvas = dynamic(() => import('@/components/ExcalidrawCanvas'), { ssr: false });

export default function HomePage() {
  const [chatMode, setChatMode] = React.useState<ChatMode>('floating');

  // ✅ Manage state locally with React
  const [excalidrawElements, setExcalidrawElements] = React.useState<any[]>([]);

  // Debug: Log when React state changes
  React.useEffect(() => {
    console.log('🔄 [REACT_STATE] React state updated:', {
      count: excalidrawElements.length,
      elementIds: excalidrawElements.map(el => el.id),
      elements: excalidrawElements
    });
  }, [excalidrawElements]);

  React.useEffect(() => {
    const setShowChat = useCedarStore.getState().setShowChat;
    if (setShowChat) {
      setShowChat(true);
    }
  }, []);

  // ✅ Modern Cedar-OS state management with comprehensive debugging
  const [cedarElements, setCedarElements] = useCedarState('excalidrawElements', [] as any[], 'The elements on the Excalidraw canvas', {
    stateSetters: {
      addElement: {
        name: 'addElement',
        description: 'Add an Excalidraw element to the canvas',
        argsSchema: z.object({
          newElement: z.object({
            x: z.number().optional(),
            y: z.number().optional(),
            width: z.number().optional(),
            height: z.number().optional(),
            strokeColor: z.string().optional(),
            backgroundColor: z.string().optional(),
            label: z.string().optional(),
            id: z.string().optional(),
          }).optional()
        }).optional(),
        execute: (current: any[], args: any) => {
          console.log('🎯 [ADD_ELEMENT] EXECUTE CALLED:', {
            current: current.length,
            currentIds: current.map(el => el.id),
            args
          });

          // Extract args from either direct args or newElement wrapper
          const elementArgs = args?.newElement || args || {};

          const newElement = {
            type: 'rectangle',
            version: 2,
            versionNonce: Math.floor(Math.random() * 1000000),
            isDeleted: false,
            id: elementArgs.id || `rect_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
            fillStyle: elementArgs.fillStyle || 'solid',
            strokeWidth: elementArgs.strokeWidth || 2,
            strokeStyle: 'solid',
            roughness: elementArgs.roughness || 1,
            opacity: (elementArgs.opacity || 1) * 100, // Convert 0-1 to 0-100
            angle: elementArgs.angle || 0,
            x: elementArgs.x || 100,
            y: elementArgs.y || 100,
            strokeColor: elementArgs.strokeColor || '#000000',
            backgroundColor: elementArgs.backgroundColor || '#ffffff',
            width: elementArgs.width || 200,
            height: elementArgs.height || 150,
            seed: Math.floor(Math.random() * 1000000),
            groupIds: [],
            frameId: null,
            roundness: { type: 3 },
            boundElements: null,
            updated: Date.now(),
            link: null,
            locked: false,
            customData: elementArgs.label ? { label: elementArgs.label, kind: 'rectangle' } : undefined
          };
          const newElements = [...current, newElement];
          console.log('🚀 [ADD_ELEMENT] Setting new elements:', {
            newElementId: newElement.id,
            totalCount: newElements.length,
            allIds: newElements.map(el => el.id)
          });
          setCedarElements(newElements);
          return { success: true, elementId: newElement.id };
        },
      },
      addRelativeElement: {
        name: 'addRelativeElement',
        description: 'Add an element positioned relative to another element',
        argsSchema: z.object({
          relativeToId: z.string(),
          position: z.enum(['right', 'left', 'above', 'below', 'above-right', 'above-left', 'below-right', 'below-left']).default('right'),
          spacing: z.number().default(50),
          width: z.number().default(200),
          height: z.number().default(150),
          strokeColor: z.string().optional(),
          backgroundColor: z.string().optional(),
          label: z.string().optional(),
          id: z.string().optional(),
        }),
        execute: (current: any[], args: any) => {
          console.log('🎯 [RELATIVE_ELEMENT] EXECUTE CALLED:', {
            current: current.length,
            currentIds: current.map(el => el.id),
            args
          });

          const { relativeToId, position = 'right', spacing = 50, ...elementArgs } = args || {};

          // Find the reference element
          const refElement = current.find(el => el.id === relativeToId);
          if (!refElement) {
            console.error('❌ [RELATIVE_ELEMENT] Reference element not found:', {
              relativeToId,
              availableIds: current.map(el => el.id)
            });
            return { error: `Reference element '${relativeToId}' not found` };
          }

          console.log('✅ [RELATIVE_ELEMENT] Found reference:', {
            refId: refElement.id,
            refPosition: { x: refElement.x, y: refElement.y, width: refElement.width, height: refElement.height }
          });

          let x = refElement.x;
          let y = refElement.y;

          // Calculate position relative to reference element
          switch (position) {
            case 'right':
              x = refElement.x + refElement.width + spacing;
              break;
            case 'left':
              x = refElement.x - (elementArgs.width || 200) - spacing;
              break;
            case 'below':
              y = refElement.y + refElement.height + spacing;
              break;
            case 'above':
              y = refElement.y - (elementArgs.height || 150) - spacing;
              break;
            case 'above-right':
              x = refElement.x + refElement.width + spacing;
              y = refElement.y - (elementArgs.height || 150) - spacing;
              break;
            case 'below-right':
              x = refElement.x + refElement.width + spacing;
              y = refElement.y + refElement.height + spacing;
              break;
          }

          const newElement = {
            type: 'rectangle',
            version: 2,
            versionNonce: Math.floor(Math.random() * 1000000),
            isDeleted: false,
            id: elementArgs.id || `rect_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
            fillStyle: elementArgs.fillStyle || 'solid',
            strokeWidth: elementArgs.strokeWidth || 2,
            strokeStyle: 'solid',
            roughness: elementArgs.roughness || 1,
            opacity: (elementArgs.opacity || 1) * 100,
            angle: elementArgs.angle || 0,
            x,
            y,
            strokeColor: elementArgs.strokeColor || '#000000',
            backgroundColor: elementArgs.backgroundColor || '#ffffff',
            width: elementArgs.width || 200,
            height: elementArgs.height || 150,
            seed: Math.floor(Math.random() * 1000000),
            groupIds: [],
            frameId: null,
            roundness: { type: 3 },
            boundElements: null,
            updated: Date.now(),
            link: null,
            locked: false,
            customData: elementArgs.label ? { label: elementArgs.label, kind: 'rectangle' } : undefined
          };

          const newElements = [...current, newElement];
          console.log('🚀 [RELATIVE_ELEMENT] Setting new elements:', {
            newElementId: newElement.id,
            newPosition: { x, y, relative: position },
            totalCount: newElements.length,
            allIds: newElements.map(el => el.id)
          });
          setCedarElements(newElements);
          return { success: true, elementId: newElement.id, position: { x, y } };
        },
      },
    }
  });

  // ✅ Sync Cedar state with local React state
  React.useEffect(() => {
    console.log('🔄 [STATE_SYNC] Cedar state changed:', {
      cedarCount: cedarElements.length,
      cedarIds: cedarElements.map(el => el.id),
      reactCount: excalidrawElements.length,
      reactIds: excalidrawElements.map(el => el.id)
    });
    if (JSON.stringify(cedarElements) !== JSON.stringify(excalidrawElements)) {
      console.log('🔄 [STATE_SYNC] Updating React state from Cedar state');
      setExcalidrawElements(cedarElements);
    }
  }, [cedarElements]);

  // ✅ Sync React state with Cedar state (for manual canvas changes)
  React.useEffect(() => {
    console.log('🔄 [STATE_SYNC] React state changed:', {
      reactCount: excalidrawElements.length,
      reactIds: excalidrawElements.map(el => el.id),
      cedarCount: cedarElements.length,
      cedarIds: cedarElements.map(el => el.id)
    });
    if (JSON.stringify(excalidrawElements) !== JSON.stringify(cedarElements)) {
      console.log('🔄 [STATE_SYNC] Updating Cedar state from React state');
      setCedarElements(excalidrawElements);
    }
  }, [excalidrawElements]);

  // ✅ Subscribe canvas state to agent context so it can see existing elements
  useSubscribeStateToAgentContext(
    'excalidrawElements',
    (elements: any[]) => {
      console.log('🔗 [AGENT_CONTEXT] Subscribing to agent context:', {
        elementCount: elements.length,
        elementIds: elements.map(el => el.id),
        elementTypes: elements.map(el => el.type)
      });
      const mappedElements = elements.map((el) => ({
        id: el.id,
        type: el.type,
        x: el.x,
        y: el.y,
        width: el.width,
        height: el.height,
        label: el.customData?.label ?? undefined,
      }));
      console.log('🔗 [AGENT_CONTEXT] Mapped elements for agent:', mappedElements);
      return { excalidrawElements: mappedElements };
    },
    {
      labelField: (el) => el.customData?.label || el.id,
      collapse: { threshold: 6, label: '{count} canvas elements' },
      showInChat: true,
    }
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
      // return { ok: true };
    },
  });

  return (
    <div className="relative h-screen w-full">
      {/* 1) Canvas is always mounted - never gets unmounted by chat UI changes */}
      <div className="absolute inset-0">
        <ExcalidrawCanvas
          elements={excalidrawElements}
          onElementsChange={(newElements) => {
            console.log("📝 [CANVAS_CHANGE] User modified canvas:", {
              count: newElements.length,
              elementIds: newElements.map(el => el.id),
              previousCount: excalidrawElements.length
            });
            setExcalidrawElements(newElements);
          }}
        />
      </div>
  
      {/* 2) Floating chat only */}
      <FloatingCedarChat side="right" title="Excalidraw Copilot" collapsedLabel="Chat with Cedar" />
    </div>
  );
}
