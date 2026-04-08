# s09 Memory System（TS）

## 这一章新增了什么

引入跨会话记忆机制：把“长期有效信息”存到磁盘，并在新一轮系统提示词里回注。

## 关键代码在哪

- 入口：`agents_self_contained/s09_memory_system.ts`
- 记忆核心：`agents_self_contained/_runtime.ts` 的 `MemoryManager`
- 写入工具：`createSaveMemoryTool`

关键流程：

1. 启动前 `memoryManager.loadAll()`
2. 每轮调用前再次 `loadAll()`（拿到最新落盘内容）
3. `loadMemoryPrompt()` 拼进系统提示词

## 运行时观察什么

```sh
npm run s09
```

观察：

1. 模型会在需要时调用 `save_memory`
2. 记忆文件落在 `.memory/`
3. 下一轮 prompt 会包含 Memory 区段

## 最小练习

让 agent 保存两类信息：

1. 用户偏好（例如输出风格）
2. 项目约定（例如目录规范）

目标：区分“短期上下文”与“跨会话记忆”。
