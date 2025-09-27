# Cedar-OS State Update Mystery - Debug Checkpoint

## 🎯 **CURRENT STATUS: EXECUTE WORKS, IMMEDIATE RESET ISSUE**

### **The Problem Pattern:**
Cedar-OS setState executes perfectly → React state updates → **IMMEDIATE RESET back to empty**

### **Evidence from Console Logs:**
```
✅ 🎯 EXECUTE CALLED: (Cedar setState function runs successfully)
✅ 🚀 Calling setExcalidrawElements with: [element] (React setState called)
✅ 🎨 ExcalidrawCanvas received elements: 1 elements (Canvas receives element)
✅ 🔄 React state updated: 1 elements (React confirms state change)
❌ 🎨 ExcalidrawCanvas received elements: 0 elements (IMMEDIATE RESET!)
❌ 🔄 React state updated: 0 elements (Back to empty array)
```

### **Cedar Debugger Shows:**
```json
{
  "key": "excalidrawElements",
  "value": [], // ← Always empty despite successful setState calls
  "stateSetters": { "addElement": {...} }
}
```

## 🏗️ **Architecture**
- **Frontend**: `cedar-os: ^0.1.18`
- **Backend**: `@cedar-os/backend: ^0.0.12` (highest available version)
- **Integration**: Using legacy `useRegisterState` for version compatibility
- **Communication**: SSE stream via `/chat/stream` (working perfectly)

## ✅ **What's Working Perfectly:**
1. **Backend Tool Execution** - addRectangle tool calls succeed
2. **State Event Dispatch** - setState events sent via SSE
3. **Frontend Execute Function** - Cedar calls our execute function correctly
4. **React State Updates** - setExcalidrawElements runs successfully
5. **Canvas Prop Reception** - ExcalidrawCanvas receives elements initially

## ❌ **The Core Issue:**
Something **immediately resets** the React state back to empty after successful updates.

## 🔧 **What We've Fixed:**
1. **Version Mismatch** - Using legacy `useRegisterState` for 0.0.12 backend compatibility
2. **Setter Format** - Object with `execute` function (not bare function)
3. **Args Format** - Handling backend's direct args (not wrapped `{newElement}`)
4. **Execute Function** - Creating proper Excalidraw element structure
5. **Logging** - Complete debug trace of update→reset pattern

## 📁 **Current Working Code:**

### Frontend State Registration (`src/app/page.tsx`):
```typescript
const [excalidrawElements, setExcalidrawElements] = React.useState<any[]>([]);

// Debug logging
React.useEffect(() => {
  console.log('🔄 React state updated:', excalidrawElements.length, 'elements:', excalidrawElements);
}, [excalidrawElements]);

useRegisterState({
  key: 'excalidrawElements',
  value: excalidrawElements,
  setValue: (newValue) => {
    console.log('🔧 useRegisterState setValue called:', newValue);
    setExcalidrawElements(newValue);
  },
  description: 'The elements on the Excalidraw canvas',
  stateSetters: {
    addElement: {
      name: 'addElement',
      description: 'Add an Excalidraw element to the canvas',
      execute: (current: any[], args: any) => {
        const newElement = {
          id: `rect_${Date.now()}`,
          type: 'rectangle',
          ...args
        };
        console.log('🎯 EXECUTE CALLED:', { current, args, newElement });
        const newElements = [...current, newElement];
        console.log('🚀 Calling setExcalidrawElements with:', newElements);
        setExcalidrawElements(newElements);
      },
    },
  }
});
```

### Backend Tool (`src/backend/src/mastra/tools/toolDefinitions.ts`):
```typescript
export const addRectangleTool = createMastraToolForStateSetter(
  'excalidrawElements',    // state key
  'addElement',            // state setter name
  AddRectangleSchema,      // Zod schema with .transform()
  {
    description: 'Spawn a rectangle on the Excalidraw canvas',
    toolId: 'addRectangle',
    streamEventFn: streamJSONEvent,
    errorSchema: ErrorResponseSchema,
  },
);
```

### Canvas Component (`src/components/ExcalidrawCanvas.tsx`):
```typescript
const ExcalidrawCanvas = ({ elements, onElementsChange }) => {
  // Debug logging
  React.useEffect(() => {
    console.log('🎨 ExcalidrawCanvas received elements:', elements.length, 'elements:', elements);
  }, [elements]);

  return (
    <Excalidraw
      initialData={{ elements: elements, appState: appState }}
      onChange={(newElements, newAppState) => {
        onElementsChange(newElements);
        setAppState(newAppState);
      }}
    />
  );
};
```

## 🔍 **Theories to Investigate:**
1. **useRegisterState Conflict** - Cedar internal state vs React state sync issue
2. **Component Lifecycle** - State updates getting overridden during render cycles
3. **SSE Handler Conflict** - Multiple setState events causing race conditions
4. **Version Incompatibility** - Silent failures between 0.1.18 frontend and 0.0.12 backend

## 📋 **Next Steps:**
1. **Research Cedar-OS internal state management** - How does useRegisterState sync with React?
2. **Investigate version compatibility** - Are there breaking changes in setState flow?
3. **Check SSE event handling** - Could multiple events be conflicting?
4. **Test alternative approaches** - Different state registration patterns?

## 🧪 **Test Commands:**
- **Frontend**: `http://localhost:3000`
- **Test**: Type "add a rectangle" in chat
- **Backend**: Shows successful setState execution
- **Frontend**: Shows update→reset pattern in console

## 📦 **Package Versions:**
```json
{
  "cedar-os": "^0.1.18",
  "@cedar-os/backend": "^0.0.12",
  "next": "15.4.4",
  "react": "19.1.0",
  "@excalidraw/excalidraw": "^0.18.0"
}
```

## 🔴 **CRITICAL ISSUE:**
The setState flow works perfectly until the final step - something immediately resets React state after successful updates. Need to identify what's causing this reset pattern.

---
**Status**: Ready for comprehensive Cedar-OS research to identify the reset mechanism.