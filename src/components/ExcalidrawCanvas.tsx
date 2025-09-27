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

    onElementsChange(newEls);
  }, [onElementsChange]);

  // After mount OR when host elements change, push them into the canvas.
  useEffect(() => {
    console.log("🎨 ExcalidrawCanvas received elements:", elements.length, "elements:", elements);

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
