import {
  createBaseTools,
  createLoopContext,
  createPluginTools,
  PluginLoader,
  runAgentLoop,
  runRepl,
  WORKDIR
} from "./_runtime";

const ctx = createLoopContext();
const pluginLoader = new PluginLoader();
const tools = [...createBaseTools(), ...createPluginTools(pluginLoader)];

await runRepl({
  label: "s19",
  ctx,
  run: async (loopCtx) => {
    pluginLoader.load();
    await runAgentLoop(loopCtx, {
      systemPrompt: `You are a coding agent at ${WORKDIR}. External tools should enter the same tool pipeline as native tools, even when they come from plugin manifests.`,
      tools,
      normalizeMessages: true
    });
  }
});
