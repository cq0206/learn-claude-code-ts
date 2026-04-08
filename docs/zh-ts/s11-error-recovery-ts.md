# s11 Error Recovery（TS）

## 这一章新增了什么

为模型调用失败增加恢复策略：第一次失败不立即终止，而是注入恢复提示并重试。

## 关键代码在哪

- 入口：`agents_self_contained/s11_error_recovery.ts`
- 循环核心：`agents_self_contained/_runtime.ts` 的 `runAgentLoop`
- 恢复钩子：`onModelError`

`s11` 的策略：

1. 第 1 次失败：把错误摘要写回 `ctx.messages`，要求模型恢复继续
2. 第 2 次失败：停止重试，向上抛错

## 运行时观察什么

```sh
npm run s11
```

观察：

1. 失败后是否出现恢复提示被注入到会话
2. 恢复后是否继续沿着原任务推进
3. 连续失败是否按上限停止

## 最小练习

人为制造一次模型失败（例如临时配置错误模型 ID），观察恢复分支行为。

目标：理解“可靠性来自恢复机制，不只来自成功路径”。
