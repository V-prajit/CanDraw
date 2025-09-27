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

  const handleChange = useCallback((newEls: any[]) => {
    console.log("🔄 [EXCALIDRAW] onChange fired with:", {
      count: newEls.length,
      elementIds: newEls.map(el => el.id),
      pushingScene: pushingSceneRef.current,
      ignoreFirstEmpty: ignoreFirstEmptyRef.current
    });

    // Some mounts emit an initial []; don't let that nuke host state.
    if (ignoreFirstEmptyRef.current && newEls.length === 0) {
      console.log("🚫 [EXCALIDRAW] Ignoring first empty onChange after mount");
      return;
    }

    // If this onChange was triggered by our own updateScene, skip it.
    if (pushingSceneRef.current) {
      console.log("🚫 [EXCALIDRAW] Ignoring onChange from our own updateScene");
      return;
    }

    console.log("✅ [EXCALIDRAW] Calling onElementsChange with:", {
      count: newEls.length,
      elementIds: newEls.map(el => el.id)
    });
    onElementsChange(newEls);
  }, [onElementsChange]);

  // After mount OR when host elements change, push them into the canvas.
  useEffect(() => {
    console.log("🎨 [EXCALIDRAW] Received elements from parent:", {
      count: elements.length,
      elementIds: elements.map(el => el.id),
      hasApi: !!apiRef.current
    });

    if (!apiRef.current) {
      console.log("⏳ [EXCALIDRAW] API not ready yet, skipping updateScene");
      return;
    }

    // After the first paint, we no longer ignore empty onChange
    // once we've pushed the host scene at least once.
    // Also guard against the initialData overwrite race.
    pushingSceneRef.current = true;
    console.log("🚀 [EXCALIDRAW] Pushing scene update:", {
      count: elements.length,
      elementIds: elements.map(el => el.id)
    });
    apiRef.current.updateScene({ elements });
    queueMicrotask(() => {
      console.log("✅ [EXCALIDRAW] Scene update complete, resetting flags");
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
