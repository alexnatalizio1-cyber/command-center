'use client';

import { useState, useCallback } from 'react';
import { ChevronLeft, ChevronRight, Plus, Calendar } from 'lucide-react';
import { format, addDays, addWeeks, subWeeks, subDays, startOfWeek } from 'date-fns';
import AgendaView from './AgendaView';
import DayView from './DayView';
import WeekView from './WeekView';
import EventModal from './EventModal';
import EventDetail from './EventDetail';

export interface CalendarEvent {
  id: string;
  summary: string;
  start: string;
  end: string;
  location?: string | null;
  description?: string | null;
  attendees?: { email: string; responseStatus: string; self: boolean }[];
  organizer?: { email: string; self: boolean } | null;
  htmlLink?: string | null;
  allDay: boolean;
  colorId?: string | null;
}

type ViewMode = 'agenda' | 'day' | 'week';

export default function CalendarFullView() {
  const [currentView, setCurrentView] = useState<ViewMode>('agenda');
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [selectedEvent, setSelectedEvent] = useState<CalendarEvent | null>(null);
  const [isCreating, setIsCreating] = useState(false);
  const [editingEvent, setEditingEvent] = useState<CalendarEvent | null>(null);
  const [defaultSlot, setDefaultSlot] = useState<{ date: string; time: string } | null>(null);
  const [refreshKey, setRefreshKey] = useState(0);

  const triggerRefresh = useCallback(() => setRefreshKey((k) => k + 1), []);

  const navigatePrev = () => {
    if (currentView === 'week') setSelectedDate((d) => subWeeks(d, 1));
    else setSelectedDate((d) => subDays(d, currentView === 'day' ? 1 : 7));
  };

  const navigateNext = () => {
    if (currentView === 'week') setSelectedDate((d) => addWeeks(d, 1));
    else setSelectedDate((d) => addDays(d, currentView === 'day' ? 1 : 7));
  };

  const goToday = () => setSelectedDate(new Date());

  const handleEventClick = (event: CalendarEvent) => {
    setSelectedEvent(event);
  };

  const handleSlotClick = (date: string, time?: string) => {
    setDefaultSlot({ date, time: time || '09:00' });
    setIsCreating(true);
  };

  const handleCloseModal = () => {
    setIsCreating(false);
    setEditingEvent(null);
    setDefaultSlot(null);
  };

  const handleSaved = () => {
    handleCloseModal();
    setSelectedEvent(null);
    triggerRefresh();
  };

  const handleDeleted = () => {
    handleCloseModal();
    setSelectedEvent(null);
    triggerRefresh();
  };

  const handleEdit = () => {
    if (selectedEvent) {
      setEditingEvent(selectedEvent);
      setSelectedEvent(null);
    }
  };

  const handleRsvp = async (eventId: string, status: string) => {
    try {
      await fetch(`/api/calendar/${eventId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ responseStatus: status }),
      });
      triggerRefresh();
      setSelectedEvent(null);
    } catch (err) {
      console.error('RSVP failed:', err);
    }
  };

  const getHeaderLabel = () => {
    if (currentView === 'week') {
      const weekStart = startOfWeek(selectedDate, { weekStartsOn: 0 });
      const weekEnd = addDays(weekStart, 6);
      return `${format(weekStart, 'MMM d')} - ${format(weekEnd, 'MMM d, yyyy')}`;
    }
    if (currentView === 'day') return format(selectedDate, 'EEEE, MMMM d, yyyy');
    return format(selectedDate, 'MMMM yyyy');
  };

  const views: { key: ViewMode; label: string }[] = [
    { key: 'agenda', label: 'Agenda' },
    { key: 'day', label: 'Day' },
    { key: 'week', label: 'Week' },
  ];

  return (
    <div className="h-[calc(100vh-120px)] flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between mb-4 flex-shrink-0">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-blue-50 dark:bg-blue-500/10 flex items-center justify-center">
            <Calendar className="w-4 h-4 text-blue-500" />
          </div>
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
            {getHeaderLabel()}
          </h2>
        </div>

        <div className="flex items-center gap-2">
          {/* Date navigation */}
          <div className="flex items-center gap-1">
            <button onClick={navigatePrev} className="btn-ghost p-1.5">
              <ChevronLeft className="w-4 h-4" />
            </button>
            <button onClick={goToday} className="btn-ghost px-2.5 py-1 text-xs font-medium">
              Today
            </button>
            <button onClick={navigateNext} className="btn-ghost p-1.5">
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>

          {/* View toggle */}
          <div className="flex items-center bg-surface-1 rounded-lg p-0.5 border border-border">
            {views.map((v) => (
              <button
                key={v.key}
                onClick={() => setCurrentView(v.key)}
                className={`px-3 py-1 text-xs font-medium rounded-md transition-colors ${
                  currentView === v.key
                    ? 'bg-white dark:bg-zinc-700 text-gray-900 dark:text-white shadow-sm'
                    : 'text-gray-500 dark:text-zinc-400 hover:text-gray-700 dark:hover:text-zinc-300'
                }`}
              >
                {v.label}
              </button>
            ))}
          </div>

          {/* New Event */}
          <button
            onClick={() => {
              setDefaultSlot(null);
              setIsCreating(true);
            }}
            className="btn-primary flex items-center gap-1.5 px-3 py-1.5 text-xs"
          >
            <Plus className="w-3.5 h-3.5" />
            New Event
          </button>
        </div>
      </div>

      {/* View content */}
      <div className="flex-1 overflow-hidden">
        {currentView === 'agenda' && (
          <AgendaView
            key={refreshKey}
            selectedDate={selectedDate}
            onEventClick={handleEventClick}
            onSlotClick={handleSlotClick}
          />
        )}
        {currentView === 'day' && (
          <DayView
            key={refreshKey}
            selectedDate={selectedDate}
            onEventClick={handleEventClick}
            onSlotClick={handleSlotClick}
          />
        )}
        {currentView === 'week' && (
          <WeekView
            key={refreshKey}
            selectedDate={selectedDate}
            onEventClick={handleEventClick}
            onSlotClick={handleSlotClick}
          />
        )}
      </div>

      {/* Event Detail panel */}
      {selectedEvent && (
        <EventDetail
          event={selectedEvent}
          onEdit={handleEdit}
          onDelete={() => handleDeleted()}
          onClose={() => setSelectedEvent(null)}
          onRsvp={handleRsvp}
        />
      )}

      {/* Event Modal for create/edit */}
      {(isCreating || editingEvent) && (
        <EventModal
          event={editingEvent || undefined}
          defaultDate={defaultSlot?.date}
          defaultTime={defaultSlot?.time}
          onClose={handleCloseModal}
          onSaved={handleSaved}
          onDeleted={handleDeleted}
        />
      )}
    </div>
  );
}
