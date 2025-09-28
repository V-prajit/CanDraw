# **URGENT: Cedar-OS State Reset Mystery - Needs Deep Research**

## **Quick Context:**
You're continuing a Cedar-OS + Mastra + Excalidraw integration where we've solved 90% of the issues but hit a **critical final blocker**: React state updates work but get **immediately reset back to empty**.

## **Read This First:**
**Complete debugging info**: `/Users/prajit/test/templateforHackGT/CEDAR_DEBUG_CHECKPOINT.md`

## **Current Status:**
**Backend**: 100% working - setState events sent successfully
**Frontend Execute**: Cedar calls our function correctly
**React Updates**: setExcalidrawElements runs successfully
**ISSUE**: State gets immediately reset to empty after updates

## **The Reset Pattern:**
```
EXECUTE CALLED → setState called → Canvas receives element → React confirms update
↓ THEN IMMEDIATELY:
Canvas receives empty → React state reset to []
```

## **Key Evidence:**
- Console shows perfect execution followed by immediate reset
- Cedar debugger always shows `"value": []` despite successful setState
- Using `useRegisterState` (legacy) for version compatibility (`0.1.18` frontend vs `0.0.12` backend)

## **Your Mission:**
**Research why Cedar-OS `useRegisterState` allows React state updates but then immediately resets them.**

## **Approach Options:**
1. **Ask user for comprehensive GPT research** - Use the checkpoint file to create a detailed prompt with all code files and evidence
2. **Investigate Cedar-OS internals** - Check if there's a sync conflict between Cedar store and React state
3. **Test alternative approaches** - Try different state registration patterns

## **Current Working Directory:**
`/Users/prajit/test/templateforHackGT/`

## **Test Setup:**
- `npm run dev` → `http://localhost:3000`
- Type "add a rectangle" in chat
- Check browser console for the update→reset pattern

## **Critical Files:**
- `src/app/page.tsx` (state registration with full debug logs)
- `src/components/ExcalidrawCanvas.tsx` (canvas with debug logs)
- `src/backend/src/mastra/tools/toolDefinitions.ts` (working backend tool)

## **Success Criteria:**
Rectangle appears on Excalidraw canvas when user types "add a rectangle" in chat.

**This is 95% solved - just need to identify the reset mechanism!**