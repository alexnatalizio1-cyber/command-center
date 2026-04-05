'use client';

import { useState } from 'react';
import { ExternalLink, Maximize2, Minimize2 } from 'lucide-react';

interface AITool {
  id: string;
  name: string;
  description: string;
  url: string;
  icon: string;
  color: string;
  lightBg: string;
}

const AI_TOOLS: AITool[] = [
  {
    id: 'claude',
    name: 'Claude',
    description: "Anthropic's AI assistant",
    url: 'https://claude.ai',
    icon: '/icons/claude.svg',
    color: 'from-amber-500/20 to-orange-500/20',
    lightBg: 'from-amber-50 to-orange-50 dark:from-amber-500/20 dark:to-orange-500/20',
  },
  {
    id: 'chatgpt',
    name: 'ChatGPT',
    description: "OpenAI's conversational AI",
    url: 'https://chat.openai.com',
    icon: '/icons/chatgpt.svg',
    color: 'from-emerald-500/20 to-green-500/20',
    lightBg: 'from-emerald-50 to-green-50 dark:from-emerald-500/20 dark:to-green-500/20',
  },
  {
    id: 'gemini',
    name: 'Gemini',
    description: "Google's AI model",
    url: 'https://gemini.google.com',
    icon: '/icons/gemini.svg',
    color: 'from-blue-500/20 to-cyan-500/20',
    lightBg: 'from-blue-50 to-cyan-50 dark:from-blue-500/20 dark:to-cyan-500/20',
  },
  {
    id: 'perplexity',
    name: 'Perplexity',
    description: 'AI-powered search engine',
    url: 'https://perplexity.ai',
    icon: '/icons/perplexity.svg',
    color: 'from-cyan-500/20 to-teal-500/20',
    lightBg: 'from-cyan-50 to-teal-50 dark:from-cyan-500/20 dark:to-teal-500/20',
  },
  {
    id: 'copilot',
    name: 'GitHub Copilot',
    description: 'AI pair programmer',
    url: 'https://github.com/features/copilot',
    icon: '/icons/copilot.svg',
    color: 'from-gray-500/20 to-zinc-500/20',
    lightBg: 'from-gray-50 to-slate-50 dark:from-gray-500/20 dark:to-zinc-500/20',
  },
  {
    id: 'midjourney',
    name: 'Midjourney',
    description: 'AI image generation',
    url: 'https://midjourney.com',
    icon: '/icons/midjourney.svg',
    color: 'from-indigo-500/20 to-blue-500/20',
    lightBg: 'from-indigo-50 to-blue-50 dark:from-indigo-500/20 dark:to-blue-500/20',
  },
];

export default function AIHub() {
  const [activeTool, setActiveTool] = useState<string | null>(null);
  const [fullscreen, setFullscreen] = useState(false);

  if (activeTool) {
    const tool = AI_TOOLS.find((t) => t.id === activeTool)!;
    return (
      <div className={`${fullscreen ? 'fixed inset-0 z-50 bg-surface-0 p-4' : ''} animate-fade-in`}>
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3">
            <button onClick={() => setActiveTool(null)} className="btn-ghost text-sm">
              ← Back
            </button>
            <img src={tool.icon} alt={tool.name} className="w-6 h-6" />
            <h2 className="text-lg font-semibold text-gray-900 dark:text-white">{tool.name}</h2>
          </div>
          <div className="flex items-center gap-2">
            <button onClick={() => setFullscreen(!fullscreen)} className="btn-ghost p-2">
              {fullscreen ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}
            </button>
            <a href={tool.url} target="_blank" rel="noopener noreferrer" className="btn-ghost p-2">
              <ExternalLink className="w-4 h-4" />
            </a>
          </div>
        </div>
        <div className={`iframe-container ${fullscreen ? 'h-[calc(100vh-80px)]' : 'h-[calc(100vh-220px)]'}`}>
          <iframe
            src={tool.url}
            title={tool.name}
            className="w-full h-full rounded-xl border border-border"
            sandbox="allow-same-origin allow-scripts allow-popups allow-forms allow-modals"
          />
        </div>
      </div>
    );
  }

  return (
    <div className="animate-fade-in">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h2 className="text-xl font-bold text-gray-900 dark:text-white">🤖 AI Hub</h2>
          <p className="text-sm text-gray-500 dark:text-zinc-500 mt-1">Quick access to all your AI tools</p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
        {AI_TOOLS.map((tool) => {
          return (
            <div
              key={tool.id}
              className="card cursor-pointer group hover:border-accent/30"
              onClick={() => setActiveTool(tool.id)}
            >
              <div className="flex items-start gap-4">
                <div className={`w-14 h-14 rounded-xl bg-gradient-to-br ${tool.lightBg} flex items-center justify-center flex-shrink-0 shadow-sm`}>
                  <img src={tool.icon} alt={tool.name} className="w-7 h-7" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between">
                    <h3 className="font-semibold text-gray-900 dark:text-white">{tool.name}</h3>
                    <ExternalLink className="w-4 h-4 text-gray-300 dark:text-zinc-600 group-hover:text-gray-500 dark:group-hover:text-zinc-400 transition-colors" />
                  </div>
                  <p className="text-sm text-gray-500 dark:text-zinc-500 mt-0.5">{tool.description}</p>
                </div>
              </div>
              <div className="mt-5 flex gap-2">
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    setActiveTool(tool.id);
                  }}
                  className="text-xs bg-surface-2 text-gray-700 dark:text-zinc-300 px-4 py-2 rounded-xl hover:bg-surface-3 transition-colors font-medium"
                >
                  Open inline
                </button>
                <a
                  href={tool.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  onClick={(e) => e.stopPropagation()}
                  className="text-xs bg-surface-2 text-gray-700 dark:text-zinc-300 px-4 py-2 rounded-xl hover:bg-surface-3 transition-colors font-medium"
                >
                  New tab ↗
                </a>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
