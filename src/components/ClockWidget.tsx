'use client';

import { useState, useEffect } from 'react';
import { format } from 'date-fns';

export default function ClockWidget() {
  const [now, setNow] = useState(new Date());

  useEffect(() => {
    const timer = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  return (
    <div className="rounded-2xl bg-gradient-to-br from-accent/[0.06] to-violet-500/[0.06] dark:from-accent/10 dark:to-violet-500/10 border border-accent/10 dark:border-accent/15 p-5">
      <div className="flex items-baseline gap-1.5">
        <span className="text-3xl font-bold text-gray-900 dark:text-white tracking-tight tabular-nums">
          {format(now, 'h:mm')}
        </span>
        <span className="text-sm font-medium text-gray-400 dark:text-zinc-400">{format(now, 'ss')}</span>
        <span className="text-sm font-medium text-gray-400 dark:text-zinc-500 ml-0.5">{format(now, 'a')}</span>
      </div>
      <p className="text-[13px] text-gray-500 dark:text-zinc-400 mt-1">{format(now, 'EEEE, MMMM d')}</p>
    </div>
  );
}
