'use client';

import { useState, useEffect } from 'react';
import { RefreshCw, Clock, MapPin, ArrowRight } from 'lucide-react';
import { format, isToday, isTomorrow, parseISO } from 'date-fns';

interface CalendarEvent {
  id: string;
  summary: string;
  start: string;
  end: string;
  location?: string;
  htmlLink?: string;
  allDay: boolean;
}

interface CalendarWidgetProps {
  isAuthenticated: boolean;
  compact?: boolean;
}

export default function CalendarWidget({ isAuthenticated, compact = false }: CalendarWidgetProps) {
  const [events, setEvents] = useState<CalendarEvent[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const fetchEvents = async () => {
    if (!isAuthenticated) return;
    setLoading(true);
    setError('');
    try {
      const res = await fetch('/api/calendar');
      const data = await res.json();
      if (data.error) throw new Error(data.error);
      setEvents(data.events || []);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchEvents(); }, [isAuthenticated]);

  const getDateLabel = (dateStr: string) => {
    const date = parseISO(dateStr);
    if (isToday(date)) return 'Today';
    if (isTomorrow(date)) return 'Tomorrow';
    return format(date, 'EEE, MMM d');
  };

  if (!isAuthenticated) {
    return (
      <div className="card">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-blue-50 dark:bg-blue-500/10 flex items-center justify-center">
            <img src="/icons/calendar.svg" alt="Calendar" className="w-5 h-5" />
          </div>
          <div>
            <p className="text-sm font-semibold text-gray-800 dark:text-zinc-200">Calendar</p>
            <p className="text-xs text-gray-400 dark:text-zinc-500">Sign in to view events</p>
          </div>
        </div>
      </div>
    );
  }

  const displayEvents = compact ? events.slice(0, 4) : events;
  const grouped = displayEvents.reduce<Record<string, CalendarEvent[]>>((acc, event) => {
    const label = getDateLabel(event.start);
    if (!acc[label]) acc[label] = [];
    acc[label].push(event);
    return acc;
  }, {});

  return (
    <div className={compact ? 'card' : 'animate-fade-in'}>
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2.5">
          <div className="w-7 h-7 rounded-lg bg-blue-50 dark:bg-blue-500/10 flex items-center justify-center">
            <img src="/icons/calendar.svg" alt="" className="w-3.5 h-3.5" />
          </div>
          <h3 className="text-sm font-semibold text-gray-800 dark:text-zinc-200">{compact ? 'Upcoming' : 'Calendar'}</h3>
        </div>
        {!compact && (
          <button onClick={(e) => { e.stopPropagation(); fetchEvents(); }} className="btn-ghost p-1.5" disabled={loading}>
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
          </button>
        )}
      </div>

      {error && <p className="text-xs text-red-500 mb-3">{error}</p>}

      <div className="space-y-3">
        {Object.entries(grouped).map(([dateLabel, dayEvents]) => (
          <div key={dateLabel}>
            <p className="text-[10px] font-semibold text-gray-400 dark:text-zinc-600 uppercase tracking-widest mb-1.5">{dateLabel}</p>
            <div className="space-y-0.5">
              {dayEvents.map((event) => (
                <div key={event.id} className="flex items-start gap-2.5 p-2.5 rounded-xl hover:bg-surface-2 transition-all duration-200">
                  <div className="w-0.5 h-7 rounded-full bg-blue-400 flex-shrink-0 mt-0.5" />
                  <div className="flex-1 min-w-0">
                    <p className="text-[13px] font-medium text-gray-900 dark:text-white truncate">{event.summary || 'No title'}</p>
                    <div className="flex items-center gap-2 mt-0.5">
                      {!event.allDay ? (
                        <span className="text-[11px] text-gray-400 dark:text-zinc-500 flex items-center gap-1">
                          <Clock className="w-2.5 h-2.5" />
                          {format(parseISO(event.start), 'h:mm a')}
                        </span>
                      ) : <span className="text-[11px] text-gray-400 dark:text-zinc-500">All day</span>}
                      {event.location && (
                        <span className="text-[11px] text-gray-400 dark:text-zinc-500 flex items-center gap-1 truncate">
                          <MapPin className="w-2.5 h-2.5" />{event.location}
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        ))}
        {displayEvents.length === 0 && !loading && (
          <p className="text-sm text-gray-400 dark:text-zinc-500 text-center py-6">No upcoming events</p>
        )}
        {loading && displayEvents.length === 0 && (
          <div className="space-y-2">
            {[...Array(3)].map((_, i) => (
              <div key={i} className="animate-pulse p-2.5 rounded-xl"><div className="h-3.5 bg-surface-3 rounded w-1/2 mb-2" /><div className="h-3 bg-surface-3 rounded w-1/3" /></div>
            ))}
          </div>
        )}
      </div>

      {compact && (
        <div className="mt-3 pt-3 border-t border-border">
          <span className="text-xs text-accent/80 font-medium flex items-center gap-1 group-hover:text-accent group-hover:gap-1.5 transition-all">
            Open Calendar <ArrowRight className="w-3 h-3" />
          </span>
        </div>
      )}
    </div>
  );
}
