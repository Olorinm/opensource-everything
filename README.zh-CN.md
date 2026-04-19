# opensource-everything

[English](./README.md)

把一个现有产品采下来，整理成可开发的材料，再拿你的实现去和 reference 做对照。

## 它能做什么

- 把网页、本地 HTML、截图和 trace 整理成结构化 reference session
- 录制浏览器流程，保存截图、DOM 快照和 Playwright trace
- 录制 plan-driven 的 macOS 桌面流程，输出截图和标准化 session
- 生成 clone spec、fixtures、candidate manifest 和 Playwright 测试
- 对 candidate build 做截图 diff 和一致性验证

桌面采集引擎保持通用。产品相关的步骤应该放在 runtime plan 里，不应该写死在引擎中。

## 安装

```bash
npm install
```

## 快速开始

先看当前有哪些工具：

```bash
node ./src/cli.js tools
```

采一个网页：

```bash
node ./src/cli.js capture-web --url https://example.com --out ./output/web-demo
```

生成一份精简的采集计划：

```bash
node ./src/cli.js plan-capture --session ./examples/reference-session.json --goal "覆盖 signup 路径" --out ./output/capture-plan-demo
```

验证一个 candidate：

```bash
node ./src/cli.js verify ./examples/reference-session.json ./examples/candidate-manifest.json --out ./output/verify-demo
```

## 常用命令

```bash
node ./src/cli.js tools
node ./src/cli.js skills
node ./src/cli.js capture-web --url <url> --out <dir>
node ./src/cli.js record-web-trace --plan <plan.json> --out <dir>
node ./src/cli.js check-desktop-permissions
node ./src/cli.js record-desktop-trace --plan <plan.json> --approve-app <AppName> --out <dir>
node ./src/cli.js summarize-trace <trace.json> --out <dir>
node ./src/cli.js generate-fixtures --session <session> --out <dir>
node ./src/cli.js emit-playwright --session <session> --candidate-base-url <url> --out <dir>
node ./src/cli.js spec <session> --out <dir>
node ./src/cli.js candidate-manifest <session> --out <file>
node ./src/cli.js diff <session> <candidate-manifest.json> --out <dir>
node ./src/cli.js verify <session> <candidate-manifest.json> --out <dir>
node ./src/cli.js plan-repair --reference <session> --candidate <candidate-manifest.json> --out <dir>
```

## 桌面采集

桌面采集需要：

- macOS Automation
- Accessibility
- Screen Recording

并且还有两道运行时闸门：

- app 必须在 allowlist 里
- app 必须在本轮调用时被显式批准

示例：

```bash
node ./src/cli.js record-desktop-trace \
  --plan ./examples/desktop-trace-plan.json \
  --approve-app TextEdit \
  --out ./output/desktop-trace-demo
```

## 在 Codex 里用

这个仓库已经带上了 Codex 需要的文件：

- `.codex-plugin/plugin.json`
- `.mcp.json`
- `skills/`

把仓库根目录加成 Codex 的本地插件即可。

## 在 Claude Code 里用

这个仓库也可以直接作为 Claude plugin 和 marketplace 包使用。

本地校验：

```bash
claude plugin validate .
```

添加并安装：

```bash
claude plugin marketplace add .
claude plugin install opensource-everything@opensource-everything-marketplace
```

如果仓库已经放到 GitHub，上面的 `.` 可以换成 `owner/repo`。

## 内置工具

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

## 内置 skills

- `computer-use-research`
- `opensource-everything`

## 仓库结构

- `src/` - 核心实现
- `skills/` - 自带 skills
- `examples/` - 示例输入
- `docs/` - 说明和适配器文档
- `.codex-plugin/` - Codex 插件元数据
- `.claude-plugin/` - Claude 插件和 marketplace 元数据

## 说明

- `editor-loop` 只是一个可选的 Markdown 编辑器模板，不是内建产品流程
- `plan_capture` 和 `plan_repair` 默认只写简短计划文件
- 演示产物默认写到 `output/`，这个目录不会进入 git
