'use client';

import { useState } from 'react';
import { Plus, Trash2, Circle, CheckCircle2, Flag, ArrowRight } from 'lucide-react';
import { useLocalStorage } from '@/hooks/useLocalStorage';

interface Task {
  id: string;
  title: string;
  completed: boolean;
  priority: 'low' | 'medium' | 'high';
  dueDate?: string;
  list: string;
  createdAt: string;
}

const PRIORITY_COLORS = {
  low: 'text-gray-400 dark:text-zinc-500',
  medium: 'text-yellow-500 dark:text-yellow-400',
  high: 'text-red-500 dark:text-red-400',
};

const PRIORITY_BG = {
  low: 'bg-gray-100 dark:bg-zinc-500/10',
  medium: 'bg-yellow-50 dark:bg-yellow-500/10',
  high: 'bg-red-50 dark:bg-red-500/10',
};

export default function TasksPanel({ compact = false }: { compact?: boolean }) {
  const [tasks, setTasks] = useLocalStorage<Task[]>('cc-tasks', []);
  const [newTask, setNewTask] = useState('');
  const [activeList, setActiveList] = useState('All');
  const [newPriority, setNewPriority] = useState<'low' | 'medium' | 'high'>('medium');
  const [showCompleted, setShowCompleted] = useState(false);

  const lists = ['All', ...Array.from(new Set(tasks.map((t) => t.list).filter((l) => l !== 'All')))];
  if (!lists.includes('Personal')) lists.push('Personal');
  if (!lists.includes('Work')) lists.push('Work');

  const addTask = (e: React.FormEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (!newTask.trim()) return;
    const task: Task = {
      id: Date.now().toString(),
      title: newTask.trim(),
      completed: false,
      priority: newPriority,
      list: activeList === 'All' ? 'Personal' : activeList,
      createdAt: new Date().toISOString(),
    };
    setTasks((prev) => [task, ...prev]);
    setNewTask('');
  };

  const toggleTask = (id: string) => {
    setTasks((prev) => prev.map((t) => (t.id === id ? { ...t, completed: !t.completed } : t)));
  };

  const deleteTask = (id: string) => {
    setTasks((prev) => prev.filter((t) => t.id !== id));
  };

  const filtered = tasks
    .filter((t) => activeList === 'All' || t.list === activeList)
    .filter((t) => showCompleted || !t.completed)
    .sort((a, b) => {
      if (a.completed !== b.completed) return a.completed ? 1 : -1;
      const priorityOrder = { high: 0, medium: 1, low: 2 };
      return priorityOrder[a.priority] - priorityOrder[b.priority];
    });

  const completedCount = tasks.filter((t) => t.completed).length;
  const totalCount = tasks.length;

  if (compact) {
    const pending = tasks.filter((t) => !t.completed).slice(0, 5);
    return (
      <div className="card">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <span className="text-lg">✅</span>
            <h3 className="font-semibold text-gray-900 dark:text-white">Tasks</h3>
            <span className="badge bg-surface-2 text-gray-500 dark:text-zinc-400">{totalCount - completedCount}</span>
          </div>
        </div>
        <div className="space-y-1">
          {pending.map((task) => (
            <div
              key={task.id}
              className="flex items-center gap-2 p-2.5 rounded-xl hover:bg-surface-2 transition-colors cursor-pointer"
              onClick={(e) => { e.stopPropagation(); toggleTask(task.id); }}
            >
              <Circle className="w-4 h-4 text-gray-300 dark:text-zinc-500 flex-shrink-0" />
              <p className="text-sm text-gray-900 dark:text-white truncate flex-1">{task.title}</p>
              <Flag className={`w-3 h-3 ${PRIORITY_COLORS[task.priority]}`} />
            </div>
          ))}
          {pending.length === 0 && (
            <p className="text-xs text-gray-400 dark:text-zinc-500 text-center py-2">All caught up! 🎉</p>
          )}
        </div>
        <div className="mt-4 pt-3 border-t border-border">
          <span className="text-xs text-accent font-medium flex items-center gap-1 group-hover:gap-2 transition-all">
            View all <ArrowRight className="w-3 h-3" />
          </span>
        </div>
      </div>
    );
  }

  return (
    <div className="animate-fade-in">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h2 className="text-xl font-bold text-gray-900 dark:text-white">✅ Tasks</h2>
          <p className="text-sm text-gray-500 dark:text-zinc-500 mt-1">
            {completedCount}/{totalCount} completed
          </p>
        </div>
        <button
          onClick={() => setShowCompleted(!showCompleted)}
          className="btn-ghost text-sm"
        >
          {showCompleted ? 'Hide' : 'Show'} completed
        </button>
      </div>

      {/* Progress bar */}
      <div className="h-2 bg-surface-3 rounded-full mb-6 overflow-hidden">
        <div
          className="h-full bg-gradient-to-r from-accent to-green-500 rounded-full transition-all duration-500"
          style={{ width: totalCount ? `${(completedCount / totalCount) * 100}%` : '0%' }}
        />
      </div>

      {/* Lists */}
      <div className="flex items-center gap-1 mb-5 overflow-x-auto pb-1">
        {lists.map((list) => (
          <button
            key={list}
            onClick={() => setActiveList(list)}
            className={`px-4 py-2 rounded-xl text-sm font-medium whitespace-nowrap transition-colors ${
              activeList === list ? 'bg-accent text-white' : 'text-gray-500 dark:text-zinc-400 hover:text-gray-900 dark:hover:text-white hover:bg-surface-2'
            }`}
          >
            {list}
          </button>
        ))}
      </div>

      {/* Add task */}
      <form onSubmit={addTask} className="flex items-center gap-3 mb-5">
        <div className="flex-1 relative">
          <Plus className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 dark:text-zinc-500" />
          <input
            type="text"
            value={newTask}
            onChange={(e) => setNewTask(e.target.value)}
            placeholder="Add a new task..."
            className="input-base w-full pl-10 py-3 text-sm"
          />
        </div>
        <div className="flex items-center gap-1 bg-surface-2 rounded-xl p-1 border border-border">
          {(['low', 'medium', 'high'] as const).map((p) => (
            <button
              key={p}
              type="button"
              onClick={() => setNewPriority(p)}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                newPriority === p ? `${PRIORITY_BG[p]} ${PRIORITY_COLORS[p]}` : 'text-gray-400 dark:text-zinc-500 hover:text-gray-700 dark:hover:text-zinc-300'
              }`}
            >
              {p}
            </button>
          ))}
        </div>
        <button type="submit" className="btn-primary py-3 text-sm">
          Add
        </button>
      </form>

      {/* Task list */}
      <div className="space-y-1">
        {filtered.map((task) => (
          <div
            key={task.id}
            className={`flex items-center gap-3 p-3 rounded-xl transition-all group ${
              task.completed ? 'opacity-50' : 'hover:bg-surface-2'
            }`}
          >
            <button onClick={() => toggleTask(task.id)} className="flex-shrink-0">
              {task.completed ? (
                <CheckCircle2 className="w-5 h-5 text-green-500" />
              ) : (
                <Circle className="w-5 h-5 text-gray-300 dark:text-zinc-500 hover:text-accent transition-colors" />
              )}
            </button>
            <div className="flex-1 min-w-0">
              <p className={`text-sm ${task.completed ? 'line-through text-gray-400 dark:text-zinc-500' : 'text-gray-900 dark:text-white'}`}>
                {task.title}
              </p>
              <div className="flex items-center gap-2 mt-0.5">
                <span className={`text-[10px] font-medium ${PRIORITY_COLORS[task.priority]}`}>{task.priority}</span>
                <span className="text-[10px] text-gray-300 dark:text-zinc-600">{task.list}</span>
              </div>
            </div>
            <button
              onClick={() => deleteTask(task.id)}
              className="opacity-0 group-hover:opacity-100 transition-opacity btn-ghost p-1"
            >
              <Trash2 className="w-3.5 h-3.5 text-gray-400 dark:text-zinc-500 hover:text-red-500 dark:hover:text-red-400" />
            </button>
          </div>
        ))}
        {filtered.length === 0 && (
          <p className="text-sm text-gray-400 dark:text-zinc-500 text-center py-8">
            {showCompleted ? 'No tasks in this list' : 'All tasks completed! 🎉'}
          </p>
        )}
      </div>
    </div>
  );
}
