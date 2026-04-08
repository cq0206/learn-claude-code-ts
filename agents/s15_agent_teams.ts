import {
  createBaseTools,
  createLoopContext,
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
const tools = [...createBaseTools(), ...createTeamTools(messageBus, teammateManager)];

await runRepl({
  label: "s15",
  ctx,
  run: async (loopCtx) => {
    await runAgentLoop(loopCtx, {
      systemPrompt: `You are a coding agent at ${WORKDIR}. Use the team inbox to coordinate with persistent teammates.`,
      tools,
      normalizeMessages: true
    });
  }
});
