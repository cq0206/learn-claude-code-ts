import {
  createBaseTools,
  createLoopContext,
  createSaveMemoryTool,
  MemoryManager,
  runAgentLoop,
  runRepl,
  WORKDIR
} from "./_runtime";

const ctx = createLoopContext();
const memoryManager = new MemoryManager();
memoryManager.loadAll();
const tools = [...createBaseTools(), createSaveMemoryTool(memoryManager)];

await runRepl({
  label: "s09",
  ctx,
  run: async (loopCtx) => {
    memoryManager.loadAll();
    await runAgentLoop(loopCtx, {
      systemPrompt: `You are a coding agent at ${WORKDIR}.
Use memory only for durable information that should survive the current session.

${memoryManager.loadMemoryPrompt()}`.trim(),
      tools,
      normalizeMessages: true
    });
  }
});
