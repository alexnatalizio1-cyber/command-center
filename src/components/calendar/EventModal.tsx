'use client';

import { useState, useEffect } from 'react';
import { X, Trash2, Loader2 } from 'lucide-react';
import { format, parseISO, addHours } from 'date-fns';
import type { CalendarEvent } from './CalendarFullView';

interface EventModalProps {
  event?: CalendarEvent;
  defaultDate?: string;
  defaultTime?: string;
  onClose: () => void;
  onSaved: () => void;
  onDeleted: () => void;
}

export default function EventModal({
  event,
  defaultDate,
  defaultTime,
  onClose,
  onSaved,
  onDeleted,
}: EventModalProps) {
  const isEditing = !!event;

  const getInitialValues = () => {
    if (event) {
      const startDate = event.allDay
        ? event.start
        : format(parseISO(event.start), 'yyyy-MM-dd');
      const endDate = event.allDay
        ? event.end
        : format(parseISO(event.end), 'yyyy-MM-dd');
      const startTime = event.allDay ? '09:00' : format(parseISO(event.start), 'HH:mm');
      const endTime = event.allDay ? '10:00' : format(parseISO(event.end), 'HH:mm');
      return {
        summary: event.summary,
        startDate,
        startTime,
        endDate,
        endTime,
        allDay: event.allDay,
        location: event.location || '',
        description: event.description || '',
        attendees: event.attendees?.map((a) => a.email).join(', ') || '',
      };
    }
    const date = defaultDate || format(new Date(), 'yyyy-MM-dd');
    const time = defaultTime || '09:00';
    const endTimeHour = parseInt(time.split(':')[0]) + 1;
    const endTime = `${endTimeHour.toString().padStart(2, '0')}:${time.split(':')[1]}`;
    return {
      summary: '',
      startDate: date,
      startTime: time,
      endDate: date,
      endTime,
      allDay: false,
      location: '',
      description: '',
      attendees: '',
    };
  };

  const [form, setForm] = useState(getInitialValues);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [error, setError] = useState('');

  const updateField = (field: string, value: any) =>
    setForm((prev) => ({ ...prev, [field]: value }));

  const handleSave = async () => {
    if (!form.summary.trim()) {
      setError('Title is required');
      return;
    }
    setSaving(true);
    setError('');

    try {
      const attendeeList = form.attendees
        ? form.attendees.split(',').map((e) => e.trim()).filter(Boolean)
        : [];

      let body: any;
      if (form.allDay) {
        body = {
          summary: form.summary,
          start: form.startDate,
          end: form.endDate,
          location: form.location || undefined,
          description: form.description || undefined,
          attendees: attendeeList.length > 0 ? attendeeList : undefined,
          allDay: true,
        };
      } else {
        body = {
          summary: form.summary,
          start: `${form.startDate}T${form.startTime}:00`,
          end: `${form.endDate}T${form.endTime}:00`,
          location: form.location || undefined,
          description: form.description || undefined,
          attendees: attendeeList.length > 0 ? attendeeList : undefined,
          allDay: false,
        };
      }

      const url = isEditing ? `/api/calendar/${event!.id}` : '/api/calendar';
      const method = isEditing ? 'PUT' : 'POST';

      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });

      const data = await res.json();
      if (data.error) throw new Error(data.error);

      onSaved();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!confirmDelete) {
      setConfirmDelete(true);
      return;
    }
    setDeleting(true);
    try {
      const res = await fetch(`/api/calendar/${event!.id}`, { method: 'DELETE' });
      const data = await res.json();
      if (data.error) throw new Error(data.error);
      onDeleted();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setDeleting(false);
      setConfirmDelete(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Overlay */}
      <div className="absolute inset-0 bg-black/40 dark:bg-black/60" onClick={onClose} />

      {/* Modal */}
      <div className="relative bg-white dark:bg-zinc-900 rounded-2xl shadow-xl border border-border w-full max-w-lg max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-border">
          <h3 className="text-sm font-semibold text-gray-900 dark:text-white">
            {isEditing ? 'Edit Event' : 'New Event'}
          </h3>
          <button onClick={onClose} className="btn-ghost p-1.5">
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Form */}
        <div className="p-4 space-y-4">
          {error && (
            <p className="text-xs text-red-500 bg-red-50 dark:bg-red-500/10 rounded-lg px-3 py-2">
              {error}
            </p>
          )}

          {/* Title */}
          <div>
            <label className="block text-xs font-medium text-gray-500 dark:text-zinc-400 mb-1">
              Title
            </label>
            <input
              type="text"
              value={form.summary}
              onChange={(e) => updateField('summary', e.target.value)}
              placeholder="Event title"
              className="input-base w-full"
              autoFocus
            />
          </div>

          {/* All-day toggle */}
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={form.allDay}
              onChange={(e) => updateField('allDay', e.target.checked)}
              className="rounded border-gray-300 dark:border-zinc-600 text-blue-500 focus:ring-blue-500"
            />
            <span className="text-xs text-gray-700 dark:text-zinc-300">All day</span>
          </label>

          {/* Date / Time */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-gray-500 dark:text-zinc-400 mb-1">
                Start date
              </label>
              <input
                type="date"
                value={form.startDate}
                onChange={(e) => updateField('startDate', e.target.value)}
                className="input-base w-full"
              />
            </div>
            {!form.allDay && (
              <div>
                <label className="block text-xs font-medium text-gray-500 dark:text-zinc-400 mb-1">
                  Start time
                </label>
                <input
                  type="time"
                  value={form.startTime}
                  onChange={(e) => updateField('startTime', e.target.value)}
                  className="input-base w-full"
                />
              </div>
            )}
            <div>
              <label className="block text-xs font-medium text-gray-500 dark:text-zinc-400 mb-1">
                End date
              </label>
              <input
                type="date"
                value={form.endDate}
                onChange={(e) => updateField('endDate', e.target.value)}
                className="input-base w-full"
              />
            </div>
            {!form.allDay && (
              <div>
                <label className="block text-xs font-medium text-gray-500 dark:text-zinc-400 mb-1">
                  End time
                </label>
                <input
                  type="time"
                  value={form.endTime}
                  onChange={(e) => updateField('endTime', e.target.value)}
                  className="input-base w-full"
                />
              </div>
            )}
          </div>

          {/* Location */}
          <div>
            <label className="block text-xs font-medium text-gray-500 dark:text-zinc-400 mb-1">
              Location
            </label>
            <input
              type="text"
              value={form.location}
              onChange={(e) => updateField('location', e.target.value)}
              placeholder="Add location"
              className="input-base w-full"
            />
          </div>

          {/* Description */}
          <div>
            <label className="block text-xs font-medium text-gray-500 dark:text-zinc-400 mb-1">
              Description
            </label>
            <textarea
              value={form.description}
              onChange={(e) => updateField('description', e.target.value)}
              placeholder="Add description"
              rows={3}
              className="input-base w-full resize-none"
            />
          </div>

          {/* Attendees */}
          <div>
            <label className="block text-xs font-medium text-gray-500 dark:text-zinc-400 mb-1">
              Attendees
            </label>
            <input
              type="text"
              value={form.attendees}
              onChange={(e) => updateField('attendees', e.target.value)}
              placeholder="Comma-separated emails"
              className="input-base w-full"
            />
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between p-4 border-t border-border">
          <div>
            {isEditing && (
              <button
                onClick={handleDelete}
                disabled={deleting}
                className={`flex items-center gap-1.5 text-xs font-medium px-3 py-1.5 rounded-lg transition-colors ${
                  confirmDelete
                    ? 'bg-red-500 text-white hover:bg-red-600'
                    : 'text-red-500 hover:bg-red-50 dark:hover:bg-red-500/10'
                }`}
              >
                {deleting ? (
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                ) : (
                  <Trash2 className="w-3.5 h-3.5" />
                )}
                {confirmDelete ? 'Confirm delete?' : 'Delete'}
              </button>
            )}
          </div>
          <div className="flex items-center gap-2">
            <button onClick={onClose} className="btn-ghost px-3 py-1.5 text-xs">
              Cancel
            </button>
            <button
              onClick={handleSave}
              disabled={saving}
              className="btn-primary flex items-center gap-1.5 px-4 py-1.5 text-xs"
            >
              {saving && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
              {isEditing ? 'Save changes' : 'Create event'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
