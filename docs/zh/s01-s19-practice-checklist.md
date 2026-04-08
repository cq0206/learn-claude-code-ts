# s01-s19 实操清单（每章 3 练习）

## s01 Agent Loop

1. 运行 `npm run s01`，输入“列出当前目录并总结结构”。
2. 观察一次完整闭环：`tool_use -> tool_result -> assistant`。
3. 记录“循环结束”的触发条件（不再请求工具）。

## s02 Tool Use

1. 让 agent 用 `write_file` 创建 `notes.txt`。
2. 用 `read_file` 读取并确认内容。
3. 用 `edit_file` 精确替换一段文本并再次验证。

## s03 Todo / Planning

1. 给一个至少 3 步任务并要求先写 todo。
2. 观察任务推进时是否只有 1 个 `in_progress`。
3. 完成后确认 todo 状态收敛到已完成。

## s04 Subagent

1. 让主 agent 把“代码扫描总结”委派给子 agent。
2. 让子 agent 返回摘要而非完整过程。
3. 让主 agent 基于摘要继续执行下一步。

## s05 Skill Loading

1. 在 `skills/example/SKILL.md` 写一条简单规则。
2. 让 agent 先 `load_skill` 再执行任务。
3. 对比加载前后输出是否符合该规则。

## s06 Context Compact

1. 让 agent 连续读取多个较大文件。
2. 观察是否触发 `microCompact` 或持久化输出提示。
3. 压缩后继续修改文件，确认任务连续性。

## s07 Permission System

1. 运行 `npm run s07` 并执行安全命令（如 `ls -la`）。
2. 尝试高风险命令语义，观察 deny/ask 行为。
3. 切换 `PERMISSION_MODE`，对比 `default/plan/auto` 结果。

## s08 Hook System

1. 创建 `.hooks.json`，给 `PreToolUse` 增加提示 hook。
2. 准备 `.claude/.claude_trusted` 后运行 `npm run s08`。
3. 观察 `SessionStart` 与工具前后 hook 是否触发。

## s09 Memory System

1. 让 agent 保存一条用户偏好到 memory。
2. 重启会话后确认该偏好被再次注入 prompt。
3. 再保存一条项目约定并验证可持续复用。

## s10 System Prompt

1. 新增一个 skill 并观察 prompt 的 Skills 段变化。
2. 新增一条 memory 并观察 Memory 段变化。
3. 说明 `buildPromptSections` 相比硬编码字符串的优势。

## s11 Error Recovery

1. 制造一次模型调用错误（例如临时无效模型 ID）。
2. 观察 `onModelError` 是否注入恢复提示并重试。
3. 确认超过重试上限后会停止并抛出错误。

## s12 Task System

1. 创建 3 条任务记录并查看任务板。
2. 认领其中 1 条并更新为 `in_progress`。
3. 完成后更新为 `completed` 并复查落盘文件。

## s13 Background Tasks

1. 用 `background_run` 启动一个慢命令。
2. 在等待期间继续执行一个前台任务。
3. 用 `check_background` 或通知回流读取结果文件。

## s14 Cron Scheduler

1. 创建一个周期调度（`schedule_task`）。
2. 运行 `run_due_schedules` 手动触发到期任务物化。
3. 在任务板中确认新增任务并推进执行状态。

## s15 Agent Teams

1. 注册两个队友并查看队友列表。
2. 发送一条团队消息到指定收件人。
3. 读取该收件人 inbox 验证消息结构。

## s16 Team Protocols

1. 发起一条计划审批请求（`request_plan_approval`）。
2. 发送对应审批响应（`respond_to_request`）。
3. 在 inbox 中核对请求与响应语义是否成对。

## s17 Autonomous Agents

1. 先创建多条未认领任务。
2. 运行 `scan_unclaimed_tasks` 查看可认领任务。
3. 认领并推进 1 条任务到 `in_progress`。

## s18 Worktree Isolation

1. 创建两个 lane（`create_lane`）。
2. 在两个 lane 分别运行不同命令（`run_in_lane`）。
3. 验证不同 lane 文件状态互不干扰。

## s19 MCP & Plugin

1. 新建一个 `.plugins/demo.json`。
2. 运行 `list_plugins` 查看插件列表。
3. 用 `describe_plugin` 读取 demo 插件细节并解释字段作用。
