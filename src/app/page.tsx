'use client';

import { useState, useEffect, useCallback } from 'react';
import { useSession, signIn, signOut } from 'next-auth/react';
import { ArrowRight, ArrowUpRight } from 'lucide-react';
import Sidebar from '@/components/Sidebar';
import SearchBar from '@/components/SearchBar';
import ClockWidget from '@/components/ClockWidget';
import WeatherWidget from '@/components/WeatherWidget';
import AIHub from '@/components/AIHub';
import GmailWidget from '@/components/GmailWidget';
import CalendarWidget from '@/components/CalendarWidget';
import DriveWidget from '@/components/DriveWidget';
import NotesPanel from '@/components/NotesPanel';
import TasksPanel from '@/components/TasksPanel';
import BookmarksPanel from '@/components/BookmarksPanel';
import GmailFullView from '@/components/gmail/GmailFullView';
import CalendarFullView from '@/components/calendar/CalendarFullView';
import DriveFullView from '@/components/drive/DriveFullView';
import PinHighPanel from '@/components/PinHighPanel';
import WeeklyFocus from '@/components/WeeklyFocus';
import ContentCalendar from '@/components/ContentCalendar';
import GeminiChat from '@/components/GeminiChat';
import SheetsPanel from '@/components/SheetsPanel';
import WeeklyDigest from '@/components/WeeklyDigest';
import SettingsPanel from '@/components/SettingsPanel';

type View = 'dashboard' | 'ai-hub' | 'gmail' | 'calendar' | 'drive' | 'content' | 'notes' | 'tasks' | 'bookmarks' | 'settings';

function getGreeting() {
  const hour = new Date().getHours();
  if (hour < 12) return 'Good morning';
  if (hour < 17) return 'Good afternoon';
  return 'Good evening';
}

