# s07 Permission System（TS）

## 这一章新增了什么

在工具真正执行前，加一层权限管道：

`tool_use -> permission check -> (allow/deny/ask) -> execute`

这意味着模型的“提议动作”不会直接变成系统执行。

## 关键代码在哪

- 入口：`agents_self_contained/s07_permission_system.ts`
- 权限核心：`agents_self_contained/_runtime.ts` 的 `PermissionManager`
- 工具执行关口：`withGuards`

`s07` 的接线方式：

- 通过 `createBaseTools({ permissions })` 把权限层注入每个工具
- `PERMISSION_MODE` 支持 `default / plan / auto`

## 运行时观察什么

```sh
npm run s07
```

观察：

1. 工具调用先经过 `permissions.check`
2. `deny` 会直接返回拒绝信息
3. `ask` 会触发交互确认（终端 y/n）

## 最小练习

让 agent 尝试两类命令：

1. 安全读取（如 `ls -la`）
2. 高风险模式命令（带 `sudo` 或高危删除语义）

目标：确认“模型能提议，但系统有最终执行裁决权”。
