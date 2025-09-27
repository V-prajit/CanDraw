'use client';

import React from 'react';
import dynamic from 'next/dynamic';
import { z } from 'zod';
import {
  useRegisterState,
  useRegisterFrontendTool,
  useSubscribeStateToAgentContext,
  useCedarStore
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
    console.log('🔄 React state updated:', excalidrawElements.length, 'elements:', excalidrawElements);
  }, [excalidrawElements]);

  React.useEffect(() => {
    const setShowChat = useCedarStore.getState().setShowChat;
    if (setShowChat) {
      setShowChat(true);
    }
  }, []);

  // ✅ Register canvas state using legacy API for 0.0.12 backend compatibility
  useRegisterState({
    key: 'excalidrawElements',
    value: excalidrawElements,
    setValue: (newValue) => {
      console.log('🔧 useRegisterState setValue called:', newValue);

      // DEFENSIVE STATE MANAGEMENT: Prevent Cedar from overriding valid state
      const currentCount = excalidrawElements.length;
      const newCount = Array.isArray(newValue) ? newValue.length : 0;

      // Detect potential Cedar state override (fewer elements than current)
      if (newCount < currentCount && currentCount > 0) {
        console.warn('🚨 PREVENTING STATE OVERRIDE:', {
          reason: 'Cedar trying to reduce element count',
          current: currentCount,
          attempted: newCount,
          currentElements: excalidrawElements.map(el => ({id: el.id, type: el.type})),
          attemptedElements: Array.isArray(newValue) ? newValue.map(el => ({id: el?.id, type: el?.type})) : []
        });

        // Only allow the override if the new value is completely empty (user cleared canvas)
        if (newCount === 0) {
          console.log('🧹 Allowing complete state clear (user action)');
          setExcalidrawElements(newValue);
        } else {
          console.log('🛡️ BLOCKED: Rejecting partial state reduction');
          // Don't update React state - keep current elements
          return;
        }
      } else {
        // Normal case: same count or increase in elements
        console.log('✅ Accepting state update:', {
          from: currentCount,
          to: newCount,
          change: newCount - currentCount
        });
        setExcalidrawElements(newValue);
      }
    },
    description: 'The elements on the Excalidraw canvas',
    stateSetters: {
      addElement: {
        name: 'addElement',
        description: 'Add an Excalidraw element to the canvas',
        execute: (current: any[], setValueFunc: any, args: any) => {
          console.log('🎯 EXECUTE CALLED:', { current, setValueFunc, args });

          // Extract the newElement from backend args - backend sends { newElement: {...} }
          console.log('🔍 RAW args received from backend:', args);
          console.log('🔍 Args type:', typeof args, 'Is null/undefined:', args == null);
          console.log('🔍 Args keys:', args ? Object.keys(args) : 'no keys');

          const elementData = args?.newElement || args;
          console.log('📦 Element data to add:', elementData);
          console.log('📦 ElementData keys:', elementData ? Object.keys(elementData) : 'no keys');

          // Helper function to check if rectangles overlap
          const checkOverlap = (rect1: any, rect2: any) => {
            return !(rect1.x + rect1.width <= rect2.x ||
                    rect2.x + rect2.width <= rect1.x ||
                    rect1.y + rect1.height <= rect2.y ||
                    rect2.y + rect2.height <= rect1.y);
          };

          // Smart positioning: find non-overlapping position
          let targetX = elementData.x || 100;
          let targetY = elementData.y || 100;
          const targetWidth = elementData.width || 200;
          const targetHeight = elementData.height || 150;

          // Check if user specified explicit position vs default
          const userSpecifiedPosition = elementData.x !== undefined && elementData.y !== undefined;

          if (!userSpecifiedPosition && current.length > 0) {
            // Auto-position to avoid overlap
            const offset = 50; // spacing between rectangles
            let attempts = 0;
            const maxAttempts = 100;

            while (attempts < maxAttempts) {
              const testRect = { x: targetX, y: targetY, width: targetWidth, height: targetHeight };
              const hasOverlap = current.some(element => {
                if (element.type === 'rectangle') {
                  return checkOverlap(testRect, element);
                }
                return false;
              });

              if (!hasOverlap) {
                break; // Found non-overlapping position
              }

              // Try next position (diagonal offset pattern)
              attempts++;
              targetX += offset;
              targetY += offset;

              // Wrap around if we go too far right/down
              if (targetX > 800) {
                targetX = 100 + (attempts % 5) * 30; // stagger the restart
                targetY += offset * 2;
              }
              if (targetY > 600) {
                targetY = 100 + (attempts % 3) * 40; // vertical stagger
              }
            }

            console.log(`🎯 Smart positioning: placed at (${targetX}, ${targetY}) after ${attempts} attempts`);
          }

          // Create proper Excalidraw element with backend parameters
          const newElement = {
            type: 'rectangle',
            version: 1,
            versionNonce: Math.floor(Math.random() * 1000000),
            isDeleted: false,
            id: elementData.id || `rect_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
            fillStyle: elementData.fillStyle || 'solid',
            strokeWidth: elementData.strokeWidth || 2,
            strokeStyle: 'solid',
            roughness: elementData.roughness || 1,
            opacity: elementData.opacity ? Math.round(elementData.opacity * 100) : 100,
            angle: elementData.angle || 0,
            x: targetX,
            y: targetY,
            strokeColor: elementData.strokeColor || '#000000',
            backgroundColor: elementData.backgroundColor || '#ffffff',
            width: targetWidth,
            height: targetHeight,
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
          console.log('📍 New element position:', { x: newElement.x, y: newElement.y, width: newElement.width, height: newElement.height });

          // DEFENSIVE: Verify state consistency before calling setValueFunc
          console.log('🔍 State consistency check:', {
            currentArrayLength: current.length,
            newArrayLength: newElements.length,
            reactStateLength: excalidrawElements.length,
            isStateConsistent: current.length === excalidrawElements.length,
            elementAdded: newElements.length === current.length + 1
          });

          // Call setValueFunc (which will trigger setValue callback with defensive logic)
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
      // return { ok: true };
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
  
      {/* 2) Floating chat only */}
      <FloatingCedarChat side="right" title="Excalidraw Copilot" collapsedLabel="Chat with Cedar" />
    </div>
  );
}
