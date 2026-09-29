# 众卜

**一个问题，多种视角。**

[打开网站](https://loverxy1205-hub.github.io/zhongbu/) · [GitHub 源码](https://github.com/loverxy1205-hub/zhongbu)

一个可交互的中文文化体验网站。访问者可以输入问题、选择占卜体系、比较独立解读，主动保存、收藏、复制和导出记录。前端部署于 GitHub Pages，五套引擎与知识库本地运行；另有用户自愿触发的 DeepSeek 灵感解读，由 Cloudflare Workers 保管密钥并转发。没有数据库、用户登录、支付、遥测、远程历法或模型下载。

用于文化体验与自我反思，不构成事实预测或专业建议。

## 运行

需要 Node.js 24、npm。依赖精确解析记录在 `package-lock.json` 中，农历库固定为 `lunar-typescript@1.8.6`。

```sh
npm ci
npm run dev
```

打开命令输出的本地地址。五套本地引擎无需任何密钥；AI 入口在未配置代理时显示尚未开通。

生产构建及预览：

```sh
npm run build
npm run preview -- --host 127.0.0.1 --port 4173
```

`dist/` 是完整静态成品，可部署在 GitHub Pages 或任意支持 HTTPS 的静态托管上。不要直接用 `file://` 打开 ES 模块网站。`base: './'` 适配仓库子路径。

## 五套可运行体系

| 体系          | 原始结果                                           | 本地知识                                        |
| ------------- | -------------------------------------------------- | ----------------------------------------------- |
| 塔罗          | 现状／阻力／提示三张；无放回；可关闭逆位           | 完整78张 RWS 名称；分别整理的正逆位含义与主题   |
| 周易·三枚铜钱 | 六轮三硬币，6/7/8/9，全部动爻、本卦与变卦          | 64卦、384爻原文和本站白话，含乾坤用九／用六附录 |
| 梅花易数      | 冻结时刻转所选时区农历；年月日時起例；简化五行体用 | 共用64卦，公开换年、闰月、换日、子时等工程约定  |
| 数字命理      | 简化个人日；生命数字、个人年／月／日               | 1–9 本站现代释义，不保留11/22/33                |
| 卢恩符文      | Elder Futhark 24枚中无放回三枚，无逆位、无空白符   | 完整名称、字符、主题及明确标为现代的解读        |

基础解释由知识查表、位置规则、场景模板生成，不对自由文本作语义推断。各引擎不读取彼此答案或用户偏好。结果默认展示“看各家”，失败项也保留。周易与梅花的相关性明确标注。AI 延伸独立显示，不修改任何本地结果，也不参与规则汇总。

## DeepSeek 灵感解读

每张成功结果下面都有独立入口。点击才发送本条抽取、已有释义、所选类别／场景／模式和目标日期；只有勾选「同时发送我的问题与行动」才发送这两项原文。生日字段、精确问卜时刻、其他体系及偏好都不发送。用户自行写入问题的个人信息会在主动勾选后发送。输出明确标为模型生成，可能有误。

密钥只存 Cloudflare Worker Secret `DEEPSEEK_API_KEY`。前端唯一配置为**公开代理地址** `VITE_INTERPRETATION_API_URL`，例如 `https://<worker>.<account>.workers.dev/interpret`；不要把任何密钥放进 `VITE_*`、源码或 GitHub 仓库。部署步骤、限流与成本边界见 [worker/README.md](worker/README.md)。

前端没有自动请求或自动重试，一条成功的 AI 结果随记录恢复，刷新不会再生成。生成失败可手动重试；离线时本地引擎保持可用。AI 文字随用户主动保存的历史一起保留，JSON / Markdown 导出单独列出模型版本与时间。页面以纯文本显示模型内容，不执行 HTML、链接或脚本。

## 记录和隐私

- 同一提交的原始结果、原文、解释、时间与版本冻结，刷新、排序、收藏和偏好汇总都不会改写。
- “保存本次”或“收藏本条”才写入本机历史；收藏保留整次记录以供对照。未保存结果仅在当前标签页会话中暂存，用于刷新恢复。
- 出生日期默认不写入会话、历史、计算轨迹或导出。派生数字保留。用户自行写在问题／行动内的信息仍会保留，分享前需要检查。
- 支持历史打开、删除、清空，以及 JSON / Markdown 导出。存储受限会提示，计算和导出仍可使用。
- 页面初次下载完静态资源即可断网计算；生产 Service Worker 缓存完成后还可以离线刷新。首次访问需要联网下载网站，不需要联网查询知识。
- 不包含分析统计、跟踪脚本、远程字体或远程图片。来源链接仅由用户主动点击打开。

## 测试

```sh
npm run typecheck
npm run lint
npm test
npm run build
npx playwright install chromium
npm run test:e2e
```

也可执行 `npm run check` 完成类型检查、lint、单元测试、生产构建；端到端测试单独执行。测试同时覆盖生产桌面、手机和开发 StrictMode。端到端测试会自动开启 4173 与 5174 两个本地服务器。

如测试浏览器下载失败而本机已有 Chrome，PowerShell 可使用：

```powershell
$env:PLAYWRIGHT_CHANNEL = 'chrome'
npm run test:e2e
```

测试包括知识完整性、独立原典标题核对、随机拒绝采样、无放回、三硬币1/3/3/1分布、全部64卦六位置动爻翻转、革之咸样例、农历换年／闰月／子时／跨时区、非法日期、生日缺省与脱敏、分歧保留、存储异常、离线、刷新、双击与 StrictMode。自动可访问性检查是辅助检查，不等于全面人工无障碍认证。

最新实际执行记录见 [docs/VALIDATION.md](docs/VALIDATION.md)。格式化源码：`npm run format`。

## GitHub Pages 自动部署

工作流 `.github/workflows/deploy.yml` 在 `main` 推送后执行：

1. `npm ci`，类型检查，lint，单元测试。
2. 生产构建并生成包含本地字体与知识资源的离线缓存清单。
3. 安装 Chromium，运行桌面／手机／StrictMode 端到端测试。
4. 所有检查通过后上传 `dist/`，发布 GitHub Pages。

仓库 Settings → Pages → Source 选择 **GitHub Actions**。Pages 发布使用 GitHub 内置临时权限。仓库 Actions Variables 中的 `INTERPRETATION_API_URL` 是公开代理 URL，不是密钥；工作流将它注入前端并只将对应 HTTPS origin 加入 CSP。DeepSeek 密钥不经过 Pages 工作流。源码不包含真实用户记录或凭据。

GitHub Pages 地址格式为 `https://<用户名>.github.io/zhongbu/`。更新完成后关闭旧标签页再打开，可让新 Service Worker 接管；历史记录保留原解释。

## 文件组织

```text
src/data/          78塔罗、24卢恩、64卦、1–9数字；来源与版本
src/engines/       原始抽取／计算，单次记录协调器
src/rules/         interpret、renderText、summary，互相分离
src/lib/           Web Crypto、日期、Zod恢复校验、存储、导出
src/components/    独立卡片、卦图、知识库和汇总界面
shared/            AI 请求／响应白名单契约
worker/            Cloudflare 代理、限流和服务器提示词
src/Zhongbu.tsx    页面状态与表单交互
tests/            单元与 Playwright 端到端测试
docs/sources/     原典修订快照与字体许可
scripts/          开发期原典导入器、构建期离线缓存生成器
```

## 来源与边界

详见 [来源、版权与校订](docs/SOURCES.md) 和 [算法约定](docs/ALGORITHMS.md)。白话文案与几何装饰由本站整理，不复制现代商业牌义和牌面。

动作适配只支持少量公开的**场景＋完整行动**白名单；不适配的行动返回“无明确倾向”。开放问题不强行二选一。不生成医疗、法律、投资、政治或投票指令，不恐吓灾祸，不提供付费化解。任何象征解读都应由用户结合真实条件自主判断。

程序源码采用 [MIT](LICENSE)。第三方资源保留原许可。
