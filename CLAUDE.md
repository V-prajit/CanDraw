# UML Database Diagram Implementation - Step by Step

## Current Situation
- **Frontend**: Ready to receive shape elements via Cedar-OS state management
- **Backend**: Only has text manipulation tools, NO shape tools
- **Goal**: Enable AI agent to create UML database diagrams through chat
- **Critical Gap**: Backend cannot spawn shapes/rectangles when user requests them

## Architecture Overview
```
User Chat → Mastra Agent → Shape Tools → Cedar-OS State → Excalidraw Canvas
```

## Step-by-Step Implementation Plan

### Phase 1: Basic Shape Foundation
**Goal**: Enable spawning a single rectangle via chat command

#### Step 1.1: Create Rectangle Tool
- Add `addRectangleTool` to `src/backend/src/mastra/tools/toolDefinitions.ts`
- Use `createMastraToolForStateSetter` targeting `excalidrawElements` state
- Target the existing `addElement` state setter from frontend

#### Step 1.2: Update Agent Instructions
- Modify `src/backend/src/mastra/agents/starterAgent.ts`
- Add shape manipulation capabilities to agent description
- Include rectangle creation in primary functions

#### Step 1.3: Test Basic Rectangle
- Test with prompt: "Add a rectangle to the canvas"
- Verify rectangle appears in Excalidraw

### Phase 2: UML Database Components
**Goal**: Create database-specific shapes and layouts

#### Step 2.1: Database Table Tool
- Create `createDatabaseTableTool` that generates:
  - Rectangle for table boundary
  - Text element for table name
  - Proper positioning and sizing

#### Step 2.2: Field Management
- Add `addTableFieldTool` for adding fields to tables
- Position fields vertically within table bounds

#### Step 2.3: Relationship Lines
- Add `connectTablesTool` for creating foreign key relationships
- Use Excalidraw arrow/line elements

### Phase 3: Advanced UML Features
**Goal**: Complete UML diagram capabilities

#### Step 3.1: Smart Positioning
- Implement automatic layout algorithms
- Prevent overlapping tables
- Maintain readable spacing

#### Step 3.2: UML Standards
- Add primary key indicators
- Foreign key relationship types
- Data type annotations

## Key Files to Modify

1. **`src/backend/src/mastra/tools/toolDefinitions.ts`**
   - Add shape manipulation tools
   - Update TOOL_REGISTRY with shapeManipulation category
   - Add tools to ALL_TOOLS array

2. **`src/backend/src/mastra/agents/starterAgent.ts`**
   - Update agent instructions for UML context
   - Add shape capabilities to primary functions

3. **Test Files**
   - Verify tools work through Mastra API endpoints
   - Test chat integration

## Testing Commands
- `npm run dev` - Start development servers
- `curl http://localhost:4112/api/tools` - Check available tools
- Chat: "Create a rectangle" - Test basic shape spawning

## Package Version Warning
⚠️ **DO NOT modify package.json versions** - Current setup has verified compatibility
- Next.js 15.4.4
- React 19.1.0
- Excalidraw 0.18.0
- Cedar-OS 0.1.18
- Mastra 0.13.1

## Current State
- ✅ Frontend state management ready
- ✅ Excalidraw integration working
- ✅ Cedar-OS agent communication working
- ❌ Backend shape tools missing (CRITICAL)
- ❌ Agent instructions limited to text only

## Success Criteria
1. User types "Add a rectangle" → Rectangle appears on canvas
2. User types "Create User table" → Table structure appears
3. User types "Connect User to Posts" → Relationship line appears