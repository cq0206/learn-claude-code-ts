# s12 Task System（TS）

## 这一章新增了什么

把会话内 todo 升级为“可持久化任务板”。

核心变化：

- 任务落盘到 `.tasks/tasks.json`
- 任务有结构化字段（`id/status/owner/title/notes`）
- 支持跨轮次继续推进

## 关键代码在哪

- 入口：`agents_self_contained/s12_task_system.ts`
- 任务核心：`agents_self_contained/_runtime.ts` 的 `TaskManager`
- 任务工具：`createTaskBoardTools`

常用工具：

- `create_task_record`
- `list_task_records`
- `update_task_record`
- `claim_unclaimed_task`

## 运行时观察什么

```sh
npm run s12
```

观察：

1. 创建任务后，数据会写入 `.tasks/tasks.json`
2. 任务状态能从 `pending -> in_progress -> completed`
3. `owner` 字段可表达任务归属

## 最小练习

让 agent：

1. 创建 3 条任务
2. 认领 1 条并推进到 `in_progress`
3. 完成后更新为 `completed`

目标：确认任务板是“持久状态”，不是临时对话文本。
