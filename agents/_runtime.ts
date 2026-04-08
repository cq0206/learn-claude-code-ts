import Anthropic from "@anthropic-ai/sdk";
import dotenv from "dotenv";
import { execSync, spawn, spawnSync } from "node:child_process";
import fs from "node:fs";
import fsp from "node:fs/promises";
import path from "node:path";
import process from "node:process";
import readline from "node:readline/promises";
import { stdin as input, stdout as output } from "node:process";

dotenv.config({ override: true });

export const WORKDIR = process.cwd();
export const DEFAULT_MODEL = "claude-3-5-sonnet-latest";

export type AgentRole = "user" | "assistant";

export type ToolInput = Record<string, unknown>;

export type TextBlock = {
  type: "text";
  text: string;
};

export type ToolUseBlock = {
  type: "tool_use";
  id: string;
  name: string;
  input: ToolInput;
};

export type ToolResultBlock = {
  type: "tool_result";
  tool_use_id: string;
  content: string;
  is_error?: boolean;
};

export type AgentContent = string | Array<TextBlock | ToolUseBlock | ToolResultBlock | Record<string, unknown>>;

export type AgentMessage = {
  role: AgentRole;
  content: AgentContent;
};

export type ToolSpec = {
  name: string;
  description: string;
  input_schema: Record<string, unknown>;
};

export type RegisteredTool = {
  spec: ToolSpec;
  execute: (input: ToolInput, ctx: LoopContext, toolUseId: string) => Promise<string> | string;
};

export type LoopContext = {
  workdir: string;
  messages: AgentMessage[];
  meta: Record<string, unknown>;
};

export type LoopConfig = {
  systemPrompt: string | (() => string);
  tools: RegisteredTool[];
  normalizeMessages?: boolean;
  maxTurns?: number;
  beforeModel?: (ctx: LoopContext) => Promise<void> | void;
  afterToolResults?: (ctx: LoopContext) => Promise<void> | void;
  onModelError?: (error: unknown, ctx: LoopContext, attempt: number) => Promise<boolean> | boolean;
};

let anthropicClient: Anthropic | null = null;

function getModelId(): string {
  return process.env.MODEL_ID || DEFAULT_MODEL;
}

function getAnthropicClient(): Anthropic {
  if (anthropicClient) {
    return anthropicClient;
  }
  anthropicClient = new Anthropic({
    apiKey: process.env.ANTHROPIC_API_KEY || process.env.ANTHROPIC_AUTH_TOKEN || "missing-api-key",
    baseURL: process.env.ANTHROPIC_BASE_URL || undefined
  });
  return anthropicClient;
}

export function createLoopContext(): LoopContext {
  return { workdir: WORKDIR, messages: [], meta: {} };
}

export function safePath(relativePath: string): string {
  const resolved = path.resolve(WORKDIR, relativePath);
  const relative = path.relative(WORKDIR, resolved);
  if (relative.startsWith("..") || path.isAbsolute(relative)) {
    throw new Error(`Path escapes workspace: ${relativePath}`);
  }
  return resolved;
}

export function runBash(command: string, cwd = WORKDIR, timeoutMs = 120_000): string {
  const dangerous = ["rm -rf /", "sudo ", "shutdown", "reboot", "> /dev/"];
  if (dangerous.some((item) => command.includes(item))) {
    return "Error: Dangerous command blocked";
  }
  try {
    const output = execSync(command, {
      cwd,
      encoding: "utf8",
      timeout: timeoutMs,
      maxBuffer: 10 * 1024 * 1024,
      shell: "/bin/zsh"
    });
    return output.trim() || "(no output)";
  } catch (error) {
    const stdout = typeof error === "object" && error !== null && "stdout" in error ? String((error as { stdout?: unknown }).stdout || "") : "";
    const stderr = typeof error === "object" && error !== null && "stderr" in error ? String((error as { stderr?: unknown }).stderr || "") : "";
    const message = `${stdout}${stderr}`.trim();
    if (message) {
      return message.slice(0, 50_000);
    }
    if (error instanceof Error) {
      return `Error: ${error.message}`;
    }
    return "Error: Unknown shell failure";
  }
}

export function readWorkspaceFile(filePath: string, limit?: number): string {
  try {
    const text = fs.readFileSync(safePath(filePath), "utf8");
    const lines = text.split(/\r?\n/u);
    if (typeof limit === "number" && limit > 0 && lines.length > limit) {
      return `${lines.slice(0, limit).join("\n")}\n... (${lines.length - limit} more lines)`;
    }
    return text.slice(0, 50_000);
  } catch (error) {
    return `Error: ${error instanceof Error ? error.message : String(error)}`;
  }
}

export function writeWorkspaceFile(filePath: string, content: string): string {
  try {
    const resolved = safePath(filePath);
    fs.mkdirSync(path.dirname(resolved), { recursive: true });
    fs.writeFileSync(resolved, content, "utf8");
    return `Wrote ${Buffer.byteLength(content, "utf8")} bytes to ${filePath}`;
  } catch (error) {
    return `Error: ${error instanceof Error ? error.message : String(error)}`;
  }
}

export function editWorkspaceFile(filePath: string, oldText: string, newText: string): string {
  try {
    const resolved = safePath(filePath);
    const content = fs.readFileSync(resolved, "utf8");
    const index = content.indexOf(oldText);
    if (index === -1) {
      return `Error: Text not found in ${filePath}`;
    }
    const updated = `${content.slice(0, index)}${newText}${content.slice(index + oldText.length)}`;
    fs.writeFileSync(resolved, updated, "utf8");
    return `Edited ${filePath}`;
  } catch (error) {
    return `Error: ${error instanceof Error ? error.message : String(error)}`;
  }
}

export function extractText(content: AgentContent): string {
  if (typeof content === "string") {
    return content;
  }
  return content
    .map((block) => {
      if (typeof block === "object" && block !== null && "text" in block && typeof block.text === "string") {
        return block.text;
      }
      if (typeof block === "object" && block !== null && "content" in block && typeof block.content === "string") {
        return block.content;
      }
      return "";
    })
    .filter(Boolean)
    .join("\n")
    .trim();
}

function normalizeContent(content: AgentContent): AgentContent {
  if (typeof content === "string") {
    return content;
  }
  return content
    .filter((block) => typeof block === "object" && block !== null)
    .map((block) => {
      const cleaned = Object.fromEntries(
        Object.entries(block).filter(([key]) => !key.startsWith("_"))
      );
      return cleaned;
    });
}

