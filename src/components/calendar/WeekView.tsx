'use client';

import { useState, useEffect } from 'react';
import {
  format,
  parseISO,
  startOfWeek,
  endOfWeek,
  eachDayOfInterval,
  isSameDay,
  isToday,
  startOfDay,
  endOfDay,
} from 'date-fns';
import type { CalendarEvent } from './CalendarFullView';

interface WeekViewProps {
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

export default function WeekView({ selectedDate, onEventClick, onSlotClick }: WeekViewProps) {
  const [events, setEvents] = useState<CalendarEvent[]>([]);
  const [loading, setLoading] = useState(true);

  const weekStart = startOfWeek(selectedDate, { weekStartsOn: 0 });
  const weekEnd = endOfWeek(selectedDate, { weekStartsOn: 0 });
  const days = eachDayOfInterval({ start: weekStart, end: weekEnd });

  useEffect(() => {
    const fetchEvents = async () => {
      setLoading(true);
      try {
        const timeMin = startOfDay(weekStart).toISOString();
        const timeMax = endOfDay(weekEnd).toISOString();
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

  const getEventsForDay = (day: Date) =>
    timedEvents.filter((e) => isSameDay(parseISO(e.start), day));

  const getAllDayEventsForDay = (day: Date) =>
    allDayEvents.filter((e) => {
      const eventDate = e.start.length === 10 ? new Date(e.start + 'T00:00:00') : parseISO(e.start);
      return isSameDay(eventDate, day);
    });

  const hours = Array.from({ length: END_HOUR - START_HOUR }, (_, i) => START_HOUR + i);

  if (loading) {
    return (
      <div className="h-full animate-pulse">
        <div className="h-full bg-surface-2 rounded" />
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col overflow-hidden">
      {/* Day headers */}
      <div className="flex flex-shrink-0 border-b border-border">
        <div className="w-14 flex-shrink-0" />
        {days.map((day) => (
          <div
            key={day.toISOString()}
            className={`flex-1 text-center py-2 ${
              isToday(day)
                ? 'text-blue-600 dark:text-blue-400'
                : 'text-gray-500 dark:text-zinc-400'
            }`}
          >
            <div className="text-[10px] font-medium uppercase">{format(day, 'EEE')}</div>
            <div
              className={`text-sm font-semibold mt-0.5 ${
                isToday(day)
                  ? 'bg-blue-500 text-white w-7 h-7 rounded-full flex items-center justify-center mx-auto'
                  : ''
              }`}
            >
              {format(day, 'd')}
            </div>
          </div>
        ))}
      </div>

      {/* All-day row */}
      {allDayEvents.length > 0 && (
        <div className="flex flex-shrink-0 border-b border-border">
          <div className="w-14 flex-shrink-0 text-[10px] text-gray-400 dark:text-zinc-500 text-right pr-2 pt-1">
            All day
          </div>
          {days.map((day) => {
            const dayAllDay = getAllDayEventsForDay(day);
            return (
              <div key={day.toISOString()} className="flex-1 border-l border-border/50 p-0.5 min-h-[24px]">
                {dayAllDay.map((event) => (
                  <button
                    key={event.id}
                    onClick={() => onEventClick(event)}
                    className="w-full text-left text-[10px] bg-blue-50 dark:bg-blue-500/10 text-blue-600 dark:text-blue-400 px-1 py-0.5 rounded truncate hover:bg-blue-100 dark:hover:bg-blue-500/20 transition-colors"
                  >
                    {event.summary || 'No title'}
                  </button>
                ))}
              </div>
            );
          })}
        </div>
      )}

      {/* Time grid */}
      <div className="flex-1 overflow-y-auto">
        <div className="flex relative" style={{ height: `${hours.length * 60}px` }}>
          {/* Hour labels */}
          <div className="w-14 flex-shrink-0 relative">
            {hours.map((hour) => (
              <div
                key={hour}
                className="absolute w-full text-right pr-2"
                style={{ top: `${((hour - START_HOUR) / (END_HOUR - START_HOUR)) * 100}%` }}
              >
                <span className="text-[10px] text-gray-400 dark:text-zinc-500 -mt-1.5 block">
                  {format(new Date(2000, 0, 1, hour), 'h a')}
                </span>
              </div>
            ))}
          </div>

          {/* Day columns */}
          {days.map((day) => {
            const dayEvents = getEventsForDay(day);
            return (
              <div key={day.toISOString()} className="flex-1 relative border-l border-border/50">
                {/* Hour gridlines */}
                {hours.map((hour) => (
                  <div
                    key={hour}
                    className="absolute w-full border-t border-border/30 cursor-pointer hover:bg-surface-2/50 transition-colors"
                    style={{
                      top: `${((hour - START_HOUR) / (END_HOUR - START_HOUR)) * 100}%`,
                      height: `${(1 / (END_HOUR - START_HOUR)) * 100}%`,
                    }}
                    onClick={() =>
                      onSlotClick(format(day, 'yyyy-MM-dd'), `${hour.toString().padStart(2, '0')}:00`)
                    }
                  />
                ))}

                {/* Events */}
                {dayEvents.map((event) => {
                  const pos = getEventPosition(event);
                  return (
                    <button
                      key={event.id}
                      onClick={(e) => {
                        e.stopPropagation();
                        onEventClick(event);
                      }}
                      className="absolute left-0.5 right-0.5 rounded px-1 py-0.5 bg-blue-500/15 dark:bg-blue-500/20 border-l-2 border-blue-500 hover:bg-blue-500/25 dark:hover:bg-blue-500/30 transition-colors text-left overflow-hidden z-10"
                      style={{ top: pos.top, height: pos.height, minHeight: '18px' }}
                    >
                      <p className="text-[10px] font-medium text-blue-700 dark:text-blue-300 truncate leading-tight">
                        {event.summary || 'No title'}
                      </p>
                      <p className="text-[9px] text-blue-500 dark:text-blue-400 truncate">
                        {format(parseISO(event.start), 'h:mm a')}
                      </p>
                    </button>
                  );
                })}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
