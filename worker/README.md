# 众卜2.0.1模型代理与私有反馈

十个篇章的基础流程都在静态前端本地完成。只有原有塔罗、周易、梅花、数字和卢恩在用户主动触发后调用模型；新增地占、咖啡、Ifá、掷筊与灼甲没有模型入口，AI请求契约拒绝这五个ID。Worker只转发给固定的 DeepSeek Chat Completions 地址，不接受客户端模型名、上游 URL、系统提示或 token 配置。密钥仅使用 Cloudflare 的 `DEEPSEEK_API_KEY` secret。私有反馈独立接受全部十个篇章，不调用模型。

## 部署

在仓库根目录使用锁文件安装的Wrangler。下面是**新建环境**的初始化步骤；已有生产数据库不要重新创建，先执行后文升级步骤：

```sh
npx wrangler login
npx wrangler d1 create zhongbu-feedback --config worker/wrangler.jsonc
# 将创建结果的 database_id 写入 worker/wrangler.jsonc 生产 FEEDBACK_DB。
npx wrangler d1 migrations apply FEEDBACK_DB --remote --config worker/wrangler.jsonc
npx wrangler deploy --dry-run --config worker/wrangler.jsonc
npx wrangler secret put DEEPSEEK_API_KEY --config worker/wrangler.jsonc
npx wrangler secret put ABUSE_HMAC_KEY --config worker/wrangler.jsonc
npx wrangler deploy --config worker/wrangler.jsonc
```

### 已有环境升级2.0

`0002_feedback_experiences.sql`扩充反馈的engine CHECK约束为十个ID，通过创建新表、完整复制旧字段、替换旧表和重建时间索引实现。迁移先于新Worker部署，不能直接跳过数据库升级。

1. 运行`node worker/scripts/feedback.mjs export`，确认生成的私有JSON可以读取；文件在Git忽略的`.wrangler/private-feedback/`，不要打印反馈正文、提交Git或放进静态产物。
2. 用下列只读查询取得迁移前行数，与导出JSON中实际反馈记录数核对一致。保留原字段数据，用于迁移后逐条核对；正在接收新反馈时需辨认新写入，不能把新增行误判为数据损坏。
3. 应用迁移，再查询行数并检查原回执及全部字段保留。检查任一失败先停止部署并调查，不清空反馈表重建。
4. 完成核对后dry-run、部署Worker，再发布Pages前端。新旧五体系模型参数及Secret不需因反馈迁移而更改。

```sh
node worker/scripts/feedback.mjs export
npx wrangler d1 execute FEEDBACK_DB --remote --config worker/wrangler.jsonc --command "SELECT count(*) AS total FROM feedback"
npx wrangler d1 migrations apply FEEDBACK_DB --remote --config worker/wrangler.jsonc
npx wrangler d1 execute FEEDBACK_DB --remote --config worker/wrangler.jsonc --command "SELECT count(*) AS total FROM feedback"
npx wrangler deploy --dry-run --config worker/wrangler.jsonc
npm run worker:deploy
```

实际备份、迁移、部署及线上验证的执行记录统一见[验证记录](../docs/VALIDATION.md)，本节是操作顺序，不以命令存在代替执行结果。

`secret put` 在终端的隐藏输入提示中录入密钥；也可以在 Cloudflare 控制台的 Worker → Settings → Variables and Secrets 中添加同名 Secret。`ABUSE_HMAC_KEY` 使用独立生成、至少 32 字节的密码学随机秘密，不使用生日、问题或 DeepSeek 密钥；保持稳定，轮换它会改变限流身份。不要把真实密钥写进命令参数、仓库、`.env`、前端构建变量或聊天中。Worker 名称为 `zhongbu-ai`，配置不含账号 ID 或凭据。由部署命令输出的公开 Worker URL 加上 `/interpret`，作为前端公开的代理地址。GitHub Pages 的部署与此 Worker 独立。初次加入 D1／Pages 时，旧 OAuth 授权若缺少 `d1:write`／`pages:write`，需要重新登录授权；权限缺失时不要把未部署功能说成已上线。

生产环境仅允许 `https://loverxy1205-hub.github.io` 和 `https://zhongbu.pages.dev` 的浏览器来源，不泛化允许任意 Pages 预览域名。Pages 同源 `/api` 可经 Service binding 访问此 Worker，保留平台提供的 CF-Connecting-IP 和原 Origin；浏览器无需连接 workers.dev。它不保证中国所有运营商均可访问 pages.dev，需真实用户网络验证。开发先运行 `npx wrangler d1 migrations apply FEEDBACK_DB --local --env development --config worker/wrangler.jsonc`，再运行 `npx wrangler dev --local --env development --config worker/wrangler.jsonc`；开发环境额外接受 localhost／127.0.0.1 的 5173、5174、4173 端口，不应公开部署。开发 HMAC 常量仅供本地，禁止用于生产。单元测试使用假 fetch 与假环境值，不需账号、密钥或联网调用模型。

## 约束与数据

