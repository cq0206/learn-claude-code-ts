import {
  createBaseTools,
  createLoopContext,
  PermissionManager,
  runAgentLoop,
  runRepl,
  WORKDIR
} from "./_runtime";

const ctx = createLoopContext();
const permissions = new PermissionManager((process.env.PERMISSION_MODE as "default" | "plan" | "auto" | undefined) || "default");
const tools = createBaseTools({ permissions });

await runRepl({
  label: "s07",
  ctx,
  run: async (loopCtx) => {
    await runAgentLoop(loopCtx, {
      systemPrompt: `You are a coding agent at ${WORKDIR}. Every tool call passes through a permission pipeline before execution.`,
      tools,
      normalizeMessages: true
    });
  }
});
