'use client';

import { useState, useCallback } from 'react';
import { Pencil } from 'lucide-react';
import LabelsPanel from './LabelsPanel';
import MessageList from './MessageList';
import MessageDetail from './MessageDetail';
import ComposeModal from './ComposeModal';

interface ReplyMessage {
  id: string;
  threadId: string;
  from: string;
  to: string;
  cc: string;
  subject: string;
  date: string;
  body: string;
}

export default function GmailFullView() {
  const [activeLabel, setActiveLabel] = useState('INBOX');
  const [selectedMessageId, setSelectedMessageId] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [isComposing, setIsComposing] = useState(false);
  const [composeMode, setComposeMode] = useState<'new' | 'reply' | 'forward'>('new');
  const [replyToMessage, setReplyToMessage] = useState<ReplyMessage | null>(null);
  const [listKey, setListKey] = useState(0);

  const refreshList = useCallback(() => {
    setListKey((k) => k + 1);
  }, []);

  const handleReply = (message: ReplyMessage) => {
    setComposeMode('reply');
    setReplyToMessage(message);
    setIsComposing(true);
  };

  const handleForward = (message: ReplyMessage) => {
    setComposeMode('forward');
    setReplyToMessage(message);
    setIsComposing(true);
  };

  const handleCompose = () => {
    setComposeMode('new');
    setReplyToMessage(null);
    setIsComposing(true);
  };

  const handleArchive = () => {
    setSelectedMessageId(null);
    refreshList();
  };

  const handleDelete = () => {
    setSelectedMessageId(null);
    refreshList();
  };

  const handleSent = () => {
    setIsComposing(false);
    setReplyToMessage(null);
    refreshList();
  };

  const handleLabelChange = (labelId: string) => {
    setActiveLabel(labelId);
    setSelectedMessageId(null);
    setSearchQuery('');
  };

  return (
    <div className="h-[calc(100vh-120px)] flex bg-surface-1 border border-border rounded-2xl overflow-hidden relative">
      {/* Labels panel */}
      <div className="w-[220px] border-r border-border flex-shrink-0 overflow-y-auto hidden md:block">
        <div className="p-3">
          <button onClick={handleCompose} className="btn-primary w-full py-2.5 text-sm font-medium flex items-center justify-center gap-2">
            <Pencil className="w-4 h-4" />
            Compose
          </button>
        </div>
        <LabelsPanel activeLabel={activeLabel} onLabelChange={handleLabelChange} />
      </div>

      {/* Message list */}
      <div
        className={`w-full md:w-[380px] border-r border-border flex-shrink-0 overflow-hidden ${
          selectedMessageId ? 'hidden md:flex md:flex-col' : 'flex flex-col'
        }`}
      >
        <MessageList
          key={listKey}
          activeLabel={activeLabel}
          searchQuery={searchQuery}
          selectedId={selectedMessageId}
          onSelect={setSelectedMessageId}
          onSearchChange={setSearchQuery}
        />
      </div>

      {/* Message detail */}
      <div
        className={`flex-1 overflow-hidden ${
          selectedMessageId ? 'flex flex-col' : 'hidden md:flex md:flex-col'
        }`}
      >
        <MessageDetail
          messageId={selectedMessageId}
          onReply={handleReply}
          onForward={handleForward}
          onArchive={handleArchive}
          onDelete={handleDelete}
          onBack={() => setSelectedMessageId(null)}
        />
      </div>

      {/* Compose modal */}
      {isComposing && (
        <ComposeModal
          mode={composeMode}
          replyTo={replyToMessage}
          onClose={() => {
            setIsComposing(false);
            setReplyToMessage(null);
          }}
          onSent={handleSent}
        />
      )}
    </div>
  );
}
