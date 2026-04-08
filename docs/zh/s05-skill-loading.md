# s05 Skill Loading（TS）

## 这一章新增了什么

引入按需加载技能文档：模型先 `load_skill(name)`，再执行任务。

## 关键代码在哪

- 入口：`agents_self_contained/s05_skill_loading.ts`
- 技能索引与扫描：`SkillRegistry`
- 工具封装：`createLoadSkillTool`

`SkillRegistry` 的流程：

1. 扫描 `skills/**/SKILL.md`
2. 读取 frontmatter（名称、描述）
3. `describeAvailable()` 给模型可用技能列表
4. `loadFullText(name)` 返回完整技能正文

## 运行时观察什么

```sh
npm run s05
```

观察：

1. 模型是否先调用 `load_skill`
2. 加载结果会以 `<skill ...>` 文本片段进入上下文
3. 然后才进入具体执行

## 最小练习

先在 `skills/example/SKILL.md` 写一段简短规则，再让 agent 执行一个需要该规则的任务。

目标：验证“技能是上下文注入，不是代码插件”。
