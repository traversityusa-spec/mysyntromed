import React from 'react';
import { cn } from '@/lib/utils';

interface SectionLabelProps {
  children: React.ReactNode;
  className?: string;
}

export const SectionLabel: React.FC<SectionLabelProps> = ({ children, className }) => (
  <span className={cn(
    "text-xs font-extrabold tracking-[0.2em] text-teal-600 uppercase mb-4 block",
    className
  )}>
    {children}
  </span>
);
