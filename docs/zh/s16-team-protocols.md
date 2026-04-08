# s16 Team Protocols（TS）

## 这一章新增了什么

在团队消息之上增加“结构化协作协议”。

从自由文本消息升级为可追踪的请求/响应类型。

## 关键代码在哪

- 入口：`agents_self_contained/s16_team_protocols.ts`
- 协议工具：`agents_self_contained/_runtime.ts` 的 `createProtocolTools`
- 底层通道：`MessageBus`

常用工具：

- `request_plan_approval`
- `respond_to_request`

## 运行时观察什么

```sh
npm run s16
```

观察：

1. 请求消息带明确 `type`（如 `plan_approval_request`）
2. 响应消息带明确批准结果（`approved`）
3. 协议消息和普通团队消息共用同一 inbox

## 最小练习

让 agent：

1. 发起一个计划审批请求
2. 发送对应审批回复
3. 从 inbox 验证请求/响应都可追踪

目标：理解“协议 = 约束沟通格式，降低协作歧义”。
