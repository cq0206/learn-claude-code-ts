import { createBaseTools, createLoopContext, createTodoTool, runAgentLoop, runRepl, TodoManager, WORKDIR } from "./_runtime";

const ctx = createLoopContext();
const todoManager = new TodoManager();
const tools = [...createBaseTools(), createTodoTool(todoManager)];

await runRepl({
  label: "s03",
  ctx,
  run: async (loopCtx) => {
    await runAgentLoop(loopCtx, {
      systemPrompt: `You are a coding agent at ${WORKDIR}.
Use the todo tool for multi-step work.
Keep exactly one step in_progress when a task has multiple steps.
Refresh the plan as work advances. Prefer tools over prose.`,
      tools,
      normalizeMessages: true,
      afterToolResults: () => {
        todoManager.noteRoundWithoutUpdate();
        const reminder = todoManager.reminder();
        if (reminder) {
          loopCtx.messages.push({ role: "user", content: reminder });
        }
      }
    });
  }
});
