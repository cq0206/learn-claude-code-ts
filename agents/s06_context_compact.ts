import {
  CompactManager,
  createBaseTools,
  createLoopContext,
  runAgentLoop,
  runRepl,
  WORKDIR
} from "./_runtime";

const ctx = createLoopContext();
const compactManager = new CompactManager();
const tools = createBaseTools({ compact: compactManager });

await runRepl({
  label: "s06",
  ctx,
  run: async (loopCtx) => {
    await runAgentLoop(loopCtx, {
      systemPrompt: `You are a coding agent at ${WORKDIR}. Keep working step by step, and compact context when it gets too long.`,
      tools,
      normalizeMessages: true,
      beforeModel: async () => {
        if (compactManager.estimateContextSize(loopCtx.messages) > compactManager.contextLimit) {
          loopCtx.messages = await compactManager.compactHistory(loopCtx.messages, "Continue the current implementation task.");
        }
      },
      afterToolResults: () => {
        compactManager.microCompact(loopCtx.messages);
      }
    });
  }
});
