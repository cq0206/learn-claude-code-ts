import {
  BackgroundManager,
  createBackgroundTools,
  createBaseTools,
  createLoopContext,
  runAgentLoop,
  runRepl,
  WORKDIR
} from "./_runtime";

const ctx = createLoopContext();
const backgroundManager = new BackgroundManager();
const tools = [...createBaseTools(), ...createBackgroundTools(backgroundManager)];

await runRepl({
  label: "s13",
  ctx,
  run: async (loopCtx) => {
    await runAgentLoop(loopCtx, {
      systemPrompt: `You are a coding agent at ${WORKDIR}. Use background_run for slow commands and drain notifications before each new model turn.`,
      tools,
      normalizeMessages: true,
      beforeModel: () => {
        const notifications = backgroundManager.drainNotifications();
        if (notifications.length > 0) {
          loopCtx.messages.push({
            role: "user",
            content: notifications
              .map((item) => `Background task ${item.taskId} finished [${item.status}] -> ${item.preview} (output_file=${item.outputFile})`)
              .join("\n")
          });
        }
      }
    });
  }
});
