# s14 Cron Scheduler（TS）

## 这一章新增了什么

把“现在执行”扩展为“定期调度执行”。

关键模型：

- 调度本身记录在 `.tasks/cron.json`
- 到点后不是直接执行 shell，而是“物化”为任务板任务

## 关键代码在哪

- 入口：`agents_self_contained/s14_cron_scheduler.ts`
- 调度核心：`agents_self_contained/_runtime.ts` 的 `CronScheduler`
- 工具：`createCronTools`

常用工具：

- `schedule_task`
- `list_schedules`
- `run_due_schedules`

## 运行时观察什么

```sh
npm run s14
```

观察：

1. schedule 创建后会持久化
2. `run_due_schedules` 会把到期调度写入任务板
3. 任务板与调度器职责分离（计划 vs 执行）

## 最小练习

让 agent：

1. 创建一个每 N 分钟的调度
2. 手动触发 `run_due_schedules`
3. 在任务板里确认生成的新任务

目标：理解“调度是任务生成器，不是任务执行器”。
