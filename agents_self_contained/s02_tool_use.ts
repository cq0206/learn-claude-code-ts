import { createBaseTools, createLoopContext, runAgentLoop, runRepl, WORKDIR } from "./_runtime";

const ctx = createLoopContext();
const tools = createBaseTools();

await runRepl({
  label: "s02",
  ctx,
  run: async (loopCtx) => {
    await runAgentLoop(loopCtx, {
      systemPrompt: `You are a coding agent at ${WORKDIR}. Use tools to solve tasks. Act, don't explain.`,
      tools,
      normalizeMessages: true
    });
  }
});