export function normalizeMessages(messages: AgentMessage[]): AgentMessage[] {
  const cleaned = messages.map((message) => ({
    role: message.role,
    content: normalizeContent(message.content)
  }));

  const existingToolResults = new Set<string>();
  for (const message of cleaned) {
    if (!Array.isArray(message.content)) {
      continue;
    }
    for (const block of message.content) {
      if (typeof block === "object" && block !== null && block.type === "tool_result" && typeof block.tool_use_id === "string") {
        existingToolResults.add(block.tool_use_id);
      }
    }
  }

  for (const message of cleaned) {
    if (message.role !== "assistant" || !Array.isArray(message.content)) {
      continue;
    }
    for (const block of message.content) {
      if (
        typeof block === "object" &&
        block !== null &&
        block.type === "tool_use" &&
        typeof block.id === "string" &&
        !existingToolResults.has(block.id)
      ) {
        cleaned.push({
          role: "user",
          content: [{ type: "tool_result", tool_use_id: block.id, content: "(cancelled)" }]
        });
      }
    }
  }

  const merged: AgentMessage[] = [];
  for (const message of cleaned) {
    const previous = merged.at(-1);
    if (!previous || previous.role !== message.role) {
      merged.push(message);
      continue;
    }
    const previousBlocks = typeof previous.content === "string" ? [{ type: "text", text: previous.content }] : previous.content;
    const nextBlocks = typeof message.content === "string" ? [{ type: "text", text: message.content }] : message.content;
    previous.content = [...previousBlocks, ...nextBlocks];
  }
  return merged;
}

async function callModel(systemPrompt: string, messages: AgentMessage[], tools: ToolSpec[]): Promise<any> {
  const client = getAnthropicClient();
  return client.messages.create({
    model: getModelId(),
    system: systemPrompt,
    messages: messages as any,
    tools: tools as any,
    max_tokens: 8_000
  });
}

export async function runAgentLoop(ctx: LoopContext, config: LoopConfig): Promise<void> {
  const maxTurns = config.maxTurns ?? 30;
  const toolMap = new Map(config.tools.map((tool) => [tool.spec.name, tool]));

  for (let turn = 0; turn < maxTurns; turn += 1) {
    if (config.beforeModel) {
      await config.beforeModel(ctx);
    }

    const systemPrompt = typeof config.systemPrompt === "function" ? config.systemPrompt() : config.systemPrompt;
    const apiMessages = config.normalizeMessages ? normalizeMessages(ctx.messages) : ctx.messages;

    let response: any;
    let modelAttempt = 0;
    for (;;) {
      try {
        const retryMessages = config.normalizeMessages ? normalizeMessages(ctx.messages) : ctx.messages;
        response = await callModel(systemPrompt, retryMessages, config.tools.map((tool) => tool.spec));
        break;
      } catch (error) {
        modelAttempt += 1;
        const shouldRetry = config.onModelError ? await config.onModelError(error, ctx, modelAttempt) : false;
        if (!shouldRetry) {
          throw error;
        }
      }
    }

    ctx.messages.push({ role: "assistant", content: response.content as AgentContent });
    if (response.stop_reason !== "tool_use") {
      return;
    }

    const toolResults: ToolResultBlock[] = [];
    for (const block of response.content as Array<any>) {
      if (block.type !== "tool_use") {
        continue;
      }
      const registered = toolMap.get(block.name);
      const toolUseId = String(block.id || cryptoRandomId());
      const input = typeof block.input === "object" && block.input !== null ? block.input as ToolInput : {};
      let outputText: string;
      if (!registered) {
        outputText = `Unknown tool: ${block.name}`;
      } else {
        outputText = await registered.execute(input, ctx, toolUseId);
      }
      console.log(`> ${block.name}`);
      console.log(outputText.slice(0, 200));
      toolResults.push({ type: "tool_result", tool_use_id: toolUseId, content: outputText });
    }

    ctx.messages.push({ role: "user", content: toolResults });
    if (config.afterToolResults) {
      await config.afterToolResults(ctx);
    }
  }
}

export async function runRepl(options: {
  label: string;
  ctx: LoopContext;
  run: (ctx: LoopContext) => Promise<void>;
  onSessionStart?: (ctx: LoopContext) => Promise<void> | void;
}): Promise<void> {
  const rl = readline.createInterface({ input, output });
  try {
    if (options.onSessionStart) {
      await options.onSessionStart(options.ctx);
    }
    for (;;) {
      const query = await rl.question(`\u001b[36m${options.label} >> \u001b[0m`);
      if (!query.trim() || ["q", "exit"].includes(query.trim().toLowerCase())) {
        break;
      }
      options.ctx.messages.push({ role: "user", content: query });
      await options.run(options.ctx);
      const lastAssistant = [...options.ctx.messages].reverse().find((message) => message.role === "assistant");
      const finalText = lastAssistant ? extractText(lastAssistant.content) : "";
      if (finalText) {
        console.log(finalText);
      }
      console.log("");
    }
  } finally {
    rl.close();
  }
}

function cryptoRandomId(): string {
  return Math.random().toString(36).slice(2, 10);
}

function withGuards(
  toolName: string,
  input: ToolInput,
  action: () => string,
  options?: {
    permissions?: PermissionManager;
    hooks?: HookManager;
    compact?: CompactManager;
    toolUseId?: string;
    onReadPath?: (filePath: string) => void;
  }
): string {
  const hookContext = { tool_name: toolName, tool_input: input };
  if (options?.permissions) {
    const decision = options.permissions.check(toolName, input);
    if (decision.behavior === "deny") {
      return `Permission denied: ${decision.reason}`;
    }
    if (decision.behavior === "ask" && !options.permissions.askUser(toolName, input)) {
      return `Permission denied by user for ${toolName}`;
    }
  }

  if (options?.hooks) {
    const pre = options.hooks.runHooks("PreToolUse", hookContext);
    if (pre.blocked) {
      return `Blocked by hook: ${pre.blockReason || "unknown"}`;
    }
  }

  let outputText = action();
  if (toolName === "read_file" && typeof input.path === "string" && options?.onReadPath) {
    options.onReadPath(input.path);
  }
  if (options?.compact) {
    outputText = options.compact.persistLargeOutput(options.toolUseId || cryptoRandomId(), outputText);
  }

  if (options?.hooks) {
    const post = options.hooks.runHooks("PostToolUse", { ...hookContext, tool_output: outputText });
    if (post.messages.length > 0) {
      outputText = `${outputText}\n\n${post.messages.join("\n")}`;
    }
  }
  return outputText.slice(0, 50_000);
}

