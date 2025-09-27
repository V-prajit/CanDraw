import React, { useCallback, useEffect, useMemo, useRef } from "react";
// @ts-expect-error
import { Excalidraw, type ExcalidrawImperativeAPI } from "@excalidraw/excalidraw";
import "@excalidraw/excalidraw/index.css";

type Props = {
  elements: any[];
  onElementsChange: (els: any[]) => void;
};

const ExcalidrawCanvas: React.FC<Props> = ({ elements, onElementsChange }) => {
  const apiRef = useRef<ExcalidrawImperativeAPI | null>(null);

  // Avoid feedback loops: if we push a scene, ignore the resulting onChange once.
  const pushingSceneRef = useRef(false);

  // Ignore the very first empty onChange after (re)mount.
  const ignoreFirstEmptyRef = useRef(true);

  // Only provide initialData once (mount-time). After that, use updateScene().
  const initialData = useMemo(() => ({ elements }), []); // freeze on first render

  // NUCLEAR STATE PROTECTION: Persistent element cache
  const elementCacheRef = useRef<any[]>([]);
  const lastValidCountRef = useRef(0);
  const resetDetectionRef = useRef(false);

  const handleChange = useCallback((newEls: any[]) => {
    console.log("🔄 Excalidraw onChange fired with:", newEls.length, "elements");

    // Some mounts emit an initial []; don't let that nuke host state.
    if (ignoreFirstEmptyRef.current && newEls.length === 0) {
      console.log("🚫 Ignoring first empty onChange after mount");
      return;
    }

    // If this onChange was triggered by our own updateScene, skip it.
    if (pushingSceneRef.current) {
      console.log("🚫 Ignoring onChange from our own updateScene");
      return;
    }

    // NUCLEAR PROTECTION: Detect and prevent suspicious reductions
    const prevCount = lastValidCountRef.current;
    if (newEls.length < prevCount && prevCount > 0 && newEls.length >= 0) {
      console.warn("🚨 NUCLEAR PROTECTION: Blocking suspicious element reduction", {
        from: prevCount,
        to: newEls.length,
        cached: elementCacheRef.current.length,
        action: 'restore_from_cache'
      });

      // Restore from cache instead of accepting the reduction
      if (elementCacheRef.current.length > newEls.length) {
        console.log("🛡️ RESTORING from element cache:", elementCacheRef.current.length, "elements");
        onElementsChange(elementCacheRef.current);
        return;
      }
    }

    // Update cache if elements increased
    if (newEls.length > lastValidCountRef.current) {
      console.log("📦 CACHING elements:", newEls.length);
      elementCacheRef.current = [...newEls];
      lastValidCountRef.current = newEls.length;
    }

    onElementsChange(newEls);
  }, [onElementsChange]);

  // Track previous element count to detect suspicious reductions
  const prevElementCountRef = useRef(0);

  // After mount OR when host elements change, push them into the canvas.
  useEffect(() => {
    console.log("🎨 ExcalidrawCanvas received elements:", elements.length, "elements:", elements);

    // NUCLEAR PROTECTION: Detect and block external resets from Cedar SSE
    const prevCount = prevElementCountRef.current;
    const currentCount = elements.length;
    const cachedCount = elementCacheRef.current.length;

    // Detect suspicious reductions (likely Cedar SSE reset)
    if (currentCount < prevCount && prevCount > 0 && currentCount >= 0) {
      console.warn("⚠️ SUSPICIOUS: Element count reduced from external source:", {
        from: prevCount,
        to: currentCount,
        reduction: prevCount - currentCount,
        cachedElements: cachedCount,
        suspiciousReset: true
      });

      // If we have more elements in cache, this is definitely a reset
      if (cachedCount > currentCount && cachedCount === prevCount) {
        console.error("🚨 CEDAR SSE RESET DETECTED! Ignoring update and keeping current scene");

        // Don't update the scene - keep the current state
        prevElementCountRef.current = prevCount; // Don't update the prev count
        return; // Skip the updateScene call entirely
      }
    }

    // Update cache when elements increase
    if (currentCount > cachedCount) {
      console.log("📦 UPDATING element cache:", currentCount, "elements");
      elementCacheRef.current = [...elements];
      lastValidCountRef.current = currentCount;
    }

    prevElementCountRef.current = currentCount;

    if (!apiRef.current) return;

    // After the first paint, we no longer ignore empty onChange
    // once we've pushed the host scene at least once.
    // Also guard against the initialData overwrite race.
    pushingSceneRef.current = true;
    console.log("🚀 Pushing scene update with", elements.length, "elements");
    apiRef.current.updateScene({ elements });
    queueMicrotask(() => {
      pushingSceneRef.current = false;
      ignoreFirstEmptyRef.current = false;
    });
  }, [elements]);

  return (
    <div style={{ height: "100%", width: "100%" }}>
      <Excalidraw
        excalidrawAPI={(api) => { apiRef.current = api; }}
        initialData={initialData}
        // @ts-expect-error
        onChange={handleChange}
      />
    </div>
  );
};

export default ExcalidrawCanvas;
