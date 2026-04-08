# s04 Subagent（TS）

## 这一章新增了什么

引入“主 agent 委派子 agent”的机制：主 agent 通过 `task` 工具把探索性任务外包。

## 关键代码在哪

- 入口：`agents_self_contained/s04_subagent.ts`
- 子代理执行器：`createSubagentRunner`
- 对主代理暴露的工具：`createTaskTool`

`s04` 结构：

1. 先创建 `runSubagent`
2. 再把 `task` 工具追加到主工具集
3. 主代理系统提示词明确“可以委派”

## 运行时观察什么

```sh
npm run s04
```

观察日志里是否出现：

1. 主代理发起 `task`
2. 子代理在独立 message 上下文中运行
3. 返回摘要给主代理继续决策

## 最小练习

让主代理完成：

1. 委派子代理扫描某个目录文件
2. 子代理返回总结
3. 主代理基于总结做下一步动作

目标：理解“并不是另开进程，而是另一个 loop 上下文”。
