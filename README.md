# CanDraw

A voice/chat-driven whiteboard for sketching database schemas. Draw tables and relationships on an Excalidraw canvas, describe changes by voice or chat, and export the diagram to SQL `CREATE TABLE` statements.

**Status:** Hackathon project (weekend hackathon, September 2025). Not maintained.

## What it does

- Excalidraw-based canvas for drawing tables (rectangles + text) and relationships (arrows that snap to table edges).
- A chat/voice interface (Cedar-OS on the frontend, Mastra agents on the backend) that can add or modify canvas elements from natural-language instructions.
- An export step that reads the raw Excalidraw elements, infers tables/fields/relationships via an LLM call, and generates SQL schema output.

This started from the Cedar-OS + Mastra Next.js starter template and was built out from there; the starter's chat/streaming scaffolding is still the backend's plumbing, but the schema-drawing, arrow-snapping, and SQL export are what was actually built for the hackathon.

## Technical notes

- Arrow-to-table edge snapping is a `useEffect`-driven layer on top of Excalidraw's element model (`src/components/ExcalidrawCanvas.tsx`) since Excalidraw doesn't support that natively.
- SQL export (`src/backend/src/mastra/tools/llmExportTool.ts`) filters the canvas to rectangle/text/arrow/line elements, then prompts an LLM to parse them into a structured `{tables, relationships, sql}` object rather than parsing shapes geometrically.
- Voice input worked but the commit history notes occasional infinite loops in the voice workflow; treat it as a rough edge, not a solid feature.

## Usage

```bash
pnpm install && cd src/backend && pnpm install && cd ../..
```

Create `.env` with `OPENAI_API_KEY=...`, then:

```bash
npm run dev
```

Runs the Next.js frontend (`:3000`) and the Mastra backend (`:4111`) together.

## Personal contribution

Built with a 3-person team over a weekend hackathon. I built the core drawing flow: table rendering, the arrow-snapping logic, and the SQL export/generation path. Teammates worked on the voice integration and chat workflow wiring.

## License

No license file is present, so default copyright applies (all rights reserved) unless you hear otherwise from me directly.
