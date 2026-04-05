'use client';

import { useState } from 'react';
import {
  ExternalLink,
  Terminal,
  FileText,
  MessageSquare,
  Zap,
  Video,
  Clock,
  Send,
} from 'lucide-react';

interface AIToolCard {
  id: string;
  name: string;
  role: string;
  accent: string;
  letter: string;
  note?: string;
  url?: string;
  actions: { label: string; icon: any; action: 'link' | 'chat' | 'digest' | 'terminal' | 'docs' }[];
}

const AI_TOOLS: AIToolCard[] = [
  {
    id: 'claude',
    name: 'Claude',
    role: 'Strategy & Analysis',
    accent: '#A855F7',
    letter: 'C',
    url: 'https://claude.ai',
    actions: [
      { label: 'Open Claude', icon: ExternalLink, action: 'link' },
      { label: 'New conversation', icon: MessageSquare, action: 'link' },
    ],
  },
  {
    id: 'claude-code',
    name: 'Claude Code',
    role: 'Builder',
    accent: '#4ADE6B',
    letter: 'CC',
    note: 'CLI Tool',
    actions: [
      { label: 'Open Terminal', icon: Terminal, action: 'terminal' },
      { label: 'View docs', icon: FileText, action: 'docs' },
    ],
  },
  {
    id: 'gemini',
    name: 'Gemini',
    role: 'Agent',
    accent: '#4285F4',
    letter: 'G',
    actions: [
      { label: 'Open Chat', icon: MessageSquare, action: 'chat' },
      { label: 'Weekly Digest', icon: Zap, action: 'digest' },
    ],
  },
  {
    id: 'heygen',
    name: 'HeyGen',
    role: 'Video Production',
    accent: '#F97316',
    letter: 'H',
    url: 'https://heygen.com',
    actions: [
      { label: 'Open HeyGen', icon: Video, action: 'link' },
      { label: 'Create Avatar', icon: ExternalLink, action: 'link' },
    ],
  },
  {
    id: 'buffer',
    name: 'Buffer',
    role: 'Publishing',
    accent: '#14B8A6',
    letter: 'B',
    url: 'https://buffer.com',
    actions: [
      { label: 'Open Buffer', icon: Send, action: 'link' },
      { label: 'Schedule Post', icon: Clock, action: 'link' },
    ],
  },
];

interface AIHubProps {
  onOpenChat?: () => void;
  onOpenDigest?: () => void;
}

export default function AIHub({ onOpenChat, onOpenDigest }: AIHubProps) {
  const [onlineStatuses] = useState<Record<string, boolean>>({
    claude: true,
    'claude-code': true,
    gemini: true,
    heygen: true,
    buffer: true,
  });

  const handleAction = (tool: AIToolCard, action: AIToolCard['actions'][number]) => {
    switch (action.action) {
      case 'link':
        if (tool.url) {
          window.open(tool.url, '_blank', 'noopener,noreferrer');
        }
        break;
      case 'chat':
        onOpenChat?.();
        break;
      case 'digest':
        onOpenDigest?.();
        break;
      case 'terminal':
        // Could open terminal instructions or docs
        window.open('https://docs.anthropic.com/en/docs/claude-code', '_blank', 'noopener,noreferrer');
        break;
      case 'docs':
        window.open('https://docs.anthropic.com/en/docs/claude-code', '_blank', 'noopener,noreferrer');
        break;
    }
  };

  return (
    <div className="animate-fade-in">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h2 className="text-xl font-bold text-gray-900 dark:text-white">PinHigh AI System</h2>
          <p className="text-sm text-gray-500 dark:text-zinc-500 mt-1">Your AI-powered team for building PinHigh</p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5">
        {AI_TOOLS.map((tool) => {
          const isOnline = onlineStatuses[tool.id] ?? false;

          return (
            <div key={tool.id} className="card group">
              <div className="flex items-start gap-4">
                {/* Icon circle */}
                <div
                  className="w-12 h-12 rounded-full flex items-center justify-center flex-shrink-0 text-white font-bold text-sm"
                  style={{ backgroundColor: tool.accent }}
                >
                  {tool.letter}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <h3 className="font-semibold text-gray-900 dark:text-white">{tool.name}</h3>
                    <span
                      className="w-2 h-2 rounded-full flex-shrink-0"
                      style={{ backgroundColor: isOnline ? '#22c55e' : '#ef4444' }}
                      title={isOnline ? 'Online' : 'Offline'}
                    />
                  </div>
                  <p className="text-sm text-gray-500 dark:text-zinc-400 mt-0.5">{tool.role}</p>
                  {tool.note && (
                    <span className="inline-block mt-1 text-[10px] font-medium px-2 py-0.5 rounded-full bg-surface-2 text-gray-500 dark:text-zinc-400">
                      {tool.note}
                    </span>
                  )}
                </div>
              </div>

              {/* Quick Actions */}
              <div className="mt-4 flex gap-2">
                {tool.actions.map((action) => {
                  const Icon = action.icon;
                  return (
                    <button
                      key={action.label}
                      onClick={() => handleAction(tool, action)}
                      className="flex-1 text-xs bg-surface-2 text-gray-700 dark:text-zinc-300 px-3 py-2.5 rounded-xl hover:bg-surface-3 transition-colors font-medium flex items-center justify-center gap-1.5 min-h-[44px]"
                    >
                      <Icon className="w-3.5 h-3.5" />
                      {action.label}
                    </button>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
