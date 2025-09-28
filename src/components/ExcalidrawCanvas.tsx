import React, { useCallback, useEffect, useMemo, useRef } from "react";
// @ts-expect-error
import { Excalidraw, type ExcalidrawImperativeAPI } from "@excalidraw/excalidraw";
import "@excalidraw/excalidraw/index.css";

type Props = {
  elements: any[];
  onElementsChange: (els: any[]) => void;
};

// Helper function to create a stable hash of elements for comparison
const getElementsHash = (elements: any[]): string => {
  return elements.map(el => `${el.id}:${el.type}:${el.x}:${el.y}:${el.version || 0}`).join('|');
};

// Helper function to deep compare element arrays
const elementsEqual = (a: any[], b: any[]): boolean => {
  if (a.length !== b.length) return false;
  return getElementsHash(a) === getElementsHash(b);
};

const ExcalidrawCanvas: React.FC<Props> = ({ elements, onElementsChange }) => {
  const apiRef = useRef<ExcalidrawImperativeAPI | null>(null);

  // Track the last scene we pushed to Excalidraw to prevent feedback loops
  const lastPushedElementsRef = useRef<any[]>([]);
  const lastPushedHashRef = useRef<string>('');

  // Track the last elements received from Excalidraw onChange
  const lastReceivedElementsRef = useRef<any[]>([]);
  const lastReceivedHashRef = useRef<string>('');

  // Ignore the very first empty onChange after mount
  const ignoreFirstEmptyRef = useRef(true);

  // Debounce timeout for updateScene calls
  const updateSceneTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Track if we're currently updating to prevent cascading updates
  const isUpdatingRef = useRef(false);

  // Only provide initialData once (mount-time). After that, use updateScene().
  const initialData = useMemo(() => ({ elements }), []); // freeze on first render

  const handleChange = useCallback((newEls: any[]) => {
    console.log("Excalidraw onChange fired with:", newEls.length, "elements");

    // Ignore first empty onChange after mount
    if (ignoreFirstEmptyRef.current && newEls.length === 0) {
      console.log("Ignoring first empty onChange after mount");
      return;
    }
    ignoreFirstEmptyRef.current = false;

    // Generate hash for the new elements
    const newHash = getElementsHash(newEls);

    // If these are the exact same elements we just pushed, ignore
    if (newHash === lastPushedHashRef.current) {
      console.log("Ignoring onChange - same as elements we just pushed");
      return;
    }

    // If these are the same elements we just received, ignore
    if (newHash === lastReceivedHashRef.current) {
      console.log("Ignoring onChange - same as elements we just received");
      return;
    }

    // If we're currently in an update cycle, ignore
    if (isUpdatingRef.current) {
      console.log("Ignoring onChange - update in progress");
      return;
    }

    console.log("Valid onChange - propagating to parent", {
      elementCount: newEls.length,
      newHash: newHash.substring(0, 50) + '...',
      lastPushedHash: lastPushedHashRef.current.substring(0, 50) + '...',
      lastReceivedHash: lastReceivedHashRef.current.substring(0, 50) + '...'
    });

    // Update our tracking
    lastReceivedElementsRef.current = [...newEls];
    lastReceivedHashRef.current = newHash;

    // Propagate to parent
    onElementsChange(newEls);
  }, [onElementsChange]);

  // Debounced updateScene function
  const debouncedUpdateScene = useCallback((elementsToUpdate: any[]) => {
    if (updateSceneTimeoutRef.current) {
      clearTimeout(updateSceneTimeoutRef.current);
    }

    updateSceneTimeoutRef.current = setTimeout(() => {
      if (!apiRef.current || isUpdatingRef.current) return;

      const newHash = getElementsHash(elementsToUpdate);

      // Only update if elements actually changed
      if (newHash !== lastPushedHashRef.current) {
        console.log("Pushing scene update with", elementsToUpdate.length, "elements");

        isUpdatingRef.current = true;
        lastPushedElementsRef.current = [...elementsToUpdate];
        lastPushedHashRef.current = newHash;

        apiRef.current.updateScene({ elements: elementsToUpdate });

        // Clear the updating flag after a brief delay
        setTimeout(() => {
          isUpdatingRef.current = false;
        }, 50);
      } else {
        console.log("Skipping scene update - no changes detected");
      }

      updateSceneTimeoutRef.current = null;
    }, 10); // Very short debounce - just enough to prevent rapid calls
  }, []);

  // After mount OR when host elements change, push them into the canvas
  useEffect(() => {
    console.log("ExcalidrawCanvas received elements:", elements.length, "elements");

    if (!apiRef.current) {
      console.log("API not ready yet, will update when available");
      return;
    }

    const currentHash = getElementsHash(elements);

    // Only update if elements actually changed
    if (currentHash === lastPushedHashRef.current) {
      console.log("Skipping update - elements unchanged from our last push");
      return;
    }

    // Only update if these aren't the same elements we just received from onChange
    if (currentHash === lastReceivedHashRef.current) {
      console.log("Skipping update - these elements came from Excalidraw onChange");
      return;
    }

    console.log("Scheduling scene update", {
      elementCount: elements.length,
      currentHash: currentHash.substring(0, 50) + '...',
      lastPushedHash: lastPushedHashRef.current.substring(0, 50) + '...',
      lastReceivedHash: lastReceivedHashRef.current.substring(0, 50) + '...'
    });

    debouncedUpdateScene(elements);
  }, [elements, debouncedUpdateScene]);

  // Cleanup timeout on unmount
  useEffect(() => {
    return () => {
      if (updateSceneTimeoutRef.current) {
        clearTimeout(updateSceneTimeoutRef.current);
      }
    };
  }, []);

  return (
    <div style={{ height: "100%", width: "100%" }}>
      <Excalidraw
        excalidrawAPI={(api) => { apiRef.current = api; }}
        initialData={initialData}
        onChange={handleChange}
      />
    </div>
  );
};

export default ExcalidrawCanvas;
