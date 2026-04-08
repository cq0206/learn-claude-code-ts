import {
  buildPromptSections,
  createBaseTools,
  createLoadSkillTool,
  createLoopContext,
  createSaveMemoryTool,
  MemoryManager,
  runAgentLoop,
  runRepl,
  SkillRegistry,
  WORKDIR
} from "./_runtime";

const ctx = createLoopContext();
const memoryManager = new MemoryManager();
const skillRegistry = new SkillRegistry();
memoryManager.loadAll();
const tools = [...createBaseTools(), createLoadSkillTool(skillRegistry), createSaveMemoryTool(memoryManager)];

await runRepl({
  label: "s10",
  ctx,
  run: async (loopCtx) => {
    memoryManager.loadAll();
    await runAgentLoop(loopCtx, {
      systemPrompt: buildPromptSections([
        { title: "Role", body: `You are a coding agent at ${WORKDIR}.` },
        { title: "Operating Style", body: "Prefer tools over prose. Keep outputs concrete and implementation-oriented." },
        { title: "Skills", body: skillRegistry.describeAvailable() },
        { title: "Memory", body: memoryManager.loadMemoryPrompt() || "(no saved memory)" }
      ]),
      tools,
      normalizeMessages: true
    });
  }
});