- `/interpret` 与 `/feedback` 接受 POST JSON 和必要的 OPTIONS 预检；拒绝缺失 Origin、其他来源／路径／方法和额外字段。响应均为 `no-store`。
- 请求契约位于 `shared/ai-contract.ts`，最大 64 KiB。新界面在用户主动生成时，默认发送问题与单体系结果，行动模式还发送按原顺序保存的全部选项（2–10 项，每项最多 300 字、不能全为空白，去掉首尾空白后不能完全相同），以及模式、场景、目标日。新请求不发送类别；契约仍接受旧客户端的可选类别、单一行动和没有选项的请求。客户端通过字段白名单生成 `rawSummary`，不发送生日、生日中间加数、问卜精确时刻、其他引擎或偏好。结构校验不能识别用户自行写入自由文本的私人信息，界面应让用户在发送前检查。`buildAiRequest` 仍支持显式传入 `false` 排除问题、行动、选项及可能内嵌这些文字的反思段落。
- 系统提示版本为 `zhongbu-single-engine-2026.09.30-11`，公共提示在`src/advice-prompt.ts`，各家专用规则仍在`src/index.ts`。一次[JSON模式](https://api-docs.deepseek.com/guides/json_mode/)调用返回短解析、依据索引、建议类别、选项索引、行动与执行安排；`src/advice-output.ts`严格校验字段、依据无重复／不越界／数量，以及行动模式的有效原选项。外部AiResponse仍返回「解析：」「建议：」两个纯文本短段，目标100–200字；行动选项从原请求按索引原样呈现。非法输出返回`UPSTREAM_OUTPUT_REJECTED`，不自动重试、不作固定建议兜底。引用合法不等于含义正确，也不能机械验证下一步与结论是否矛盾。
- 每次只有公共约束与当前体系专属规则，以及一条独立用户消息；不发送其他家的结果、回复、偏好或历史对话。上游evidence保留methodVersion、rawSummary、paragraphs和traditional，省去共用headline/themes及reflection；旧记录兼容。普通日常问题先以本次结构说明依据，再选完整行动并给相应安排，不把休整一律移到课后，不把推进一律当作服从／出勤，也不为迎合用户强答可以。公共提示有一对合成聚会示例，与随机组／诊断牌阵不同；示例不是当前牌，不能补进当前解释。塔罗按牌位和正逆，卢恩按三位置，周易按实际动爻／本变，梅花按体用；矩阵只用精选释义，不补算次数、缺位或个人日，旧个人日仍以个人日为主。阻力不能直接当行动建议，有依据的相同方向允许保留。
- 明确建议仍只属于模型延伸：事实真假、诊断或他人隐藏内心不能拿符号证明；普通真假问题可明确建议核实原始通知等具体行动，并简短说明符号不能证实真伪，不一律劝人别信，也不能用随机符号推翻已给的可靠现实信息。医疗／法律／投资／政治不提供行动指令。自由文本和 evidence 均作为数据处理，注入指令不能覆盖系统要求，原始抽取、冻结解释和原文不能改写。此次是提示词调优，没有训练或微调模型，不是事实预测。单元测试检查送出的提示契约与原始证据，不等同于验证真实模型每次都会遵守；真实输出质量需单独评估。
- 上游固定为 `https://api.deepseek.com/chat/completions`，模型由服务端变量 `DEEPSEEK_MODEL` 决定，默认配置 `deepseek-flash`；非流式、关闭 thinking、`response_format: {type: "json_object"}`、最多800输出token、25秒超时、不自动重试。字符目标由提示词约束，不能保证每次遵守篇幅或语义。代理不截字；若上游`finish_reason`为`length`，仍拒绝不完整回复并返回`UPSTREAM_RESPONSE_INVALID`。格式化只组合通过校验的字段，并在行动模式呈现原选项，不增加第二次模型调用。上游错误、响应体和凭据不会回显；解析前与JSON解码后均阻止配置密钥出现在回复中。客户端把`text`当普通文本渲染，不解释成HTML。
- 模型请求与回复不记录内容、不写数据库或缓存，关闭 Workers Observability。主动反馈才写 D1，限流只保存匿名身份和有界时间戳，详情见下文。Cloudflare／DeepSeek 仍处理传输与请求，本站不能承诺控制平台自身的日志和数据政策。
- 上游失败响应附带固定枚举 `code` 和可选数字 `upstreamStatus`，用于区分请求传输、HTTP 拒绝、响应读取、JSON／结构校验或超时；不返回异常消息、上游内容或任何凭据。Secret 使用前仅清理首尾空白，兼容录入时附带的换行。

提示词-9对普通日常行动不预设推进／出勤高于休整／拒绝。保持原问题的否定和期限，未明示长期范围时按目标日理解，不凭词语自动判不宜或强迫答可以；建议不等同学校／单位许可，不虚构出勤规定、假期或用户身体状态。此项不修改第5条专业／政治边界，也不更改限流和模型参数。真实原问题对照见根目录 `docs/VALIDATION.md`；测试并不保证模型在每次输出中都遵守这些要求。

## 防刷与封禁

`ABUSE_GUARD` 是 SQLite Durable Object，按 Cloudflare 可信 `CF-Connecting-IP` 的 HMAC 匿名键全局路由；不接受 X-Forwarded-For、不依赖浏览器可清除的计数。事务内维护滚动 `(当前时刻−60秒, 当前时刻]` 窗口。有效来源访问已知 API 的所有 POST 尝试先计数，再检查格式、业务字段与较低成本配额。因此无效正文、被配额拒绝的脚本请求同样会计数；第 61 次起封禁 24 小时，期间重复请求不会延长封禁。返回 `ABUSE_BLOCKED`、ISO `blockedUntil`、`retryAfterSeconds` 和 `Retry-After`；解封按精确时刻，不是午夜清零。限流状态到期后由 alarm 删除，缺失绑定、HMAC 配置或存储异常时拒绝在线请求。

另在同一 Durable Object 内保持模型每 IP 滚动 6 次／分钟，以及反馈每 IP 3 次／分钟、10 次／24 小时；这些限额返回 `RATE_LIMITED`，不会仅因第 7 次模型调用就封一天。原有 Cloudflare 节点级每 IP 6 次、共享 40 次／分钟作为额外成本保护保留，后者仍是最终一致，**不是全局账单硬上限**。未登录服务用网络 IP 近似用户：同一校园／公司／家庭出口会共享额度，换 IP 或分布式脚本仍可能绕过个人约束，不能声称已识别独立自然人。封禁仅影响模型与反馈，十个篇章的本地流程仍可用。

CORS 是浏览器来源限制，不是身份认证；浏览器外可伪造 Origin。Cloudflare 免费资源有平台额度，DeepSeek API 独立计费；仍应使用服务商余额／预算控制管理费用。

## 私有反馈与管理

`POST /feedback` 契约见 `shared/feedback-contract.ts`，正文最大 16 KiB。必须显式填写 kind 和 5–2000 字 message，用户主动勾选后才附 question，engine／appVersion 可选；不接受生日、完整记录、IP、偏好或额外字段。D1 只保存这些字段及服务端 UUID 回执、接收时刻，不自动收集用户的问题。自由文本中的用户自填私人信息无法靠结构校验识别，界面需提示不要提交敏感信息。成功返回 201 `{id,receivedAt}`，数据库失败返回固定错误，不假报已保存；不需要 DeepSeek 密钥，不调用模型。没有公开读取或管理接口，页面不展示其他用户反馈。

2.0的反馈engine白名单为`tarot / iching / meihua / numerology / runes / geomancy / coffee / ifa / jiaobei / oracle`；AI白名单仍只有前五个。新增篇章的随机参数、咖啡观察缓存、Ifá签名和灼甲事后记录继续只存本机，反馈不会自动附带这些内容。

反馈在活动数据库中保留最多约 90 天：每天 UTC 03:17 的 scheduled handler 删除早于 90 天的行；平台备份／恢复保留规则由 Cloudflare 控制。所有 SQL 参数化。管理员通过已经授权的本机 Wrangler 查看、导出或删除：

```sh
node worker/scripts/feedback.mjs list
node worker/scripts/feedback.mjs export
node worker/scripts/feedback.mjs delete 回执UUID
node worker/scripts/feedback.mjs clear --confirm
```

`list` 仅显示最近 100 条；`export` 导出 UTF-8 JSON 到仓库忽略的 `.wrangler/private-feedback/`，不要把该文件放入 public、提交到 GitHub 或发给其他用户。delete 只删除对应回执，clear 是管理员显式清空。

核验文档（2026-09-29）：[DeepSeek 首次调用与模型名](https://api-docs.deepseek.com/guides/harness)、[Chat Completions 参数](https://api-docs.deepseek.com/api/create-chat-completion/)、[thinking 开关](https://api-docs.deepseek.com/guides/thinking_mode/)、[Cloudflare 原生限流及其准确性](https://developers.cloudflare.com/workers/runtime-apis/bindings/rate-limit/)、[Durable Object 事务存储](https://developers.cloudflare.com/durable-objects/api/sqlite-storage-api/)、[Pages Service binding](https://developers.cloudflare.com/pages/functions/bindings/)、[Durable Objects 免费套餐](https://developers.cloudflare.com/durable-objects/platform/pricing/)。

## 检查

```sh
npx vitest run tests/worker.test.ts tests/worker-abuse-feedback.test.ts
npx wrangler deploy --dry-run --config worker/wrangler.jsonc
```

测试不会真实调用 DeepSeek。使用 Wrangler 锁定的 Miniflare／workerd 运行真正的 Worker 代码，一项以原生 `Request` 构造全部上游参数，另一项同时运行 SQLite DO 与 D1，验证并发请求第 61 次封禁、成本拒绝仍计数、不同 IP 隔离和私有反馈写入；覆盖 Node mock 无法发现的平台兼容性差异。上游使用 `redirect: "manual"`，所有 3xx 都被拒绝，凭据不会转发到重定向目标。真实密钥配置和最终部署由操作者在 Cloudflare 中完成。
