import React, { useState, useRef, useEffect, useCallback } from 'react';
import ReactMarkdown from 'react-markdown';
import './App.css';

function App() {
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const messagesEndRef = useRef(null);
  const inputRef = useRef(null);

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
    setMessages((prev) => [...prev, userMsg]);

    // 添加空的助手消息占位
    const assistantMsgId = Date.now() + 1;
    const assistantMsg = { role: 'assistant', content: '', id: assistantMsgId };
    setMessages((prev) => [...prev, assistantMsg]);

    setLoading(true);

    try {
      // 调用本项目的后端代理 /api/dify（不暴露 Dify API Key）
      const response = await fetch('/api/dify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ keyword: query }),
      });

      if (!response.ok) {
        const errData = await response.json().catch(() => ({}));
        throw new Error(errData.message || `请求失败 (HTTP ${response.status})`);
      }

      const data = await response.json();

      // blocking 模式返回完整 JSON，提取 outputs 中的文本
      const outputs = data.outputs || {};
      const text =
        outputs.text ||
        outputs.result ||
        outputs.answer ||
        outputs.output ||
        (Object.keys(outputs).length > 0
          ? JSON.stringify(outputs, null, 2)
          : '(工作流未返回文本内容)');

      setMessages((prev) =>
        prev.map((msg) =>
          msg.id === assistantMsgId ? { ...msg, content: text } : msg
        )
      );
    } catch (err) {
      console.error('请求失败:', err);
      setError(err.message || '请求失败，请稍后重试');

      setMessages((prev) =>
        prev.map((msg) =>
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
              <span
                className="suggestion-tag"
                onClick={() => setInput('人工智能在医疗领域的应用')}
              >
                人工智能在医疗领域的应用
              </span>
              <span
                className="suggestion-tag"
                onClick={() => setInput('Transformer 模型的最新研究进展')}
              >
                Transformer 模型的最新研究进展
              </span>
              <span
                className="suggestion-tag"
                onClick={() => setInput('深度学习在自然语言处理中的应用')}
              >
                深度学习在自然语言处理中的应用
              </span>
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
                        {msg.content ? (
                          <ReactMarkdown>{msg.content}</ReactMarkdown>
                        ) : (
                          loading && (
                            <span className="typing-indicator">
                              <span></span>
                              <span></span>
                              <span></span>
                            </span>
                          )
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
