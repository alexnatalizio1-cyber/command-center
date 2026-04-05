'use client';

import { useState, useEffect } from 'react';
import {
  Inbox,
  Send,
  FileText,
  AlertTriangle,
  Trash2,
  Star,
  Clock,
  Tag,
} from 'lucide-react';

interface Label {
  id: string;
  name: string;
  type: string;
  unreadCount: number;
  totalCount: number;
}

interface LabelsPanelProps {
  activeLabel: string;
  onLabelChange: (labelId: string) => void;
}

const SYSTEM_LABEL_CONFIG: Record<string, { icon: React.ElementType; order: number }> = {
  INBOX: { icon: Inbox, order: 0 },
  STARRED: { icon: Star, order: 1 },
  SNOOZED: { icon: Clock, order: 2 },
  SENT: { icon: Send, order: 3 },
  DRAFT: { icon: FileText, order: 4 },
  SPAM: { icon: AlertTriangle, order: 5 },
  TRASH: { icon: Trash2, order: 6 },
};

export default function LabelsPanel({ activeLabel, onLabelChange }: LabelsPanelProps) {
  const [labels, setLabels] = useState<Label[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchLabels = async () => {
      try {
        const res = await fetch('/api/gmail/labels');
        const data = await res.json();
        if (data.labels) setLabels(data.labels);
      } catch {
        // silently fail
      } finally {
        setLoading(false);
      }
    };
    fetchLabels();
  }, []);

  const systemLabels = labels
    .filter((l) => l.type === 'system' && SYSTEM_LABEL_CONFIG[l.id!])
    .sort((a, b) => (SYSTEM_LABEL_CONFIG[a.id]?.order ?? 99) - (SYSTEM_LABEL_CONFIG[b.id]?.order ?? 99));

  const userLabels = labels.filter((l) => l.type === 'user');

  const renderLabel = (label: Label) => {
    const config = SYSTEM_LABEL_CONFIG[label.id];
    const Icon = config?.icon || Tag;
    const isActive = activeLabel === label.id;

    return (
      <button
        key={label.id}
        onClick={() => onLabelChange(label.id)}
        className={`w-full flex items-center gap-3 px-3 py-2 rounded-xl text-sm transition-colors ${
          isActive
            ? 'bg-accent/10 text-accent font-medium'
            : 'text-gray-600 dark:text-zinc-400 hover:bg-surface-2'
        }`}
      >
        <Icon className="w-4 h-4 flex-shrink-0" />
        <span className="flex-1 truncate text-left">{label.name}</span>
        {label.unreadCount > 0 && (
          <span
            className={`text-xs font-medium tabular-nums ${
              isActive ? 'text-accent' : 'text-gray-400 dark:text-zinc-500'
            }`}
          >
            {label.unreadCount}
          </span>
        )}
      </button>
    );
  };

  if (loading) {
    return (
      <div className="p-3 space-y-1">
        {[...Array(6)].map((_, i) => (
          <div key={i} className="animate-pulse h-9 bg-surface-3 rounded-xl" />
        ))}
      </div>
    );
  }

  return (
    <div className="p-3 space-y-1">
      {systemLabels.map(renderLabel)}

      {userLabels.length > 0 && (
        <>
          <div className="border-t border-border my-3" />
          <p className="px-3 text-[10px] uppercase tracking-wider text-gray-400 dark:text-zinc-600 font-semibold mb-1">
            Labels
          </p>
          {userLabels.map(renderLabel)}
        </>
      )}
    </div>
  );
}
