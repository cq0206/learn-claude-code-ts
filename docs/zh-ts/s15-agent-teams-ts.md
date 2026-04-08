# s15 Agent Teams（TS）

## 这一章新增了什么

从“一次性 subagent”升级到“持久化团队协作”。

核心组件：

- `TeammateManager`：维护队友注册信息
- `MessageBus`：基于文件 inbox 的团队消息通道

## 关键代码在哪

- 入口：`agents_self_contained/s15_agent_teams.ts`
- 队友管理：`agents_self_contained/_runtime.ts` 的 `TeammateManager`
- 消息总线：`MessageBus`
- 团队工具：`createTeamTools`

常用工具：

- `register_teammate`
- `list_teammates`
- `send_team_message`
- `read_team_inbox`

## 运行时观察什么

```sh
npm run s15
```

观察：

1. 队友信息落在 `.team/teammates.json`
2. 消息以 json 文件形式进入 `.team/inbox/`
3. 可以按收件人读取 inbox

## 最小练习

让 agent：

1. 注册两个队友
2. 发送一条任务消息给其中一个
3. 读取该队友 inbox 验证消息

目标：理解“持久身份 + 消息通道”是团队协作基础。
