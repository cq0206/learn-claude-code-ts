import {
  BackgroundManager,
  CompactManager,
  CronScheduler,
  createBackgroundTools,
  createBaseTools,
  createCronTools,
  createLoadSkillTool,
  createLoopContext,
  createPluginTools,
  createProtocolTools,
  createSaveMemoryTool,
  createSubagentRunner,
  createTaskBoardTools,
  createTaskTool,
  createTeamTools,
  createTodoTool,
  createWorktreeTools,
  HookManager,
  MemoryManager,
  MessageBus,
  PermissionManager,
  PluginLoader,
  runAgentLoop,
  runRepl,
  SkillRegistry,
  TaskManager,
  TeammateManager,
  TodoManager,
  WorktreeManager,
  WORKDIR
} from "./_runtime";

const ctx = createLoopContext();
const compactManager = new CompactManager();
const permissionManager = new PermissionManager((process.env.PERMISSION_MODE as "default" | "plan" | "auto" | undefined) || "default");
const hookManager = new HookManager();
const todoManager = new TodoManager();
const skillRegistry = new SkillRegistry();
const memoryManager = new MemoryManager();
const taskManager = new TaskManager();
const backgroundManager = new BackgroundManager();
const cronScheduler = new CronScheduler();
const messageBus = new MessageBus();
const teammateManager = new TeammateManager();
const worktreeManager = new WorktreeManager();
const pluginLoader = new PluginLoader();

memoryManager.loadAll();

const subagentTools = createBaseTools({
  compact: compactManager,
  permissions: permissionManager,
  hooks: hookManager
});
const runSubagent = createSubagentRunner({
  systemPrompt: `You are a coding subagent at ${WORKDIR}. Complete the delegated task, then return a short concrete summary.`,
  tools: subagentTools,
  normalizeMessages: true
});

const tools = [
  ...createBaseTools({
    compact: compactManager,
    permissions: permissionManager,
    hooks: hookManager
  }),
  createTodoTool(todoManager),
  createTaskTool(runSubagent),
  createLoadSkillTool(skillRegistry),
  createSaveMemoryTool(memoryManager),
  ...createTaskBoardTools(taskManager),
  ...createBackgroundTools(backgroundManager),
  ...createCronTools(cronScheduler, taskManager),
  ...createTeamTools(messageBus, teammateManager),
  ...createProtocolTools(messageBus),
  ...createWorktreeTools(worktreeManager),
  ...createPluginTools(pluginLoader)
];

await runRepl({
  label: "full",
  ctx,
  onSessionStart: () => {
    const sessionStart = hookManager.runHooks("SessionStart");
    if (sessionStart.messages.length > 0) {
      console.log(sessionStart.messages.join("\n"));
    }
  },
  run: async (loopCtx) => {
    memoryManager.loadAll();
    pluginLoader.load();
    await runAgentLoop(loopCtx, {
      systemPrompt: `You are a capstone teaching agent at ${WORKDIR}.
Use the available tools to plan, delegate, remember durable facts, coordinate background work, and keep context under control.

Skills:
${skillRegistry.describeAvailable()}

Memories:
${memoryManager.loadMemoryPrompt() || "(no saved memory yet)"}`.trim(),
      tools,
      normalizeMessages: true,
      beforeModel: async () => {
        const notifications = backgroundManager.drainNotifications();
        if (notifications.length > 0) {
          loopCtx.messages.push({
            role: "user",
            content: notifications
              .map((item) => `Background task ${item.taskId} finished [${item.status}] -> ${item.preview} (output_file=${item.outputFile})`)
              .join("\n")
          });
        }
        if (compactManager.estimateContextSize(loopCtx.messages) > compactManager.contextLimit) {
          loopCtx.messages = await compactManager.compactHistory(loopCtx.messages, "Continue the active coding task.");
        }
      },
      afterToolResults: () => {
        compactManager.microCompact(loopCtx.messages);
      },
      onModelError: (error, currentCtx, attempt) => {
        if (attempt > 1) {
          return false;
        }
        currentCtx.messages.push({
          role: "user",
          content: `The previous model call failed with: ${error instanceof Error ? error.message : String(error)}. Recover and continue with the current task state.`
        });
        return true;
      }
    });
  }
});