export default function Home() {
  const { data: session } = useSession();
  const [currentView, setCurrentView] = useState<View>('dashboard');
  const [greeting, setGreeting] = useState(getGreeting());
  const [geminiOpen, setGeminiOpen] = useState(false);
  const [geminiEnabled, setGeminiEnabled] = useState(true);
  const [contextCounts, setContextCounts] = useState({ emails: 0, events: 0, tasks: 0, notes: 0 });
  const [refreshKey, setRefreshKey] = useState(0);
  const isAuth = !!session;

  useEffect(() => {
    const timer = setInterval(() => setGreeting(getGreeting()), 60000);
    return () => clearInterval(timer);
  }, []);

  // Check Gemini enabled setting
  useEffect(() => {
    try {
      const stored = localStorage.getItem('gemini-enabled');
      if (stored !== null) {
        setGeminiEnabled(JSON.parse(stored));
      }
    } catch {
      // silent
    }
  }, []);

  // Build context counts from localStorage
  useEffect(() => {
    try {
      const tasks = localStorage.getItem('cc-tasks');
      const notes = localStorage.getItem('cc-notes');
      const taskCount = tasks ? JSON.parse(tasks).filter((t: any) => !t.completed).length : 0;
      const noteCount = notes ? JSON.parse(notes).length : 0;
      setContextCounts((prev) => ({ ...prev, tasks: taskCount, notes: noteCount }));
    } catch {
      // silent
    }
  }, [refreshKey]);

  const handleUiRefresh = useCallback((panels: string[]) => {
    setRefreshKey((k) => k + 1);
  }, []);

  const handleOpenChat = useCallback(() => {
    setGeminiOpen(true);
  }, []);

  const handleOpenDigest = useCallback(() => {
    setCurrentView('dashboard');
    // Digest is visible on the dashboard
  }, []);

  const renderView = () => {
    switch (currentView) {
      case 'dashboard':
        return (
          <div className="animate-fade-in space-y-6">
            {/* Hero: Greeting + Weekly Focus + Search */}
            <div className="grid grid-cols-1 lg:grid-cols-5 gap-5">
              <div className="lg:col-span-2 space-y-4">
                <div>
                  <h2 className="text-[26px] font-bold text-gray-900 dark:text-white tracking-tight leading-tight">
                    {greeting},{' '}
                    <span className="bg-gradient-to-r from-accent to-violet-500 bg-clip-text text-transparent">
                      {session?.user?.name?.split(' ')[0] || 'there'}
                    </span>
                  </h2>
                  <div className="mt-3">
                    <ClockWidget />
                  </div>
                </div>
                <div className="rounded-2xl bg-surface-1 border border-border p-4" style={{ boxShadow: 'var(--shadow-card)' }}>
                  <WeeklyFocus />
                </div>
              </div>
              <div className="lg:col-span-3 space-y-3">
                <SearchBar onNavigate={(v) => setCurrentView(v as View)} />
                <WeatherWidget />
              </div>
            </div>

            {/* Main grid - clickable cards */}
            <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-5">
              {[
                { view: 'gmail' as View, component: <GmailWidget isAuthenticated={isAuth} compact /> },
                { view: 'calendar' as View, component: <CalendarWidget isAuthenticated={isAuth} compact /> },
                { view: 'drive' as View, component: <DriveWidget isAuthenticated={isAuth} compact /> },
                { view: 'tasks' as View, component: <TasksPanel compact key={`tasks-${refreshKey}`} /> },
                { view: 'notes' as View, component: <NotesPanel compact key={`notes-${refreshKey}`} /> },
                { view: 'bookmarks' as View, component: <BookmarksPanel compact /> },
              ].map(({ view, component }) => (
                <div
                  key={view}
                  onClick={() => setCurrentView(view)}
                  className="cursor-pointer group"
                  role="button"
                  tabIndex={0}
                  onKeyDown={(e) => e.key === 'Enter' && setCurrentView(view)}
                >
                  {component}
                </div>
              ))}
            </div>

            {/* PinHigh + AI + Sheets + Digest */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
              <PinHighPanel />

              {/* AI Quick Access */}
              <div className="card">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-sm font-semibold text-gray-500 dark:text-zinc-400">AI Assistants</h3>
                  <button
                    onClick={() => setCurrentView('ai-hub')}
                    className="text-xs text-accent font-medium flex items-center gap-1 hover:gap-1.5 transition-all"
                  >
                    View all <ArrowRight className="w-3 h-3" />
                  </button>
                </div>
                <div className="flex flex-wrap gap-2.5">
                  {[
                    { name: 'Claude', url: 'https://claude.ai', icon: '/icons/claude.svg', bg: 'bg-amber-50 dark:bg-amber-500/10 hover:bg-amber-100 dark:hover:bg-amber-500/15' },
                    { name: 'ChatGPT', url: 'https://chat.openai.com', icon: '/icons/chatgpt.svg', bg: 'bg-emerald-50 dark:bg-emerald-500/10 hover:bg-emerald-100 dark:hover:bg-emerald-500/15' },
                    { name: 'Gemini', url: 'https://gemini.google.com', icon: '/icons/gemini.svg', bg: 'bg-blue-50 dark:bg-blue-500/10 hover:bg-blue-100 dark:hover:bg-blue-500/15' },
                    { name: 'Perplexity', url: 'https://perplexity.ai', icon: '/icons/perplexity.svg', bg: 'bg-cyan-50 dark:bg-cyan-500/10 hover:bg-cyan-100 dark:hover:bg-cyan-500/15' },
                    { name: 'Grok', url: 'https://grok.x.ai', icon: '/icons/grok.svg', bg: 'bg-gray-50 dark:bg-zinc-500/10 hover:bg-gray-100 dark:hover:bg-zinc-500/15' },
                  ].map((ai) => (
                    <a
                      key={ai.name}
                      href={ai.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className={`flex items-center gap-2.5 px-4 py-2.5 rounded-xl ${ai.bg} transition-all duration-200 text-sm text-gray-700 dark:text-zinc-200 font-medium group/ai`}
                    >
                      <img src={ai.icon} alt={ai.name} className="w-5 h-5" />
                      {ai.name}
                      <ArrowUpRight className="w-3 h-3 opacity-0 group-hover/ai:opacity-50 transition-opacity -ml-0.5" />
                    </a>
                  ))}
                </div>
              </div>
            </div>

            {/* Sheets + Weekly Digest */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
              <SheetsPanel />
              <WeeklyDigest />
            </div>
          </div>
        );
      case 'ai-hub':
        return <AIHub onOpenChat={handleOpenChat} onOpenDigest={handleOpenDigest} />;
      case 'gmail':
        return <GmailFullView />;
      case 'calendar':
        return <CalendarFullView />;
      case 'drive':
        return <DriveFullView />;
      case 'content':
        return <ContentCalendar />;
      case 'notes':
        return <NotesPanel />;
      case 'tasks':
        return <TasksPanel />;
      case 'bookmarks':
        return <BookmarksPanel />;
      case 'settings':
        return <SettingsPanel />;
      default:
        return null;
    }
  };

  return (
    <div className="flex min-h-screen bg-surface-0">
      <Sidebar
        currentView={currentView}
        onViewChange={setCurrentView}
        user={session?.user}
        onSignIn={() => signIn('google')}
        onSignOut={() => signOut()}
      />
      <main className="flex-1 ml-[260px] p-8 lg:p-10">
        <div className="max-w-[1280px] mx-auto">
          {renderView()}
        </div>
      </main>

      {/* Gemini Chat - floating, always present when authenticated and enabled */}
      {isAuth && geminiEnabled && (
        <>
          {!geminiOpen && (
            <button
              onClick={() => setGeminiOpen(true)}
              className="fixed bottom-6 right-6 z-50 w-14 h-14 rounded-full flex items-center justify-center shadow-lg transition-all duration-300 hover:scale-110"
              style={{ backgroundColor: '#4285F4' }}
              aria-label="Open Gemini Chat"
            >
              <svg className="w-6 h-6 text-white" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="m12 3-1.912 5.813a2 2 0 0 1-1.275 1.275L3 12l5.813 1.912a2 2 0 0 1 1.275 1.275L12 21l1.912-5.813a2 2 0 0 1 1.275-1.275L21 12l-5.813-1.912a2 2 0 0 1-1.275-1.275L12 3Z" />
                <path d="M5 3v4" />
                <path d="M19 17v4" />
                <path d="M3 5h4" />
                <path d="M17 19h4" />
              </svg>
            </button>
          )}
          <GeminiChat
            isOpen={geminiOpen}
            onClose={() => setGeminiOpen(false)}
            onUiRefresh={handleUiRefresh}
            contextCounts={contextCounts}
          />
        </>
      )}
    </div>
  );
}
