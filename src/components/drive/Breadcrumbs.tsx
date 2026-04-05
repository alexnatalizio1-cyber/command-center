'use client';

import { ChevronRight, Home } from 'lucide-react';

export interface BreadcrumbItem {
  id: string;
  name: string;
}

interface BreadcrumbsProps {
  breadcrumbs: BreadcrumbItem[];
  onNavigate: (folderId: string, index: number) => void;
}

export default function Breadcrumbs({ breadcrumbs, onNavigate }: BreadcrumbsProps) {
  return (
    <nav className="flex items-center gap-1 text-sm min-w-0 overflow-x-auto">
      <button
        onClick={() => onNavigate('root', -1)}
        className={`flex items-center gap-1 px-2 py-1 rounded-lg transition-colors flex-shrink-0 ${
          breadcrumbs.length === 0
            ? 'text-gray-900 dark:text-white font-medium'
            : 'text-gray-500 dark:text-zinc-400 hover:text-gray-700 dark:hover:text-zinc-200 hover:bg-surface-2'
        }`}
      >
        <Home className="w-3.5 h-3.5" />
        <span>My Drive</span>
      </button>

      {breadcrumbs.map((crumb, index) => {
        const isLast = index === breadcrumbs.length - 1;
        return (
          <div key={crumb.id} className="flex items-center gap-1 min-w-0">
            <ChevronRight className="w-3.5 h-3.5 text-gray-400 dark:text-zinc-600 flex-shrink-0" />
            {isLast ? (
              <span className="px-2 py-1 text-gray-900 dark:text-white font-medium truncate">
                {crumb.name}
              </span>
            ) : (
              <button
                onClick={() => onNavigate(crumb.id, index)}
                className="px-2 py-1 rounded-lg text-gray-500 dark:text-zinc-400 hover:text-gray-700 dark:hover:text-zinc-200 hover:bg-surface-2 transition-colors truncate"
              >
                {crumb.name}
              </button>
            )}
          </div>
        );
      })}
    </nav>
  );
}
