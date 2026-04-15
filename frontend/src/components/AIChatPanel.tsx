import { useState, useEffect, useRef, useCallback } from 'react';
import { useAuth } from '../context/AuthContext';
import { agentAPI } from '../services/api';
import { motion, AnimatePresence } from 'framer-motion';
import { RiRobotLine, RiCloseLine, RiSendPlaneLine, RiLoader4Line, RiArrowDownLine, RiChatNewLine } from 'react-icons/ri';
import toast from 'react-hot-toast';
import DOMPurify from 'dompurify';

const sanitizeContent = (content) => {
  if (!content) return '';
  return DOMPurify.sanitize(content, {
    ALLOWED_TAGS: ['b', 'i', 'em', 'strong', 'code', 'pre', 'br', 'p', 'ul', 'ol', 'li', 'h1', 'h2', 'h3', 'span'],
    ALLOWED_ATTR: ['class'],
  });
};

export default function AIChatPanel() {
  const { session, plan } = useAuth();
  const [open, setOpen] = useState(false);
  const [agents, setAgents] = useState([]);
  const [selectedAgent, setSelectedAgent] = useState(null);
  const [conversations, setConversations] = useState([]);
  const [activeConversation, setActiveConversation] = useState(null);
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [sending, setSending] = useState(false);
  const [loadingMessages, setLoadingMessages] = useState(false);
  const [agentsError, setAgentsError] = useState(false);
  const [agentsLoaded, setAgentsLoaded] = useState(false);
  const messagesEndRef = useRef(null);
  const inputRef = useRef(null);
  const isMounted = useRef(true);

  // Track component mount state to prevent state updates after unmount
  useEffect(() => {
    isMounted.current = true;
    return () => { isMounted.current = false; };
  }, []);

  // Load agents when panel opens
  useEffect(() => {
    if (!open || !session) return;
    setAgentsError(false);
    agentAPI.getInstances()
      .then(r => {
        const list = r.data?.data || [];
        setAgents(list);
        setAgentsLoaded(true);
        if (list.length > 0 && !selectedAgent) {
          setSelectedAgent(list[0]);
        }
      })
      .catch(() => {
        setAgentsError(true);
        setAgentsLoaded(true);
        toast.error('Failed to load AI agents');
      });
  }, [open, session]);

  // Load conversations for selected agent
  useEffect(() => {
    if (!selectedAgent) return;
    agentAPI.getConversations({ agentInstanceId: selectedAgent.id, status: 'active', limit: 10 })
      .then(r => setConversations(r.data?.data || []))
      .catch(() => {});
  }, [selectedAgent]);

  // Load messages for active conversation
  useEffect(() => {
    if (!activeConversation) {
      setMessages([]);
      return;
    }
    setLoadingMessages(true);
    agentAPI.getMessages(activeConversation, { limit: 100 })
      .then(r => {
        setMessages(r.data?.data || []);
        scrollToBottom();
      })
      .catch(() => toast.error('Failed to load messages'))
      .finally(() => setLoadingMessages(false));
  }, [activeConversation]);

  const scrollToBottom = useCallback(() => {
    setTimeout(() => {
      if (isMounted.current) {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
      }
    }, 100);
  }, []);

  const handleSend = async () => {
    if (!input.trim() || sending) return;
    if (!selectedAgent) {
      toast.error('AI agents are still loading. Please wait a moment.');
      return;
    }
    const text = input.trim();
    setInput('');
    setSending(true);

    // Optimistically add user message
    const tempUserMsg = { id: `temp-${Date.now()}`, role: 'user', content: text, created_at: new Date().toISOString() };
    setMessages(prev => [...prev, tempUserMsg]);
    scrollToBottom();

    try {
      const res = await agentAPI.chat({
        agentInstanceId: selectedAgent.id,
        conversationId: activeConversation || undefined,
        message: text,
      });
      const data = res.data?.data;
      if (data) {
        if (!activeConversation && data.conversationId) {
          setActiveConversation(data.conversationId);
        }
        // Add assistant response
        const assistantMsg = {
          id: `resp-${Date.now()}`,
          role: 'assistant',
          content: data.response || '',
          created_at: new Date().toISOString(),
        };
        setMessages(prev => [...prev, assistantMsg]);
        scrollToBottom();
      }
    } catch (err) {
      const errMsg = err.response?.data?.message || 'Failed to send message';
      toast.error(errMsg);
      // Remove optimistic message on error
      setMessages(prev => prev.filter(m => m.id !== tempUserMsg.id));
    } finally {
      setSending(false);
      inputRef.current?.focus();
    }
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const startNewConversation = () => {
    setActiveConversation(null);
    setMessages([]);
    inputRef.current?.focus();
  };

  const agentName = selectedAgent?.config_overrides?.display_name
    || selectedAgent?.ai_agent_definitions?.name
    || 'AI Assistant';
  const agentDescription = selectedAgent?.ai_agent_definitions?.description || '';
  const agentTier = selectedAgent?.ai_agent_definitions?.tier || 'general';
  const agentsLoading = open && !agentsLoaded && !agentsError;

  if (!session) return null;

  return (
    <>
      {/* Floating action button — positioned above the theme toggle FAB */}
      <button
        onClick={() => setOpen(true)}
        className="fixed bottom-20 right-5 z-[60] w-14 h-14 rounded-full bg-forest-900 text-white shadow-xl hover:bg-forest-800 transition-all hover:scale-105 flex items-center justify-center"
        title="AI Assistant"
      >
        <RiRobotLine className="text-2xl" />
      </button>

      {/* Chat panel */}
      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, x: 400 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: 400 }}
            transition={{ type: 'spring', damping: 25, stiffness: 300 }}
            className="fixed right-0 top-0 h-full w-full sm:w-[420px] bg-white shadow-2xl z-50 flex flex-col border-l border-slate-200"
          >
            {/* Header */}
            <div className="flex items-center justify-between px-4 py-3 border-b border-slate-100 bg-forest-900 text-white">
              <div className="flex items-center gap-3 flex-1 min-w-0">
                <div className="w-8 h-8 rounded-full bg-white/20 flex items-center justify-center flex-shrink-0">
                  <RiRobotLine className="text-lg" />
                </div>
                <div className="min-w-0">
                  <p className="text-sm font-semibold truncate">{agentName}</p>
                  <p className="text-[10px] opacity-70 uppercase tracking-wider">
                    {agentTier === 'customer' ? `${agentDescription || 'Specialist Agent'}` : 'SolNuv AI Assistant'}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-1">
                <button onClick={startNewConversation} className="p-2 hover:bg-white/10 rounded-lg transition-colors" title="New Chat">
                  <RiChatNewLine />
                </button>
                <button onClick={() => setOpen(false)} className="p-2 hover:bg-white/10 rounded-lg transition-colors" title="Close">
                  <RiCloseLine className="text-lg" />
                </button>
              </div>
            </div>

            {/* Agent selector */}
            {agents.length > 1 && (
              <div className="px-4 py-2 border-b border-slate-100 bg-slate-50">
                <select
                  value={selectedAgent?.id || ''}
                  onChange={e => {
                    const ag = agents.find(a => a.id === e.target.value);
                    setSelectedAgent(ag);
                    setActiveConversation(null);
                    setMessages([]);
                  }}
                  className="w-full text-sm bg-white border border-slate-200 rounded-lg px-3 py-1.5 focus:outline-none focus:ring-2 focus:ring-forest-500"
                >
                  {agents.map(a => (
                    <option key={a.id} value={a.id}>
                      {a.config_overrides?.display_name || a.ai_agent_definitions?.name || 'Agent'}
                    </option>
                  ))}
                </select>
              </div>
            )}

            {/* Recent conversations */}
            {conversations.length > 0 && !activeConversation && messages.length === 0 && (
              <div className="px-4 py-3 border-b border-slate-100 max-h-40 overflow-y-auto">
                <p className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider mb-2">Recent</p>
                {conversations.map(c => (
                  <button
                    key={c.id}
                    onClick={() => setActiveConversation(c.id)}
                    className="w-full text-left text-sm text-slate-700 hover:text-forest-900 hover:bg-slate-50 rounded-lg px-2 py-1.5 truncate transition-colors"
                  >
                    {c.title || 'Untitled'}
                  </button>
                ))}
              </div>
            )}

            {/* Messages area */}
            <div className="flex-1 overflow-y-auto px-4 py-4 space-y-3">
              {loadingMessages && (
                <div className="flex justify-center py-8">
                  <RiLoader4Line className="text-2xl text-forest-600 animate-spin" />
                </div>
              )}

              {!loadingMessages && messages.length === 0 && (
                <div className="text-center py-12 text-slate-400">
                  <RiRobotLine className="text-4xl mx-auto mb-3 opacity-40" />
                  <p className="text-sm font-medium">
                    {agentsLoading ? 'Connecting to AI...' : agentsError ? 'Failed to connect' : agents.length === 0 && agentsLoaded ? 'No agents available' : 'Start a conversation'}
                  </p>
                  <p className="text-xs mt-1">
                    {agentsLoading
                      ? 'Loading your available agents...'
                      : agentsError
                        ? 'Check your connection and try reopening the panel.'
                        : agents.length === 0 && agentsLoaded
                          ? 'AI agents have not been provisioned yet. Contact support or check your subscription.'
                          : 'Ask me anything about your solar projects, compliance, or the platform.'}
                  </p>
                </div>
              )}

              {messages.filter(m => m.role === 'user' || m.role === 'assistant').map((msg) => (
                <div key={msg.id} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                  <div
                    className={`max-w-[85%] rounded-2xl px-4 py-2.5 text-sm leading-relaxed whitespace-pre-wrap ${
                      msg.role === 'user'
                        ? 'bg-forest-900 text-white rounded-br-md'
                        : 'bg-slate-100 text-slate-800 rounded-bl-md'
                    }`}
                  >
                    <span dangerouslySetInnerHTML={{ __html: sanitizeContent(msg.content) }} />
                  </div>
                </div>
              ))}

              {sending && (
                <div className="flex justify-start">
                  <div className="bg-slate-100 rounded-2xl rounded-bl-md px-4 py-3">
                    <div className="flex gap-1">
                      <span className="w-2 h-2 bg-slate-400 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                      <span className="w-2 h-2 bg-slate-400 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                      <span className="w-2 h-2 bg-slate-400 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
                    </div>
                  </div>
                </div>
              )}

              <div ref={messagesEndRef} />
            </div>

            {/* Input area */}
            <div className="border-t border-slate-100 px-4 py-3 bg-white">
              <div className="flex items-end gap-2">
                <textarea
                  ref={inputRef}
                  rows={1}
                  value={input}
                  onChange={e => setInput(e.target.value)}
                  onKeyDown={handleKeyDown}
                  placeholder={agentsLoading ? 'Connecting...' : 'Type a message...'}
                  disabled={sending}
                  className="flex-1 resize-none text-sm border border-slate-200 rounded-xl px-4 py-2.5 focus:outline-none focus:ring-2 focus:ring-forest-500 focus:border-transparent max-h-24 disabled:opacity-50"
                  style={{ minHeight: '42px' }}
                />
                <button
                  onClick={handleSend}
                  disabled={!input.trim() || sending}
                  className="w-10 h-10 flex-shrink-0 rounded-xl bg-forest-900 text-white flex items-center justify-center hover:bg-forest-800 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  {sending ? <RiLoader4Line className="animate-spin" /> : <RiSendPlaneLine />}
                </button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
