import {
  createBaseTools,
  createLoopContext,
  createSubagentRunner,
  createTaskTool,
  runAgentLoop,
  runRepl,
  WORKDIR
} from "./_runtime";

const ctx = createLoopContext();
const childTools = createBaseTools();
const runSubagent = createSubagentRunner({
  systemPrompt: `You are a coding subagent at ${WORKDIR}. Complete the given task, then summarize your findings.`,
  tools: childTools,
  normalizeMessages: true
});
const tools = [...createBaseTools(), createTaskTool(runSubagent)];

await runRepl({
  label: "s04",
  ctx,
  run: async (loopCtx) => {
    await runAgentLoop(loopCtx, {
      systemPrompt: `You are a coding agent at ${WORKDIR}. Use the task tool to delegate exploration or subtasks.`,
      tools,
      normalizeMessages: true
    });
  }
});
