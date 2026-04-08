import {
  createBaseTools,
  createLoadSkillTool,
  createLoopContext,
  runAgentLoop,
  runRepl,
  SkillRegistry,
  WORKDIR
} from "./_runtime";

const ctx = createLoopContext();
const skillRegistry = new SkillRegistry();
const tools = [...createBaseTools(), createLoadSkillTool(skillRegistry)];

await runRepl({
  label: "s05",
  ctx,
  run: async (loopCtx) => {
    await runAgentLoop(loopCtx, {
      systemPrompt: `You are a coding agent at ${WORKDIR}.
Use load_skill when a task needs specialized instructions before you act.

Skills available:
${skillRegistry.describeAvailable()}`,
      tools,
      normalizeMessages: true
    });
  }
});
