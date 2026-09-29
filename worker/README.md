# 众卜模型解读代理

静态前端保留本地基础解读；用户明确选择某一体系并触发后，才调用这个 Worker。它只转发给固定的 DeepSeek Chat Completions 地址，不接受客户端模型名、上游 URL、系统提示或 token 配置。密钥仅使用 Cloudflare 的 `DEEPSEEK_API_KEY` secret。

## 部署

在仓库根目录使用已安装的 Wrangler（需要 4.36.0 或更新版）：

```sh
npx wrangler login
npx wrangler deploy --dry-run --config worker/wrangler.jsonc
npx wrangler secret put DEEPSEEK_API_KEY --config worker/wrangler.jsonc
npx wrangler deploy --config worker/wrangler.jsonc
```

`secret put` 在终端的隐藏输入提示中录入密钥；也可以在 Cloudflare 控制台的 Worker → Settings → Variables and Secrets 中添加同名 Secret。不要把真实密钥写进命令参数、仓库、`.env`、前端构建变量或聊天中。Worker 名称为 `zhongbu-ai`，配置不含账号 ID 或凭据。由部署命令输出的公开 Worker URL 加上 `/interpret`，作为前端公开的代理地址。GitHub Pages 的部署与此 Worker 独立。

生产环境仅允许 `https://loverxy1205-hub.github.io` 的浏览器来源。开发只运行 `npx wrangler dev --local --env development --config worker/wrangler.jsonc`；开发环境额外接受 localhost／127.0.0.1 的 5173、5174、4173 端口，不应公开部署。单元测试使用假 fetch 与假环境值，不需账号、密钥或联网调用模型。

## 约束与数据

- `/interpret` 接受 POST JSON 和必要的 OPTIONS 预检；拒绝缺失 Origin、其他来源／路径／方法和额外字段。响应均为 `no-store`。
- 请求契约位于 `shared/ai-contract.ts`，最大 64 KiB。新界面在用户主动生成时，默认发送问题与单体系结果，行动模式还发送按原顺序保存的全部选项（2–10 项，每项最多 300 字、不能全为空白，去掉首尾空白后不能完全相同），以及模式、场景、目标日。新请求不发送类别；契约仍接受旧客户端的可选类别、单一行动和没有选项的请求。客户端通过字段白名单生成 `rawSummary`，不发送生日、生日中间加数、问卜精确时刻、其他引擎或偏好。结构校验不能识别用户自行写入自由文本的私人信息，界面应让用户在发送前检查。`buildAiRequest` 仍支持显式传入 `false` 排除问题、行动、选项及可能内嵌这些文字的反思段落。
- 系统提示版本为 `zhongbu-single-engine-2026.09.29-5`。只输出「解析：」「建议：」两个小段，目标合计约 100–200 个中文字符。普通日常选择在第一句明确建议做、不要做或选哪项，再联系本次真实 evidence 的结构与释义解释理由，最后给一个小步骤；不把所有选项并列推回用户、不反问、不用若／否则分支回避结论。多选项完整传入，建议原样引用选中的一项，保留否定与条件；较长原文允许略超篇幅。同一份冻结结果用于权衡矛盾线索：塔罗需考虑牌位与正逆位语义，卢恩考虑位置作用，周易按实际动爻／本变关系（多个动爻综合权衡，不择有利爻迎合立场），梅花按体用关系，数字以个人日为主、其余派生值作背景，不能只报名字或另套断法；阻力位不能直接当行动建议，正逆位不机械等于好坏。提示词包含少量明确标为假设的正反例，禁止借用不属于本次结果的示例证据。
- 明确建议仍只属于模型延伸：事实真假、诊断或他人隐藏内心不能拿符号证明；普通真假问题可明确建议核实原始通知等具体行动，并简短说明符号不能证实真伪，不一律劝人别信，也不能用随机符号推翻已给的可靠现实信息。医疗／法律／投资／政治不提供行动指令。自由文本和 evidence 均作为数据处理，注入指令不能覆盖系统要求，原始抽取、冻结解释和原文不能改写。此次是提示词调优，没有训练或微调模型，不是事实预测。单元测试检查送出的提示契约与原始证据，不等同于验证真实模型每次都会遵守；真实输出质量需单独评估。
- 上游固定为 `https://api.deepseek.com/chat/completions`，模型由服务端变量 `DEEPSEEK_MODEL` 决定，默认配置 `deepseek-flash`；非流式、关闭 thinking、最多 800 输出 token、25 秒超时、不自动重试。字符目标由提示词约束，token 上限留有余量，但不能保证模型每次遵守篇幅或格式。代理不截字、不改写完整回复；若上游 `finish_reason` 为 `length`，仍拒绝不完整回复并返回 `UPSTREAM_RESPONSE_INVALID`，不会保存被截断的建议。上游错误、响应体和凭据不会回显。客户端把 `text` 当普通文本渲染，不解释成 HTML。
- 代码不记录请求内容或请求头，不写数据库或缓存，关闭 Workers Observability。Cloudflare／DeepSeek 仍处理传输与请求，本站不能承诺控制平台自身的日志和数据政策。
- 上游失败响应附带固定枚举 `code` 和可选数字 `upstreamStatus`，用于区分请求传输、HTTP 拒绝、响应读取、JSON／结构校验或超时；不返回异常消息、上游内容或任何凭据。Secret 使用前仅清理首尾空白，兼容录入时附带的换行。

每 IP 6 次／分钟，可容纳五体系各一次；另有共享键 40 次／分钟的 Cloudflare 原生限流；binding 缺失或失败时拒绝模型请求。限流按 Cloudflare 节点分别执行，最终一致，**不是精确全球限额或账单硬上限**。CORS 约束浏览器访问，不是调用身份认证；知道端点的人可以在浏览器外伪造 Origin。请结合 DeepSeek 账户可用的余额／预算控制管理费用；若公开流量增加，可再添加 Turnstile 或身份验证。Cloudflare 免费套餐有使用额度，DeepSeek API 独立计费。

核验文档（2026-09-29）：[DeepSeek 首次调用与模型名](https://api-docs.deepseek.com/guides/harness)、[Chat Completions 参数](https://api-docs.deepseek.com/api/create-chat-completion/)、[thinking 开关](https://api-docs.deepseek.com/guides/thinking_mode/)、[Cloudflare 原生限流及其准确性](https://developers.cloudflare.com/workers/runtime-apis/bindings/rate-limit/)。

## 检查

```sh
npx vitest run tests/worker.test.ts
npx wrangler deploy --dry-run --config worker/wrangler.jsonc
```

测试不会真实调用 DeepSeek。其中一项使用 Wrangler 锁定的 Miniflare／workerd 运行真正的 Worker 代码，并以原生 `Request` 构造全部上游参数，覆盖 Node mock 无法发现的平台兼容性差异；不执行外部 fetch。上游使用 `redirect: "manual"`，所有 3xx 都被拒绝，凭据不会转发到重定向目标。真实密钥配置和最终部署由操作者在 Cloudflare 中完成。
