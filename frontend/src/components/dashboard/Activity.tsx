import React from 'react';
import { Calendar, Check, ClipboardList, Clock, RefreshCw, User } from 'lucide-react';
import { useActivity } from '@/lib/dashboard';

const typeIcons: Record<string, React.ComponentType<{ size?: number; className?: string }>> = {
  'Chart Prep': ClipboardList,
  Insurance: Calendar,
  'Follow-Up': RefreshCw,
  Documentation: ClipboardList,
  Scheduling: Calendar,
  Call: Clock,
};

const statusColors = {
  completed: 'bg-emerald-100 text-emerald-700',
  in_progress: 'bg-blue-100 text-blue-700',
  pending: 'bg-slate-100 text-slate-600',
};

const statusIcons = {
  completed: Check,
  in_progress: RefreshCw,
  pending: Clock,
};

const Activity = () => {
  const { activity, filter, setFilter, loading, refreshActivity } = useActivity();

  const formatTime = (date: Date) => {
    const now = new Date();
    const itemDate = new Date(date);
    const diff = now.getTime() - itemDate.getTime();
    const hours = Math.floor(diff / (1000 * 60 * 60));
    const days = Math.floor(hours / 24);

    if (days > 1) {
      return itemDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
    } else if (days === 1) {
      return 'Yesterday';
    } else if (hours > 0) {
      return `${hours}h ago`;
    } else {
      return 'Just now';
    }
  };

  const getTypeIcon = (type: string) => {
    return typeIcons[type] || ClipboardList;
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-navy-900">Activity Log</h1>
        <p className="mt-1 text-slate-600">Track completed and ongoing tasks</p>
      </div>

      <div className="rounded-xl border border-slate-200 bg-white">
        <div className="flex flex-wrap items-center justify-between gap-4 border-b border-slate-200 p-4">
          <h2 className="text-lg font-semibold text-navy-900">Timeline</h2>
          <div className="flex items-center gap-2">
            <div className="flex gap-2">
              {(['today', 'week', 'month'] as const).map((f) => (
                <button
                  key={f}
                  onClick={() => setFilter(f)}
                  className={`rounded-lg px-4 py-2 text-sm font-medium transition ${
                    filter === f ? 'bg-teal-100 text-teal-700' : 'text-slate-500 hover:bg-slate-100'
                  }`}
                >
                  {f.charAt(0).toUpperCase() + f.slice(1)}
                </button>
              ))}
            </div>
            <button
              onClick={() => refreshActivity()}
              className="rounded-lg p-2 text-slate-400 hover:bg-slate-100 hover:text-slate-600"
            >
              <RefreshCw size={18} />
            </button>
          </div>
        </div>

        <div className="p-4">
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <div className="h-8 w-8 animate-spin rounded-full border-2 border-teal-500 border-t-transparent" />
            </div>
          ) : activity.length > 0 ? (
            <div className="relative">
              <div className="absolute left-6 top-0 h-full w-px bg-slate-200" />

              <div className="space-y-4">
                {activity.map((item) => {
                  const Icon = getTypeIcon(item.type);
                  const StatusIcon = statusIcons[item.status];

                  return (
                    <div key={item.id} className="relative flex gap-4">
                      <div className="relative z-10 flex h-12 w-12 items-center justify-center rounded-full bg-white">
                        <div className="flex h-10 w-10 items-center justify-center rounded-full border border-slate-200 bg-white">
                          <Icon size={16} className="text-teal-600" />
                        </div>
                      </div>

                      <div className="flex-1 rounded-lg border border-slate-200 bg-white p-4">
                        <div className="flex items-start justify-between gap-4">
                          <div>
                            <p className="font-medium text-slate-900">{item.title}</p>
                            <div className="mt-1 flex flex-wrap items-center gap-3 text-sm text-slate-500">
                              <span className="flex items-center gap-1">
                                <User size={12} />
                                {item.specialistName}
                              </span>
                              <span>{item.type}</span>
                              <span className="flex items-center gap-1">
                                <Clock size={12} />
                                {formatTime(item.createdAt)}
                              </span>
                            </div>
                          </div>
                          <span
                            className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-medium ${statusColors[item.status]}`}
                          >
                            <StatusIcon size={10} className={item.status === 'in_progress' ? 'animate-spin' : ''} />
                            {item.status === 'in_progress'
                              ? 'In Progress'
                              : item.status.charAt(0).toUpperCase() + item.status.slice(1)}
                          </span>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          ) : (
            <div className="flex flex-col items-center py-12 text-slate-500">
              <Clock size={48} className="mb-4 text-slate-300" />
              <p className="text-lg font-medium">No activity yet</p>
              <p className="mt-1 text-sm">Activity will appear here as your specialist works on tasks</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default Activity;
