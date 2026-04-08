import {
  CronScheduler,
  createBaseTools,
  createCronTools,
  createLoopContext,
  createTaskBoardTools,
  runAgentLoop,
  runRepl,
  TaskManager,
  WORKDIR
} from "./_runtime";

const ctx = createLoopContext();
const taskManager = new TaskManager();
const cronScheduler = new CronScheduler();
const tools = [...createBaseTools(), ...createTaskBoardTools(taskManager), ...createCronTools(cronScheduler, taskManager)];

await runRepl({
  label: "s14",
  ctx,
  run: async (loopCtx) => {
    await runAgentLoop(loopCtx, {
      systemPrompt: `You are a coding agent at ${WORKDIR}. Use schedules for recurring work and the durable task board for materialized jobs.`,
      tools,
      normalizeMessages: true
    });
  }
});