export function createBaseTools(options?: {
  permissions?: PermissionManager;
  hooks?: HookManager;
  compact?: CompactManager;
}): RegisteredTool[] {
  return [
    {
      spec: {
        name: "bash",
        description: "Run a shell command in the current workspace.",
        input_schema: {
          type: "object",
          properties: { command: { type: "string" } },
          required: ["command"]
        }
      },
      execute: (input, _ctx, toolUseId) =>
        withGuards(
          "bash",
          input,
          () => runBash(String(input.command || "")),
          { ...options, toolUseId }
        )
    },
    {
      spec: {
        name: "read_file",
        description: "Read file contents from the workspace.",
        input_schema: {
          type: "object",
          properties: {
            path: { type: "string" },
            limit: { type: "integer" }
          },
          required: ["path"]
        }
      },
      execute: (input, _ctx, toolUseId) =>
        withGuards(
          "read_file",
          input,
          () => readWorkspaceFile(String(input.path || ""), typeof input.limit === "number" ? input.limit : undefined),
          {
            ...options,
            toolUseId,
            onReadPath: (filePath) => options?.compact?.trackRecentFile(filePath)
          }
        )
    },
    {
      spec: {
        name: "write_file",
        description: "Write a file in the workspace.",
        input_schema: {
          type: "object",
          properties: {
            path: { type: "string" },
            content: { type: "string" }
          },
          required: ["path", "content"]
        }
      },
      execute: (input, _ctx, toolUseId) =>
        withGuards(
          "write_file",
          input,
          () => writeWorkspaceFile(String(input.path || ""), String(input.content || "")),
          { ...options, toolUseId }
        )
    },
    {
      spec: {
        name: "edit_file",
        description: "Replace exact text in a file once.",
        input_schema: {
          type: "object",
          properties: {
            path: { type: "string" },
            old_text: { type: "string" },
            new_text: { type: "string" }
          },
          required: ["path", "old_text", "new_text"]
        }
      },
      execute: (input, _ctx, toolUseId) =>
        withGuards(
          "edit_file",
          input,
          () => editWorkspaceFile(
            String(input.path || ""),
            String(input.old_text || ""),
            String(input.new_text || "")
          ),
          { ...options, toolUseId }
        )
    }
  ];
}

export class TodoManager {
  items: Array<{ content: string; status: "pending" | "in_progress" | "completed"; activeForm: string }> = [];
  roundsSinceUpdate = 0;

  update(items: Array<Record<string, unknown>>): string {
    if (items.length > 12) {
      throw new Error("Keep the session plan short (max 12 items)");
    }
    const normalized = items.map((item, index) => {
      const content = String(item.content || "").trim();
      const status = String(item.status || "pending") as "pending" | "in_progress" | "completed";
      const activeForm = String(item.activeForm || "");
      if (!content) {
        throw new Error(`Item ${index}: content required`);
      }
      if (!["pending", "in_progress", "completed"].includes(status)) {
        throw new Error(`Item ${index}: invalid status '${status}'`);
      }
      return { content, status, activeForm };
    });
    const active = normalized.filter((item) => item.status === "in_progress");
    if (active.length > 1) {
      throw new Error("Only one plan item can be in_progress");
    }
    this.items = normalized;
    this.roundsSinceUpdate = 0;
    return this.render();
  }

  noteRoundWithoutUpdate(): void {
    this.roundsSinceUpdate += 1;
  }

  reminder(interval = 3): string | null {
    if (this.items.length === 0 || this.roundsSinceUpdate < interval) {
      return null;
    }
    return "<reminder>Refresh your current plan before continuing.</reminder>";
  }

  render(): string {
    if (this.items.length === 0) {
      return "No session plan yet.";
    }
    const lines = this.items.map((item) => {
      const marker = item.status === "completed" ? "[x]" : item.status === "in_progress" ? "[>]" : "[ ]";
      return item.status === "in_progress" && item.activeForm
        ? `${marker} ${item.content} (${item.activeForm})`
        : `${marker} ${item.content}`;
    });
    const completed = this.items.filter((item) => item.status === "completed").length;
    lines.push(`\n(${completed}/${this.items.length} completed)`);
    return lines.join("\n");
  }
}

export function createTodoTool(todoManager: TodoManager): RegisteredTool {
  return {
    spec: {
      name: "todo",
      description: "Rewrite the current session plan for multi-step work.",
      input_schema: {
        type: "object",
        properties: {
          items: {
            type: "array",
            items: {
              type: "object",
              properties: {
                content: { type: "string" },
                status: { type: "string", enum: ["pending", "in_progress", "completed"] },
                activeForm: { type: "string" }
              },
              required: ["content", "status"]
            }
          }
        },
        required: ["items"]
      }
    },
    execute: (input) => {
      const items = Array.isArray(input.items) ? input.items as Array<Record<string, unknown>> : [];
      return todoManager.update(items);
    }
  };
}

type Frontmatter = { meta: Record<string, string>; body: string };

function parseFrontmatter(text: string): Frontmatter {
  const match = /^---\n([\s\S]*?)\n---\n?([\s\S]*)$/u.exec(text);
  if (!match) {
    return { meta: {}, body: text };
  }
  const meta: Record<string, string> = {};
  for (const line of match[1].split("\n")) {
    const separator = line.indexOf(":");
    if (separator === -1) {
      continue;
    }
    meta[line.slice(0, separator).trim()] = line.slice(separator + 1).trim();
  }
  return { meta, body: match[2].trim() };
}

export class SkillRegistry {
  skillsDir: string;
  documents = new Map<string, { name: string; description: string; path: string; body: string }>();

  constructor(skillsDir = path.join(WORKDIR, "skills")) {
    this.skillsDir = skillsDir;
    this.loadAll();
  }

  loadAll(): void {
    this.documents.clear();
    if (!fs.existsSync(this.skillsDir)) {
      return;
    }
    const entries = walkFiles(this.skillsDir).filter((filePath) => filePath.endsWith("SKILL.md"));
    for (const filePath of entries) {
      const parsed = parseFrontmatter(fs.readFileSync(filePath, "utf8"));
      const name = parsed.meta.name || path.basename(path.dirname(filePath));
      const description = parsed.meta.description || "No description";
      this.documents.set(name, {
        name,
        description,
        path: filePath,
        body: parsed.body
      });
    }
  }

  describeAvailable(): string {
    if (this.documents.size === 0) {
      return "(no skills available)";
    }
    return [...this.documents.values()]
      .sort((a, b) => a.name.localeCompare(b.name))
      .map((skill) => `- ${skill.name}: ${skill.description}`)
      .join("\n");
  }

  loadFullText(name: string): string {
    const skill = this.documents.get(name);
    if (!skill) {
      const known = [...this.documents.keys()].sort().join(", ") || "(none)";
      return `Error: Unknown skill '${name}'. Available skills: ${known}`;
    }
    const relPath = path.relative(WORKDIR, skill.path);
    return `<skill name="${skill.name}" path="${relPath}">\n${skill.body}\n</skill>`;
  }
}

function walkFiles(root: string): string[] {
  const results: string[] = [];
  for (const entry of fs.readdirSync(root, { withFileTypes: true })) {
    const fullPath = path.join(root, entry.name);
    if (entry.isDirectory()) {
      results.push(...walkFiles(fullPath));
      continue;
    }
    results.push(fullPath);
  }
  return results;
}

export function createLoadSkillTool(skillRegistry: SkillRegistry): RegisteredTool {
  return {
    spec: {
      name: "load_skill",
      description: "Load the full body of a named skill into the current context.",
      input_schema: {
        type: "object",
        properties: { name: { type: "string" } },
        required: ["name"]
      }
    },
    execute: (input) => skillRegistry.loadFullText(String(input.name || ""))
  };
}

