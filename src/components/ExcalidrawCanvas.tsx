import React, { useState, useCallback } from "react";
import { Excalidraw } from "@excalidraw/excalidraw";
import "@excalidraw/excalidraw/index.css";

const ExcalidrawCanvas = ({ elements, onElementsChange }) => {
  const [appState, setAppState] = useState({});

  const handleChange = useCallback((newElements, newAppState) => {
    onElementsChange(newElements);
    setAppState(newAppState);
  }, [onElementsChange]);

  return (
    <div style={{ height: "100%", width: "100%" }}>
      <Excalidraw
        initialData={{
          elements: elements,
          appState: appState,
        }}
        onChange={handleChange}
      />
    </div>
  );
};

export default ExcalidrawCanvas;
