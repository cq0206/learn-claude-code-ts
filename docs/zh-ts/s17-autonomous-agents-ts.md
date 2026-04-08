# s17 Autonomous Agents（TS）

## 这一章新增了什么

引入自治工作模式：agent 不等点名，主动扫描未认领任务并认领。

## 关键代码在哪

- 入口：`agents_self_contained/s17_autonomous_agents.ts`
- 任务核心：`TaskManager`
- 新增工具：`scan_unclaimed_tasks`
- 配合工具：`claim_unclaimed_task`（来自任务板工具）

## 运行时观察什么

```sh
npm run s17
```

观察：

1. `scan_unclaimed_tasks` 能列出无 owner 的任务
2. agent 可主动认领并推进任务状态
3. 任务板开始体现“拉模式分工”

## 最小练习

先在任务板创建多条无 owner 任务，再让 agent：

1. 扫描未认领任务
2. 认领其中一条
3. 更新状态为 `in_progress`

目标：理解自治不是魔法，而是“扫描 + 认领 + 状态推进”的组合。
