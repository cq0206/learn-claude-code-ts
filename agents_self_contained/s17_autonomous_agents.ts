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
const tools = [
  ...createBaseTools(),
  ...createTaskBoardTools(taskManager),
  {
    spec: {
      name: "scan_unclaimed_tasks",
      description: "List durable tasks that are not owned by any agent.",
      input_schema: { type: "object", properties: {} }
    },
    execute: () => {
      const tasks = taskManager.scanUnclaimedTasks();
      return tasks.length > 0
        ? tasks.map((task) => `${task.id}: [${task.status}] ${task.title}`).join("\n")
        : "No unclaimed tasks.";
    }
  }
];

await runRepl({
  label: "s17",
  ctx,
  run: async (loopCtx) => {
    await runAgentLoop(loopCtx, {
      systemPrompt: `You are a coding agent at ${WORKDIR}. Autonomous agents can scan for unclaimed work and claim it without waiting for a direct prompt.`,
      tools,
      normalizeMessages: true
    });
  }
});
