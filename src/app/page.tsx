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
          const timestamp = Date.now();
          const uniqueIndex = Math.floor(Math.random() * 1000000);

          const newElement = {
            id: elementData.id || `rect_${timestamp}_${uniqueIndex}`,
            type: 'rectangle',
            version: elementData.version || 1,
            versionNonce: elementData.versionNonce || Math.floor(Math.random() * 2147483647),
            isDeleted: false,
            x: targetX,
            y: targetY,
            width: targetWidth,
            height: targetHeight,
            angle: elementData.angle || 0,
            strokeColor: elementData.strokeColor || '#000000',
            backgroundColor: elementData.backgroundColor || '#ffffff',
            fillStyle: elementData.fillStyle || 'solid',
            strokeWidth: elementData.strokeWidth || 2,
            strokeStyle: elementData.strokeStyle || 'solid',
            roughness: elementData.roughness !== undefined ? elementData.roughness : 1,
            opacity: elementData.opacity !== undefined ? Math.round(elementData.opacity * 100) : 100,
            seed: elementData.seed || Math.floor(Math.random() * 2147483647),
            groupIds: elementData.groupIds || [],
            frameId: elementData.frameId || null,
            roundness: elementData.roundness || { type: 3 },
            boundElements: elementData.boundElements || null,
            updated: elementData.updated || 1,
            link: elementData.link || null,
            locked: elementData.locked || false
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
      addMultipleElements: {
        name: 'addMultipleElements',
        description: 'Add multiple Excalidraw elements to the canvas at once',
        execute: (current: any[], setValueFunc: any, args: any) => {
          console.log('🎯 ADD_MULTIPLE_ELEMENTS EXECUTE CALLED:', { current, args });

          // Extract the elements array from backend args
          const elementsToAdd = args?.elements || [];
          console.log('📦 Elements to add:', elementsToAdd.length, 'elements');

          if (!Array.isArray(elementsToAdd) || elementsToAdd.length === 0) {
            console.warn('⚠️ No elements to add');
            return;
          }

          // Process each element to ensure proper Excalidraw format
          const processedElements = elementsToAdd.map((elementData: any, index: number) => {
            // Generate stable, unique IDs with better entropy
            const timestamp = Date.now();
            const uniqueIndex = Math.floor(Math.random() * 1000000);

            // Common element properties required by Excalidraw
            const baseElement = {
              version: elementData.version || 1,
              versionNonce: elementData.versionNonce || Math.floor(Math.random() * 2147483647),
              isDeleted: false,
              fillStyle: elementData.fillStyle || 'solid',
              strokeWidth: elementData.strokeWidth || 2,
              strokeStyle: elementData.strokeStyle || 'solid',
              roughness: elementData.roughness !== undefined ? elementData.roughness : 1,
              opacity: elementData.opacity !== undefined ? Math.round(elementData.opacity * 100) : 100,
              angle: elementData.angle || 0,
              strokeColor: elementData.strokeColor || '#000000',
              backgroundColor: elementData.backgroundColor || 'transparent',
              seed: elementData.seed || Math.floor(Math.random() * 2147483647),
              groupIds: elementData.groupIds || [],
              frameId: elementData.frameId || null,
              roundness: elementData.roundness || null,
              boundElements: elementData.boundElements || null,
              updated: elementData.updated || 1,
              link: elementData.link || null,
              locked: elementData.locked || false,
            };

            // Type-specific properties with all required Excalidraw fields
            if (elementData.type === 'rectangle') {
              return {
                ...baseElement,
                id: elementData.id || `rect_${timestamp}_${uniqueIndex}_${index}`,
                type: 'rectangle',
                x: elementData.x !== undefined ? elementData.x : 100,
                y: elementData.y !== undefined ? elementData.y : 100,
                width: elementData.width || 200,
                height: elementData.height || 150,
                roundness: elementData.roundness || { type: 3 }, // Proper roundness for rectangles
              };
            } else if (elementData.type === 'text') {
              return {
                ...baseElement,
                id: elementData.id || `text_${timestamp}_${uniqueIndex}_${index}`,
                type: 'text',
                x: elementData.x !== undefined ? elementData.x : 100,
                y: elementData.y !== undefined ? elementData.y : 100,
                width: elementData.width || 0, // Let Excalidraw measure
                height: elementData.height || 0, // Let Excalidraw measure
                text: elementData.text || '',
                fontSize: elementData.fontSize || 20,
                fontFamily: elementData.fontFamily || 1, // Excalidraw default font
                textAlign: elementData.textAlign || 'left',
                verticalAlign: elementData.verticalAlign || 'top',
                baseline: elementData.baseline || elementData.fontSize || 20, // Use baseline from backend or default
                containerId: elementData.containerId || null,
                originalText: elementData.originalText || elementData.text || '',
                lineHeight: elementData.lineHeight || 1.25,
              };
            } else if (elementData.type === 'line') {
              return {
                ...baseElement,
                id: elementData.id || `line_${timestamp}_${uniqueIndex}_${index}`,
                type: 'line',
                x: elementData.x !== undefined ? elementData.x : 0,
                y: elementData.y !== undefined ? elementData.y : 0,
                width: elementData.width || 100,
                height: elementData.height || 0,
                points: elementData.points || [[0, 0], [100, 0]],
                lastCommittedPoint: elementData.lastCommittedPoint || null,
                startBinding: elementData.startBinding || null,
                endBinding: elementData.endBinding || null,
                startArrowhead: elementData.startArrowhead || null,
                endArrowhead: elementData.endArrowhead || null,
              };
            } else if (elementData.type === 'arrow') {
              return {
                ...baseElement,
                id: elementData.id || `arrow_${timestamp}_${uniqueIndex}_${index}`,
                type: 'arrow',
                x: elementData.x !== undefined ? elementData.x : 0,
                y: elementData.y !== undefined ? elementData.y : 0,
                width: elementData.width || 100,
                height: elementData.height || 0,
                points: elementData.points || [[0, 0], [100, 0]],
                lastCommittedPoint: elementData.lastCommittedPoint || null,
                startBinding: elementData.startBinding || null,
                endBinding: elementData.endBinding || null,
                startArrowhead: elementData.startArrowhead || null,
                endArrowhead: elementData.endArrowhead || 'arrow',
              };
            }

            console.warn('⚠️ Unknown element type:', elementData.type);
            return null;
          }).filter(Boolean); // Remove null elements

          const newElements = [...current, ...processedElements];
          console.log('🚀 About to add', processedElements.length, 'elements. Total:', newElements.length);

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
