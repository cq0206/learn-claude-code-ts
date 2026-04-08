import {
  createBaseTools,
  createLoopContext,
  createProtocolTools,
  createTeamTools,
  MessageBus,
  runAgentLoop,
  runRepl,
  TeammateManager,
  WORKDIR
} from "./_runtime";

const ctx = createLoopContext();
const messageBus = new MessageBus();
const teammateManager = new TeammateManager();
const tools = [
  ...createBaseTools(),
  ...createTeamTools(messageBus, teammateManager),
  ...createProtocolTools(messageBus)
];

await runRepl({
  label: "s16",
  ctx,
  run: async (loopCtx) => {
    await runAgentLoop(loopCtx, {
      systemPrompt: `You are a coding agent at ${WORKDIR}. Use structured team protocols for plan approvals, requests, and responses.`,
      tools,
      normalizeMessages: true
    });
  }
});
