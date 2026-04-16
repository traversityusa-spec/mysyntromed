import React from 'react';
import { cn } from '@/lib/utils';

interface BadgeProps {
  children: React.ReactNode;
  className?: string;
}

export const Badge: React.FC<BadgeProps> = ({ children, className }) => (
  <span className={cn(
    "inline-flex items-center rounded-full bg-teal-50 px-3 py-1 text-xs font-bold text-teal-700 uppercase tracking-wider border border-teal-100",
    className
  )}>
    {children}
  </span>
);
