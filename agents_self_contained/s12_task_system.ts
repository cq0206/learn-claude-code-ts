import {
  createBaseTools,
  createLoopContext,
  createTaskBoardTools,
  runAgentLoop,
  runRepl,
  TaskManager,
  WORKDIR
} from "./_runtime";

const ctx = createLoopContext();
const taskManager = new TaskManager();
const tools = [...createBaseTools(), ...createTaskBoardTools(taskManager)];

await runRepl({
  label: "s12",
  ctx,
  run: async (loopCtx) => {
    await runAgentLoop(loopCtx, {
      systemPrompt: `You are a coding agent at ${WORKDIR}. Use the durable task board for work that should survive the current REPL turn.`,
      tools,
      normalizeMessages: true
    });
  }
});
