import React, { useState, useRef, useEffect, useCallback } from 'react';
import ReactMarkdown from 'react-markdown';
import './App.css';

// 生成唯一用户 ID
const getUserId = () => {
  let uid = localStorage.getItem('paper_query_user_id');
  if (!uid) {
    uid = 'user_' + Date.now() + '_' + Math.random().toString(36).substring(2, 9);
    localStorage.setItem('paper_query_user_id', uid);
  }
  return uid;
};

const API_BASE = 'http://localhost:3001/api';

function App() {
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const messagesEndRef = useRef(null);
  const inputRef = useRef(null);
  const userId = useRef(getUserId());

  // 自动滚动到底部
  const scrollToBottom = useCallback(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, []);

  useEffect(() => {
    scrollToBottom();
  }, [messages, scrollToBottom]);

  // 发送消息
  const handleSend = async () => {
    const query = input.trim();
    if (!query || loading) return;

    setInput('');
    setError('');

    // 添加用户消息
    const userMsg = { role: 'user', content: query, id: Date.now() };
    setMessages(prev => [...prev, userMsg]);

    // 添加空的助手消息占位
    const assistantMsgId = Date.now() + 1;
    const assistantMsg = { role: 'assistant', content: '', id: assistantMsgId, metadata: {} };
    setMessages(prev => [...prev, assistantMsg]);

    setLoading(true);

    try {
      const response = await fetch(`${API_BASE}/workflows/run`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          query: query,
          user: userId.current,
        }),
      });

      if (!response.ok) {
        const errData = await response.json().catch(() => ({}));
        throw new Error(errData.message || errData.details || `HTTP ${response.status}`);
      }

      // 读取 SSE 流
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
          if (!line.trim() || !line.startsWith('data:')) continue;
          const jsonStr = line.replace(/^data:\s*/, '').trim();
          if (!jsonStr) continue;

          try {
            const data = JSON.parse(jsonStr);
            console.log('SSE event:', data);

            // Workflow SSE 事件处理
            if (data.event === 'workflow_started') {
              console.log('Workflow 开始执行:', data);
              setMessages(prev =>
                prev.map(msg =>
                  msg.id === assistantMsgId
                    ? { ...msg, metadata: { ...msg.metadata, task_id: data.task_id, workflow_run_id: data.workflow_run_id } }
                    : msg
                )
              );
            } else if (data.event === 'node_started') {
              console.log(`节点开始: ${data.data?.title || data.data?.node_type}`);
            } else if (data.event === 'node_finished') {
              console.log(`节点完成: ${data.data?.title || data.data?.node_type}`);

              // 如果节点有输出文本，累积到消息中
              if (data.data?.outputs) {
                const outputs = data.data.outputs;
                // 查找可能的文本输出字段
                const textOutput = outputs.text || outputs.result || outputs.answer || outputs.output || '';
                if (textOutput) {
                  setMessages(prev =>
                    prev.map(msg =>
                      msg.id === assistantMsgId
                        ? { ...msg, content: msg.content + textOutput }
                        : msg
                    )
                  );
                }
              }
            } else if (data.event === 'workflow_finished') {
              console.log('Workflow 执行完成:', data);

              // 从 workflow_finished 中提取最终输出
              if (data.data?.outputs) {
                const outputs = data.data.outputs;
                const finalText = outputs.text || outputs.result || outputs.answer || outputs.output || '';

                if (finalText) {
                  setMessages(prev =>
                    prev.map(msg =>
                      msg.id === assistantMsgId
                        ? { ...msg, content: finalText }
                        : msg
                    )
                  );
                }
              }
            } else if (data.event === 'tts_message' || data.event === 'tts_message_end') {
              // TTS 事件，忽略
            } else if (data.event === 'error') {
              throw new Error(data.message || '工作流执行出错');
            }
          } catch (parseErr) {
            console.warn('SSE 解析错误:', parseErr, jsonStr);
          }
        }
      }
    } catch (err) {
      console.error('请求失败:', err);
      setError(err.message || '请求失败，请稍后重试');

      // 更新错误状态到消息
      setMessages(prev =>
        prev.map(msg =>
          msg.id === assistantMsgId
            ? { ...msg, content: `❌ 出错了: ${err.message || '请求失败'}` }
            : msg
        )
      );
    } finally {
      setLoading(false);
    }
  };

  // 处理回车发送
  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  // 清空对话
  const handleClearChat = () => {
    setMessages([]);
    setError('');
    inputRef.current?.focus();
  };

  return (
    <div className="app-container">
      {/* 顶部栏 */}
      <header className="app-header">
        <div className="header-left">
          <div className="logo-icon">📄</div>
          <div>
            <h1 className="app-title">论文查询助手</h1>
            <p className="app-subtitle">基于 Dify AI 工作流</p>
          </div>
        </div>
        <button className="btn-new-chat" onClick={handleClearChat}>
          + 新查询
        </button>
      </header>

      {/* 消息列表 */}
      <div className="chat-area">
        {messages.length === 0 ? (
          <div className="welcome-container">
            <div className="welcome-icon">🔍</div>
            <h2>论文查询助手</h2>
            <p>请输入您想查询的论文主题或研究方向</p>
            <div className="suggestion-list">
              <span className="suggestion-tag" onClick={() => setInput('人工智能在医疗领域的应用')}>人工智能在医疗领域的应用</span>
              <span className="suggestion-tag" onClick={() => setInput('Transformer 模型的最新研究进展')}>Transformer 模型的最新研究进展</span>
              <span className="suggestion-tag" onClick={() => setInput('深度学习在自然语言处理中的应用')}>深度学习在自然语言处理中的应用</span>
            </div>
          </div>
        ) : (
          <div className="message-list">
            {messages.map((msg) => (
              <div key={msg.id} className={`message ${msg.role}`}>
                <div className={`message-avatar ${msg.role}`}>
                  {msg.role === 'user' ? '👤' : '🤖'}
                </div>
                <div className="message-content">
                  <div className="message-role-name">
                    {msg.role === 'user' ? '你' : '论文助手'}
                  </div>
                  <div className="message-text">
                    {msg.role === 'assistant' ? (
                      <>
                        <ReactMarkdown>{msg.content || ''}</ReactMarkdown>
                        {loading && !msg.content && (
                          <span className="typing-indicator">
                            <span></span><span></span><span></span>
                          </span>
                        )}
                      </>
                    ) : (
                      <p>{msg.content}</p>
                    )}
                  </div>
                </div>
              </div>
            ))}
            {error && <div className="error-banner">⚠️ {error}</div>}
            <div ref={messagesEndRef} />
          </div>
        )}
      </div>

      {/* 底部输入区 */}
      <div className="input-area">
        <div className="input-container">
          <textarea
            ref={inputRef}
            className="chat-input"
            placeholder="输入论文主题或研究方向..."
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            rows={1}
            disabled={loading}
          />
          <button
            className="btn-send"
            onClick={handleSend}
            disabled={!input.trim() || loading}
          >
            {loading ? '⏳' : '➤'}
          </button>
        </div>
        <p className="input-hint">按 Enter 发送，Shift+Enter 换行</p>
      </div>
    </div>
  );
}

export default App;
