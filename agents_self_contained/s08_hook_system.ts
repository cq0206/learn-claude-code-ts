import {
  createBaseTools,
  createLoopContext,
  HookManager,
  runAgentLoop,
  runRepl,
  WORKDIR
} from "./_runtime";

const ctx = createLoopContext();
const hooks = new HookManager();
const tools = createBaseTools({ hooks });

await runRepl({
  label: "s08",
  ctx,
  onSessionStart: () => {
    const result = hooks.runHooks("SessionStart");
    if (result.messages.length > 0) {
      console.log(result.messages.join("\n"));
    }
  },
  run: async (loopCtx) => {
    await runAgentLoop(loopCtx, {
      systemPrompt: `You are a coding agent at ${WORKDIR}. Hooks extend the agent without touching the loop.`,
      tools,
      normalizeMessages: true
    });
  }
});
