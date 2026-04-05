'use client';

import { useState, useEffect } from 'react';
import { Plus, ChevronLeft, ChevronRight, X, Trash2 } from 'lucide-react';
import { useLocalStorage } from '@/hooks/useLocalStorage';
import {
  startOfWeek,
  endOfWeek,
  eachDayOfInterval,
  format,
  addWeeks,
  subWeeks,
  isToday,
  isSameWeek,
} from 'date-fns';

type Platform = 'LinkedIn' | 'Instagram' | 'YouTube' | 'Email';
type Status = 'idea' | 'drafted' | 'scheduled' | 'posted';

interface ContentItem {
  id: string;
  date: string; // YYYY-MM-DD
  platform: Platform;
  title: string;
  status: Status;
}

const PLATFORM_CONFIG: Record<Platform, { color: string; bg: string; emoji: string }> = {
  LinkedIn: { color: 'text-blue-600 dark:text-blue-400', bg: 'bg-blue-50 dark:bg-blue-500/10 border-blue-200 dark:border-blue-500/20', emoji: '💼' },
  Instagram: { color: 'text-pink-600 dark:text-pink-400', bg: 'bg-pink-50 dark:bg-pink-500/10 border-pink-200 dark:border-pink-500/20', emoji: '📸' },
  YouTube: { color: 'text-red-600 dark:text-red-400', bg: 'bg-red-50 dark:bg-red-500/10 border-red-200 dark:border-red-500/20', emoji: '🎬' },
  Email: { color: 'text-green-600 dark:text-green-400', bg: 'bg-green-50 dark:bg-green-500/10 border-green-200 dark:border-green-500/20', emoji: '📧' },
};

const STATUS_CONFIG: Record<Status, { label: string; dot: string }> = {
  idea: { label: 'Idea', dot: 'bg-gray-400 dark:bg-zinc-500' },
  drafted: { label: 'Drafted', dot: 'bg-yellow-400' },
  scheduled: { label: 'Scheduled', dot: 'bg-blue-400' },
  posted: { label: 'Posted', dot: 'bg-green-500' },
};

