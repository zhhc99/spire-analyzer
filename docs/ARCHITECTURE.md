# spire-analyzer 架构

## 总览

spire-analyzer 采用 `index.html + 原生 ESM + Node ESM` 的轻量架构.

- `src/core/` 负责 `.run` 解析, 规范化, 文案组装, Spire Codex 数据读取
- `src/cli/` 负责命令行输入, history 定位, 终端渲染
- `src/web/` 负责文件导入, 状态切换, DOM 渲染
- `index.html` 提供纯前端页面壳和样式

## 目录结构

```text
.
├─ index.html                 # Web 页面壳与样式
├─ package.json               # npm scripts
├─ scripts/
│  └─ build.mjs               # 静态拷贝到 dist/
├─ src/
│  ├─ core/
│  │  ├─ config.js            # API 常量, 角色主题, 通用配置
│  │  ├─ i18n.js              # 中英文文案与格式化
│  │  ├─ api.js               # Spire Codex 请求与回退
│  │  └─ report.js            # .run 解析, 规范化, 报告模型
│  ├─ cli/
│  │  └─ main.js              # CLI 参数, history 发现, 文本输出
│  └─ web/
│     ├─ main.js              # Web 状态与事件
│     └─ render.js            # Web DOM 渲染
├─ dist/
│  ├─ web/                    # Web build 输出
│  │  ├─ index.html
│  │  └─ src/
│  └─ cli/                    # CLI build 输出
│     ├─ main.js
│     └─ core/
└─ docs/
   ├─ RULES.md
   ├─ ARCHITECTURE.md
   └─ codex/
      └─ run-notes.md
```

## 构建

- `npm run build`
  输出 `dist/web/` 和 `dist/cli/`
- `npm run cli -- analyze <path>`
  分析指定 `.run`
- `npm run cli -- latest`
  从本机 history 中定位最新 `.run`
- `npm run web`
  启动本地静态文件服务

## 约束

- 不引入框架
- 不引入运行时依赖
- CLI 和 Web 只消费共享 `core` 产出的报告对象
- `dist/web` 和 `dist/cli` 分开输出
- 允许 Spire Codex 请求失败后回退到英文或原始 ID
