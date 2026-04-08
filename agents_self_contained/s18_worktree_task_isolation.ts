import {
  createBaseTools,
  createLoopContext,
  createTaskBoardTools,
  createWorktreeTools,
  runAgentLoop,
  runRepl,
  TaskManager,
  WorktreeManager,
  WORKDIR
} from "./_runtime";

const ctx = createLoopContext();
const taskManager = new TaskManager();
const worktreeManager = new WorktreeManager();
const tools = [...createBaseTools(), ...createTaskBoardTools(taskManager), ...createWorktreeTools(worktreeManager)];

await runRepl({
  label: "s18",
  ctx,
  run: async (loopCtx) => {
    await runAgentLoop(loopCtx, {
      systemPrompt: `You are a coding agent at ${WORKDIR}. Use isolated lanes when parallel work would otherwise trample shared state.`,
      tools,
      normalizeMessages: true
    });
  }
});
