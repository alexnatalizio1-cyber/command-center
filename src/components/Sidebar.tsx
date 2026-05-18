'use client';

import { useTheme } from 'next-themes';
import { useEffect, useState } from 'react';
import {
  LayoutDashboard,
  Bot,
  Mail,
  Calendar,
  HardDrive,
  StickyNote,
  CheckSquare,
  Bookmark,
  LogIn,
  LogOut,
  User,
  Sun,
  Moon,
  Command,
  Megaphone,
  Target,
  Settings,
} from 'lucide-react';

type View =
  | 'dashboard'
  | 'ai-hub'
  | 'gmail'
  | 'calendar'
  | 'drive'
  | 'content'
  | 'notes'
  | 'tasks'
  | 'bookmarks'
  | 'market-research'
  | 'settings';

interface SidebarProps {
  currentView: View;
  onViewChange: (view: View) => void;
  user: any;
  onSignIn: () => void;
  onSignOut: () => void;
}

const NAV_ITEMS: { id: View; label: string; icon: any; section?: string; color?: string }[] = [
  { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard, section: 'Overview', color: '#6366f1' },
  { id: 'ai-hub', label: 'AI Hub', icon: Bot, section: 'Tools', color: '#8B5CF6' },
  { id: 'gmail', label: 'Gmail', icon: Mail, section: 'Google', color: '#EA4335' },
  { id: 'calendar', label: 'Calendar', icon: Calendar, color: '#4285F4' },
  { id: 'drive', label: 'Drive', icon: HardDrive, color: '#0F9D58' },
  { id: 'content', label: 'Content', icon: Megaphone, section: 'Workspace', color: '#EC4899' },
  { id: 'notes', label: 'Notes', icon: StickyNote, color: '#F59E0B' },
  { id: 'tasks', label: 'Tasks', icon: CheckSquare, color: '#10B981' },
  { id: 'bookmarks', label: 'Bookmarks', icon: Bookmark, color: '#8B5CF6' },
  { id: 'market-research', label: 'Market Research', icon: Target, section: 'Sales', color: '#6366f1' },
  { id: 'settings', label: 'Settings', icon: Settings, section: 'System', color: '#6B7280' },
];

export default function Sidebar({ currentView, onViewChange, user, onSignIn, onSignOut }: SidebarProps) {
  const { theme, setTheme } = useTheme();
  const [mounted, setMounted] = useState(false);
  let lastSection = '';

  useEffect(() => setMounted(true), []);

  return (
    <aside className="hidden md:flex w-[260px] h-screen bg-surface-1 border-r border-border flex-col fixed left-0 top-0 z-30">
      {/* Logo + Theme Toggle */}
      <div className="px-5 py-4 border-b border-border">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-accent to-violet-500 flex items-center justify-center">
              <Command className="w-4 h-4 text-white" />
            </div>
            <span className="text-[15px] font-semibold text-gray-900 dark:text-white tracking-tight">Command</span>
          </div>
          {mounted && (
            <button
              onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
              className="w-8 h-8 rounded-lg hover:bg-surface-2 flex items-center justify-center transition-all duration-200"
              title={theme === 'dark' ? 'Light mode' : 'Dark mode'}
            >
              {theme === 'dark' ? (
                <Sun className="w-4 h-4 text-amber-400" />
              ) : (
                <Moon className="w-4 h-4 text-gray-400" />
              )}
            </button>
          )}
        </div>
      </div>

      {/* Navigation */}
      <nav className="flex-1 overflow-y-auto px-3 py-3 space-y-0.5">
        {NAV_ITEMS.map((item) => {
          const showSection = item.section && item.section !== lastSection;
          if (item.section) lastSection = item.section;
          const Icon = item.icon;
          const isActive = currentView === item.id;
          return (
            <div key={item.id}>
              {showSection && (
                <p className="text-[11px] font-medium text-gray-400 dark:text-zinc-600 uppercase tracking-widest px-4 pt-5 pb-1.5">
                  {item.section}
                </p>
              )}
              <button
                onClick={() => onViewChange(item.id)}
                className={`sidebar-link w-full ${isActive ? 'active' : ''}`}
              >
                <Icon
                  className="w-4 h-4 flex-shrink-0 transition-colors duration-200"
                  style={{ color: isActive ? item.color : undefined }}
                />
                <span className="flex-1 text-left">{item.label}</span>
                {isActive && (
                  <div className="w-1.5 h-1.5 rounded-full bg-accent" />
                )}
              </button>
            </div>
          );
        })}
      </nav>

      {/* User */}
      <div className="px-3 py-3 border-t border-border">
        {user ? (
          <div className="flex items-center gap-2.5 px-3 py-2">
            {user.image ? (
              <img src={user.image} alt="" className="w-8 h-8 rounded-full" />
            ) : (
              <div className="w-8 h-8 rounded-full bg-surface-3 flex items-center justify-center">
                <User className="w-3.5 h-3.5 text-gray-400 dark:text-zinc-400" />
              </div>
            )}
            <div className="flex-1 min-w-0">
              <p className="text-[13px] font-medium text-gray-900 dark:text-white truncate">{user.name}</p>
              <p className="text-[11px] text-gray-400 dark:text-zinc-500 truncate">{user.email}</p>
            </div>
            <button onClick={onSignOut} className="text-gray-300 dark:text-zinc-600 hover:text-gray-500 dark:hover:text-white transition-colors p-1">
              <LogOut className="w-3.5 h-3.5" />
            </button>
          </div>
        ) : (
          <button onClick={onSignIn} className="w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-accent/10 text-accent hover:bg-accent/15 transition-all text-[13px] font-medium">
            <LogIn className="w-3.5 h-3.5" />
            Sign in with Google
          </button>
        )}
      </div>
    </aside>
  );
}
