'use client';

import { Home, Mail, CheckSquare, StickyNote, Settings } from 'lucide-react';

type View = 'dashboard' | 'ai-hub' | 'gmail' | 'calendar' | 'drive' | 'content' | 'notes' | 'tasks' | 'bookmarks' | 'market-research' | 'settings';

interface MobileTabBarProps {
  currentView: View;
  onViewChange: (view: View) => void;
}

const TABS: { id: View; label: string; icon: typeof Home }[] = [
  { id: 'dashboard', label: 'Home', icon: Home },
  { id: 'gmail', label: 'Inbox', icon: Mail },
  { id: 'tasks', label: 'Tasks', icon: CheckSquare },
  { id: 'notes', label: 'Notes', icon: StickyNote },
  { id: 'settings', label: 'Settings', icon: Settings },
];

export default function MobileTabBar({ currentView, onViewChange }: MobileTabBarProps) {
  return (
    <nav
      className="md:hidden fixed bottom-0 left-0 right-0 z-40 bg-zinc-900/90 backdrop-blur-lg border-t border-white/10"
      style={{ paddingBottom: 'env(safe-area-inset-bottom, 0px)', height: 'calc(60px + env(safe-area-inset-bottom, 0px))' }}
    >
      <div className="flex items-center justify-around h-[60px]">
        {TABS.map((tab) => {
          const isActive = currentView === tab.id;
          const Icon = tab.icon;
          return (
            <button
              key={tab.id}
              onClick={() => onViewChange(tab.id)}
              className={`flex flex-col items-center justify-center gap-0.5 min-w-[44px] min-h-[44px] px-3 py-1 rounded-xl transition-colors relative ${
                isActive
                  ? 'text-green-400'
                  : 'text-zinc-500 hover:text-zinc-300'
              }`}
              aria-label={tab.label}
            >
              <Icon className="w-5 h-5" />
              <span className="text-[10px] font-medium">{tab.label}</span>
              {isActive && (
                <span className="absolute bottom-0 left-1/2 -translate-x-1/2 w-5 h-0.5 rounded-full bg-green-400" />
              )}
            </button>
          );
        })}
      </div>
    </nav>
  );
}