export default function ContentCalendar() {
  const [items, setItems] = useLocalStorage<ContentItem[]>('cc-content-calendar', []);
  const [currentWeekStart, setCurrentWeekStart] = useState(() =>
    startOfWeek(new Date(), { weekStartsOn: 1 })
  );
  const [showModal, setShowModal] = useState(false);
  const [modalDay, setModalDay] = useState('');
  const [modalPlatform, setModalPlatform] = useState<Platform>('LinkedIn');
  const [modalTitle, setModalTitle] = useState('');
  const [modalStatus, setModalStatus] = useState<Status>('idea');
  const [mounted, setMounted] = useState(false);

  useEffect(() => setMounted(true), []);

  const days = eachDayOfInterval({
    start: currentWeekStart,
    end: endOfWeek(currentWeekStart, { weekStartsOn: 1 }),
  });

  const isThisWeek = isSameWeek(currentWeekStart, new Date(), { weekStartsOn: 1 });

  const openAddModal = (day?: string) => {
    setModalDay(day || format(new Date(), 'yyyy-MM-dd'));
    setModalPlatform('LinkedIn');
    setModalTitle('');
    setModalStatus('idea');
    setShowModal(true);
  };

  const addItem = () => {
    if (!modalTitle.trim()) return;
    const item: ContentItem = {
      id: Date.now().toString(),
      date: modalDay,
      platform: modalPlatform,
      title: modalTitle.trim(),
      status: modalStatus,
    };
    setItems((prev) => [...prev, item]);
    setShowModal(false);
  };

  const deleteItem = (id: string) => {
    setItems((prev) => prev.filter((i) => i.id !== id));
  };

  const cycleStatus = (id: string) => {
    const order: Status[] = ['idea', 'drafted', 'scheduled', 'posted'];
    setItems((prev) =>
      prev.map((item) => {
        if (item.id !== id) return item;
        const idx = order.indexOf(item.status);
        return { ...item, status: order[(idx + 1) % order.length] };
      })
    );
  };

  if (!mounted) return null;

  return (
    <div className="animate-fade-in">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-xl font-bold text-gray-900 dark:text-white">📅 Content Calendar</h2>
          <p className="text-sm text-gray-500 dark:text-zinc-500 mt-0.5">
            {format(currentWeekStart, 'MMM d')} – {format(endOfWeek(currentWeekStart, { weekStartsOn: 1 }), 'MMM d, yyyy')}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <div className="flex items-center bg-surface-2 rounded-xl p-0.5">
            <button
              onClick={() => setCurrentWeekStart(subWeeks(currentWeekStart, 1))}
              className="p-2 rounded-lg hover:bg-surface-3 transition-colors"
            >
              <ChevronLeft className="w-4 h-4 text-gray-500 dark:text-zinc-400" />
            </button>
            <button
              onClick={() => setCurrentWeekStart(startOfWeek(new Date(), { weekStartsOn: 1 }))}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                isThisWeek
                  ? 'bg-accent text-white'
                  : 'text-gray-500 dark:text-zinc-400 hover:bg-surface-3'
              }`}
            >
              Today
            </button>
            <button
              onClick={() => setCurrentWeekStart(addWeeks(currentWeekStart, 1))}
              className="p-2 rounded-lg hover:bg-surface-3 transition-colors"
            >
              <ChevronRight className="w-4 h-4 text-gray-500 dark:text-zinc-400" />
            </button>
          </div>
          <button onClick={() => openAddModal()} className="btn-primary text-sm py-2 px-4 flex items-center gap-1.5">
            <Plus className="w-3.5 h-3.5" /> Add
          </button>
        </div>
      </div>

      {/* Week Grid */}
      <div className="grid grid-cols-7 gap-3">
        {days.map((day) => {
          const dayKey = format(day, 'yyyy-MM-dd');
          const dayItems = items.filter((i) => i.date === dayKey);
          const today = isToday(day);

          return (
            <div
              key={dayKey}
              className={`rounded-2xl border p-3 min-h-[160px] transition-all ${
                today
                  ? 'border-accent/30 bg-accent/[0.02] dark:bg-accent/[0.04]'
                  : 'border-border bg-surface-1'
              }`}
              style={{ boxShadow: 'var(--shadow-card)' }}
            >
              {/* Day Header */}
              <div className="flex items-center justify-between mb-2">
                <div>
                  <p className="text-[10px] font-medium text-gray-400 dark:text-zinc-500 uppercase">
                    {format(day, 'EEE')}
                  </p>
                  <p className={`text-lg font-bold ${
                    today ? 'text-accent' : 'text-gray-900 dark:text-white'
                  }`}>
                    {format(day, 'd')}
                  </p>
                </div>
                <button
                  onClick={() => openAddModal(dayKey)}
                  className="w-6 h-6 rounded-lg hover:bg-surface-2 flex items-center justify-center text-gray-300 dark:text-zinc-600 hover:text-gray-500 dark:hover:text-zinc-400 transition-colors"
                >
                  <Plus className="w-3 h-3" />
                </button>
              </div>

              {/* Content Items */}
              <div className="space-y-1.5">
                {dayItems.map((item) => {
                  const platform = PLATFORM_CONFIG[item.platform];
                  const status = STATUS_CONFIG[item.status];
                  return (
                    <div
                      key={item.id}
                      className={`group relative p-2 rounded-lg border text-left ${platform.bg} cursor-pointer transition-all hover:scale-[1.02]`}
                      onClick={() => cycleStatus(item.id)}
                      title={`Click to change status (${status.label})`}
                    >
                      <div className="flex items-start gap-1.5">
                        <span className="text-xs flex-shrink-0">{platform.emoji}</span>
                        <div className="flex-1 min-w-0">
                          <p className={`text-[11px] font-medium truncate ${platform.color}`}>
                            {item.title}
                          </p>
                          <div className="flex items-center gap-1 mt-0.5">
                            <span className={`w-1.5 h-1.5 rounded-full ${status.dot}`} />
                            <span className="text-[9px] text-gray-400 dark:text-zinc-500">{status.label}</span>
                          </div>
                        </div>
                      </div>
                      <button
                        onClick={(e) => { e.stopPropagation(); deleteItem(item.id); }}
                        className="absolute top-1 right-1 opacity-0 group-hover:opacity-100 p-0.5 rounded hover:bg-red-100 dark:hover:bg-red-500/20 transition-all"
                      >
                        <Trash2 className="w-2.5 h-2.5 text-red-400" />
                      </button>
                    </div>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>

      {/* Legend */}
      <div className="flex items-center gap-4 mt-4 text-[10px] text-gray-400 dark:text-zinc-500">
        <span className="font-medium">Platforms:</span>
        {Object.entries(PLATFORM_CONFIG).map(([name, config]) => (
          <span key={name} className="flex items-center gap-1">
            {config.emoji} {name}
          </span>
        ))}
        <span className="ml-4 font-medium">Click item to cycle status</span>
      </div>

      {/* Add Modal */}
      {showModal && (
        <div className="fixed inset-0 z-[80] flex items-center justify-center bg-black/30 dark:bg-black/50 backdrop-blur-sm">
          <div className="bg-surface-1 border border-border rounded-2xl p-6 w-full max-w-md mx-4 shadow-xl animate-slide-up">
            <div className="flex items-center justify-between mb-5">
              <h3 className="text-base font-semibold text-gray-900 dark:text-white">Add Content</h3>
              <button onClick={() => setShowModal(false)} className="btn-ghost p-1.5">
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-4">
              {/* Day */}
              <div>
                <label className="text-xs font-medium text-gray-500 dark:text-zinc-400 mb-1.5 block">Day</label>
                <input
                  type="date"
                  value={modalDay}
                  onChange={(e) => setModalDay(e.target.value)}
                  className="input-base w-full text-sm"
                />
              </div>

              {/* Platform */}
              <div>
                <label className="text-xs font-medium text-gray-500 dark:text-zinc-400 mb-1.5 block">Platform</label>
                <div className="grid grid-cols-4 gap-2">
                  {(Object.keys(PLATFORM_CONFIG) as Platform[]).map((p) => {
                    const config = PLATFORM_CONFIG[p];
                    return (
                      <button
                        key={p}
                        onClick={() => setModalPlatform(p)}
                        className={`flex flex-col items-center gap-1 p-2.5 rounded-xl border transition-all text-xs font-medium ${
                          modalPlatform === p
                            ? `${config.bg} ${config.color} border-current`
                            : 'border-border text-gray-400 dark:text-zinc-500 hover:bg-surface-2'
                        }`}
                      >
                        <span className="text-base">{config.emoji}</span>
                        {p}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Title */}
              <div>
                <label className="text-xs font-medium text-gray-500 dark:text-zinc-400 mb-1.5 block">Title</label>
                <input
                  type="text"
                  value={modalTitle}
                  onChange={(e) => setModalTitle(e.target.value)}
                  placeholder="What's the content about?"
                  className="input-base w-full text-sm"
                  autoFocus
                  onKeyDown={(e) => e.key === 'Enter' && addItem()}
                />
              </div>

              {/* Status */}
              <div>
                <label className="text-xs font-medium text-gray-500 dark:text-zinc-400 mb-1.5 block">Status</label>
                <div className="grid grid-cols-4 gap-2">
                  {(Object.keys(STATUS_CONFIG) as Status[]).map((s) => {
                    const config = STATUS_CONFIG[s];
                    return (
                      <button
                        key={s}
                        onClick={() => setModalStatus(s)}
                        className={`flex items-center justify-center gap-1.5 p-2 rounded-xl border transition-all text-xs font-medium ${
                          modalStatus === s
                            ? 'bg-surface-2 border-accent/30 text-gray-800 dark:text-zinc-200'
                            : 'border-border text-gray-400 dark:text-zinc-500 hover:bg-surface-2'
                        }`}
                      >
                        <span className={`w-2 h-2 rounded-full ${config.dot}`} />
                        {config.label}
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>

            <div className="flex justify-end gap-2 mt-6">
              <button onClick={() => setShowModal(false)} className="btn-ghost text-sm px-4 py-2">
                Cancel
              </button>
              <button onClick={addItem} className="btn-primary text-sm px-5 py-2">
                Add Content
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
