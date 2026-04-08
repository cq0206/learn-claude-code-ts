# s02 Tool Use（TS）

## 这一章新增了什么

从“只有 bash”升级到完整基础工具集：

- `bash`
- `read_file`
- `write_file`
- `edit_file`

并开启 `normalizeMessages: true`，让请求更稳定。

## 关键代码在哪

- 入口：`agents_self_contained/s02_tool_use.ts`
- 工具定义：`agents_self_contained/_runtime.ts` 的 `createBaseTools`
- 工具执行保护：`withGuards`
- 消息清洗：`normalizeMessages`

## 运行时观察什么

```sh
npm run s02
```

观察两个细节：

1. 模型可能连续发多个 `tool_use`，runtime 会按顺序执行并回填结果
2. `normalizeMessages` 会补齐不完整的工具结果对，减少 API 校验错误

## 最小练习

让 agent：

1. 新建 `notes.txt`
2. 写入一行文本
3. 再读出来验证
4. 用 `edit_file` 把一处文本改掉

目标：确认你理解“工具是能力注入，loop 本身没改”。
