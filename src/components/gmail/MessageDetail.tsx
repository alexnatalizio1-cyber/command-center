'use client';

import { useState, useEffect } from 'react';
import {
  Reply,
  Forward,
  Archive,
  Trash2,
  Mail,
  ArrowLeft,
  Loader2,
} from 'lucide-react';
import { format } from 'date-fns';

interface MessageData {
  id: string;
  threadId: string;
  from: string;
  to: string;
  cc: string;
  subject: string;
  date: string;
  body: string;
  snippet: string;
  unread: boolean;
  labelIds: string[];
}

interface MessageDetailProps {
  messageId: string | null;
  onReply: (message: MessageData) => void;
  onForward: (message: MessageData) => void;
  onArchive: () => void;
  onDelete: () => void;
  onBack: () => void;
}

export default function MessageDetail({
  messageId,
  onReply,
  onForward,
  onArchive,
  onDelete,
  onBack,
}: MessageDetailProps) {
  const [message, setMessage] = useState<MessageData | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!messageId) {
      setMessage(null);
      return;
    }

    const fetchMessage = async () => {
      setLoading(true);
      try {
        const res = await fetch(`/api/gmail/${messageId}`);
        const data = await res.json();
        if (data.error) throw new Error(data.error);
        setMessage(data);

        // Mark as read if unread
        if (data.unread) {
          await fetch(`/api/gmail/${messageId}`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ removeLabelIds: ['UNREAD'] }),
          });
        }
      } catch {
        setMessage(null);
      } finally {
        setLoading(false);
      }
    };

    fetchMessage();
  }, [messageId]);

  const handleArchive = async () => {
    if (!messageId) return;
    await fetch(`/api/gmail/${messageId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ removeLabelIds: ['INBOX'] }),
    });
    onArchive();
  };

  const handleDelete = async () => {
    if (!messageId) return;
    await fetch(`/api/gmail/${messageId}`, { method: 'DELETE' });
    onDelete();
  };

  const handleMarkUnread = async () => {
    if (!messageId) return;
    await fetch(`/api/gmail/${messageId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ addLabelIds: ['UNREAD'] }),
    });
    onBack();
  };

  if (!messageId) {
    return (
      <div className="flex items-center justify-center h-full">
        <p className="text-sm text-gray-400 dark:text-zinc-500">
          Select a message to read
        </p>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <Loader2 className="w-6 h-6 animate-spin text-gray-400 dark:text-zinc-500" />
      </div>
    );
  }

  if (!message) {
    return (
      <div className="flex items-center justify-center h-full">
        <p className="text-sm text-gray-400 dark:text-zinc-500">
          Message not found
        </p>
      </div>
    );
  }

  const extractName = (from: string) => {
    const match = from.match(/^"?([^"<]+)/);
    return match ? match[1].trim() : from;
  };

  const formattedDate = message.date
    ? format(new Date(message.date), 'MMM d, yyyy h:mm a')
    : '';

  return (
    <div className="flex flex-col h-full">
      {/* Action bar */}
      <div className="flex items-center gap-1 p-3 border-b border-border">
        <button onClick={onBack} className="btn-ghost p-2 lg:hidden">
          <ArrowLeft className="w-4 h-4" />
        </button>
        <div className="flex-1" />
        <button onClick={() => onReply(message)} className="btn-ghost p-2" title="Reply">
          <Reply className="w-4 h-4" />
        </button>
        <button onClick={() => onForward(message)} className="btn-ghost p-2" title="Forward">
          <Forward className="w-4 h-4" />
        </button>
        <button onClick={handleArchive} className="btn-ghost p-2" title="Archive">
          <Archive className="w-4 h-4" />
        </button>
        <button onClick={handleDelete} className="btn-ghost p-2" title="Delete">
          <Trash2 className="w-4 h-4" />
        </button>
        <button onClick={handleMarkUnread} className="btn-ghost p-2" title="Mark unread">
          <Mail className="w-4 h-4" />
        </button>
      </div>

      {/* Message header */}
      <div className="p-4 border-b border-border">
        <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-3">
          {message.subject || '(no subject)'}
        </h2>
        <div className="space-y-1 text-sm">
          <div className="flex items-baseline gap-2">
            <span className="text-gray-400 dark:text-zinc-500 w-10 flex-shrink-0">From</span>
            <span className="text-gray-900 dark:text-white font-medium">
              {extractName(message.from)}
            </span>
            <span className="text-gray-400 dark:text-zinc-500 text-xs truncate">
              {message.from.includes('<') ? message.from : ''}
            </span>
          </div>
          <div className="flex items-baseline gap-2">
            <span className="text-gray-400 dark:text-zinc-500 w-10 flex-shrink-0">To</span>
            <span className="text-gray-600 dark:text-zinc-300">{message.to}</span>
          </div>
          {message.cc && (
            <div className="flex items-baseline gap-2">
              <span className="text-gray-400 dark:text-zinc-500 w-10 flex-shrink-0">Cc</span>
              <span className="text-gray-600 dark:text-zinc-300">{message.cc}</span>
            </div>
          )}
          <div className="flex items-baseline gap-2">
            <span className="text-gray-400 dark:text-zinc-500 w-10 flex-shrink-0">Date</span>
            <span className="text-gray-600 dark:text-zinc-300">{formattedDate}</span>
          </div>
        </div>
      </div>

      {/* Message body */}
      <div className="flex-1 overflow-hidden p-4">
        <iframe
          srcDoc={message.body}
          sandbox="allow-same-origin"
          className="w-full h-full border-0 bg-white dark:bg-zinc-900 rounded-lg"
          title="Email content"
        />
      </div>
    </div>
  );
}
