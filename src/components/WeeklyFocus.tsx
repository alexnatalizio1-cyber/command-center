'use client';

import { useState, useEffect } from 'react';
import { Target, CheckCircle2, Circle, Flame } from 'lucide-react';
import { useLocalStorage } from '@/hooks/useLocalStorage';
import { startOfWeek, differenceInWeeks, format } from 'date-fns';

interface Priority {
  text: string;
  done: boolean;
}

interface WeeklyData {
  weekKey: string;
  priorities: Priority[];
}

const PINHIGH_START = new Date('2026-03-01');

function getWeekKey(): string {
  const monday = startOfWeek(new Date(), { weekStartsOn: 1 });
  return format(monday, 'yyyy-MM-dd');
}

function getBuildWeek(): number {
  return differenceInWeeks(new Date(), PINHIGH_START) + 1;
}

export default function WeeklyFocus() {
  const [data, setData] = useLocalStorage<WeeklyData>('cc-weekly-focus', {
    weekKey: getWeekKey(),
    priorities: [
      { text: '', done: false },
      { text: '', done: false },
      { text: '', done: false },
    ],
  });
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    // Auto-reset on Monday
    const currentWeek = getWeekKey();
    if (data.weekKey !== currentWeek) {
      setData({
        weekKey: currentWeek,
        priorities: [
          { text: '', done: false },
          { text: '', done: false },
          { text: '', done: false },
        ],
      });
    }
  }, []);

  const updatePriority = (index: number, updates: Partial<Priority>) => {
    setData((prev) => ({
      ...prev,
      priorities: prev.priorities.map((p, i) =>
        i === index ? { ...p, ...updates } : p
      ),
    }));
  };

  const buildWeek = getBuildWeek();
  const completedCount = data.priorities.filter((p) => p.done && p.text).length;
  const totalSet = data.priorities.filter((p) => p.text).length;

  if (!mounted) return null;

  return (
    <div className="space-y-3">
      <h3 className="text-xs font-semibold text-gray-400 dark:text-zinc-500 uppercase tracking-widest flex items-center gap-2">
        <Target className="w-3 h-3" />
        This week&apos;s focus
        {totalSet > 0 && (
          <span className="text-[10px] font-medium text-accent ml-auto normal-case tracking-normal">
            {completedCount}/{totalSet} done
          </span>
        )}
      </h3>

      <div className="space-y-1.5">
        {data.priorities.map((priority, i) => (
          <div
            key={i}
            className={`flex items-center gap-2.5 p-2 rounded-xl transition-all duration-200 ${
              priority.done ? 'opacity-50' : 'hover:bg-surface-2'
            }`}
          >
            <button
              onClick={() => updatePriority(i, { done: !priority.done })}
              className="flex-shrink-0"
            >
              {priority.done ? (
                <CheckCircle2 className="w-4 h-4 text-green-500" />
              ) : (
                <Circle className="w-4 h-4 text-gray-300 dark:text-zinc-600 hover:text-accent transition-colors" />
              )}
            </button>
            <span className="text-[11px] font-semibold text-gray-300 dark:text-zinc-600 w-4 flex-shrink-0">
              {i + 1}.
            </span>
            <input
              type="text"
              value={priority.text}
              onChange={(e) => updatePriority(i, { text: e.target.value })}
              placeholder={`Priority ${i + 1}`}
              className={`flex-1 bg-transparent text-[13px] outline-none placeholder-gray-300 dark:placeholder-zinc-600 ${
                priority.done
                  ? 'line-through text-gray-400 dark:text-zinc-500'
                  : 'text-gray-800 dark:text-zinc-200'
              }`}
            />
          </div>
        ))}
      </div>

      <div className="flex items-center gap-1.5 pt-1">
        <Flame className="w-3 h-3 text-orange-400" />
        <span className="text-[11px] text-gray-400 dark:text-zinc-500">
          Week {buildWeek} of building <span className="font-semibold text-gray-600 dark:text-zinc-300">PinHigh</span>
        </span>
      </div>
    </div>
  );
}
