'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import {
  Sparkles,
  X,
  Send,
  Mic,
  MicOff,
  Mail,
  Calendar,
  CheckSquare,
  StickyNote,
  CheckCircle2,
  Loader2,
} from 'lucide-react';

interface Message {
  id: string;
  role: 'user' | 'assistant' | 'function';
  content: string;
  timestamp: string;
}

interface ContextCounts {
  emails: number;
  events: number;
  tasks: number;
  notes: number;
}

interface GeminiChatProps {
  isOpen: boolean;
  onClose: () => void;
  onUiRefresh: (panels: string[]) => void;
  contextCounts?: ContextCounts;
}

const QUICK_COMMANDS = [
  'Summarize my inbox',
  "What's on my calendar today?",
  'Draft an email to...',
  'Create a task',
  'PinHigh status update',
];

const STORAGE_KEY = 'gemini-chat-history';

export default function GeminiChat({ isOpen, onClose, onUiRefresh, contextCounts }: GeminiChatProps) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  // hasPulse could be exposed to parent for floating button animation
  const [, setHasPulse] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const recognitionRef = useRef<any>(null);
  const panelRef = useRef<HTMLDivElement>(null);

  // Load messages from localStorage
  useEffect(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) {
        const parsed = JSON.parse(stored) as Message[];
        setMessages(parsed.slice(-50));
      }
    } catch {
      // silent
    }
  }, []);

  // Save messages to localStorage
  useEffect(() => {
    if (messages.length > 0) {
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(messages.slice(-50)));
      } catch {
        // silent
      }
    }
  }, [messages]);

  // Scroll to bottom on new messages
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isLoading]);

  // Focus input when opening
  useEffect(() => {
    if (isOpen) {
      setTimeout(() => inputRef.current?.focus(), 300);
    }
  }, [isOpen]);

  // iOS keyboard handling
  useEffect(() => {
    if (!isOpen || typeof window === 'undefined') return;
    const vv = window.visualViewport;
    if (!vv) return;

    const handleResize = () => {
      if (panelRef.current) {
        const offsetY = window.innerHeight - vv.height;
        panelRef.current.style.transform = `translateY(-${offsetY}px)`;
      }
    };

    vv.addEventListener('resize', handleResize);
    return () => vv.removeEventListener('resize', handleResize);
  }, [isOpen]);

  const sendMessage = useCallback(async (text: string) => {
    if (!text.trim() || isLoading) return;

    const userMsg: Message = {
      id: Date.now().toString(),
      role: 'user',
      content: text.trim(),
      timestamp: new Date().toISOString(),
    };

    setMessages((prev) => [...prev, userMsg]);
    setInput('');
    setIsLoading(true);

    try {
      // Read tasks and notes from localStorage
      let tasks: any[] = [];
      let notes: any[] = [];
      try {
        const storedTasks = localStorage.getItem('cc-tasks');
        if (storedTasks) tasks = JSON.parse(storedTasks);
        const storedNotes = localStorage.getItem('cc-notes');
        if (storedNotes) notes = JSON.parse(storedNotes);
      } catch {
        // silent
      }

      const res = await fetch('/api/gemini/agent', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: text.trim(),
          history: messages.slice(-20).map((m) => ({ role: m.role, content: m.content })),
          tasks,
          notes,
        }),
      });

      if (!res.ok) throw new Error('Failed to get response');

      const data = await res.json();

      // Add assistant message
      const assistantMsg: Message = {
        id: (Date.now() + 1).toString(),
        role: 'assistant',
        content: data.message || data.response || 'I received your message but had trouble generating a response.',
        timestamp: new Date().toISOString(),
      };
      setMessages((prev) => [...prev, assistantMsg]);

      // Add function results if any
      if (data.actions && data.actions.length > 0) {
        const actionMsg: Message = {
          id: (Date.now() + 2).toString(),
          role: 'function',
          content: data.actions.map((a: any) => a.summary || a.description || JSON.stringify(a)).join('\n'),
          timestamp: new Date().toISOString(),
        };
        setMessages((prev) => [...prev, actionMsg]);
      }

      // Handle UI refresh
      if (data.uiRefresh && Array.isArray(data.uiRefresh) && data.uiRefresh.length > 0) {
        onUiRefresh(data.uiRefresh);
      }

      setHasPulse(true);
      setTimeout(() => setHasPulse(false), 2000);
    } catch {
      const errorMsg: Message = {
        id: (Date.now() + 1).toString(),
        role: 'assistant',
        content: 'Sorry, I couldn\'t process that request right now. Please try again.',
        timestamp: new Date().toISOString(),
      };
      setMessages((prev) => [...prev, errorMsg]);
    } finally {
      setIsLoading(false);
    }
  }, [isLoading, messages, onUiRefresh]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    sendMessage(input);
  };

  const startVoiceInput = () => {
    try {
      const SpeechRecognition = (window as any).webkitSpeechRecognition || (window as any).SpeechRecognition;
      if (!SpeechRecognition) return;

      const recognition = new SpeechRecognition();
      recognition.continuous = false;
      recognition.interimResults = false;
      recognition.lang = 'en-US';

      recognition.onresult = (event: any) => {
        const transcript = event.results[0][0].transcript;
        setInput((prev) => prev + transcript);
        setIsRecording(false);
      };

      recognition.onerror = () => {
        setIsRecording(false);
      };

      recognition.onend = () => {
        setIsRecording(false);
      };

      recognitionRef.current = recognition;
      recognition.start();
      setIsRecording(true);
    } catch {
      // Speech recognition not supported
    }
  };

  const stopVoiceInput = () => {
    if (recognitionRef.current) {
      recognitionRef.current.stop();
      setIsRecording(false);
    }
  };

  const renderMarkdown = (text: string) => {
    // Simple markdown: bold, lists, code
    let html = text
      .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
      .replace(/`([^`]+)`/g, '<code class="px-1.5 py-0.5 bg-surface-3 rounded text-xs font-mono">$1</code>')
      .replace(/^- (.+)$/gm, '<li class="ml-4 list-disc">$1</li>')
      .replace(/^(\d+)\. (.+)$/gm, '<li class="ml-4 list-decimal">$2</li>')
      .replace(/\n/g, '<br />');
    return <span dangerouslySetInnerHTML={{ __html: html }} />;
  };

  // When closed, render nothing (parent handles the floating button)
  if (!isOpen) {
    return null;
  }

  return (
    <>
      {/* Backdrop on mobile */}
      <div
        className="fixed inset-0 bg-black/40 z-40 lg:hidden"
        onClick={onClose}
      />

      {/* Chat Panel */}
      <div
        ref={panelRef}
        className="fixed z-50 bg-surface-1 border border-border flex flex-col
          bottom-0 right-0 w-full h-[85vh] rounded-t-2xl
          lg:bottom-4 lg:right-4 lg:w-[380px] lg:h-[600px] lg:rounded-2xl
          animate-slide-up"
        style={{ boxShadow: '0 8px 32px rgba(0,0,0,0.2)' }}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-border flex-shrink-0">
          <div className="flex items-center gap-2.5">
            <div
              className="w-8 h-8 rounded-lg flex items-center justify-center"
              style={{ backgroundColor: '#4285F4' }}
            >
              <Sparkles className="w-4 h-4 text-white" />
            </div>
            <div>
              <h3 className="text-sm font-semibold text-gray-900 dark:text-white">Gemini Agent</h3>
              <p className="text-[10px] text-gray-400 dark:text-zinc-500">AI Assistant</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-lg hover:bg-surface-2 flex items-center justify-center transition-colors"
          >
            <X className="w-4 h-4 text-gray-400 dark:text-zinc-500" />
          </button>
        </div>

        {/* Context Bar */}
        {contextCounts && (
          <div className="flex items-center gap-1.5 px-4 py-2 border-b border-border overflow-x-auto flex-shrink-0">
            {[
              { icon: Mail, label: 'emails', count: contextCounts.emails, color: 'text-red-400' },
              { icon: Calendar, label: 'events', count: contextCounts.events, color: 'text-blue-400' },
              { icon: CheckSquare, label: 'tasks', count: contextCounts.tasks, color: 'text-green-400' },
              { icon: StickyNote, label: 'notes', count: contextCounts.notes, color: 'text-yellow-400' },
            ].map((ctx) => (
              <span
                key={ctx.label}
                className="flex items-center gap-1 px-2 py-1 rounded-lg bg-surface-2 text-[10px] font-medium text-gray-500 dark:text-zinc-400 whitespace-nowrap"
              >
                <ctx.icon className={`w-3 h-3 ${ctx.color}`} />
                {ctx.count} {ctx.label}
              </span>
            ))}
          </div>
        )}

        {/* Messages */}
        <div className="flex-1 overflow-y-auto px-4 py-3 space-y-3">
          {messages.length === 0 && !isLoading && (
            <div className="flex flex-col items-center justify-center h-full gap-4">
              <div
                className="w-12 h-12 rounded-full flex items-center justify-center"
                style={{ backgroundColor: '#4285F4' }}
              >
                <Sparkles className="w-6 h-6 text-white" />
              </div>
              <p className="text-sm text-gray-500 dark:text-zinc-400 text-center">
                How can I help you today?
              </p>
              <div className="flex flex-wrap gap-2 justify-center max-w-[300px]">
                {QUICK_COMMANDS.map((cmd) => (
                  <button
                    key={cmd}
                    onClick={() => sendMessage(cmd)}
                    className="px-3 py-2 text-xs font-medium bg-surface-2 hover:bg-surface-3 text-gray-600 dark:text-zinc-300 rounded-xl transition-colors min-h-[44px]"
                  >
                    {cmd}
                  </button>
                ))}
              </div>
            </div>
          )}

          {messages.map((msg) => {
            if (msg.role === 'user') {
              return (
                <div key={msg.id} className="flex justify-end">
                  <div className="max-w-[80%] px-3.5 py-2.5 rounded-2xl rounded-br-md text-sm text-white" style={{ backgroundColor: '#4285F4' }}>
                    {msg.content}
                  </div>
                </div>
              );
            }

            if (msg.role === 'function') {
              return (
                <div key={msg.id} className="flex justify-start">
                  <div className="flex flex-wrap gap-1.5">
                    {msg.content.split('\n').map((action, i) => (
                      <span
                        key={i}
                        className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-green-50 dark:bg-green-500/10 text-green-600 dark:text-green-400 text-xs font-medium"
                      >
                        <CheckCircle2 className="w-3 h-3" />
                        {action}
                      </span>
                    ))}
                  </div>
                </div>
              );
            }

            // assistant
            return (
              <div key={msg.id} className="flex justify-start">
                <div className="max-w-[85%] px-3.5 py-2.5 rounded-2xl rounded-bl-md bg-surface-3 text-sm text-gray-800 dark:text-zinc-200 leading-relaxed">
                  {renderMarkdown(msg.content)}
                </div>
              </div>
            );
          })}

          {isLoading && (
            <div className="flex justify-start">
              <div className="px-4 py-3 rounded-2xl rounded-bl-md bg-surface-3">
                <div className="flex gap-1.5">
                  <span className="w-2 h-2 bg-gray-400 dark:bg-zinc-500 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                  <span className="w-2 h-2 bg-gray-400 dark:bg-zinc-500 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                  <span className="w-2 h-2 bg-gray-400 dark:bg-zinc-500 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
                </div>
              </div>
            </div>
          )}

          <div ref={messagesEndRef} />
        </div>

        {/* Input Area */}
        <form
          onSubmit={handleSubmit}
          className="flex items-center gap-2 px-4 py-3 border-t border-border flex-shrink-0"
        >
          <button
            type="button"
            onClick={isRecording ? stopVoiceInput : startVoiceInput}
            className={`w-11 h-11 flex-shrink-0 rounded-xl flex items-center justify-center transition-colors ${
              isRecording
                ? 'bg-red-500 text-white'
                : 'hover:bg-surface-2 text-gray-400 dark:text-zinc-500'
            }`}
            aria-label={isRecording ? 'Stop recording' : 'Start voice input'}
          >
            {isRecording ? <MicOff className="w-4 h-4" /> : <Mic className="w-4 h-4" />}
          </button>
          <input
            ref={inputRef}
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Ask Gemini anything..."
            className="input-base flex-1 py-2.5 text-sm"
            disabled={isLoading}
          />
          <button
            type="submit"
            disabled={!input.trim() || isLoading}
            className="w-11 h-11 flex-shrink-0 rounded-xl flex items-center justify-center transition-all disabled:opacity-30 text-white"
            style={{ backgroundColor: '#4285F4' }}
          >
            {isLoading ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <Send className="w-4 h-4" />
            )}
          </button>
        </form>
      </div>
    </>
  );
}
