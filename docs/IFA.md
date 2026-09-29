# Ifá · 约鲁巴符号与占链体验 v1

本篇实现 òpèlè 占链形成符号的文化体验，没有实现完整的 Ifá 宗教咨询，也没有把欧洲地占图名、贝壳数量占或 ikin 棕榈果操作混入。知识与美术全部随应用打包；无需联网、模型或音频。

## 来源与实际核对

- William Bascom, _Ifa Divination: Communication between Gods and Men in West Africa_, Indiana University Press, 1969：第3–4页 Table 1、第29页占链器具、第40–42页 Figure 2 与说明。核对凹凸面到单双划的映射、操作者视角、两自由端位置、右列优先、逐行方向以及16×16结构。[出版方书目](https://iupress.org/9780253206381/ifa-divination/)；开发时查看[原著扫描文本](https://fliphtml5.com/zythh/rksk/Bascom,_William_-_Ifa_Divination:_Communication_Between_Gods_and_Men_in_West_Africa/)。只使用事实性编码与中文概述，不复制扫描图、译文或诗节。没有将能浏览扫描等同于获得再发行许可。
- Paul-Kolade Tubi, “Anthropology of Ifa: A Study of Traditional Epistemology, Ethics and Wisdom”, _OWIJOPPA_ 4(2), 2020，133–140页；第135页 Fig. 2：逐行核对16个基础四行图式。[作者上传的论文](https://www.researchgate.net/publication/361164673_ANTHROPOLOGY_OF_IFA_A_STUDY_OF_TRADITIONAL_EPISTEMOLOGY_ETHICS_AND_WISDOM)。该文表中的 `owara`、`okonron`、`oturwa` 与其他位置拼写不一致；本版采用 Bascom 的常见拉丁转写 Owonrin、Okanran、Otura，不把印刷差异当新增图式。Odi 的 Edi 别名来自 Bascom。表中的学术文化陈述不转为预测事实。
- [Duke University, Sacred Arts of the Black Atlantic, D059](https://sacredart.caaar.duke.edu/artifacts/pair-of-nigerian-yoruba-ifa-divination-chains-opele-1-green-yellow-beads-and-2-metal-chain-links/)：参考连链器形；网页使用原创 SVG，不复制照片。
- [UNESCO 00146](https://ich.unesco.org/en/RL/ifa-divination-system-00146)／[保护项目00036](https://ich.unesco.org/en/projects/safeguarding-of-the-ifa-divination-system-00036)：文化背景、专门解释者与口传语料的角色，不作为具体二进制映射的证明。条目页此次触发网站防机器人页，保护项目页可读；图式核对依上述专门资料。
- 用户给出的 Smithsonian 贝宁 Fá 介绍属于相关但有地域差异的资料；未拿它替代 Yorùbá 占链的具体图式规则。

核对日期：2026-09-30。术语采用 Ifá、Yorùbá、Odù、òpèlè；基础列名采用来源中核实过的拉丁转写，不擅自补造声调。本站只选定一套展示约定，不声称各地域流派完全一致。

## Orientation convention

版本 `ifa-practitioner-right-first-top-down-v1`。

1. 固定为操作者俯视：操作者在画面下方，U形链的自由端靠近操作者，弯折处远离操作者。
2. 屏幕右列是第一列，屏幕左列是第二列；各列均从上往下读。左右依据操作者视角，不按面对操作者的旁观者镜像。右列名字在前的顺序来自 Bascom 的具体说明；画面内持续标示左右。
3. 凹面朝上 → 单划 `I` → 内部 `1`；凸面朝上 → 双划 `II` → 内部 `0`。1/0 是本站编码，不是古代数字标签。
4. `faces[0..3]` 是右列上至下，`faces[4..7]` 是左列上至下。数组次序只是存储约定。基础图式的四位字符串均从上至下。
5. 右列一枚末端标记珠、左列两枚用于保持方向；参考实物用不同末端标记区分两侧的办法，不把本站珠形当实物复原。
6. 固定核对例：右列 `0001` = Okanran，左列 `1101` = Irete，对应 Bascom Figure 2。签名 `ifa-r0001-l1101`，交换左右会成为另一签名。

| 基础名 | 上→下（单1／双0） | 基础名    | 上→下（单1／双0） |
| ------ | ----------------- | --------- | ----------------- |
| Ogbe   | 1111              | Oyeku     | 0000              |
| Iwori  | 0110              | Odi / Edi | 1001              |
| Irosun | 1100              | Owonrin   | 0011              |
| Obara  | 1000              | Okanran   | 0001              |
| Ogunda | 1110              | Osa       | 0111              |
| Ika    | 0100              | Oturupon  | 0010              |
| Otura  | 1011              | Irete     | 1101              |
| Ose    | 1010              | Ofun      | 0101              |

展示顺序不是传统高低排序。本版不实现排序用于具体问答的方法。

## 生成、记录与显示

`createIfa(rng)` 在一次新记录提交中调用共享拒绝采样 `uniformInt(2,rng)` 八次，独立冻结八片朝向与左右图式、签名及各数据版本。此公平二值是数字模拟假设，不是实物概率测量，也不意味着吉凶均分。

流程进度 `intro → focus → lifted → settled → complete` 在 `IfaState` 内；刷新可恢复。释放阶段1.65秒临时动画不持久化，离开取消，回来仍是 lifted，可继续释放同一组朝向。跳过、Escape、暂停与系统减少动态效果只提前揭晓冻结朝向。无动画随机调用，无反复抛到满意功能。

`ifaSchema` 严格校验恰好八个0/1、编码与签名一致、已知版本、已知进度，不接收任意额外文本字段。`canTransitionIfa` 只接受下一阶段，且八片朝向、签名、左右列、方向与版本完全相同。`interpretIfa` 在 complete 前返回 undefined，完成后返回无方向主题的资料解释。

## 三份独立数据

- `signatureCatalog.ts`：完整16基础图式与256有序签名，16同列重复／240不同列。每项含来源、方向、左右图式；未经逐项核对的复合名留 `null`，用内部签名ID展示，不机械造约鲁巴别名。
- `interpretationCorpus.ts`：首版为空。未来条目必须含对应签名、来源、定位、语言、许可／使用方式、核对状态。没有可发布并核实的文字时明确写“符号已生成，本版本尚无该项经核对的文本解读”。不模仿诗节，不随机填寓言，不把两列各自主题相加冒充复合判词。
- `reflectionTemplates.ts`：两条本站原创中性反思，仅区分观察、联想与现实资料。不根据图式推断 iré／ìbì，不提供祭献、禁忌、医疗或付费化解指令，不向 DeepSeek 补写传统资料。

此体系可看、收藏、导出，但不能参加行动方向投票；不填一个“中性分数”混入票数。空 themes 是有意保留的边界。

## 验证

专项单元测试位于 `tests/ifa.test.ts`：16编码逐项、256唯一与16/240分组、固定方向例、恰好8次公平随机输入、全部256输入对应目录、严格schema、进度冻结、JSON恢复、缺文本回退、全部签名无方向判断及不反转用户否定行动。实际执行结果由交付验证文档记录。
