# s08 Hook System（TS）

## 这一章新增了什么

引入 Hook 扩展点：不改主循环，也能在关键时机插入行为。

支持三个时机：

- `SessionStart`
- `PreToolUse`
- `PostToolUse`

## 关键代码在哪

- 入口：`agents_self_contained/s08_hook_system.ts`
- Hook 核心：`agents_self_contained/_runtime.ts` 的 `HookManager`
- 工具执行接入：`withGuards` 中的 hook 调用

重要边界：

- Hook 配置来自 `.hooks.json`
- 只有存在 `.claude/.claude_trusted` 时才会真正执行 hook

## 运行时观察什么

```sh
npm run s08
```

观察：

1. 会话启动时是否触发 `SessionStart`
2. 工具前后是否分别触发 pre/post hook
3. hook 返回 `blocked` 时工具是否被拦截

## 最小练习

配置一个简单 `.hooks.json`：

1. `PreToolUse` 对 `bash` 打印提醒
2. `PostToolUse` 追加一条日志文本

目标：确认 hook 是“时机扩展”，不是“重写 loop”。
