# s13 Background Tasks（TS）

## 这一章新增了什么

增加后台任务执行能力，让慢命令异步运行，不阻塞主循环。

## 关键代码在哪

- 入口：`agents_self_contained/s13_background_tasks.ts`
- 后台任务核心：`agents_self_contained/_runtime.ts` 的 `BackgroundManager`
- 工具：`createBackgroundTools`

常用工具：

- `background_run`
- `check_background`

运行产物：

- 输出日志落盘在 `.runtime-tasks/*.log`
- 完成通知通过 `drainNotifications()` 在 `beforeModel` 注入到会话

## 运行时观察什么

```sh
npm run s13
```

观察：

1. `background_run` 立即返回 task id
2. 任务完成后，下一轮会自动收到通知
3. 可用 `check_background` 查看状态/预览/输出文件

## 最小练习

让 agent：

1. 后台执行一个慢命令
2. 继续做另一个前台任务
3. 任务完成后读取后台结果

目标：理解“异步执行 + 通知回流”的闭环。
