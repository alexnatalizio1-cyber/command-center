'use client';

import { useState } from 'react';
import { X, Minus, Loader2, ChevronDown, ChevronUp } from 'lucide-react';

interface ReplyTo {
  id: string;
  threadId: string;
  from: string;
  to: string;
  cc: string;
  subject: string;
  date: string;
  body: string;
}

interface ComposeModalProps {
  mode: 'new' | 'reply' | 'forward';
  replyTo?: ReplyTo | null;
  onClose: () => void;
  onSent: () => void;
}

export default function ComposeModal({ mode, replyTo, onClose, onSent }: ComposeModalProps) {
  const getInitialTo = () => {
    if (mode === 'reply' && replyTo) {
      const match = replyTo.from.match(/<([^>]+)>/);
      return match ? match[1] : replyTo.from;
    }
    return '';
  };

  const getInitialSubject = () => {
    if (!replyTo) return '';
    if (mode === 'reply') {
      const subj = replyTo.subject;
      return subj.startsWith('Re:') ? subj : `Re: ${subj}`;
    }
    if (mode === 'forward') {
      const subj = replyTo.subject;
      return subj.startsWith('Fwd:') ? subj : `Fwd: ${subj}`;
    }
    return '';
  };

  const getInitialBody = () => {
    if (!replyTo) return '';
    const quotedDate = replyTo.date;
    const quotedFrom = replyTo.from;
    if (mode === 'reply') {
      return `<br/><br/><div style="border-left:2px solid #ccc;padding-left:12px;margin-left:0;color:#666">On ${quotedDate}, ${quotedFrom} wrote:<br/>${replyTo.body}</div>`;
    }
    if (mode === 'forward') {
      return `<br/><br/>---------- Forwarded message ----------<br/>From: ${quotedFrom}<br/>Date: ${quotedDate}<br/>Subject: ${replyTo.subject}<br/>To: ${replyTo.to}<br/><br/>${replyTo.body}`;
    }
    return '';
  };

  const [to, setTo] = useState(getInitialTo());
  const [cc, setCc] = useState(mode === 'reply' && replyTo?.cc ? replyTo.cc : '');
  const [bcc, setBcc] = useState('');
  const [subject, setSubject] = useState(getInitialSubject());
  const [body, setBody] = useState(getInitialBody());
  const [showCc, setShowCc] = useState(!!cc);
  const [showBcc, setShowBcc] = useState(false);
  const [sending, setSending] = useState(false);
  const [minimized, setMinimized] = useState(false);
  const [error, setError] = useState('');

  const handleSend = async () => {
    if (!to || !subject) {
      setError('To and Subject are required');
      return;
    }
    setSending(true);
    setError('');

    try {
      const payload: Record<string, string | undefined> = {
        to,
        subject,
        body: body || '<p></p>',
      };
      if (cc) payload.cc = cc;
      if (bcc) payload.bcc = bcc;
      if (mode === 'reply' && replyTo) {
        payload.threadId = replyTo.threadId;
        payload.inReplyTo = replyTo.id;
        payload.references = replyTo.id;
      }

      const res = await fetch('/api/gmail/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (data.error) throw new Error(data.error);
      onSent();
    } catch (err: any) {
      setError(err.message || 'Failed to send');
    } finally {
      setSending(false);
    }
  };

  const title =
    mode === 'reply' ? 'Reply' : mode === 'forward' ? 'Forward' : 'New Message';

  return (
    <div
      className={`fixed bottom-0 right-6 z-50 bg-surface-1 border border-border rounded-t-2xl shadow-2xl transition-all ${
        minimized ? 'w-72' : 'w-[520px]'
      }`}
    >
      {/* Title bar */}
      <div
        className="flex items-center justify-between px-4 py-2.5 bg-surface-2 rounded-t-2xl cursor-pointer"
        onClick={() => setMinimized(!minimized)}
      >
        <span className="text-sm font-semibold text-gray-900 dark:text-white">
          {title}
        </span>
        <div className="flex items-center gap-1">
          <button
            onClick={(e) => {
              e.stopPropagation();
              setMinimized(!minimized);
            }}
            className="btn-ghost p-1"
          >
            {minimized ? (
              <ChevronUp className="w-4 h-4" />
            ) : (
              <Minus className="w-4 h-4" />
            )}
          </button>
          <button
            onClick={(e) => {
              e.stopPropagation();
              onClose();
            }}
            className="btn-ghost p-1"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>

      {!minimized && (
        <div className="p-4 space-y-3">
          {/* To */}
          <div className="flex items-center gap-2">
            <label className="text-xs text-gray-400 dark:text-zinc-500 w-8">To</label>
            <input
              type="text"
              value={to}
              onChange={(e) => setTo(e.target.value)}
              className="input-base flex-1 text-sm py-1.5"
              placeholder="recipient@email.com"
            />
            <div className="flex items-center gap-1 text-xs">
              {!showCc && (
                <button
                  onClick={() => setShowCc(true)}
                  className="text-gray-400 dark:text-zinc-500 hover:text-gray-600 dark:hover:text-zinc-300"
                >
                  Cc
                </button>
              )}
              {!showBcc && (
                <button
                  onClick={() => setShowBcc(true)}
                  className="text-gray-400 dark:text-zinc-500 hover:text-gray-600 dark:hover:text-zinc-300"
                >
                  Bcc
                </button>
              )}
            </div>
          </div>

          {/* CC */}
          {showCc && (
            <div className="flex items-center gap-2">
              <label className="text-xs text-gray-400 dark:text-zinc-500 w-8">Cc</label>
              <input
                type="text"
                value={cc}
                onChange={(e) => setCc(e.target.value)}
                className="input-base flex-1 text-sm py-1.5"
              />
            </div>
          )}

          {/* BCC */}
          {showBcc && (
            <div className="flex items-center gap-2">
              <label className="text-xs text-gray-400 dark:text-zinc-500 w-8">Bcc</label>
              <input
                type="text"
                value={bcc}
                onChange={(e) => setBcc(e.target.value)}
                className="input-base flex-1 text-sm py-1.5"
              />
            </div>
          )}

          {/* Subject */}
          <div className="flex items-center gap-2">
            <label className="text-xs text-gray-400 dark:text-zinc-500 w-8">Subj</label>
            <input
              type="text"
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
              className="input-base flex-1 text-sm py-1.5"
            />
          </div>

          {/* Body */}
          <textarea
            value={body}
            onChange={(e) => setBody(e.target.value)}
            rows={10}
            className="input-base w-full text-sm resize-none"
            placeholder="Compose your message..."
          />

          {error && <p className="text-xs text-red-500">{error}</p>}

          {/* Actions */}
          <div className="flex items-center justify-between">
            <button
              onClick={handleSend}
              disabled={sending}
              className="btn-primary px-6 py-2 text-sm font-medium flex items-center gap-2"
            >
              {sending && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
              Send
            </button>
            <button onClick={onClose} className="btn-ghost px-3 py-2 text-sm">
              Discard
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
