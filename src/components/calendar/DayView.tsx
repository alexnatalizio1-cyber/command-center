'use client';

import { useState, useEffect } from 'react';
import { format, parseISO, startOfDay, endOfDay, differenceInMinutes, isSameDay } from 'date-fns';
import type { CalendarEvent } from './CalendarFullView';

interface DayViewProps {
  selectedDate: Date;
  onEventClick: (event: CalendarEvent) => void;
  onSlotClick: (date: string, time?: string) => void;
}

const START_HOUR = 7;
const END_HOUR = 22;
const TOTAL_MINUTES = (END_HOUR - START_HOUR) * 60;

function getEventPosition(event: CalendarEvent) {
  const start = parseISO(event.start);
  const end = parseISO(event.end);
  const startMin = start.getHours() * 60 + start.getMinutes();
  const endMin = end.getHours() * 60 + end.getMinutes();
  const top = ((startMin - START_HOUR * 60) / TOTAL_MINUTES) * 100;
  const height = ((endMin - startMin) / TOTAL_MINUTES) * 100;
  return {
    top: `${Math.max(0, top)}%`,
    height: `${Math.max(1.5, height)}%`,
  };
}

export default function DayView({ selectedDate, onEventClick, onSlotClick }: DayViewProps) {
  const [events, setEvents] = useState<CalendarEvent[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchEvents = async () => {
      setLoading(true);
      try {
        const timeMin = startOfDay(selectedDate).toISOString();
        const timeMax = endOfDay(selectedDate).toISOString();
        const res = await fetch(`/api/calendar?timeMin=${timeMin}&timeMax=${timeMax}`);
        const data = await res.json();
        setEvents(data.events || []);
      } catch {
        setEvents([]);
      } finally {
        setLoading(false);
      }
    };
    fetchEvents();
  }, [selectedDate]);

  const allDayEvents = events.filter((e) => e.allDay);
  const timedEvents = events.filter((e) => !e.allDay);

  const hours = Array.from({ length: END_HOUR - START_HOUR }, (_, i) => START_HOUR + i);

  const handleSlotClick = (hour: number) => {
    const dateStr = format(selectedDate, 'yyyy-MM-dd');
    const timeStr = `${hour.toString().padStart(2, '0')}:00`;
    onSlotClick(dateStr, timeStr);
  };

  if (loading) {
    return (
      <div className="h-full animate-pulse">
        <div className="h-8 bg-surface-3 rounded mb-2 w-48" />
        <div className="h-full bg-surface-2 rounded" />
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col overflow-hidden">
      {/* All-day events */}
      {allDayEvents.length > 0 && (
        <div className="flex-shrink-0 border-b border-border pb-2 mb-2">
          <span className="text-[10px] font-semibold text-gray-400 dark:text-zinc-500 uppercase tracking-wider mr-3">
            All day
          </span>
          <div className="flex flex-wrap gap-1 mt-1">
            {allDayEvents.map((event) => (
              <button
                key={event.id}
                onClick={() => onEventClick(event)}
                className="badge bg-blue-50 dark:bg-blue-500/10 text-blue-600 dark:text-blue-400 text-[11px] px-2 py-0.5 cursor-pointer hover:bg-blue-100 dark:hover:bg-blue-500/20 transition-colors"
              >
                {event.summary || 'No title'}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Time grid */}
      <div className="flex-1 overflow-y-auto relative">
        <div className="relative" style={{ height: `${hours.length * 60}px` }}>
          {/* Hour lines */}
          {hours.map((hour) => (
            <div
              key={hour}
              className="absolute w-full flex items-start cursor-pointer hover:bg-surface-2/50 transition-colors"
              style={{ top: `${((hour - START_HOUR) / (END_HOUR - START_HOUR)) * 100}%`, height: `${(1 / (END_HOUR - START_HOUR)) * 100}%` }}
              onClick={() => handleSlotClick(hour)}
            >
              <span className="text-[10px] text-gray-400 dark:text-zinc-500 w-14 flex-shrink-0 -mt-1.5 text-right pr-3">
                {format(new Date(2000, 0, 1, hour), 'h a')}
              </span>
              <div className="flex-1 border-t border-border/50 h-full" />
            </div>
          ))}

          {/* Timed events */}
          {timedEvents.map((event) => {
            const pos = getEventPosition(event);
            return (
              <button
                key={event.id}
                onClick={(e) => {
                  e.stopPropagation();
                  onEventClick(event);
                }}
                className="absolute left-16 right-4 rounded-lg px-2 py-1 bg-blue-500/15 dark:bg-blue-500/20 border-l-2 border-blue-500 hover:bg-blue-500/25 dark:hover:bg-blue-500/30 transition-colors text-left overflow-hidden z-10"
                style={{ top: pos.top, height: pos.height, minHeight: '20px' }}
              >
                <p className="text-[11px] font-medium text-blue-700 dark:text-blue-300 truncate">
                  {event.summary || 'No title'}
                </p>
                <p className="text-[10px] text-blue-500 dark:text-blue-400">
                  {format(parseISO(event.start), 'h:mm a')}
                </p>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}
