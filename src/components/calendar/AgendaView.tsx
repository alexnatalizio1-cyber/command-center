'use client';

import { useState, useEffect } from 'react';
import { format, parseISO, isToday, isTomorrow, addDays, startOfDay, endOfDay } from 'date-fns';
import { Clock, MapPin, Users } from 'lucide-react';
import type { CalendarEvent } from './CalendarFullView';

interface AgendaViewProps {
  selectedDate: Date;
  onEventClick: (event: CalendarEvent) => void;
  onSlotClick: (date: string, time?: string) => void;
}

export default function AgendaView({ selectedDate, onEventClick, onSlotClick }: AgendaViewProps) {
  const [events, setEvents] = useState<CalendarEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    const fetchEvents = async () => {
      setLoading(true);
      setError('');
      try {
        const timeMin = startOfDay(selectedDate).toISOString();
        const timeMax = endOfDay(addDays(selectedDate, 13)).toISOString();
        const res = await fetch(`/api/calendar?timeMin=${timeMin}&timeMax=${timeMax}`);
        const data = await res.json();
        if (data.error) throw new Error(data.error);
        setEvents(data.events || []);
      } catch (err: any) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    };
    fetchEvents();
  }, [selectedDate]);

  const getDateLabel = (dateStr: string) => {
    const date = parseISO(dateStr);
    if (isToday(date)) return 'Today';
    if (isTomorrow(date)) return 'Tomorrow';
    return format(date, 'EEEE, MMMM d');
  };

  // Group events by day
  const grouped: Record<string, CalendarEvent[]> = {};
  for (const event of events) {
    const dayKey = event.allDay
      ? event.start
      : format(parseISO(event.start), 'yyyy-MM-dd');
    const label = getDateLabel(event.start);
    if (!grouped[label]) grouped[label] = [];
    grouped[label].push(event);
  }

  // Fill in empty days
  const allDays: { label: string; events: CalendarEvent[] }[] = [];
  for (let i = 0; i < 14; i++) {
    const day = addDays(selectedDate, i);
    const dayIso = format(day, 'yyyy-MM-dd');
    let label: string;
    if (isToday(day)) label = 'Today';
    else if (isTomorrow(day)) label = 'Tomorrow';
    else label = format(day, 'EEEE, MMMM d');

    const dayEvents = grouped[label] || [];
    allDays.push({ label, events: dayEvents });
  }

  if (loading) {
    return (
      <div className="space-y-4 overflow-y-auto h-full pr-2">
        {[...Array(5)].map((_, i) => (
          <div key={i} className="animate-pulse">
            <div className="h-3 bg-surface-3 rounded w-32 mb-2" />
            <div className="card p-3">
              <div className="h-4 bg-surface-3 rounded w-2/3 mb-2" />
              <div className="h-3 bg-surface-3 rounded w-1/3" />
            </div>
          </div>
        ))}
      </div>
    );
  }

  if (error) {
    return <p className="text-sm text-red-500 py-4">{error}</p>;
  }

  return (
    <div className="space-y-5 overflow-y-auto h-full pr-2">
      {allDays.map(({ label, events: dayEvents }) => (
        <div key={label}>
          <div className="flex items-center justify-between mb-2">
            <h3 className="text-xs font-semibold text-gray-400 dark:text-zinc-500 uppercase tracking-wider">
              {label}
            </h3>
            <button
              onClick={() => {
                const day = dayEvents.length > 0 ? dayEvents[0].start : undefined;
                const dateStr = day ? format(parseISO(day), 'yyyy-MM-dd') : format(addDays(selectedDate, allDays.findIndex((d) => d.label === label)), 'yyyy-MM-dd');
                onSlotClick(dateStr, '09:00');
              }}
              className="text-[10px] text-gray-400 dark:text-zinc-500 hover:text-blue-500 dark:hover:text-blue-400 transition-colors"
            >
              + Add
            </button>
          </div>

          {dayEvents.length === 0 ? (
            <p className="text-xs text-gray-300 dark:text-zinc-600 py-2 pl-4">No events</p>
          ) : (
            <div className="space-y-1">
              {dayEvents.map((event) => (
                <button
                  key={event.id}
                  onClick={() => onEventClick(event)}
                  className="w-full text-left flex items-start gap-3 p-2.5 rounded-xl hover:bg-surface-2 transition-all duration-200 group"
                >
                  <div className="w-0.5 h-8 rounded-full bg-blue-400 flex-shrink-0 mt-0.5" />
                  <div className="flex-1 min-w-0">
                    <p className="text-[13px] font-medium text-gray-900 dark:text-white truncate">
                      {event.summary || 'No title'}
                    </p>
                    <div className="flex items-center gap-3 mt-0.5">
                      {event.allDay ? (
                        <span className="text-[11px] text-gray-400 dark:text-zinc-500">All day</span>
                      ) : (
                        <span className="text-[11px] text-gray-400 dark:text-zinc-500 flex items-center gap-1">
                          <Clock className="w-2.5 h-2.5" />
                          {format(parseISO(event.start), 'h:mm a')} - {format(parseISO(event.end), 'h:mm a')}
                        </span>
                      )}
                      {event.location && (
                        <span className="text-[11px] text-gray-400 dark:text-zinc-500 flex items-center gap-1 truncate">
                          <MapPin className="w-2.5 h-2.5" />
                          {event.location}
                        </span>
                      )}
                      {event.attendees && event.attendees.length > 0 && (
                        <span className="text-[11px] text-gray-400 dark:text-zinc-500 flex items-center gap-1">
                          <Users className="w-2.5 h-2.5" />
                          {event.attendees.length}
                        </span>
                      )}
                    </div>
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>
      ))}
    </div>
  );
}
