# 来源、版权与校订

知识库版本 `2026.09.29-2`，应用 v1.5。源码 MIT；古籍原文公版；电子整理、字体和依赖保留各自许可，详见下表。所有中文基础释义、白话、主题标签、位置解释、场景反思均为本站自行整理，不是引自现代商业解读的逐字翻译。

| 数据／资源                | 来源                                                                                                                     | 本地位置与使用说明                                                                                                                                                                                                                                                                                                                                         |
| ------------------------- | ------------------------------------------------------------------------------------------------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 周易64卦／384爻／用九用六 | [维基文库《周易》](https://zh.wikisource.org/wiki/周易) 各分卦页                                                         | `src/data/classics.json` 每条记下 `oldid`。`docs/sources/wikisource-pages.json` 保存64页的修订号、时间和 wikitext 快照；`wiki.json` 为次序表。仅提取“易经”蓝色段落，不使用彖传、象传、文言传作为卦爻辞。古文本身属公版；若涉及维基文库编辑整理贡献，遵守 [CC BY-SA 4.0](https://creativecommons.org/licenses/by-sa/4.0/)，保留修订页对作者历史的归属链接。 |
| 梅花年月日時法            | [《梅花易數》卷一，年月日時起例](https://zh.wikisource.org/wiki/梅花易數/卷一)                                           | 古籍公版。公式和工程约定记录于 ALGORITHMS.md；体用仅为简化比较。                                                                                                                                                                                                                                                                                           |
| 农历转换                  | [6tail/lunar-typescript](https://github.com/6tail/lunar-typescript)；[作者 API 文档](https://6tail.cn/calendar/api.html) | `lunar-typescript@1.8.6` 精确锁定，MIT；本地运行，只用日期转换，不使用宜忌等功能。测试核对2024正月初一、2023闰二月初一、子时换日、时区跨日。支持范围是本站保守限制，不声称穷尽检验库全部年份。                                                                                                                                                             |
| RWS 名称框架              | [A. E. Waite, The Pictorial Key to the Tarot](https://en.wikisource.org/wiki/The_Pictorial_Key_to_the_Tarot)，1910       | 原书公版；只参照牌名体系与基本象征范围，中文文案原创。没有抓取／使用商业牌图。                                                                                                                                                                                                                                                                             |
| 卢恩字符                  | [Unicode Runic 字符表](https://www.unicode.org/charts/PDF/U16A0.pdf)                                                     | 核对24字符与名称；没有复制 Unicode PDF 或提取其中字体。常见重建名称与 Unicode 长名称存在拼写差异，如 Sowilo/Sowilu、Othala/Othalan，不代表古代统一标准。                                                                                                                                                                                                   |
| 符文字体                  | [Google Fonts / Noto Sans Runic](https://github.com/google/fonts/tree/main/ofl/notosansrunic)                            | `src/assets/NotoSansRunic-Regular.ttf`；SIL OFL 1.1 原许可见 `docs/sources/Runic-OFL.txt`，字形随包离线可用。                                                                                                                                                                                                                                              |
| 数字命理                  | 本站现代规则 v1                                                                                                          | 公式完全公开；1–9 含义为本站整理，无统一古代规则主张。                                                                                                                                                                                                                                                                                                     |
| 生日数字九宫格            | 本站生日数字九宫格 v1（用户选择的原始生日数字版）                                                                        | `src/data/numbers.ts` 的 `MATRIX_NUMBERS`，忽略0、保留重复、不加四工作数；1/4/7、2/5/8、3/6/9 布局与公式见 ALGORITHMS.md。毕达哥拉斯式为现代玩法名称，不声称来自毕达哥拉斯本人著作。中文文案原创；不将次数或空格解释为能力、健康、智商或财富评分。旧个人日数据保留用于历史兼容。                                                                           |

## 原文处理和核验记录

1. 开发阶段交叉查看过 `bollwarm/ZHOUYI`、`muyen/decoding-iching` 的文本和 `leechhui/zhouyi` 的编码；发现前两者的乾九二使用了“見龍再田”。没有采用该上游文本作为交付原文。
2. 最终统一按维基文库每卦的固定修订版本提取，乾九二为“見龍在田”。所有数据都可从快照用 `node scripts/import-classics.mjs` 离线重建。
3. 去掉 HTML、维基链接、繁简显示包裹与注释标记，保留所引版本的字形和标点。卦辞标题保留源页面写法，不人为伪造原文缺项。
4. 艮卦页面部分 `<span>` 没有结束标签，按行提取而非跨段匹配。`{{另|裂|列}}`、`{{另|閽|薰}}`、`{{另|孚|序}}` 分别选用列／薰／序，选择规则写在导入器中，原始异文完整保存在快照。这不是隐瞒异文的校勘定本。
5. 自动检查64个编码唯一、上下卦正确、六爻条数、每爻阴阳名与编码相符、384条白话全部存在；以屯／解与革之咸等方向样例避免上下或显示次序反转。
6. “核对”指固定版本逐项抽取与结构校验、样例交叉核验，不声称做过学术级各版本训诂校勘。本站白话是简短反思性释读，不是权威或唯一翻译。原文有古代征伐等表述，展示原典与提供现代行动指令严格分开。

## 版本更新

v1.1 新增的 SVG 装饰为本站原创：塔罗按牌号／花色变化的几何符号，周易山水云纹、梅枝五瓣花、数字星轨、卢恩石纹；不使用商业牌面或远程图片。AI 灵感解读来源单独标为 DeepSeek，不能混同本知识库白话或传统原典。

v1.4 的转铜钱、落梅、数字跳动及岩石撬开也是本站SVG／CSS交互装饰，不是传统起卦仪式的复原，也不改变冻结结果。没有新增远程美术资源。

v1.5 的78张牌背、六轮铜钱与逐爻图、布袋摸石、生日数字九宫格和分体系篇章继续使用本站原创 SVG／CSS／HTML，无新增商业卡面或远程图片。塔罗整副牌在提交时冻结，实际选择的槽位决定三张结果；其他揭晓装饰不重算。九宫格算法、生日独立同意存储与旧记录兼容详见 [算法约定](ALGORITHMS.md)。

接口和部署依据：[DeepSeek 官方调用文档](https://api-docs.deepseek.com/guides/harness)、[Chat Completions API](https://api-docs.deepseek.com/api/create-chat-completion/)、[Cloudflare Workers Secrets](https://developers.cloudflare.com/workers/configuration/secrets/)、[Workers Rate Limiting](https://developers.cloudflare.com/workers/runtime-apis/bindings/rate-limit/)。运行时只有用户显式生成 AI 才调用 DeepSeek；用户主动提交的反馈另经代理写入私有数据库，不调用模型。知识数据本身仍全部打包。

v1.5 服务实现参考 [Pages Functions bindings／Service binding](https://developers.cloudflare.com/pages/functions/bindings/)、[SQLite Durable Object 事务存储](https://developers.cloudflare.com/durable-objects/api/sqlite-storage-api/) 和 [D1 数据库](https://developers.cloudflare.com/d1/)（2026-09-29核验）。它们分别用于同源API网关、滚动窗口与24小时防刷状态、主动反馈的私有存储。网站自定的反馈保留约90天、HMAC出口IP分组及60秒超过60次封禁规则不是这些平台提供的预测或身份认证能力，也不能保证中国所有网络可达。详细范围和限制见 [Worker说明](../worker/README.md)。

改变知识、规则或模板时更新 `src/data/meta.ts` 中相应版本，保留旧记录内冻结的文本。来源快照无需在应用运行时加载；生产 bundle 只带实际知识数据。
