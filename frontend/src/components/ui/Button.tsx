import React from 'react';
import { Link } from 'react-router-dom';
import { cn } from '@/lib/utils';
import { LucideIcon } from 'lucide-react';

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'outline' | 'ghost';
  size?: 'sm' | 'md' | 'lg';
  href?: string;
  loading?: boolean;
  showArrow?: boolean;
  icon?: LucideIcon;
}

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant = 'primary', size = 'md', href, loading, showArrow = true, icon: Icon, children, ...props }, ref) => {
    const baseStyles = "inline-flex items-center justify-center rounded-lg font-semibold transition-all duration-200 active:scale-95 disabled:opacity-70 disabled:pointer-events-none group";
    
    const variants = {
      primary: "bg-teal-600 hover:bg-teal-700 text-white shadow-sm hover:shadow-md",
      outline: "border-2 border-teal-600 text-teal-600 hover:bg-teal-600 hover:text-white",
      ghost: "text-teal-600 hover:bg-teal-50",
    };

    const sizes = {
      sm: "px-4 py-2 text-sm",
      md: "px-6 py-3 text-base",
      lg: "px-8 py-4 text-lg",
    };

    const content = (
      <>
        {loading && (
          <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-current" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
          </svg>
        )}
        {Icon && <Icon className={cn("mr-2 h-5 w-5", loading && "hidden")} />}
        {children}
        {showArrow && <span className="ml-2 transition-transform group-hover:translate-x-1">→</span>}
      </>
    );

    if (href) {
      return (
        <Link 
          to={href} 
          className={cn(baseStyles, variants[variant], sizes[size], className)}
        >
          {content}
        </Link>
      );
    }

    return (
      <button
        ref={ref}
        className={cn(baseStyles, variants[variant], sizes[size], className)}
        disabled={loading}
        {...props}
      >
        {content}
      </button>
    );
  }
);
