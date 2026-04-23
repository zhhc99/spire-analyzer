构建一个开源的 Slay the Spire 2 对局分析工具。

输入：.run 文件（JSON）。
核心：解析并规范化数据，生成简单、客观的总结。
输出（CLI 和 Web 共用）：


架构：一个共享 core，CLI 和纯前端 Web 作为薄壳。
原则：简单、有用、客观，不做复杂评分或过度分析。

---

一些文档在 doc/ 下. 任何时候都严格遵循 RULES.md. ARCHITECTURE 是另一个 web 项目 spiremind 的, 你应该完
全仿照其格式, 克制地写一个 ARCHITECTURE.md. 保持内容简洁, 不使用 "是..., 不是..." 等 AI 口癖, 不要过度
设计.

---

参考项目 spiremind 在 references 下. 它用到了 spire-codex 的 api, 并且构建了符合我心意的 material
design. 在构建 material ui 或使用卡牌 api 时, 优先**照搬**该项目. 你可能需要其他 api 的具体信息, 如遗
物等. 该 api 的完整文档位于 https://spire-codex.com/docs, 在 github 仓库 https://github.com/ptrlrd/
spire-codex 的 readme 也有一些信息. 优先参照本地 reference spiremind 的经验. 遇到未知领域时, 你可以使
用 curl 工具去尝试查询 api. 如果结果不正确, 考虑全大写 / 全小写 / 首字母大写等各种格式.

这里还有一个 xxx.run 文件, 它是 sts2 的 run history 文件, 你可以以此文件为标准了解 history 格式. 在
linux 下, 它位于 ~/.local/share/SlayTheSpire2/steam/{your steam id}/profile1/saves/history, cli 程序应
该能获取这个路径 (示例逻辑: 玩家只有1个?定位玩家:用户指定 -> 非空 profile 只有1个?定位profile:用户指
定. 当然你还要处理 0 个的边界情况). 在 windows/macos 下的路径需要你做准确猜测或查询.

---

我希望在 core 内支持的内容:
- 对局摘要, 如一些基本信息, hp 曲线, 牌组数量曲线等
- 总抓牌数 & 每个 act 的抓牌数. 每个 act boss 战后的选卡.
- 总遗物数 & 总消费数
- 总火堆数 (总数 | 休息 / 敲牌(即升级) / 其他)
- 每个 act 最初有一个先古遗物, 这个先古遗物的选择.
- 精英战的数量 (总数 | act1/act2/...)
- 战损最高的 5 场战斗的简要信息
- 前 3 场战斗的抓牌 (抓了什么 & 跳过什么)

遣词造句时, 你应该用游戏内的表述, 而不是我在这里的臆造术语. 确保有依有据.
---

l10n: 做中英文即可. fallback 为英文.

---

cli 的呈现 / 交互方面你来设计. web 方面, 优先参考 spiremind 项目的 material design 样式. 一些 css 样式
在自行实现时容易踩坑, 建议能照抄的组件尽量照抄, ui 结构和呈现, 交互由你自行设计. 不需要提供主题按钮,
只提供默认的深色主题. 可以在读取 run 之前用 md 标准的深黑色, 读取 run 之后根据角色而切换深色版本的主色
调 (spiremind 有 5 个浅色版本的主色调/色盘, 供你参考).

---

其他未尽事项可以自行发挥, 最后给我简报. 一些重要的事情建议记录在 docs/codex/ 下, 供你自己参阅. 一切都
保持简洁, 避免过度设计, less is more.