export class CompactManager {
  contextLimit: number;
  persistThreshold: number;
  previewChars: number;
  keepRecentToolResults: number;
  transcriptDir: string;
  toolResultsDir: string;
  recentFiles: string[] = [];

  constructor(options?: {
    contextLimit?: number;
    persistThreshold?: number;
    previewChars?: number;
    keepRecentToolResults?: number;
  }) {
    this.contextLimit = options?.contextLimit ?? 50_000;
    this.persistThreshold = options?.persistThreshold ?? 30_000;
    this.previewChars = options?.previewChars ?? 2_000;
    this.keepRecentToolResults = options?.keepRecentToolResults ?? 3;
    this.transcriptDir = path.join(WORKDIR, ".transcripts");
    this.toolResultsDir = path.join(WORKDIR, ".task_outputs", "tool-results");
  }

  estimateContextSize(messages: AgentMessage[]): number {
    return JSON.stringify(messages).length;
  }

  trackRecentFile(filePath: string): void {
    this.recentFiles = this.recentFiles.filter((item) => item !== filePath);
    this.recentFiles.push(filePath);
    this.recentFiles = this.recentFiles.slice(-5);
  }

  persistLargeOutput(toolUseId: string, output: string): string {
    if (output.length <= this.persistThreshold) {
      return output;
    }
    fs.mkdirSync(this.toolResultsDir, { recursive: true });
    const safeId = toolUseId.replace(/[^a-zA-Z0-9_.-]/gu, "_");
    const filePath = path.join(this.toolResultsDir, `${safeId}.txt`);
    if (!fs.existsSync(filePath)) {
      fs.writeFileSync(filePath, output, "utf8");
    }
    const preview = output.slice(0, this.previewChars);
    return [
      "<persisted-output>",
      `Full output saved to: ${path.relative(WORKDIR, filePath)}`,
      "Preview:",
      preview,
      "</persisted-output>"
    ].join("\n");
  }

  microCompact(messages: AgentMessage[]): void {
    const toolBlocks: Array<ToolResultBlock> = [];
    for (const message of messages) {
      if (message.role !== "user" || !Array.isArray(message.content)) {
        continue;
      }
      for (const block of message.content) {
        if (typeof block === "object" && block !== null && block.type === "tool_result") {
          toolBlocks.push(block as ToolResultBlock);
        }
      }
    }
    for (const block of toolBlocks.slice(0, -this.keepRecentToolResults)) {
      if (block.content.length > 120) {
        block.content = "[Earlier tool result compacted. Re-run the tool if you need full detail.]";
      }
    }
  }

  async writeTranscript(messages: AgentMessage[]): Promise<string> {
    await fsp.mkdir(this.transcriptDir, { recursive: true });
    const filePath = path.join(this.transcriptDir, `transcript_${Date.now()}.jsonl`);
    const lines = messages.map((message) => JSON.stringify(message)).join("\n");
    await fsp.writeFile(filePath, `${lines}\n`, "utf8");
    return filePath;
  }

  async compactHistory(messages: AgentMessage[], focus?: string): Promise<AgentMessage[]> {
    await this.writeTranscript(messages);
    const lastUserGoal = [...messages].reverse().find((message) => message.role === "user");
    const summaryLines = [
      "This conversation was compacted so the agent can continue working.",
      "",
      "Current goal:",
      extractText(lastUserGoal?.content || ""),
      "",
      "What happened recently:",
      ...messages.slice(-6).map((message) => `- ${message.role}: ${extractText(message.content).slice(0, 160)}`)
    ];
    if (this.recentFiles.length > 0) {
      summaryLines.push("", "Recent files to reopen:", ...this.recentFiles.map((item) => `- ${item}`));
    }
    if (focus) {
      summaryLines.push("", `Focus to preserve: ${focus}`);
    }
    return [{ role: "user", content: summaryLines.join("\n") }];
  }
}

export type PermissionBehavior = "allow" | "deny" | "ask";

export class PermissionManager {
  mode: "default" | "plan" | "auto";
  rules: Array<{ tool: string; behavior: PermissionBehavior; path?: string; content?: string }> = [
    { tool: "bash", content: "rm -rf /", behavior: "deny" },
    { tool: "bash", content: "sudo ", behavior: "deny" },
    { tool: "read_file", path: "*", behavior: "allow" }
  ];
  consecutiveDenials = 0;

  constructor(mode: "default" | "plan" | "auto" = "default") {
    this.mode = mode;
  }

