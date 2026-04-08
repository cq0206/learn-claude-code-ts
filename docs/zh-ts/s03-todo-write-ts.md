# s03 Todo / Planning（TS）

## 这一章新增了什么

增加 `todo` 工具，让多步骤任务在会话内显式维护计划状态。

核心约束：

- 最多 12 项
- 同一时刻只允许 1 个 `in_progress`

## 关键代码在哪

- 入口：`agents_self_contained/s03_todo_write.ts`
- 状态管理：`TodoManager`
- 工具封装：`createTodoTool`

`s03` 特别逻辑：

- `afterToolResults` 中会调用 `todoManager.noteRoundWithoutUpdate()`
- 如果多轮不更新计划，会自动注入 reminder 提示模型刷新 todo

## 运行时观察什么

```sh
npm run s03
```

给一个明显多步骤任务，观察：

1. 是否主动创建 todo 列表
2. `in_progress` 是否在推进中更新
3. 完成后是否出现 `(x/y completed)`

## 最小练习

任务示例：

1. 创建一个 `src` 目录
2. 写一个 `hello.ts`
3. 读取确认内容

目标：中间至少更新一次 todo，而不是一直口头描述。
