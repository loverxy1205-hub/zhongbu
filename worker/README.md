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
- 系统提示版本为 `zhongbu-single-engine-2026.09.29-3`。模型先回应实际问题；行动模式用同一份冻结结果，按原序号逐项比较条件、代价和可实行的小步骤，可以提出普通日常范围内清晰的有条件建议。选项完整传入且保留否定，回答用原序号和准确的原文要点对应选项，不要求重复长段全文。没有足够现实信息时说明缺口与可核实的条件，不编造个人事实。自由文本和 evidence 均作为数据处理，模型不得改写原始结果、伪造原文、反转否定或给出医疗／法律／投资／政治行动指令。输出仍为独立的模型扩展，不是事实预言；提示约束并不能保证模型永不出错，模型内容不得覆盖本地冻结记录。
- 上游固定为 `https://api.deepseek.com/chat/completions`，模型由服务端变量 `DEEPSEEK_MODEL` 决定，默认配置 `deepseek-flash`；非流式、关闭 thinking、最多 1800 输出 token、25 秒超时、不自动重试。上游错误、响应体和凭据不会回显。客户端把 `text` 当普通文本渲染，不解释成 HTML。
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
