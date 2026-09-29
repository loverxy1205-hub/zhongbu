# 众卜

**一个问题，多种视角。**

[打开网站](https://zhongbu.pages.dev/) · [GitHub Pages](https://loverxy1205-hub.github.io/zhongbu/) · [源码](https://github.com/loverxy1205-hub/zhongbu)

中文文化体验网站，Vite + React + TypeScript。五套本地体系、完整知识库、独立结果与规则汇总都在浏览器运行，支持离线。DeepSeek建议由用户主动触发，通过Cloudflare Worker保管密钥；意见反馈私下存入D1，Durable Object保存防刷状态。没有登录、支付、遥测、远程历法或本地模型。

用于文化体验与自我反思，不构成事实预测或专业建议。

## 运行与测试

需要Node.js 24和npm，依赖由package-lock.json锁定。

```sh
npm ci
npm run dev
npm run check
npm run test:e2e
```

`check`包含严格类型检查、lint、单元测试和生产构建。端到端测试自动开启4173生产预览与5174 StrictMode开发服务；默认使用Playwright Chromium。本机已有Chrome时可设置`PLAYWRIGHT_CHANNEL=chrome`。最新实际结果见[验证记录](docs/VALIDATION.md)。

```sh
npm run build
npm run preview -- --host 127.0.0.1 --port 4173
```

五套本地体系无需密钥。生产成品位于`dist/`；首次下载并完成Service Worker缓存后，可离线计算、浏览知识和刷新已有记录。不要通过file://打开ES模块网站。

## 五个独立篇章

| 体系          | 新记录的互动                                                 | 本地知识与约定                                            |
| ------------- | ------------------------------------------------------------ | --------------------------------------------------------- |
| 塔罗          | 展示完整78张预洗牌背，点击原槽位直接翻出牌面，选齐三张后解读 | 完整RWS名称与正逆释义，无放回；逆位默认开启，各牌独立50%  |
| 周易·三枚铜钱 | 双面铜钱腾空翻转、落地回弹；六轮留下记录并自下而上画爻       | 64卦、384爻原文及本站白话；阳面刻乾隆通宝记3，阴面无字记2 |
| 梅花易数      | 点击梅花飘落后揭晓；计算仍用提交时冻结的问卜时刻             | 本地农历年月日時起卦，简化体用；lunar-typescript@1.8.6    |
| 数字命理      | 点击九数轮盘转动，再展开可点击的生日九宫格                   | 忽略0、保留重复；布局147／258／369，不加入四个工作数      |
| 卢恩符文      | 先从布袋摸出三石，再逐块撬开符文                             | 完整Elder Futhark 24枚，无空白符、无逆位，现代象征解释    |

默认每个体系独占一页，可通过顶部页签或右侧下一家按钮切换；手机下一家按钮位于卡片右下，避免遮挡牌阵。「查看全部」仍可比较所有结果。偏好、排序与收藏不会改变结果。周易与梅花是相关体系，不能当作独立科学证据。

塔罗整副牌在提交时只洗一次，用户点击的槽位决定实际牌，第三次选择才完成该体系解释；同一记录其他结果完全不变。周易和卢恩的结果在提交时冻结，动画只按顺序揭示。重复点击、刷新、翻页、暂停动画和StrictMode不会重新抽取。进度可恢复，未完成的动画在离开后取消，回来仍是相同牌币石。旧记录继续显示原有算法和解释。

九宫格是本站采用的现代生日数字排列约定，不声称出自毕达哥拉斯本人的古代占卜法；不作健康、智商、财富或预测评分。旧版简化个人日记录仍可恢复，不会换算成新矩阵。

## 输入与生日记忆

- 自由问题用于记录；本地模板依据主动选择的场景和模式，不用关键词冒充语义理解。模型建议另行理解用户主动发送的问题。
- 行动取舍至少两个不同选项，可添加至十个，保持顺序、否定和条件；开放探索不硬套二选一。
- 生日只用于数字命理，缺少时不影响其他体系。
- 填写生日后主动询问是否记住，只有点击同意才写入独立的`zhongbu-birthday-consent-v1`键，下次访问或再问自动填入。可随时「忘记保存的生日」，不默认勾选，不随其他偏好自动保存。
- 原始生日不进入Reading、历史、导出、反馈或模型请求。矩阵计数属于派生结果，会随用户主动保存的记录保留，不能视为匿名化数据；模型只接收精选象征主题，不接收全部格数或生日数字串。

## DeepSeek建议与连接

每家完成揭晓后可主动生成一条建议。请求只包含本次问题、选项、所选体系的结果和释义、模式／场景／目标日期，不发送其他体系、偏好、精确问卜时刻和生日字段。用户自行写在自由文本内的信息仍会发送。成功回复随手动保存的记录保留，不自动重试或重写，不参与本地规则汇总。

当前使用`deepseek-flash`、非思考模式、800输出token，提示版本`zhongbu-single-engine-2026.09.30-8`。每次只发送当前体系的结构化结果与释义，系统提示也只带本家规则，没有其他家的结果、建议或对话历史。上游省去各家共用的概括标题和主题标签，减少泛化锚定；根据本次牌位／正逆、动爻、本变、体用或数字精选释义决定方向、对象和行动强度，再给一个对应的具体做法，目标100–200字、不反问。不默认收束为「先试一点／做二十分钟」，也不为制造差异强行反对；有依据时允许相同结论。真假问题不把符号当事实证据。医疗、法律、投资、政治等不生成行动指令。这是提示词调优，没有训练权重；模型可能出错。

[官方型号页](https://api-docs.deepseek.com/quick_start/pricing/)在2026-09-29将该型号映射为DeepSeek-V4.1-Flash，本站未启用Pro。

Cloudflare Pages入口通过同源`/api/interpret`、`/api/feedback`和Service binding连接Worker，浏览器不需要访问workers.dev。GitHub Pages也可配置这两个Pages接口。这个改动消除了直连workers.dev的依赖，但不能保证中国所有运营商或网络可达；本站没有中国境内多网探针或自有域名。

模型连接使用基础AbortController与完整40秒截止时间，兼容缺少AbortSignal.any/timeout的旧手机。网络失败、超时、普通限额与24小时封禁分别提示，不会影响本地计算。

## 私有反馈与防刷

结果末尾有意见反馈。用户填写5–2000字意见，可自愿勾选附上本次问题，默认不附带。成功显示回执；失败保留表单文字。反馈没有公开读取API，不自动上传抽取记录、生日或日志。D1保存90天，每日定时清理过期数据。

站主在已授权Cloudflare的本机运行：

```sh
node worker/scripts/feedback.mjs list
node worker/scripts/feedback.mjs export
node worker/scripts/feedback.mjs delete 回执UUID
node worker/scripts/feedback.mjs clear --confirm
```

导出写入被Git忽略的`.wrangler/private-feedback/`；不要把反馈文件发布到网站或提交源码。

服务端根据Cloudflare可信来源IP的HMAC路由到同一个Durable Object，原子记录滚动60秒内的API尝试：**第61次封禁24小时**，重复请求不延长封禁，响应显示解封时间。被模型成本配额拒绝的尝试也计数，客户端换本机ID或刷新无法解除。无账号系统不能识别真实个人：同一出口IP共用额度，换IP和分布式请求无法靠这一条规则完全阻断。普通静态资源与本地占卜不计入该限制。

额外保留模型单IP6次／分钟、共享40次／分钟的成本保护；反馈限制3次／分钟、10次／24小时。共享限额采用Cloudflare原生节点近似限流，不能当作全球账单硬上限。详情见[Worker说明](worker/README.md)。

## 存储和隐私

历史仅在「保存本次」或「收藏本条」时写入本机，未保存的进度仅在当前标签页会话暂存。支持恢复、删除、清空和JSON／Markdown导出。存储受限时明确提示，当前计算仍可使用。不同浏览器、域名、设备不共享本机数据，切换两个入口时需要自行导出记录。

没有远程字体、远程图片、分析统计或跟踪脚本。自愿反馈会保存到私有服务端；Cloudflare、GitHub、DeepSeek可能处理平台自身访问日志，本站不能控制平台政策。原始生日的独立记忆与普通历史是不同存储项，清空历史不会代替「忘记生日」。

## 部署

GitHub Actions在main推送后执行依赖安装、类型检查、lint、单元测试、构建和端到端测试，再发布GitHub Pages。Actions变量`INTERPRETATION_API_URL`只存公开接口地址，建议`https://zhongbu.pages.dev/api/interpret`。

Cloudflare Pages镜像使用根目录`wrangler.jsonc`；Worker使用`worker/wrangler.jsonc`。两者部署独立，发布时需一并更新：

```sh
npm run worker:deploy
npm run build
npx wrangler pages deploy dist --project-name zhongbu --branch main
```

Pages构建可设`VITE_INTERPRETATION_API_URL=/api/interpret`使用同源接口。GitHub构建使用上面的绝对地址。生产密钥只存Worker Secret `DEEPSEEK_API_KEY`与独立的`ABUSE_HMAC_KEY`；不能放进源码、VITE变量、GitHub仓库或Pages前端。D1迁移、DO绑定和权限详见Worker说明。新版本Service Worker会在关闭旧标签页再打开后接管；历史解释不改写。

## 文件组织与来源

`src/data`知识；`src/engines`计算；`src/rules`解释与汇总；`src/lib`随机、交互状态、存储、隐私和请求；`src/components`页面；`shared`请求契约；`worker`代理、防刷、反馈存储；`functions/api`同源网关；`tests`单元及端到端测试。

详见[算法约定](docs/ALGORITHMS.md)、[来源与版权](docs/SOURCES.md)和[实际验证](docs/VALIDATION.md)。中文白话与几何美术由本站整理，不使用现代商业牌面。源码采用[MIT](LICENSE)，第三方资源保留原许可。
