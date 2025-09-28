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

// Import our new LLM-powered components
import { ExportPanel } from '@/components/ExportPanel';
import { DemoGenerator } from '@/components/DemoGenerator';

type ChatMode = 'floating' | 'sidepanel' | 'caption';
const ExcalidrawCanvas = dynamic(() => import('@/components/ExcalidrawCanvas'), { ssr: false });

export default function HomePage() {
  const [chatMode, setChatMode] = React.useState<ChatMode>('floating');

  // ✅ Manage state locally with React
  const [excalidrawElements, setExcalidrawElements] = React.useState<any[]>([]);

  // Add state management tracking
  const lastUpdateRef = React.useRef<{ timestamp: number; source: string; count: number }>({
    timestamp: Date.now(),
    source: 'init',
    count: 0
  });

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
      const now = Date.now();
      const currentCount = excalidrawElements.length;
      const newCount = Array.isArray(newValue) ? newValue.length : 0;
      const timeSinceLastUpdate = now - lastUpdateRef.current.timestamp;

      console.log('🔧 useRegisterState setValue called:', {
        newCount,
        currentCount,
        timeSinceLastUpdate,
        lastSource: lastUpdateRef.current.source
      });

      // IMPROVED STATE MANAGEMENT: Smarter conflict detection

      // Case 1: Complete clear (user action) - always allow
      if (newCount === 0) {
        console.log('🧹 Allowing complete state clear (user action)');
        lastUpdateRef.current = { timestamp: now, source: 'clear', count: newCount };
        setExcalidrawElements(newValue);
        return;
      }

      // Case 2: Normal increase or same count - always allow
      if (newCount >= currentCount) {
        console.log('✅ Accepting state update (increase/same):', {
          from: currentCount,
          to: newCount,
          change: newCount - currentCount
        });
        lastUpdateRef.current = { timestamp: now, source: 'increase', count: newCount };
        setExcalidrawElements(newValue);
        return;
      }

      // Case 3: Reduction in elements - need to be careful
      const isRecentUpdate = timeSinceLastUpdate < 2000; // 2 seconds
      const isSignificantReduction = (currentCount - newCount) > 5; // More than 5 elements
      const isFromProgrammaticUpdate = lastUpdateRef.current.source.includes('programmatic') ||
                                      lastUpdateRef.current.source.includes('tool');

      // Allow reduction if it's recent and not a significant loss
      if (isRecentUpdate && !isSignificantReduction) {
        console.log('✅ Allowing minor recent reduction:', {
          from: currentCount,
          to: newCount,
          change: newCount - currentCount,
          reason: 'Recent minor change'
        });
        lastUpdateRef.current = { timestamp: now, source: 'minor_reduction', count: newCount };
        setExcalidrawElements(newValue);
        return;
      }

      // Allow reduction if it seems to be part of a programmatic sequence
      if (isFromProgrammaticUpdate && isRecentUpdate) {
        console.log('✅ Allowing programmatic sequence reduction:', {
          from: currentCount,
          to: newCount,
          change: newCount - currentCount,
          reason: 'Part of programmatic update sequence'
        });
        lastUpdateRef.current = { timestamp: now, source: 'programmatic_sequence', count: newCount };
        setExcalidrawElements(newValue);
        return;
      }

      // Block significant unexpected reductions
      console.warn('🚨 BLOCKING SIGNIFICANT STATE REDUCTION:', {
        reason: 'Unexpected significant element loss',
        current: currentCount,
        attempted: newCount,
        timeSinceLastUpdate,
        lastSource: lastUpdateRef.current.source,
        currentElements: excalidrawElements.slice(0, 3).map(el => ({id: el.id, type: el.type})),
        attemptedElements: Array.isArray(newValue) ? newValue.slice(0, 3).map(el => ({id: el?.id, type: el?.type})) : []
      });

      // Don't update React state - keep current elements
      return;
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

          // Determine element type from backend data
          const elementType = elementData.type || 'rectangle';
          console.log('🔧 Creating element of type:', elementType);

          // Base properties common to all elements
          const baseElement = {
            id: elementData.id || `${elementType}_${timestamp}_${uniqueIndex}`,
            type: elementType,
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
            boundElements: elementData.boundElements || null,
            updated: elementData.updated || 1,
            link: elementData.link || null,
            locked: elementData.locked || false
          };

          // Add type-specific properties
          let newElement;
          if (elementType === 'arrow') {
            newElement = {
              ...baseElement,
              points: elementData.points || [[0, 0], [100, 0]],
              lastCommittedPoint: elementData.lastCommittedPoint || null,
              startBinding: elementData.startBinding || null,
              endBinding: elementData.endBinding || null,
              startArrowhead: elementData.startArrowhead || null,
              endArrowhead: elementData.endArrowhead || 'arrow',
            };

            // 🔧 ARROW BINDING ENHANCEMENT: Auto-detect and bind to tables
            console.log('🔧 Processing arrow for auto-binding');

            // Helper function to find table at coordinates
            const findTableAtCoordinates = (x: number, y: number) => {
              console.log(`🔍 Looking for table at coordinates (${x}, ${y}) among ${current.length} elements`);

              // Look for table background elements (ID pattern: *_bg)
              const tableElements = current.filter(el =>
                el && el.id && el.id.endsWith('_bg') && el.type === 'rectangle'
              );

              console.log(`🔍 Found ${tableElements.length} table background elements:`,
                tableElements.map(t => ({ id: t.id, x: t.x, y: t.y, w: t.width, h: t.height }))
              );

              // Check if coordinates fall within any table bounds
              for (const table of tableElements) {
                const withinBounds = (
                  x >= table.x &&
                  x <= table.x + table.width &&
                  y >= table.y &&
                  y <= table.y + table.height
                );

                console.log(`🔍 Checking table ${table.id}: bounds (${table.x}, ${table.y}, ${table.width}, ${table.height}) - match: ${withinBounds}`);

                if (withinBounds) {
                  console.log(`🎯 Found table at coordinates: ${table.id}`);
                  return table;
                }
              }

              console.log('❌ No table found at the given coordinates');
              return null;
            };

            // Helper function to calculate binding focus
            const calculateBindingFocus = (table: any, pointX: number, pointY: number) => {
              const centerX = table.x + table.width / 2;
              const centerY = table.y + table.height / 2;
              const dx = pointX - centerX;
              const dy = pointY - centerY;

              let focus: number;
              if (Math.abs(dx) / table.width > Math.abs(dy) / table.height) {
                focus = dy / table.height; // Vertical edge
              } else {
                focus = dx / table.width;  // Horizontal edge
              }

              return Math.max(-0.5, Math.min(0.5, focus));
            };

            // Calculate arrow coordinates from points
            const startX = newElement.x;
            const startY = newElement.y;
            const points = newElement.points || [[0, 0], [100, 0]];
            const endX = startX + (points[1]?.[0] || 100);
            const endY = startY + (points[1]?.[1] || 0);

            console.log('🎯 Arrow coordinates:', { startX, startY, endX, endY });

            // Auto-detect source table if no binding exists
            if (!newElement.startBinding) {
              const sourceTable = findTableAtCoordinates(startX, startY);
              if (sourceTable) {
                const focus = calculateBindingFocus(sourceTable, endX, endY);
                newElement.startBinding = {
                  elementId: sourceTable.id,
                  focus: focus,
                  gap: 4
                };
                console.log('🔗 Created auto start binding:', newElement.startBinding);
              }
            }

            // Auto-detect target table if no binding exists
            if (!newElement.endBinding) {
              const targetTable = findTableAtCoordinates(endX, endY);
              if (targetTable) {
                const focus = calculateBindingFocus(targetTable, startX, startY);
                newElement.endBinding = {
                  elementId: targetTable.id,
                  focus: focus,
                  gap: 4
                };
                console.log('🔗 Created auto end binding:', newElement.endBinding);
              }
            }
          } else if (elementType === 'text') {
            newElement = {
              ...baseElement,
              text: elementData.text || '',
              fontSize: elementData.fontSize || 20,
              fontFamily: elementData.fontFamily || 1,
              textAlign: elementData.textAlign || 'left',
              verticalAlign: elementData.verticalAlign || 'top',
              baseline: elementData.baseline || elementData.fontSize || 20,
              containerId: elementData.containerId || null,
              originalText: elementData.originalText || elementData.text || '',
              lineHeight: elementData.lineHeight || 1.25,
            };
          } else {
            // Default to rectangle-type element
            newElement = {
              ...baseElement,
              roundness: elementData.roundness || { type: 3 },
            };
          }

          // 🔧 BIDIRECTIONAL BINDING: Update boundElements on target shapes
          let updatedCurrent = current;
          if (elementType === 'arrow' && (newElement.startBinding || newElement.endBinding)) {
            console.log('🔧 Updating boundElements for arrow binding');

            updatedCurrent = current.map(element => {
              // Check if this element is a binding target
              const isStartTarget = newElement.startBinding?.elementId === element.id;
              const isEndTarget = newElement.endBinding?.elementId === element.id;

              if (!isStartTarget && !isEndTarget) {
                return element; // No change needed
              }

              // Update boundElements array
              const currentBoundElements = Array.isArray(element.boundElements) ? element.boundElements : [];
              const alreadyBound = currentBoundElements.some(bound => bound?.id === newElement.id);

              if (alreadyBound) {
                console.log(`⚠️ Arrow ${newElement.id} already bound to ${element.id}`);
                return element; // Already bound
              }

              const newBoundElement = { id: newElement.id, type: 'arrow' };
              const updatedElement = {
                ...element,
                boundElements: [...currentBoundElements, newBoundElement]
              };

              console.log(`🔗 Added arrow ${newElement.id} to boundElements of ${element.id}`);
              return updatedElement;
            });
          }

          const newElements = [...updatedCurrent, newElement];
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

          // Mark this as a programmatic update and call setValueFunc
          lastUpdateRef.current = {
            timestamp: Date.now(),
            source: 'programmatic_addElement',
            count: newElements.length
          };
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

          // Mark this as a programmatic update and call setValueFunc
          lastUpdateRef.current = {
            timestamp: Date.now(),
            source: 'programmatic_addMultipleElements',
            count: newElements.length
          };
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

      {/* 2) Main Action Buttons - Top Right */}
      <div className="absolute top-4 right-4 space-x-3 z-50">
        <ExportPanel elements={excalidrawElements} />
        <DemoGenerator elements={excalidrawElements} />
      </div>


      {/* 3) Floating chat - positioned to not interfere with new components */}
      <FloatingCedarChat
        side="right"
        title="🧠 UML AI Assistant"
        collapsedLabel="Chat with AI"
      />

      {/* 4) Optional: Element count indicator */}
      {excalidrawElements.length > 0 && (
        <div className="absolute bottom-4 left-4 z-40">
          <div className="bg-black/70 text-white px-3 py-1 rounded-full text-sm">
            📊 {excalidrawElements.length} elements on canvas
          </div>
        </div>
      )}
    </div>
  );
}
