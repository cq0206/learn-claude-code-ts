import { createBaseTools, createLoopContext, runAgentLoop, runRepl, WORKDIR } from "./_runtime";

const ctx = createLoopContext();
const tools = [createBaseTools()[0]];

await runRepl({
  label: "s01",
  ctx,
  run: async (loopCtx) => {
    await runAgentLoop(loopCtx, {
      systemPrompt: `You are a coding agent at ${WORKDIR}. Use bash to inspect and change the workspace. Act first, then report clearly.`,
      tools,
      maxTurns: 20
    });
  }
});
