'use client';

import { useState } from 'react';
import {
  X,
  Pencil,
  Trash2,
  MapPin,
  Clock,
  Users,
  ExternalLink,
  Check,
  XIcon,
  HelpCircle,
  Loader2,
  Calendar,
  User,
} from 'lucide-react';
import { format, parseISO } from 'date-fns';
import type { CalendarEvent } from './CalendarFullView';

interface EventDetailProps {
  event: CalendarEvent;
  onEdit: () => void;
  onDelete: () => void;
  onClose: () => void;
  onRsvp: (eventId: string, status: string) => void;
}

const rsvpIcon = (status: string) => {
  switch (status) {
    case 'accepted':
      return <Check className="w-3 h-3 text-green-500" />;
    case 'declined':
      return <XIcon className="w-3 h-3 text-red-500" />;
    case 'tentative':
      return <HelpCircle className="w-3 h-3 text-yellow-500" />;
    default:
      return <HelpCircle className="w-3 h-3 text-gray-400 dark:text-zinc-500" />;
  }
};

export default function EventDetail({ event, onEdit, onDelete, onClose, onRsvp }: EventDetailProps) {
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const handleDelete = async () => {
    if (!confirmDelete) {
      setConfirmDelete(true);
      return;
    }
    setDeleting(true);
    try {
      const res = await fetch(`/api/calendar/${event.id}`, { method: 'DELETE' });
      const data = await res.json();
      if (data.error) throw new Error(data.error);
      onDelete();
    } catch (err) {
      console.error('Delete failed:', err);
    } finally {
      setDeleting(false);
      setConfirmDelete(false);
    }
  };

  const selfAttendee = event.attendees?.find((a) => a.self);
  const isLocationUrl =
    event.location &&
    (event.location.startsWith('http://') || event.location.startsWith('https://'));

  const formatEventTime = () => {
    if (event.allDay) return 'All day';
    try {
      const start = parseISO(event.start);
      const end = parseISO(event.end);
      return `${format(start, 'EEEE, MMMM d, yyyy')} · ${format(start, 'h:mm a')} - ${format(end, 'h:mm a')}`;
    } catch {
      return event.start;
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-end p-4">
      {/* Overlay */}
      <div className="absolute inset-0 bg-black/40 dark:bg-black/60" onClick={onClose} />

      {/* Panel */}
      <div className="relative bg-white dark:bg-zinc-900 rounded-2xl shadow-xl border border-border w-full max-w-md h-full max-h-[80vh] overflow-y-auto animate-fade-in">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-border">
          <div className="flex items-center gap-2">
            <div className="w-2 h-2 rounded-full bg-blue-500" />
            <h3 className="text-sm font-semibold text-gray-900 dark:text-white truncate">
              {event.summary || 'No title'}
            </h3>
          </div>
          <div className="flex items-center gap-1">
            {event.htmlLink && (
              <a
                href={event.htmlLink}
                target="_blank"
                rel="noopener noreferrer"
                className="btn-ghost p-1.5"
                title="Open in Google Calendar"
              >
                <ExternalLink className="w-3.5 h-3.5" />
              </a>
            )}
            <button onClick={onClose} className="btn-ghost p-1.5">
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="p-4 space-y-4">
          {/* Date & time */}
          <div className="flex items-start gap-3">
            <Clock className="w-4 h-4 text-gray-400 dark:text-zinc-500 mt-0.5 flex-shrink-0" />
            <p className="text-sm text-gray-700 dark:text-zinc-300">{formatEventTime()}</p>
          </div>

          {/* Location */}
          {event.location && (
            <div className="flex items-start gap-3">
              <MapPin className="w-4 h-4 text-gray-400 dark:text-zinc-500 mt-0.5 flex-shrink-0" />
              {isLocationUrl ? (
                <a
                  href={event.location}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-sm text-blue-500 hover:underline break-all"
                >
                  {event.location}
                </a>
              ) : (
                <p className="text-sm text-gray-700 dark:text-zinc-300">{event.location}</p>
              )}
            </div>
          )}

          {/* Description */}
          {event.description && (
            <div className="flex items-start gap-3">
              <Calendar className="w-4 h-4 text-gray-400 dark:text-zinc-500 mt-0.5 flex-shrink-0" />
              <div
                className="text-sm text-gray-600 dark:text-zinc-400 prose prose-sm dark:prose-invert max-w-none"
                dangerouslySetInnerHTML={{ __html: event.description }}
              />
            </div>
          )}

          {/* Organizer */}
          {event.organizer && (
            <div className="flex items-start gap-3">
              <User className="w-4 h-4 text-gray-400 dark:text-zinc-500 mt-0.5 flex-shrink-0" />
              <div>
                <p className="text-[10px] font-medium text-gray-400 dark:text-zinc-500 uppercase tracking-wider mb-0.5">
                  Organizer
                </p>
                <p className="text-sm text-gray-700 dark:text-zinc-300">
                  {event.organizer.email}
                  {event.organizer.self && (
                    <span className="text-[10px] text-gray-400 dark:text-zinc-500 ml-1">(you)</span>
                  )}
                </p>
              </div>
            </div>
          )}

          {/* Attendees */}
          {event.attendees && event.attendees.length > 0 && (
            <div className="flex items-start gap-3">
              <Users className="w-4 h-4 text-gray-400 dark:text-zinc-500 mt-0.5 flex-shrink-0" />
              <div className="flex-1">
                <p className="text-[10px] font-medium text-gray-400 dark:text-zinc-500 uppercase tracking-wider mb-1.5">
                  Attendees ({event.attendees.length})
                </p>
                <div className="space-y-1">
                  {event.attendees.map((attendee) => (
                    <div
                      key={attendee.email}
                      className="flex items-center gap-2 text-sm text-gray-700 dark:text-zinc-300"
                    >
                      {rsvpIcon(attendee.responseStatus)}
                      <span className="truncate">
                        {attendee.email}
                        {attendee.self && (
                          <span className="text-[10px] text-gray-400 dark:text-zinc-500 ml-1">(you)</span>
                        )}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* RSVP buttons */}
          {selfAttendee && (
            <div className="pt-2 border-t border-border">
              <p className="text-[10px] font-medium text-gray-400 dark:text-zinc-500 uppercase tracking-wider mb-2">
                Your RSVP
              </p>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => onRsvp(event.id, 'accepted')}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                    selfAttendee.responseStatus === 'accepted'
                      ? 'bg-green-500 text-white'
                      : 'text-green-600 dark:text-green-400 hover:bg-green-50 dark:hover:bg-green-500/10 border border-green-200 dark:border-green-500/30'
                  }`}
                >
                  <Check className="w-3 h-3" />
                  Accept
                </button>
                <button
                  onClick={() => onRsvp(event.id, 'declined')}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                    selfAttendee.responseStatus === 'declined'
                      ? 'bg-red-500 text-white'
                      : 'text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-500/10 border border-red-200 dark:border-red-500/30'
                  }`}
                >
                  <XIcon className="w-3 h-3" />
                  Decline
                </button>
                <button
                  onClick={() => onRsvp(event.id, 'tentative')}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                    selfAttendee.responseStatus === 'tentative'
                      ? 'bg-yellow-500 text-white'
                      : 'text-yellow-600 dark:text-yellow-400 hover:bg-yellow-50 dark:hover:bg-yellow-500/10 border border-yellow-200 dark:border-yellow-500/30'
                  }`}
                >
                  <HelpCircle className="w-3 h-3" />
                  Maybe
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Footer actions */}
        <div className="flex items-center justify-between p-4 border-t border-border">
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
            {confirmDelete ? 'Confirm?' : 'Delete'}
          </button>
          <button
            onClick={onEdit}
            className="btn-ghost flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium"
          >
            <Pencil className="w-3.5 h-3.5" />
            Edit
          </button>
        </div>
      </div>
    </div>
  );
}
