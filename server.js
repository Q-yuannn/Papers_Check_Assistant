require('dotenv').config();
const express = require('express');
const cors = require('cors');
const path = require('path');

const app = express();
app.use(cors());
app.use(express.json());

// ============================================================
// 生产模式：提供 React 构建后的静态文件
// ============================================================
app.use(express.static(path.join(__dirname, 'build')));

// ============================================================
// POST /api/dify —— 代理到 Dify Workflow API
// 前端只调用这个端点，API Key 不暴露给浏览器
// ============================================================
app.post('/api/dify', async (req, res) => {
  try {
    const { keyword } = req.body;

    if (!keyword) {
      return res.status(400).json({ error: true, message: '缺少 keyword 参数' });
    }

    const DIFY_API_URL = process.env.DIFY_API_URL || 'https://api.dify.ai/v1/workflows/run';
    const DIFY_API_KEY = process.env.DIFY_API_KEY;

    if (!DIFY_API_KEY) {
      console.error('[ERROR] 未设置 DIFY_API_KEY 环境变量');
      return res.status(500).json({
        error: true,
        message: '服务器未配置 DIFY_API_KEY 环境变量，请联系管理员',
      });
    }

    const difyBody = {
      inputs: {
        keyword: keyword,
      },
      response_mode: 'blocking',
      user: 'aliyun-web-user',
    };

    console.log(`[Dify] 请求 -> keyword="${keyword}"`);

    const response = await fetch(DIFY_API_URL, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${DIFY_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(difyBody),
    });

    const data = await response.json();

    if (!response.ok) {
      console.error(`[Dify] 错误 ${response.status}:`, JSON.stringify(data).substring(0, 500));
      return res.status(response.status).json({
        error: true,
        message: data.message || `Dify API 返回错误 ${response.status}`,
      });
    }

    console.log(`[Dify] 成功 -> task_id=${data.task_id}`);

    // 提取 workflow 输出
    const outputs = data.data?.outputs || {};

    res.json({
      success: true,
      task_id: data.task_id,
      workflow_run_id: data.workflow_run_id,
      outputs: outputs,
    });
  } catch (error) {
    console.error('[Proxy] 内部错误:', error.message);
    res.status(500).json({
      error: true,
      message: '代理服务内部错误',
      details: error.message,
    });
  }
});

// ============================================================
// SPA fallback：所有非 API 路径返回 index.html
// ============================================================
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'build', 'index.html'));
});

// ============================================================
// 启动服务
// ============================================================
const PORT = process.env.PORT || 3000;
app.listen(PORT, '0.0.0.0', () => {
  console.log('========================================');
  console.log(`  论文查询助手已启动`);
  console.log(`  地址: http://0.0.0.0:${PORT}`);
  console.log(`  Dify API: ${process.env.DIFY_API_URL || 'https://api.dify.ai/v1/workflows/run'}`);
  console.log('========================================');
});