  check(toolName: string, toolInput: ToolInput): { behavior: PermissionBehavior; reason: string } {
    if (toolName === "bash") {
      const command = String(toolInput.command || "");
      if (/(^|\s)sudo(\s|$)/u.test(command) || /\brm\s+-[a-zA-Z]*r/u.test(command)) {
        return { behavior: "deny", reason: "Bash validator flagged a high-risk command" };
      }
      if (/[;&|`]/u.test(command) || /\$\(/u.test(command)) {
        return { behavior: "ask", reason: "Bash validator flagged shell metacharacters" };
      }
    }

    for (const rule of this.rules.filter((rule) => rule.behavior === "deny")) {
      if (this.matches(rule, toolName, toolInput)) {
        return { behavior: "deny", reason: `Blocked by deny rule for ${toolName}` };
      }
    }

    if (this.mode === "plan") {
      return ["read_file"].includes(toolName)
        ? { behavior: "allow", reason: "Plan mode allows read-only tools" }
        : { behavior: "deny", reason: "Plan mode blocks state changes" };
    }

    if (this.mode === "auto" && ["read_file"].includes(toolName)) {
      return { behavior: "allow", reason: "Auto mode allows read-only tools" };
    }

    for (const rule of this.rules.filter((rule) => rule.behavior === "allow")) {
      if (this.matches(rule, toolName, toolInput)) {
        return { behavior: "allow", reason: `Matched allow rule for ${toolName}` };
      }
    }
    return { behavior: "ask", reason: `No rule matched for ${toolName}` };
  }

  askUser(toolName: string, toolInput: ToolInput): boolean {
    const preview = JSON.stringify(toolInput).slice(0, 200);
    const result = spawnSync("/bin/zsh", ["-lc", 'printf "\\n[Permission] %s: %s\\nAllow? (y/n): " "$TOOL_NAME" "$TOOL_PREVIEW"; read answer; [[ "$answer" == "y" || "$answer" == "yes" ]]'], {
      env: {
        ...process.env,
        TOOL_NAME: toolName,
        TOOL_PREVIEW: preview
      },
      stdio: "inherit"
    });
    return result.status === 0;
  }

  private matches(rule: { tool: string; path?: string; content?: string }, toolName: string, toolInput: ToolInput): boolean {
    if (rule.tool !== "*" && rule.tool !== toolName) {
      return false;
    }
    if (rule.path && rule.path !== "*") {
      return String(toolInput.path || "").includes(rule.path.replace("*", ""));
    }
    if (rule.content) {
      return String(toolInput.command || "").includes(rule.content.replace("*", ""));
    }
    return true;
  }
}

export class HookManager {
  hooks: Record<"PreToolUse" | "PostToolUse" | "SessionStart", Array<{ command: string; matcher?: string }>> = {
    PreToolUse: [],
    PostToolUse: [],
    SessionStart: []
  };

  constructor(configPath = path.join(WORKDIR, ".hooks.json")) {
    if (!fs.existsSync(configPath)) {
      return;
    }
    try {
      const parsed = JSON.parse(fs.readFileSync(configPath, "utf8")) as {
        hooks?: Partial<Record<"PreToolUse" | "PostToolUse" | "SessionStart", Array<{ command: string; matcher?: string }>>>;
      };
      this.hooks = {
        PreToolUse: parsed.hooks?.PreToolUse || [],
        PostToolUse: parsed.hooks?.PostToolUse || [],
        SessionStart: parsed.hooks?.SessionStart || []
      };
    } catch (error) {
      console.error(`[Hook config error] ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  runHooks(
    event: "PreToolUse" | "PostToolUse" | "SessionStart",
    context?: Record<string, unknown>
  ): { blocked: boolean; blockReason?: string; messages: string[] } {
    const result = { blocked: false, blockReason: undefined as string | undefined, messages: [] as string[] };
    const trustMarker = path.join(WORKDIR, ".claude", ".claude_trusted");
    if (!fs.existsSync(trustMarker)) {
      return result;
    }
    for (const hook of this.hooks[event]) {
      if (hook.matcher && context?.tool_name && hook.matcher !== "*" && hook.matcher !== context.tool_name) {
        continue;
      }
      const env = {
        ...process.env,
        HOOK_EVENT: event,
        HOOK_TOOL_NAME: String(context?.tool_name || ""),
        HOOK_TOOL_INPUT: JSON.stringify(context?.tool_input || {}),
        HOOK_TOOL_OUTPUT: String(context?.tool_output || "")
      };
      const executed = spawnSync("/bin/zsh", ["-lc", hook.command], {
        cwd: WORKDIR,
        env,
        encoding: "utf8",
        timeout: 30_000
      });
      if (executed.status === 1) {
        result.blocked = true;
        result.blockReason = executed.stderr?.trim() || "Blocked by hook";
      }
      if (executed.status === 2 && executed.stderr?.trim()) {
        result.messages.push(executed.stderr.trim());
      }
    }
    return result;
  }
}

export const MEMORY_TYPES = ["user", "feedback", "project", "reference"] as const;
export type MemoryType = (typeof MEMORY_TYPES)[number];

export class MemoryManager {
  memoryDir: string;
  memories = new Map<string, { description: string; type: MemoryType; content: string; file: string }>();

  constructor(memoryDir = path.join(WORKDIR, ".memory")) {
    this.memoryDir = memoryDir;
  }

  loadAll(): void {
    this.memories.clear();
    if (!fs.existsSync(this.memoryDir)) {
      return;
    }
    for (const fileName of fs.readdirSync(this.memoryDir)) {
      if (!fileName.endsWith(".md") || fileName === "MEMORY.md") {
        continue;
      }
      const parsed = parseFrontmatter(fs.readFileSync(path.join(this.memoryDir, fileName), "utf8"));
      const name = parsed.meta.name || fileName.replace(/\.md$/u, "");
      const type = (parsed.meta.type as MemoryType) || "project";
      this.memories.set(name, {
        description: parsed.meta.description || "",
        type,
        content: parsed.body,
        file: fileName
      });
    }
  }

  loadMemoryPrompt(): string {
    if (this.memories.size === 0) {
      return "";
    }
    const lines = ["# Memories (persistent across sessions)", ""];
    for (const memoryType of MEMORY_TYPES) {
      const entries = [...this.memories.entries()].filter(([, value]) => value.type === memoryType);
      if (entries.length === 0) {
        continue;
      }
      lines.push(`## [${memoryType}]`);
      for (const [name, value] of entries) {
        lines.push(`### ${name}: ${value.description}`);
        if (value.content.trim()) {
          lines.push(value.content.trim());
        }
        lines.push("");
      }
    }
    return lines.join("\n");
  }

  saveMemory(name: string, description: string, memoryType: MemoryType, content: string): string {
    if (!MEMORY_TYPES.includes(memoryType)) {
      return `Error: type must be one of ${MEMORY_TYPES.join(", ")}`;
    }
    const safeName = name.toLowerCase().replace(/[^a-z0-9_-]/gu, "_") || "memory";
    fs.mkdirSync(this.memoryDir, { recursive: true });
    const fileName = `${safeName}.md`;
    const filePath = path.join(this.memoryDir, fileName);
    fs.writeFileSync(
      filePath,
      `---\nname: ${name}\ndescription: ${description}\ntype: ${memoryType}\n---\n${content}\n`,
      "utf8"
    );
    this.memories.set(name, { description, type: memoryType, content, file: fileName });
    this.rebuildIndex();
    return `Saved memory '${name}' [${memoryType}] to ${path.relative(WORKDIR, filePath)}`;
  }

  rebuildIndex(): void {
    fs.mkdirSync(this.memoryDir, { recursive: true });
    const lines = ["# Memory Index", ""];
    for (const [name, value] of this.memories.entries()) {
      lines.push(`- ${name}: ${value.description} [${value.type}]`);
    }
    fs.writeFileSync(path.join(this.memoryDir, "MEMORY.md"), `${lines.join("\n")}\n`, "utf8");
  }
}

export function createSaveMemoryTool(memoryManager: MemoryManager): RegisteredTool {
  return {
    spec: {
      name: "save_memory",
      description: "Save durable cross-session information to the memory store.",
      input_schema: {
        type: "object",
        properties: {
          name: { type: "string" },
          description: { type: "string" },
          type: { type: "string", enum: [...MEMORY_TYPES] },
          content: { type: "string" }
        },
        required: ["name", "description", "type", "content"]
      }
    },
    execute: (input) =>
      memoryManager.saveMemory(
        String(input.name || ""),
        String(input.description || ""),
        (String(input.type || "project") as MemoryType),
        String(input.content || "")
      )
  };
}

export type TaskRecord = {
  id: string;
  title: string;
  status: "pending" | "in_progress" | "completed";
  owner?: string;
  notes?: string;
  createdAt: string;
  updatedAt: string;
};

export class TaskManager {
  taskFile: string;
  tasks: TaskRecord[] = [];

  constructor(taskFile = path.join(WORKDIR, ".tasks", "tasks.json")) {
    this.taskFile = taskFile;
    this.load();
  }

  load(): void {
    if (!fs.existsSync(this.taskFile)) {
      this.tasks = [];
      return;
    }
    this.tasks = JSON.parse(fs.readFileSync(this.taskFile, "utf8")) as TaskRecord[];
  }

  save(): void {
    fs.mkdirSync(path.dirname(this.taskFile), { recursive: true });
    fs.writeFileSync(this.taskFile, JSON.stringify(this.tasks, null, 2), "utf8");
  }

  createTask(title: string, notes = ""): string {
    const task: TaskRecord = {
      id: cryptoRandomId(),
      title,
      status: "pending",
      notes,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };
    this.tasks.push(task);
    this.save();
    return `Created task ${task.id}: ${task.title}`;
  }

  listTasks(): string {
    if (this.tasks.length === 0) {
      return "No tasks.";
    }
    return this.tasks
      .map((task) => `${task.id}: [${task.status}] ${task.title}${task.owner ? ` @${task.owner}` : ""}`)
      .join("\n");
  }

  updateTask(id: string, fields: Partial<Pick<TaskRecord, "status" | "owner" | "notes" | "title">>): string {
    const task = this.tasks.find((item) => item.id === id);
    if (!task) {
      return `Error: Unknown task ${id}`;
    }
    Object.assign(task, fields);
    task.updatedAt = new Date().toISOString();
    this.save();
    return `Updated task ${id}`;
  }

  claimUnclaimed(agentName: string): string {
    const task = this.tasks.find((item) => !item.owner && item.status !== "completed");
    if (!task) {
      return "No unclaimed tasks.";
    }
    task.owner = agentName;
    task.status = "in_progress";
    task.updatedAt = new Date().toISOString();
    this.save();
    return `Claimed task ${task.id} for ${agentName}`;
  }

  scanUnclaimedTasks(): TaskRecord[] {
    return this.tasks.filter((task) => !task.owner && task.status !== "completed");
  }
}

export function createTaskBoardTools(taskManager: TaskManager): RegisteredTool[] {
  return [
    {
      spec: {
        name: "create_task_record",
        description: "Create a durable task-board item.",
        input_schema: {
          type: "object",
          properties: {
            title: { type: "string" },
            notes: { type: "string" }
          },
          required: ["title"]
        }
      },
      execute: (input) => taskManager.createTask(String(input.title || ""), String(input.notes || ""))
    },
    {
      spec: {
        name: "list_task_records",
        description: "List durable task-board items.",
        input_schema: { type: "object", properties: {} }
      },
      execute: () => taskManager.listTasks()
    },
    {
      spec: {
        name: "update_task_record",
        description: "Update a task-board item.",
        input_schema: {
          type: "object",
          properties: {
            id: { type: "string" },
            status: { type: "string", enum: ["pending", "in_progress", "completed"] },
            owner: { type: "string" },
            notes: { type: "string" },
            title: { type: "string" }
          },
          required: ["id"]
        }
      },
      execute: (input) =>
        taskManager.updateTask(String(input.id || ""), {
          status: input.status as TaskRecord["status"] | undefined,
          owner: input.owner ? String(input.owner) : undefined,
          notes: input.notes ? String(input.notes) : undefined,
          title: input.title ? String(input.title) : undefined
        })
    },
    {
      spec: {
        name: "claim_unclaimed_task",
        description: "Claim the next unclaimed task for an agent.",
        input_schema: {
          type: "object",
          properties: { agent_name: { type: "string" } },
          required: ["agent_name"]
        }
      },
      execute: (input) => taskManager.claimUnclaimed(String(input.agent_name || "agent"))
    }
  ];
}

export class BackgroundManager {
  dir: string;
  tasks: Record<string, { status: string; command: string; result: string | null; startedAt: number; outputFile: string; resultPreview: string }> = {};
  notifications: Array<{ taskId: string; status: string; preview: string; outputFile: string }> = [];

  constructor(dir = path.join(WORKDIR, ".runtime-tasks")) {
    this.dir = dir;
    fs.mkdirSync(this.dir, { recursive: true });
  }

  run(command: string): string {
    const taskId = cryptoRandomId();
    const outputFile = path.join(this.dir, `${taskId}.log`);
    this.tasks[taskId] = {
      status: "running",
      command,
      result: null,
      startedAt: Date.now(),
      outputFile,
      resultPreview: ""
    };
    const child = spawn("/bin/zsh", ["-lc", command], {
      cwd: WORKDIR,
      stdio: ["ignore", "pipe", "pipe"]
    });
    let stdout = "";
    let stderr = "";
    child.stdout.on("data", (chunk) => {
      stdout += String(chunk);
    });
    child.stderr.on("data", (chunk) => {
      stderr += String(chunk);
    });
    child.on("close", (code) => {
      const result = `${stdout}${stderr}`.trim() || "(no output)";
      fs.writeFileSync(outputFile, result, "utf8");
      const preview = result.replace(/\s+/gu, " ").slice(0, 500);
      this.tasks[taskId] = {
        ...this.tasks[taskId],
        status: code === 0 ? "completed" : "error",
        result,
        resultPreview: preview
      };
      this.notifications.push({
        taskId,
        status: this.tasks[taskId].status,
        preview,
        outputFile: path.relative(WORKDIR, outputFile)
      });
    });
    return `Background task ${taskId} started: ${command} (output_file=${path.relative(WORKDIR, outputFile)})`;
  }

  check(taskId?: string): string {
    if (taskId) {
      const task = this.tasks[taskId];
      if (!task) {
        return `Error: Unknown task ${taskId}`;
      }
      if (task.status === "running" && !task.result) {
        return "[running] (running)";
      }
      return JSON.stringify({
        id: taskId,
        status: task.status,
        command: task.command,
        result_preview: task.resultPreview,
        output_file: path.relative(WORKDIR, task.outputFile)
      }, null, 2);
    }
    const entries = Object.entries(this.tasks);
    if (entries.length === 0) {
      return "No background tasks.";
    }
    return entries
      .map(([id, task]) => `${id}: [${task.status}] ${task.command} -> ${task.resultPreview || "(running)"}`)
      .join("\n");
  }

  drainNotifications(): Array<{ taskId: string; status: string; preview: string; outputFile: string }> {
    const drained = [...this.notifications];
    this.notifications = [];
    return drained;
  }
}

export function createBackgroundTools(backgroundManager: BackgroundManager): RegisteredTool[] {
  return [
    {
      spec: {
        name: "background_run",
        description: "Run a slow shell command in the background.",
        input_schema: {
          type: "object",
          properties: { command: { type: "string" } },
          required: ["command"]
        }
      },
      execute: (input) => backgroundManager.run(String(input.command || ""))
    },
    {
      spec: {
        name: "check_background",
        description: "Check one background task or list all of them.",
        input_schema: {
          type: "object",
          properties: { task_id: { type: "string" } }
        }
      },
      execute: (input) => backgroundManager.check(input.task_id ? String(input.task_id) : undefined)
    }
  ];
}

export class CronScheduler {
  scheduleFile: string;
  jobs: Array<{ id: string; name: string; everyMinutes: number; taskTitle: string; lastRunAt: number | null }> = [];

  constructor(scheduleFile = path.join(WORKDIR, ".tasks", "cron.json")) {
    this.scheduleFile = scheduleFile;
    this.load();
  }

  load(): void {
    if (!fs.existsSync(this.scheduleFile)) {
      this.jobs = [];
      return;
    }
    this.jobs = JSON.parse(fs.readFileSync(this.scheduleFile, "utf8")) as typeof this.jobs;
  }

  save(): void {
    fs.mkdirSync(path.dirname(this.scheduleFile), { recursive: true });
    fs.writeFileSync(this.scheduleFile, JSON.stringify(this.jobs, null, 2), "utf8");
  }

  schedule(name: string, everyMinutes: number, taskTitle: string): string {
    const job = { id: cryptoRandomId(), name, everyMinutes, taskTitle, lastRunAt: null };
    this.jobs.push(job);
    this.save();
    return `Scheduled ${name} every ${everyMinutes} minutes`;
  }

  list(): string {
    if (this.jobs.length === 0) {
      return "No scheduled jobs.";
    }
    return this.jobs
      .map((job) => `${job.id}: ${job.name} every ${job.everyMinutes}m -> ${job.taskTitle}`)
      .join("\n");
  }

  runDue(taskManager: TaskManager): string {
    const now = Date.now();
    const dueJobs = this.jobs.filter((job) => job.lastRunAt === null || now - job.lastRunAt >= job.everyMinutes * 60_000);
    if (dueJobs.length === 0) {
      return "No jobs are due.";
    }
    for (const job of dueJobs) {
      taskManager.createTask(job.taskTitle, `Scheduled by ${job.name}`);
      job.lastRunAt = now;
    }
    this.save();
    return `Ran ${dueJobs.length} scheduled job(s).`;
  }
}

export function createCronTools(cronScheduler: CronScheduler, taskManager: TaskManager): RegisteredTool[] {
  return [
    {
      spec: {
        name: "schedule_task",
        description: "Schedule a recurring task-board item.",
        input_schema: {
          type: "object",
          properties: {
            name: { type: "string" },
            every_minutes: { type: "integer" },
            task_title: { type: "string" }
          },
          required: ["name", "every_minutes", "task_title"]
        }
      },
      execute: (input) =>
        cronScheduler.schedule(
          String(input.name || ""),
          Number(input.every_minutes || 60),
          String(input.task_title || "")
        )
    },
    {
      spec: {
        name: "list_schedules",
        description: "List recurring schedules.",
        input_schema: { type: "object", properties: {} }
      },
      execute: () => cronScheduler.list()
    },
    {
      spec: {
        name: "run_due_schedules",
        description: "Materialize all due scheduled tasks into the task board.",
        input_schema: { type: "object", properties: {} }
      },
      execute: () => cronScheduler.runDue(taskManager)
    }
  ];
}

export class MessageBus {
  inboxDir: string;

  constructor(inboxDir = path.join(WORKDIR, ".team", "inbox")) {
    this.inboxDir = inboxDir;
    fs.mkdirSync(this.inboxDir, { recursive: true });
  }

  send(recipient: string, payload: Record<string, unknown>): string {
    const id = cryptoRandomId();
    const filePath = path.join(this.inboxDir, `${recipient}-${id}.json`);
    fs.writeFileSync(filePath, JSON.stringify({ id, recipient, ...payload }, null, 2), "utf8");
    return `Sent message ${id} to ${recipient}`;
  }

  read(recipient?: string): string {
    const files = fs.readdirSync(this.inboxDir).filter((fileName) => fileName.endsWith(".json"));
    const relevant = recipient ? files.filter((fileName) => fileName.startsWith(`${recipient}-`)) : files;
    if (relevant.length === 0) {
      return "Inbox is empty.";
    }
    return relevant
      .map((fileName) => {
        const payload = JSON.parse(fs.readFileSync(path.join(this.inboxDir, fileName), "utf8")) as Record<string, unknown>;
        return `${payload.id}: ${payload.type || "message"} -> ${payload.subject || "(no subject)"}`;
      })
      .join("\n");
  }
}

export class TeammateManager {
  teammateFile: string;
  teammates: Array<{ name: string; role: string }> = [];

  constructor(teammateFile = path.join(WORKDIR, ".team", "teammates.json")) {
    this.teammateFile = teammateFile;
    this.load();
  }

  load(): void {
    if (!fs.existsSync(this.teammateFile)) {
      this.teammates = [];
      return;
    }
    this.teammates = JSON.parse(fs.readFileSync(this.teammateFile, "utf8")) as Array<{ name: string; role: string }>;
  }

  save(): void {
    fs.mkdirSync(path.dirname(this.teammateFile), { recursive: true });
    fs.writeFileSync(this.teammateFile, JSON.stringify(this.teammates, null, 2), "utf8");
  }

  register(name: string, role: string): string {
    this.teammates = this.teammates.filter((teammate) => teammate.name !== name);
    this.teammates.push({ name, role });
    this.save();
    return `Registered teammate ${name} (${role})`;
  }

  list(): string {
    if (this.teammates.length === 0) {
      return "No teammates registered.";
    }
    return this.teammates.map((teammate) => `- ${teammate.name}: ${teammate.role}`).join("\n");
  }
}

export function createTeamTools(messageBus: MessageBus, teammateManager: TeammateManager): RegisteredTool[] {
  return [
    {
      spec: {
        name: "register_teammate",
        description: "Register or update a teammate profile.",
        input_schema: {
          type: "object",
          properties: {
            name: { type: "string" },
            role: { type: "string" }
          },
          required: ["name", "role"]
        }
      },
      execute: (input) => teammateManager.register(String(input.name || ""), String(input.role || ""))
    },
    {
      spec: {
        name: "list_teammates",
        description: "List registered teammates.",
        input_schema: { type: "object", properties: {} }
      },
      execute: () => teammateManager.list()
    },
    {
      spec: {
        name: "send_team_message",
        description: "Send a message into the shared team inbox.",
        input_schema: {
          type: "object",
          properties: {
            recipient: { type: "string" },
            type: { type: "string" },
            subject: { type: "string" },
            body: { type: "string" }
          },
          required: ["recipient", "type", "subject", "body"]
        }
      },
      execute: (input) =>
        messageBus.send(String(input.recipient || ""), {
          type: String(input.type || "message"),
          subject: String(input.subject || ""),
          body: String(input.body || "")
        })
    },
    {
      spec: {
        name: "read_team_inbox",
        description: "Read inbox messages for one teammate or for everyone.",
        input_schema: {
          type: "object",
          properties: { recipient: { type: "string" } }
        }
      },
      execute: (input) => messageBus.read(input.recipient ? String(input.recipient) : undefined)
    }
  ];
}

export function createProtocolTools(messageBus: MessageBus): RegisteredTool[] {
  return [
    {
      spec: {
        name: "request_plan_approval",
        description: "Send a structured plan approval request to another teammate.",
        input_schema: {
          type: "object",
          properties: {
            recipient: { type: "string" },
            subject: { type: "string" },
            plan: { type: "string" }
          },
          required: ["recipient", "subject", "plan"]
        }
      },
      execute: (input) =>
        messageBus.send(String(input.recipient || ""), {
          type: "plan_approval_request",
          subject: String(input.subject || ""),
          body: String(input.plan || "")
        })
    },
    {
      spec: {
        name: "respond_to_request",
        description: "Respond to a structured request in the team inbox.",
        input_schema: {
          type: "object",
          properties: {
            recipient: { type: "string" },
            approved: { type: "boolean" },
            response: { type: "string" }
          },
          required: ["recipient", "approved", "response"]
        }
      },
      execute: (input) =>
        messageBus.send(String(input.recipient || ""), {
          type: "plan_approval_response",
          approved: Boolean(input.approved),
          body: String(input.response || "")
        })
    }
  ];
}

export class WorktreeManager {
  rootDir: string;

  constructor(rootDir = path.join(WORKDIR, ".worktrees")) {
    this.rootDir = rootDir;
    fs.mkdirSync(this.rootDir, { recursive: true });
  }

  createLane(name: string): string {
    const lanePath = path.join(this.rootDir, name);
    fs.mkdirSync(lanePath, { recursive: true });
    return `Created isolated lane at ${path.relative(WORKDIR, lanePath)}`;
  }

  listLanes(): string {
    const lanes = fs.readdirSync(this.rootDir, { withFileTypes: true })
      .filter((entry) => entry.isDirectory())
      .map((entry) => entry.name);
    return lanes.length > 0 ? lanes.map((lane) => `- ${lane}`).join("\n") : "No isolated lanes.";
  }

  runInLane(name: string, command: string): string {
    const lanePath = path.join(this.rootDir, name);
    if (!fs.existsSync(lanePath)) {
      return `Error: Unknown lane ${name}`;
    }
    return runBash(command, lanePath);
  }
}

export function createWorktreeTools(worktreeManager: WorktreeManager): RegisteredTool[] {
  return [
    {
      spec: {
        name: "create_lane",
        description: "Create an isolated execution lane for a task.",
        input_schema: {
          type: "object",
          properties: { name: { type: "string" } },
          required: ["name"]
        }
      },
      execute: (input) => worktreeManager.createLane(String(input.name || "lane"))
    },
    {
      spec: {
        name: "list_lanes",
        description: "List isolated execution lanes.",
        input_schema: { type: "object", properties: {} }
      },
      execute: () => worktreeManager.listLanes()
    },
    {
      spec: {
        name: "run_in_lane",
        description: "Run a shell command inside an isolated lane.",
        input_schema: {
          type: "object",
          properties: {
            name: { type: "string" },
            command: { type: "string" }
          },
          required: ["name", "command"]
        }
      },
      execute: (input) => worktreeManager.runInLane(String(input.name || ""), String(input.command || ""))
    }
  ];
}

type PluginManifest = {
  name: string;
  command: string;
  args?: string[];
  description?: string;
};

export class MCPClient {
  manifest: PluginManifest;
  process: ReturnType<typeof spawn> | null = null;
  requestId = 0;

  constructor(manifest: PluginManifest) {
    this.manifest = manifest;
  }

  connect(): string {
    if (this.process) {
      return `Already connected to ${this.manifest.name}`;
    }
    this.process = spawn(this.manifest.command, this.manifest.args || [], {
      cwd: WORKDIR,
      stdio: ["pipe", "pipe", "pipe"]
    });
    return `Started MCP server ${this.manifest.name}`;
  }
}

export class PluginLoader {
  pluginDir: string;
  manifests = new Map<string, PluginManifest>();

  constructor(pluginDir = path.join(WORKDIR, ".plugins")) {
    this.pluginDir = pluginDir;
    this.load();
  }

  load(): void {
    this.manifests.clear();
    if (!fs.existsSync(this.pluginDir)) {
      return;
    }
    for (const fileName of fs.readdirSync(this.pluginDir)) {
      if (!fileName.endsWith(".json")) {
        continue;
      }
      const parsed = JSON.parse(fs.readFileSync(path.join(this.pluginDir, fileName), "utf8")) as PluginManifest;
      this.manifests.set(parsed.name, parsed);
    }
  }

  list(): string {
    if (this.manifests.size === 0) {
      return "No plugins configured.";
    }
    return [...this.manifests.values()]
      .map((manifest) => `- ${manifest.name}: ${manifest.description || manifest.command}`)
      .join("\n");
  }

  describe(name: string): string {
    const manifest = this.manifests.get(name);
    if (!manifest) {
      return `Error: Unknown plugin ${name}`;
    }
    return JSON.stringify(manifest, null, 2);
  }
}

export function createPluginTools(pluginLoader: PluginLoader): RegisteredTool[] {
  return [
    {
      spec: {
        name: "list_plugins",
        description: "List available plugin manifests.",
        input_schema: { type: "object", properties: {} }
      },
      execute: () => pluginLoader.list()
    },
    {
      spec: {
        name: "describe_plugin",
        description: "Read one plugin manifest.",
        input_schema: {
          type: "object",
          properties: { name: { type: "string" } },
          required: ["name"]
        }
      },
      execute: (input) => pluginLoader.describe(String(input.name || ""))
    }
  ];
}

export function buildPromptSections(sections: Array<{ title: string; body: string }>): string {
  return sections
    .filter((section) => section.body.trim())
    .map((section) => `## ${section.title}\n${section.body.trim()}`)
    .join("\n\n");
}

export function createTaskTool(runSubagent: (prompt: string) => Promise<string>): RegisteredTool {
  return {
    spec: {
      name: "task",
      description: "Spawn a subagent with fresh context that returns only a summary.",
      input_schema: {
        type: "object",
        properties: {
          prompt: { type: "string" },
          description: { type: "string" }
        },
        required: ["prompt"]
      }
    },
    execute: async (input) => runSubagent(String(input.prompt || ""))
  };
}

export function createSubagentRunner(options: {
  systemPrompt: string;
  tools: RegisteredTool[];
  normalizeMessages?: boolean;
  maxTurns?: number;
}): (prompt: string) => Promise<string> {
  return async (prompt: string) => {
    const subContext = createLoopContext();
    subContext.messages.push({ role: "user", content: prompt });
    await runAgentLoop(subContext, {
      systemPrompt: options.systemPrompt,
      tools: options.tools,
      normalizeMessages: options.normalizeMessages ?? true,
      maxTurns: options.maxTurns ?? 20
    });
    const lastAssistant = [...subContext.messages].reverse().find((message) => message.role === "assistant");
    return lastAssistant ? extractText(lastAssistant.content) || "(no summary)" : "(no summary)";
  };
}
