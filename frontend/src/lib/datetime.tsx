import { useState, useEffect } from 'react';

export const useDateTime = () => {
  const [currentTime, setCurrentTime] = useState(new Date());
  const [timezone, setTimezone] = useState<string>('');
  const [timezoneOffset, setTimezoneOffset] = useState<number>(0);

  useEffect(() => {
    const updateTime = () => {
      const now = new Date();
      setCurrentTime(now);
      setTimezone(now.toLocaleTimeString(undefined, { timeZoneName: 'short' }).split(' ').slice(1).join(' '));
      setTimezoneOffset(now.getTimezoneOffset());
    };

    updateTime();
    const interval = setInterval(updateTime, 1000);
    return () => clearInterval(interval);
  }, []);

  const formatTime = (date?: Date) => {
    const d = date || currentTime;
    return d.toLocaleTimeString(undefined, {
      hour: 'numeric',
      minute: '2-digit',
      second: '2-digit',
    });
  };

  const formatDate = (date?: Date) => {
    const d = date || currentTime;
    return d.toLocaleDateString(undefined, {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });
  };

  const formatShortDate = (date?: Date) => {
    const d = date || currentTime;
    return d.toLocaleDateString(undefined, {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });
  };

  const formatRelative = (date: Date) => {
    const now = currentTime;
    const diff = now.getTime() - date.getTime();
    const seconds = Math.floor(diff / 1000);
    const minutes = Math.floor(seconds / 60);
    const hours = Math.floor(minutes / 60);
    const days = Math.floor(hours / 24);

    if (seconds < 60) return 'Just now';
    if (minutes < 60) return `${minutes}m ago`;
    if (hours < 24) return `${hours}h ago`;
    if (days < 7) return `${days}d ago`;
    return formatShortDate(date);
  };

  return {
    currentTime,
    timezone,
    timezoneOffset,
    formatTime,
    formatDate,
    formatShortDate,
    formatRelative,
  };
};

export const DateTimeDisplay = ({ className = '' }: { className?: string }) => {
  const { formatTime, formatDate, timezone } = useDateTime();
  
  return (
    <div className={`flex flex-col ${className}`}>
      <span className="text-2xl font-bold text-navy-900">{formatTime()}</span>
      <span className="text-sm text-slate-500">{formatDate()}</span>
      {timezone && <span className="text-xs text-slate-400">{timezone}</span>}
    </div>
  );
};