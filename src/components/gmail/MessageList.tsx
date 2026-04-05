'use client';

import { useState, useEffect, useCallback } from 'react';
import { Archive, Trash2, Mail, MailOpen, Circle, RefreshCw } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import GmailSearchBar from './GmailSearchBar';

interface Message {
  id: string;
  threadId: string;
  from: string;
  subject: string;
  date: string;
  snippet: string;
  unread: boolean;
  labelIds: string[];
}

interface MessageListProps {
  activeLabel: string;
  searchQuery: string;
  selectedId: string | null;
  onSelect: (id: string) => void;
  onSearchChange: (query: string) => void;
}

export default function MessageList({
  activeLabel,
  searchQuery,
  selectedId,
  onSelect,
  onSearchChange,
}: MessageListProps) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [loading, setLoading] = useState(true);
  const [checkedIds, setCheckedIds] = useState<Set<string>>(new Set());
  const [nextPageToken, setNextPageToken] = useState<string | null>(null);

  const fetchMessages = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ label: activeLabel, maxResults: '20' });
      if (searchQuery) params.set('q', searchQuery);
      const res = await fetch(`/api/gmail?${params}`);
      const data = await res.json();
      if (data.error) throw new Error(data.error);
      setMessages(data.messages || []);
      setNextPageToken(data.nextPageToken || null);
    } catch {
      setMessages([]);
    } finally {
      setLoading(false);
    }
  }, [activeLabel, searchQuery]);

  useEffect(() => {
    fetchMessages();
    setCheckedIds(new Set());
  }, [fetchMessages]);

  const extractName = (from: string) => {
    const match = from.match(/^"?([^"<]+)/);
    return match ? match[1].trim() : from;
  };

  const toggleCheck = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setCheckedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const bulkAction = async (action: 'archive' | 'trash' | 'read' | 'unread') => {
    const ids = Array.from(checkedIds);
    const promises = ids.map((id) => {
      switch (action) {
        case 'archive':
          return fetch(`/api/gmail/${id}`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ removeLabelIds: ['INBOX'] }),
          });
        case 'trash':
          return fetch(`/api/gmail/${id}`, { method: 'DELETE' });
        case 'read':
          return fetch(`/api/gmail/${id}`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ removeLabelIds: ['UNREAD'] }),
          });
        case 'unread':
          return fetch(`/api/gmail/${id}`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ addLabelIds: ['UNREAD'] }),
          });
      }
    });
    await Promise.all(promises);
    setCheckedIds(new Set());
    fetchMessages();
  };

  const loadMore = async () => {
    if (!nextPageToken) return;
    const params = new URLSearchParams({
      label: activeLabel,
      maxResults: '20',
      pageToken: nextPageToken,
    });
    if (searchQuery) params.set('q', searchQuery);
    const res = await fetch(`/api/gmail?${params}`);
    const data = await res.json();
    setMessages((prev) => [...prev, ...(data.messages || [])]);
    setNextPageToken(data.nextPageToken || null);
  };

  return (
    <div className="flex flex-col h-full">
      <div className="p-3 border-b border-border space-y-2">
        <div className="flex items-center gap-2">
          <div className="flex-1">
            <GmailSearchBar value={searchQuery} onSearchChange={onSearchChange} />
          </div>
          <button onClick={fetchMessages} className="btn-ghost p-2" disabled={loading}>
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          </button>
        </div>

        {checkedIds.size > 0 && (
          <div className="flex items-center gap-1 text-xs">
            <span className="text-gray-500 dark:text-zinc-400 mr-1">
              {checkedIds.size} selected
            </span>
            <button onClick={() => bulkAction('archive')} className="btn-ghost p-1.5" title="Archive">
              <Archive className="w-3.5 h-3.5" />
            </button>
            <button onClick={() => bulkAction('trash')} className="btn-ghost p-1.5" title="Delete">
              <Trash2 className="w-3.5 h-3.5" />
            </button>
            <button onClick={() => bulkAction('read')} className="btn-ghost p-1.5" title="Mark read">
              <MailOpen className="w-3.5 h-3.5" />
            </button>
            <button onClick={() => bulkAction('unread')} className="btn-ghost p-1.5" title="Mark unread">
              <Mail className="w-3.5 h-3.5" />
            </button>
          </div>
        )}
      </div>

      <div className="flex-1 overflow-y-auto">
        {loading && messages.length === 0 ? (
          <div className="p-3 space-y-1">
            {[...Array(8)].map((_, i) => (
              <div key={i} className="animate-pulse p-3 rounded-xl">
                <div className="h-3.5 bg-surface-3 rounded w-1/3 mb-2" />
                <div className="h-3 bg-surface-3 rounded w-2/3 mb-1" />
                <div className="h-2.5 bg-surface-3 rounded w-full" />
              </div>
            ))}
          </div>
        ) : messages.length === 0 ? (
          <div className="flex items-center justify-center h-full">
            <p className="text-sm text-gray-400 dark:text-zinc-500">No messages</p>
          </div>
        ) : (
          <div className="p-1">
            {messages.map((msg) => (
              <button
                key={msg.id}
                onClick={() => onSelect(msg.id)}
                className={`w-full text-left p-3 rounded-xl transition-colors ${
                  selectedId === msg.id
                    ? 'bg-accent/10'
                    : 'hover:bg-surface-2'
                }`}
              >
                <div className="flex items-start gap-2">
                  <div
                    onClick={(e) => toggleCheck(msg.id, e)}
                    className={`mt-1 w-4 h-4 rounded border flex-shrink-0 flex items-center justify-center cursor-pointer transition-colors ${
                      checkedIds.has(msg.id)
                        ? 'bg-accent border-accent'
                        : 'border-gray-300 dark:border-zinc-600'
                    }`}
                  >
                    {checkedIds.has(msg.id) && (
                      <svg className="w-2.5 h-2.5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                      </svg>
                    )}
                  </div>

                  {msg.unread && (
                    <Circle className="w-2 h-2 fill-accent text-accent mt-1.5 flex-shrink-0" />
                  )}

                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-2">
                      <p
                        className={`text-[13px] truncate ${
                          msg.unread
                            ? 'font-semibold text-gray-900 dark:text-white'
                            : 'text-gray-500 dark:text-zinc-400'
                        }`}
                      >
                        {extractName(msg.from)}
                      </p>
                      <span className="text-[10px] text-gray-300 dark:text-zinc-600 flex-shrink-0 tabular-nums">
                        {msg.date
                          ? formatDistanceToNow(new Date(msg.date), { addSuffix: true })
                          : ''}
                      </span>
                    </div>
                    <p
                      className={`text-[13px] truncate ${
                        msg.unread
                          ? 'text-gray-700 dark:text-zinc-300'
                          : 'text-gray-400 dark:text-zinc-500'
                      }`}
                    >
                      {msg.subject || '(no subject)'}
                    </p>
                    <p className="text-xs text-gray-400 dark:text-zinc-600 truncate mt-0.5">
                      {msg.snippet}
                    </p>
                  </div>
                </div>
              </button>
            ))}

            {nextPageToken && (
              <button
                onClick={loadMore}
                className="w-full py-3 text-center text-xs text-accent hover:text-accent/80 transition-colors"
              >
                Load more
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
