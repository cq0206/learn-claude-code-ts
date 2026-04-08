# Next Step (TypeScript Track)

目标：按递进路线把 `s01 -> s19` 真正跑通，而不是只看代码。

## Step 1: Core Loop (今天先完成)

1. 运行 `npm run s01`
2. 在 REPL 里输入一个简单任务（例如“创建并读取一个文件”）
3. 观察最小闭环：`user -> tool_use -> tool_result -> assistant`

完成标准：
- 你能清楚指出“循环继续”的触发点是什么。

## Step 2: Tools + Planning (同一天)

1. 运行 `npm run s02`
2. 让 agent 执行一次 `read_file / write_file / edit_file`
3. 运行 `npm run s03`
4. 给一个多步骤任务，观察 `todo` 如何保持一个 `in_progress`

完成标准：
- 你能解释：为什么“加工具”不需要重写主 loop。

## Step 3: Context Control (明天)

1. 运行 `npm run s04`（看 subagent 的隔离上下文）
2. 运行 `npm run s05`（看 skill 按需加载）
3. 运行 `npm run s06`（看 compact 触发）

完成标准：
- 你能解释：`subagent`、`skill`、`compact` 各自解决哪种上下文问题。

## Step 4: Hardening (后天)

1. 运行 `npm run s07`（权限）
2. 运行 `npm run s08`（hooks）
3. 运行 `npm run s09`（memory）
4. 运行 `npm run s10`（prompt assembly）
5. 运行 `npm run s11`（error recovery）

完成标准：
- 你能说出：为什么顺序是 gate -> extend -> remember -> assemble -> recover。

## Step 5: Runtime + Platform (最后两天)

1. 运行 `npm run s12`、`npm run s13`、`npm run s14`
2. 运行 `npm run s15` 到 `npm run s19`
3. 最后运行 `npm run full`

完成标准：
- 你能区分三组最容易混的概念：
  - task vs runtime task
  - teammate vs subagent
  - task vs worktree

## 每次学习都做这 3 件事

1. 跑命令前：先预测这一章会新增什么机制
2. 跑完后：写 3 句总结（新增了什么、状态存哪、loop 哪里变了）
3. 对照源码：只看 `agents_self_contained/sXX_*.ts` 和 `agents_self_contained/_runtime.ts` 的相关函数
