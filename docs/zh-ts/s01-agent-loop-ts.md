# s01 Agent Loop（TS）

## 这一章新增了什么

`s01` 只保留一个工具（`bash`），让你先看懂最小闭环：

`user -> model -> tool_use -> tool_result -> model`

## 关键代码在哪

- 入口：`agents_self_contained/s01_agent_loop.ts`
- 循环主逻辑：`agents_self_contained/_runtime.ts` 中的 `runAgentLoop`
- REPL：`agents_self_contained/_runtime.ts` 中的 `runRepl`
- 基础工具：`createBaseTools`

`s01` 的关键点：

- `const tools = [createBaseTools()[0]]` 只给了第一个工具（`bash`）
- `maxTurns: 20` 显式限制最大轮数，避免失控循环

## 运行时观察什么

运行：

```sh
npm run s01
```

输入一个简单任务（例如让它列目录），观察：

1. assistant 先产出 `tool_use`
2. runtime 执行工具并打印 `> bash`
3. `tool_result` 回到消息流
4. 模型继续推理，直到不再请求工具

## 最小练习

让 agent 执行：

1. `pwd`
2. `ls -la`
3. 用一句话总结目录结构

目标：确认你能在日志里定位闭环的每一步。
