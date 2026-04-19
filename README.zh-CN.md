# opensource-everything

[English](./README.md)

`opensource-everything` 用来做一件事：先把一个现有产品研究清楚，再把这些研究结果变成可实现、可验证的复刻材料。

它适合这种场景：

- “我想把这个网站 / 产品流程重做一遍。”
- “我有截图和 trace，但太乱了，没法直接开做。”
- “我不想靠感觉判断像不像，我想要明确的 diff 和验证结果。”

## 它能做什么

- 把研究笔记、截图、computer-use trace 整理成结构化 reference session
- 把在线网页或本地 HTML 直接采集成结构化 reference session
- 录制脚本化浏览器 trace，输出截图、DOM 快照和 Playwright trace
- 录制 plan-driven 的 macOS 桌面 trace，输出截图和标准化 session
- 生成 Markdown 和 JSON 两种 clone spec
- 生成 smoke flow、copy check、state coverage、visual check 这些 fixtures
- 根据 session / fixture plan 生成 Playwright 测试
- 根据捕获到的 session 直接生成 candidate manifest
- 生成 clone loop 工作目录，把 spec、测试和验证输入都准备好
- 直接抓运行中的 candidate URL，并一键做 diff + verify
- 自带一个可选的 Markdown 编辑器模板包
- 用 `pixelmatch` 做 PNG 截图 diff
- 对 candidate build 做一致性验证
- 自带 skills 和 MCP tools，可直接给 Codex / Claude Code 用

核心引擎保持通用。桌面端的产品特定流程、步骤和检查项，应该由模型在运行时根据目标产品生成 plan，而不是写死在引擎里。

## 安装

```bash
npm install
```

## 在 Codex 里用

这个仓库已经把 Codex 需要的东西都带上了：

- `.codex-plugin/plugin.json`
- `.mcp.json`
- `skills/`

把仓库根目录加成 Codex 的本地插件之后，就可以直接这样用：

- “总结这份 trace，并生成 fixtures。”
- “把这个 reference session 整理成 clone spec。”
- “对照 reference 检查我的实现。”

## 在 Claude Code 里用

同一个仓库也可以直接当 Claude plugin 和 Claude marketplace 用。

本地校验：

```bash
claude plugin validate .
```

把这个仓库加成 marketplace，然后安装插件：

```bash
claude plugin marketplace add .
claude plugin install opensource-everything@opensource-everything-marketplace
```

如果仓库已经放到 GitHub，上面的 `.` 也可以直接换成 `owner/repo`。

## 典型工作流

1. 收集目标产品的截图、文档、流程说明
2. 保存成 reference session 或 computer-use trace
3. 运行 `summarize-trace` 看证据够不够
4. 运行 `generate-fixtures` 生成可复用探针
5. 运行 `spec` 生成 clone spec
6. 开始实现
7. 用 `diff` 和 `verify` 看哪里还没对齐

## 工具

内置 MCP server 提供导入、采集、trace、spec、diff、验证和模板相关工具，包括：

- `capture_web_reference`
- `record_web_trace`
- `record_desktop_trace`
- `check_desktop_permissions`
- `plan_capture`
- `generate_playwright_tests`
- `generate_candidate_manifest`
- `verify_live_web_clone`
- `plan_repair`
- `scaffold_clone_loop`
- `scaffold_editor_loop`
- `verify_editor_clone`

## Skills

仓库里自带两个 skill：

- `computer-use-research`
- `opensource-everything`

大多数时候直接用 skill 就够了，底下的 tool 让 agent 自己调。

## CLI

查看帮助：

```bash
node ./src/cli.js --help
```

列出工具：

```bash
node ./src/cli.js tools
```

列出 skills：

```bash
node ./src/cli.js skills
```

生成 trace 摘要：

```bash
node ./src/cli.js summarize-trace ./examples/computer-use-trace.json --out ./output/trace-demo
```

采集网页：

```bash
node ./src/cli.js capture-web --url https://example.com --out ./output/web-demo
```

录制脚本化 web trace：

```bash
node ./src/cli.js record-web-trace --plan ./examples/web-trace-plan.json --out ./output/record-web-demo
```

检查桌面 trace 权限：

```bash
node ./src/cli.js check-desktop-permissions
```

生成精简的采集计划：

```bash
node ./src/cli.js plan-capture --session ./examples/reference-session.json --goal "覆盖 signup 路径" --out ./output/capture-plan-demo
```

录制 plan-driven 的桌面 trace：

```bash
node ./src/cli.js record-desktop-trace --plan ./examples/desktop-trace-plan.json --approve-app TextEdit --out ./output/desktop-trace-demo
```

桌面 trace 依赖 macOS 的 Automation、Accessibility 和 Screen Recording 授权。权限检查更像 preflight，不代表当前宿主一定会放行所有按键注入或截图。

这也是一个比普通网页采集更高风险的模式。它可以查看实时桌面状态、驱动别的 app，还会落盘截图，所以应该只在明确需要时、用尽量窄的 plan 去跑。

现在桌面 trace 还多了两道闸门：

- plan 或调用参数里要有 app 白名单
- 真正操纵某个 app 前，调用时还要显式传入用户同意的 app 名单

从 trace 生成 fixtures：

```bash
node ./src/cli.js generate-fixtures --trace ./examples/computer-use-trace.json --out ./output/trace-demo
```

生成 Playwright 测试：

```bash
node ./src/cli.js emit-playwright --session ./output/reference-demo --candidate-base-url http://localhost:3000 --out ./output/playwright-demo
```

生成 clone spec：

```bash
node ./src/cli.js spec ./output/reference-demo
```

生成 candidate manifest：

```bash
node ./src/cli.js candidate-manifest ./output/reference-demo
```

验证 candidate build：

```bash
node ./src/cli.js verify ./output/reference-demo ./examples/candidate-manifest.json
```

生成精简的修补计划：

```bash
node ./src/cli.js plan-repair --reference ./examples/reference-session.json --candidate ./examples/candidate-manifest.json --out ./output/repair-plan-demo
```

对比 candidate 截图：

```bash
node ./src/cli.js diff ./output/reference-demo ./examples/candidate-manifest.json
```

生成 clone loop 工作目录：

```bash
node ./src/cli.js clone-loop ./output/reference-demo --candidate-base-url http://localhost:3000 --out ./output/clone-loop
```

验证运行中的 web candidate：

```bash
node ./src/cli.js verify-live-web ./output/reference-demo --candidate-url http://localhost:3000 --out ./output/live-web-verify
```

生成可选的 Markdown 编辑器模板包：

```bash
node ./src/cli.js editor-loop --product "Markdown Editor Template" --out ./output/editor-loop
```

验证 Markdown 编辑器模板的 candidate manifest：

```bash
node ./src/cli.js verify-editor ./output/editor-loop/editor-loop/reference/editor-fixtures.json ./output/editor-loop/editor-loop/candidate-editor-manifest.json
```

## 你最可能关心的文件

- `src/` - 核心实现
- `skills/` - 自带 skills
- `.codex-plugin/plugin.json` - Codex 插件信息
- `.claude-plugin/plugin.json` - Claude 插件信息
- `.claude-plugin/marketplace.json` - Claude marketplace 入口
- `docs/desktop-trace-plans.md` - 桌面 trace 引擎为什么保持通用
- `examples/` - 示例输入

## 发布前看看这些

- [CHANGELOG.md](./CHANGELOG.md)
- [docs/release-checklist.md](./docs/release-checklist.md)
