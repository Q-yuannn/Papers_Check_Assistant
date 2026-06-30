# 论文查询助手 (Papers Check Assistant)

基于 Dify Workflow API 的智能论文查询助手，支持流式对话交互。

## ✨ 功能特性

- 🔍 **智能论文查询**：通过 Dify AI 工作流，输入关键词即可获取相关论文信息
- 💬 **流式响应**：基于 SSE（Server-Sent Events）实时流式输出，无需等待完整结果
- 📝 **Markdown 渲染**：助手回复支持富文本格式（标题、列表、代码块、表格等）
- 🎨 **现代化 UI**：渐变紫色主题，响应式设计，支持移动端
- ⌨️ **快捷键支持**：Enter 发送消息，Shift+Enter 换行

## 🛠 技术栈

| 模块 | 技术 |
|------|------|
| 前端框架 | React 18 |
| Markdown 渲染 | react-markdown |
| 后端代理 | Express (Node.js) |
| API 对接 | Dify Workflow API (SSE 流式) |
| 样式方案 | 原生 CSS |

## 📁 项目结构

```
paper-query-assistant/
├── server/
│   └── index.js          # Express 后端代理服务（端口 3001）
├── src/
│   ├── App.js            # React 主组件
│   ├── App.css           # 样式文件
│   └── index.js          # React 入口
├── public/
│   └── index.html        # HTML 模板
├── package.json
└── .gitignore
```

## 🚀 快速开始

### 环境要求

- Node.js >= 18
- npm >= 8

### 安装与运行

```bash
# 1. 克隆仓库
git clone https://github.com/Q-yuannn/Papers_Check_Assistant.git
cd Papers_Check_Assistant

# 2. 安装依赖
npm install

# 3. 启动项目（同时启动前后端）
npm run dev
```

启动后：
- 前端页面：http://localhost:3000
- 后端代理：http://localhost:3001

### 单独启动

```bash
# 仅启动后端代理
npm run server

# 仅启动前端
npm run client
```

## 🔧 API 架构

```
浏览器 (React)                   后端代理 (Express)                Dify Cloud
    │                                │                               │
    │  POST /api/workflows/run       │                               │
    │  {"query": "论文关键词"}        │  POST /v1/workflows/run       │
    │ ──────────────────────────────>│  {"inputs":{"keyword":"..."}} │
    │                                │ ─────────────────────────────>│
    │                                │                               │
    │                                │    SSE stream (text/event-stream)
    │                                │ <─────────────────────────────│
    │    SSE stream (转发)            │                               │
    │ <──────────────────────────────│                               │
    │                                │                               │
```

- **安全设计**：API Key 仅存储在后端代理服务中，不暴露给前端
- **流式转发**：后端实时转发 Dify 的 SSE 流，前端逐字显示结果

## 📝 使用说明

1. 在输入框中输入论文主题或研究方向关键词
2. 按 `Enter` 发送查询
3. 等待 AI 工作流处理并流式返回结果
4. 点击「+ 新查询」清空对话历史

## ⚠️ 注意事项

- API Key 已配置在 `server/index.js` 中，如需更换请在文件中修改 `DIFY_API_KEY`
- Workflow 的输入变量名为 `keyword`，可通过 `GET /api/parameters` 查看应用参数

## 📄 License

MIT
