const express = require('express');
const cors = require('cors');

const app = express();
app.use(cors());
app.use(express.json());

// Dify API 配置
const DIFY_API_KEY = 'app-ngnm4jo4nhs4NkRIXCRFCLlg';
const DIFY_BASE_URL = 'https://api.dify.ai/v1';

// 获取应用参数（查看 workflow 的输入变量名）
app.get('/api/parameters', async (req, res) => {
  try {
    const response = await fetch(`${DIFY_BASE_URL}/parameters`, {
      headers: {
        'Authorization': `Bearer ${DIFY_API_KEY}`,
      },
    });

    const data = await response.json();
    res.json(data);
  } catch (error) {
    res.status(500).json({ error: true, message: error.message });
  }
});

// 执行 Workflow（流式 SSE）
app.post('/api/workflows/run', async (req, res) => {
  try {
    const { query, user } = req.body;

    // Workflow 的输入变量名为 keyword（从 /api/parameters 获取的 user_input_form 得知）
    const difyBody = {
      inputs: {
        keyword: query,
      },
      response_mode: 'streaming',
      user: user || 'web-user',
    };

    console.log('发送到 Dify Workflow:', JSON.stringify(difyBody));

    const response = await fetch(`${DIFY_BASE_URL}/workflows/run`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${DIFY_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(difyBody),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('Dify API error:', response.status, errorText);
      return res.status(response.status).json({
        error: true,
        message: `Dify API 返回错误: ${response.status}`,
        details: errorText,
      });
    }

    // 设置 SSE 头
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    res.setHeader('X-Accel-Buffering', 'no');

    // 流式转发
    const reader = response.body.getReader();
    const decoder = new TextDecoder();

    let buffer = '';
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split('\n');
      buffer = lines.pop() || '';

      for (const line of lines) {
        if (line.trim()) {
          res.write(line + '\n');
        }
      }
    }

    if (buffer.trim()) {
      res.write(buffer + '\n');
    }

    res.end();
  } catch (error) {
    console.error('Proxy error:', error);
    res.status(500).json({
      error: true,
      message: '代理服务内部错误',
      details: error.message,
    });
  }
});

const PORT = process.env.PORT || 3001;
app.listen(PORT, () => {
  console.log(`✅ 后端代理服务已启动: http://localhost:${PORT}`);
  console.log(`📡 Dify API: ${DIFY_BASE_URL}`);
});
