import { createBaseTools, createLoopContext, runAgentLoop, runRepl, WORKDIR } from "./_runtime";

const ctx = createLoopContext();
const tools = createBaseTools();

await runRepl({
  label: "s11",
  ctx,
  run: async (loopCtx) => {
    await runAgentLoop(loopCtx, {
      systemPrompt: `You are a coding agent at ${WORKDIR}. If a model call or tool step fails, recover and continue instead of giving up immediately.`,
      tools,
      normalizeMessages: true,
      onModelError: (error, currentCtx, attempt) => {
        if (attempt > 1) {
          return false;
        }
        const message = error instanceof Error ? error.message : String(error);
        currentCtx.messages.push({
          role: "user",
          content: `The previous model call failed with: ${message}. Recover carefully, keep the task state, and continue.`
        });
        return true;
      }
    });
  }
});
