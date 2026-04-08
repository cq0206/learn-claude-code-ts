# s19 MCP & Plugin（TS）

## 这一章新增了什么

引入插件清单与外部能力入口，让“工具来源”可扩展。

教学实现里重点是插件装载与描述，而不是完整 MCP 协议细节。

## 关键代码在哪

- 入口：`agents_self_contained/s19_mcp_plugin.ts`
- 插件清单加载：`agents_self_contained/_runtime.ts` 的 `PluginLoader`
- 工具：`createPluginTools`
- MCP 连接原型：`MCPClient`

常用工具：

- `list_plugins`
- `describe_plugin`

插件目录：

- `.plugins/*.json`

## 运行时观察什么

```sh
npm run s19
```

观察：

1. 启动时 `pluginLoader.load()` 会刷新插件清单
2. `list_plugins` 列出可用插件描述
3. `describe_plugin` 返回某个插件 manifest 详情

## 最小练习

手动创建一个 `.plugins/demo.json`，再让 agent：

1. 列出插件
2. 读取该插件详情

目标：理解“插件先进入统一工具管道，再被模型调用”。
