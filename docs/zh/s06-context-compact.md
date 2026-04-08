# s06 Context Compact（TS）

## 这一章新增了什么

引入上下文压缩策略，避免长会话把 token 撑爆。

## 关键代码在哪

- 入口：`agents_self_contained/s06_context_compact.ts`
- 压缩管理器：`CompactManager`

本章有两层压缩：

1. `beforeModel`：当估算上下文超限，执行 `compactHistory`
2. `afterToolResults`：每轮执行 `microCompact`，把旧工具结果缩短

另外还有一个很实用的点：

- `persistLargeOutput` 会把超长工具输出落盘到 `.task_outputs/tool-results/`，上下文里只留预览

## 运行时观察什么

```sh
npm run s06
```

给长任务（例如多文件读取），观察：

1. 旧结果是否被替换为 compact 提示
2. 是否出现 persisted-output 提示
3. 历史压缩后还能继续完成当前任务

## 最小练习

让 agent 连续读取多个较大文件，然后继续修改其中一个文件。

目标：确认压缩发生后，任务仍能连续推进。
