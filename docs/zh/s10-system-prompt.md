# s10 System Prompt Construction（TS）

## 这一章新增了什么

把 system prompt 从“一段硬编码字符串”升级成“可维护的分段组装”。

## 关键代码在哪

- 入口：`agents_self_contained/s10_system_prompt.ts`
- 组装函数：`agents_self_contained/_runtime.ts` 的 `buildPromptSections`
- 动态数据源：`SkillRegistry`、`MemoryManager`

`s10` 的 prompt 分段：

1. `Role`
2. `Operating Style`
3. `Skills`
4. `Memory`

这让提示词能跟随运行时状态变化，而不是写死。

## 运行时观察什么

```sh
npm run s10
```

观察：

1. skills/memory 变化后，下一轮 system prompt 会自动变化
2. 主循环本身不需要修改
3. 新增一段规则只需加一个 section

## 最小练习

做两个动作：

1. 新增一个 skill
2. 新增一条 memory

目标：确认 prompt 是“组合产物”，不是固定文本。
