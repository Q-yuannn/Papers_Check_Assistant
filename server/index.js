require('dotenv').config();
const express = require('express');
const cors = require('cors');

const app = express();
app.use(cors());
app.use(express.json());

// Dify API 配置 —— 从环境变量读取，不硬编码
const DIFY_API_KEY = process.env.DIFY_API_KEY || '';
const DIFY_BASE_URL = process.env.DIFY_API_URL?.replace(/\/workflows\/run$/, '')
  || 'https://api.dify.ai/v1';

// ============================================================
// POST /api/dify —— blocking 模式代理（供开发调试用）
// ============================================================
app.post('/api/dify', async (req, res) => {
  try {
    const { keyword } = req.body;

    if (!keyword) {
      return res.status(400).json({ error: true, message: '缺少 keyword 参数' });
    }

    if (!DIFY_API_KEY) {
      return res.status(500).json({ error: true, message: '未设置 DIFY_API_KEY 环境变量' });
    }

    const difyBody = {
      inputs: { keyword },
      response_mode: 'blocking',
      user: 'dev-web-user',
    };

    console.log('[dev:dify] 请求:', keyword);

    const response = await fetch(`${DIFY_BASE_URL}/workflows/run`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${DIFY_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(difyBody),
    });

    const data = await response.json();

    if (!response.ok) {
      console.error('[dev:dify] 错误:', response.status, JSON.stringify(data).substring(0, 300));
      return res.status(response.status).json(data);
    }

    const outputs = data.data?.outputs || {};
    res.json({
      success: true,
      task_id: data.task_id,
      workflow_run_id: data.workflow_run_id,
      outputs,
    });
  } catch (error) {
    console.error('[dev:dify] 内部错误:', error.message);
    res.status(500).json({ error: true, message: error.message });
  }
});

// ============================================================
// 获取应用参数（查看 workflow 的输入变量名）
// ============================================================
app.get('/api/parameters', async (req, res) => {
  try {
    const response = await fetch(`${DIFY_BASE_URL}/parameters`, {
      headers: {
        Authorization: `Bearer ${DIFY_API_KEY}`,
      },
    });
    const data = await response.json();
    res.json(data);
  } catch (error) {
    res.status(500).json({ error: true, message: error.message });
  }
});

// ============================================================
// POST /api/workflows/run —— 流式 SSE（开发时保留）
// ============================================================
app.post('/api/workflows/run', async (req, res) => {
  try {
    const { query, user } = req.body;

    if (!DIFY_API_KEY) {
      return res.status(500).json({ error: true, message: '未设置 DIFY_API_KEY 环境变量' });
    }

    const difyBody = {
      inputs: { keyword: query },
      response_mode: 'streaming',
      user: user || 'dev-web-user',
    };

    console.log('[dev:stream] 发送到 Dify:', JSON.stringify(difyBody));

    const response = await fetch(`${DIFY_BASE_URL}/workflows/run`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${DIFY_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(difyBody),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('[dev:stream] Dify 错误:', response.status, errorText);
      return res.status(response.status).json({
        error: true,
        message: `Dify API 返回错误: ${response.status}`,
        details: errorText,
      });
    }

    // SSE 流式转发
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    res.setHeader('X-Accel-Buffering', 'no');

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
        if (line.trim()) res.write(line + '\n');
      }
    }
    if (buffer.trim()) res.write(buffer + '\n');
    res.end();
  } catch (error) {
    console.error('[dev:stream] 代理错误:', error);
    res.status(500).json({ error: true, message: '代理服务内部错误', details: error.message });
  }
});

const PORT = process.env.DEV_SERVER_PORT || 3001;
app.listen(PORT, () => {
  console.log(`✅ 开发代理服务已启动: http://localhost:${PORT}`);
  console.log(`📡 Dify API: ${DIFY_BASE_URL}`);
});
