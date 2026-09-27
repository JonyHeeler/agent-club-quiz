# AI 智能体 + 协会招新答题网站

面向社团招新活动的本地答题网站。支持随机抽题、题库选择和隐藏的题库调试编辑模式；可在电脑启动服务后，让同一 Wi-Fi/热点下的 iPad 访问。

## 环境要求

- Node.js（包含 npm）

## 安装与运行

```powershell
npm install
npm run build
npm run start
```

服务默认监听 `4173` 端口。电脑本机访问 [http://localhost:4173](http://localhost:4173)。局域网设备访问 `http://电脑IPv4地址:4173`；电脑与设备需处于同一网络，并允许 Node.js 通过防火墙访问。

## 题库

将 JSON 题库放在 `public/` 目录中，支持多个文件（例如 `questions1.json`）。正式答题会合并所有题库，每轮随机抽取 5 题；题库数据会随源码上传。

每份题库包含 `title` 和 `questions`；每题包含唯一 `id`、`question`、含 A、B、C、D 四个选项的 `options` 对象，以及 `answer`（`A`、`B`、`C` 或 `D`）。示例格式见 [`public/questions1.json`](public/questions1.json)，出题要求见 [`GPT出题提示词.md`](GPT出题提示词.md)。

连续点击首页协会标志三次可进入调试模式：选择题库后可试做、编辑和删除题目；保存会直接写回 `public/` 中相应文件。

## 开发与构建

- `npm run build`：使用 Vite 构建静态文件到 `dist/`。
- `npm run start`：启动 Node.js 服务，提供构建文件及题库读取/保存接口。

`dist/` 和 `node_modules/` 为本地产物，已由 `.gitignore` 排除；克隆后运行安装和构建命令即可生成。
