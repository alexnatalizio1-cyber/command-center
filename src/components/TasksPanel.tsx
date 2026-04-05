'use client';

import { useState, useEffect, useCallback } from 'react';
import { Plus, Trash2, Circle, CheckCircle2, Flag, ArrowRight, RefreshCw, AlertCircle } from 'lucide-react';

interface Task {
  id: string;
  title: string;
  completed: boolean;
  priority: 'low' | 'medium' | 'high';
  due: string | null;
  listId: string;
  listName: string;
  notes: string;
  status: string;
}

interface TaskList {
  id: string;
  title: string;
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

function TaskSkeleton() {
  return (
    <div className="space-y-1">
      {[1, 2, 3, 4].map((i) => (
        <div key={i} className="flex items-center gap-3 p-3 rounded-xl animate-pulse">
          <div className="w-5 h-5 rounded-full bg-surface-3 flex-shrink-0" />
          <div className="flex-1 space-y-1.5">
            <div className="h-3.5 bg-surface-3 rounded-lg w-3/4" />
            <div className="h-2.5 bg-surface-3 rounded-lg w-1/3" />
          </div>
        </div>
      ))}
    </div>
  );
}

export default function TasksPanel({ compact = false }: { compact?: boolean }) {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [taskLists, setTaskLists] = useState<TaskList[]>([]);
  const [newTask, setNewTask] = useState('');
  const [activeList, setActiveList] = useState('All');
  const [newPriority, setNewPriority] = useState<'low' | 'medium' | 'high'>('medium');
  const [showCompleted, setShowCompleted] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  const fetchTasks = useCallback(async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true);
    else setLoading(true);
    setError(null);

    try {
      const res = await fetch('/api/tasks');
      if (res.status === 401) {
        setError('auth');
        return;
      }
      if (!res.ok) throw new Error('Failed to fetch tasks');
      const data = await res.json();
      setTasks(data.tasks || []);
      setTaskLists(data.lists || []);
    } catch {
      setError('Could not load tasks. Please try again.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    fetchTasks();
  }, [fetchTasks]);

  const lists = ['All', ...taskLists.map((l) => l.title)];

  const getListId = (listName: string): string | undefined => {
    const found = taskLists.find((l) => l.title === listName);
    return found?.id;
  };

  const addTask = async (e: React.FormEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (!newTask.trim()) return;

    const targetListName = activeList === 'All' ? (taskLists[0]?.title || 'My Tasks') : activeList;
    const targetListId = getListId(targetListName);

    // Optimistic add
    const tempId = `temp_${Date.now()}`;
    const optimisticTask: Task = {
      id: tempId,
      title: newTask.trim(),
      completed: false,
      priority: newPriority,
      due: null,
      listId: targetListId || '',
      listName: targetListName,
      notes: '',
      status: 'needsAction',
    };
    setTasks((prev) => [optimisticTask, ...prev]);
    const savedInput = newTask;
    setNewTask('');

    try {
      const res = await fetch('/api/tasks', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: savedInput.trim(),
          taskListId: targetListId,
          priority: newPriority,
        }),
      });
      if (!res.ok) throw new Error('Failed to create task');
      const data = await res.json();
      // Replace optimistic with real
      setTasks((prev) =>
        prev.map((t) => (t.id === tempId ? { ...optimisticTask, id: data.task.id, listId: data.task.listId } : t)),
      );
    } catch {
      // Revert optimistic
      setTasks((prev) => prev.filter((t) => t.id !== tempId));
      setNewTask(savedInput);
    }
  };

  const toggleTask = async (task: Task) => {
    const newStatus = task.completed ? 'needsAction' : 'completed';
    // Optimistic update
    setTasks((prev) =>
      prev.map((t) => (t.id === task.id ? { ...t, completed: !t.completed, status: newStatus } : t)),
    );

    try {
      const res = await fetch(`/api/tasks/${task.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: newStatus, listId: task.listId }),
      });
      if (!res.ok) throw new Error('Failed to update task');
    } catch {
      // Revert
      setTasks((prev) =>
        prev.map((t) => (t.id === task.id ? { ...t, completed: task.completed, status: task.status } : t)),
      );
    }
  };

  const deleteTask = async (task: Task) => {
    // Optimistic delete
    setTasks((prev) => prev.filter((t) => t.id !== task.id));

    try {
      const res = await fetch(`/api/tasks/${task.id}?listId=${task.listId}`, {
        method: 'DELETE',
      });
      if (!res.ok) throw new Error('Failed to delete task');
    } catch {
      // Revert
      setTasks((prev) => [...prev, task]);
    }
  };

  const filtered = tasks
    .filter((t) => activeList === 'All' || t.listName === activeList)
    .filter((t) => showCompleted || !t.completed)
    .sort((a, b) => {
      if (a.completed !== b.completed) return a.completed ? 1 : -1;
      const priorityOrder = { high: 0, medium: 1, low: 2 };
      return priorityOrder[a.priority] - priorityOrder[b.priority];
    });

  const completedCount = tasks.filter((t) => t.completed).length;
  const totalCount = tasks.length;

  if (error === 'auth') {
    if (compact) {
      return (
        <div className="card">
          <div className="flex items-center gap-2 mb-3">
            <span className="text-lg">✅</span>
            <h3 className="font-semibold text-gray-900 dark:text-white">Tasks</h3>
          </div>
          <div className="flex items-center gap-2 text-sm text-gray-400 dark:text-zinc-500 py-4">
            <AlertCircle className="w-4 h-4" />
            <span>Sign in with Google to sync tasks</span>
          </div>
        </div>
      );
    }
    return (
      <div className="animate-fade-in">
        <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-4">✅ Tasks</h2>
        <div className="card flex flex-col items-center justify-center py-12 gap-3">
          <AlertCircle className="w-8 h-8 text-gray-300 dark:text-zinc-600" />
          <p className="text-sm text-gray-500 dark:text-zinc-400">Sign in with Google to sync tasks</p>
          <p className="text-xs text-gray-400 dark:text-zinc-500">Your tasks will sync with Google Tasks across all devices</p>
        </div>
      </div>
    );
  }

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
          <button
            onClick={(e) => { e.stopPropagation(); fetchTasks(true); }}
            className="btn-ghost p-1.5"
            disabled={refreshing}
          >
            <RefreshCw className={`w-3.5 h-3.5 ${refreshing ? 'animate-spin' : ''}`} />
          </button>
        </div>
        {loading ? (
          <TaskSkeleton />
        ) : (
          <div className="space-y-1">
            {pending.map((task) => (
              <div
                key={task.id}
                className="flex items-center gap-2 p-2.5 rounded-xl hover:bg-surface-2 transition-colors cursor-pointer min-h-[44px]"
                onClick={(e) => { e.stopPropagation(); toggleTask(task); }}
              >
                <Circle className="w-4 h-4 text-gray-300 dark:text-zinc-500 flex-shrink-0" />
                <p className="text-sm text-gray-900 dark:text-white truncate flex-1">{task.title}</p>
                <Flag className={`w-3 h-3 ${PRIORITY_COLORS[task.priority]}`} />
              </div>
            ))}
            {pending.length === 0 && !loading && (
              <p className="text-xs text-gray-400 dark:text-zinc-500 text-center py-2">All caught up!</p>
            )}
          </div>
        )}
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
        <div className="flex items-center gap-2">
          <button
            onClick={() => fetchTasks(true)}
            className="btn-ghost text-sm flex items-center gap-1.5 min-h-[44px] px-3"
            disabled={refreshing}
          >
            <RefreshCw className={`w-3.5 h-3.5 ${refreshing ? 'animate-spin' : ''}`} />
            Refresh
          </button>
          <button
            onClick={() => setShowCompleted(!showCompleted)}
            className="btn-ghost text-sm min-h-[44px] px-3"
          >
            {showCompleted ? 'Hide' : 'Show'} completed
          </button>
        </div>
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
            className={`px-4 py-2 rounded-xl text-sm font-medium whitespace-nowrap transition-colors min-h-[44px] ${
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
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors min-h-[44px] ${
                newPriority === p ? `${PRIORITY_BG[p]} ${PRIORITY_COLORS[p]}` : 'text-gray-400 dark:text-zinc-500 hover:text-gray-700 dark:hover:text-zinc-300'
              }`}
            >
              {p}
            </button>
          ))}
        </div>
        <button type="submit" className="btn-primary py-3 text-sm min-h-[44px]">
          Add
        </button>
      </form>

      {/* Task list */}
      {loading ? (
        <TaskSkeleton />
      ) : error ? (
        <div className="text-center py-8">
          <p className="text-sm text-red-400">{error}</p>
          <button onClick={() => fetchTasks()} className="btn-ghost text-sm mt-2 min-h-[44px]">
            Try again
          </button>
        </div>
      ) : (
        <div className="space-y-1">
          {filtered.map((task) => (
            <div
              key={task.id}
              className={`flex items-center gap-3 p-3 rounded-xl transition-all group min-h-[44px] ${
                task.completed ? 'opacity-50' : 'hover:bg-surface-2'
              }`}
            >
              <button onClick={() => toggleTask(task)} className="flex-shrink-0 min-w-[44px] min-h-[44px] flex items-center justify-center">
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
                  <span className="text-[10px] text-gray-300 dark:text-zinc-600">{task.listName}</span>
                </div>
              </div>
              <button
                onClick={() => deleteTask(task)}
                className="opacity-0 group-hover:opacity-100 transition-opacity btn-ghost p-1 min-w-[44px] min-h-[44px] flex items-center justify-center"
              >
                <Trash2 className="w-3.5 h-3.5 text-gray-400 dark:text-zinc-500 hover:text-red-500 dark:hover:text-red-400" />
              </button>
            </div>
          ))}
          {filtered.length === 0 && (
            <p className="text-sm text-gray-400 dark:text-zinc-500 text-center py-8">
              {showCompleted ? 'No tasks in this list' : 'All tasks completed!'}
            </p>
          )}
        </div>
      )}
    </div>
  );
}
