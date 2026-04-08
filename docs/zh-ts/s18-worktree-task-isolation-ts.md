# s18 Worktree Task Isolation（TS）

## 这一章新增了什么

把并行任务从“逻辑并行”升级到“执行空间隔离”。

核心思路：

- 每个任务可在独立 lane 中运行
- 避免共享目录互相污染

## 关键代码在哪

- 入口：`agents_self_contained/s18_worktree_task_isolation.ts`
- 隔离管理：`agents_self_contained/_runtime.ts` 的 `WorktreeManager`
- 工具：`createWorktreeTools`

常用工具：

- `create_lane`
- `list_lanes`
- `run_in_lane`

目录结构：

- lane 默认创建在 `.worktrees/`

## 运行时观察什么

```sh
npm run s18
```

观察：

1. 新 lane 会出现在 `.worktrees/`
2. `run_in_lane` 的命令在 lane 内部执行
3. 不同 lane 间文件状态互不干扰

## 最小练习

让 agent：

1. 创建两个 lane
2. 在各 lane 分别写入不同文件
3. 对比确认互不影响

目标：理解隔离执行面是并行稳定性的关键。
