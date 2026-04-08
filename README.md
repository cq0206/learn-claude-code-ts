[English](./README.md)

# Learn Claude Code with TypeScript

这是一个教学仓库，目标不是复刻某个生产系统的全部细节，而是用 TypeScript 把 coding agent 的主干机制讲清楚。

这个版本延续了原始 Python 教学仓库的章节结构，但教学语言统一改成了 `TypeScript + Node.js`。重点仍然是这些真正决定 agent 是否好用的机制：

- agent loop
- tools
- planning
- delegation
- context control
- permissions
- hooks
- memory
- prompt assembly
- tasks
- teams
- isolated execution lanes
- external capability routing

## 教学目标

一句话版：

**模型负责推理，harness 负责给模型一个可工作的环境。**

这个环境主要由几部分组成：

- `Agent Loop`：调用模型，执行工具，把结果喂回模型，再继续
- `Tools`：模型的手和脚
- `Planning`：让多步任务别漂掉
- `Context Management`：保持上下文小而清晰
- `Permissions`：不要把模型意图直接变成危险执行
- `Hooks`：在不重写 loop 的前提下扩展行为
- `Memory`：只保存跨会话仍然值得记住的事实
- `Prompt Construction`：把稳定规则和运行时状态拼成系统提示词
- `Tasks / Teams / Worktree / Plugin`：把单 agent 内核扩展成更大的工作平台

## 仓库结构

```txt
agents/
  _runtime.ts
  s01_agent_loop.ts
  s02_tool_use.ts
  ...
  s19_mcp_plugin.ts
  s_full.ts
skills/
  example/SKILL.md
```

`agents/_runtime.ts` 是共享教学 runtime，章节文件只负责组合机制。

## 快速开始

```sh
npm install
cp .env.example .env
```

在 `.env` 中配置：

- `ANTHROPIC_API_KEY`
- `MODEL_ID`
- 可选 `ANTHROPIC_BASE_URL`

然后运行：

```sh
npm run s01
npm run s04
npm run s09
npm run full
```

## 推荐阅读顺序

按章节从前往后读：

1. `s01-s06`：搭出一个好用的单 agent 内核
2. `s07-s11`：补上安全、扩展点、记忆、提示词装配和恢复能力
3. `s12-s14`：把会话内工作变成可持续运行的任务系统
4. `s15-s19`：进入团队协作、自治、隔离执行和外部能力接入

## 章节对照

| Chapter | Topic |
|---|---|
| `s01` | Agent Loop |
| `s02` | Tool Use |
| `s03` | Todo / Planning |
| `s04` | Subagent |
| `s05` | Skill Loading |
| `s06` | Context Compact |
| `s07` | Permission System |
| `s08` | Hook System |
| `s09` | Memory System |
| `s10` | System Prompt |
| `s11` | Error Recovery |
| `s12` | Task System |
| `s13` | Background Tasks |
| `s14` | Cron Scheduler |
| `s15` | Agent Teams |
| `s16` | Team Protocols |
| `s17` | Autonomous Agents |
| `s18` | Worktree Task Isolation |
| `s19` | MCP & Plugin |

## 和 Python 版的关系

- 教学顺序保持一致
- 核心机制保持一致
- 示例代码改为 `TypeScript`
- 运行方式改为 `Node.js + tsx`
- 公共逻辑抽到了 `agents/_runtime.ts`，避免把同一套实现复制 19 次

如果你是从 Python 版迁移过来的，可以把这个仓库理解成：

**同一套教学路线，换成更适合前后端同学共读的 TS 实现。**
