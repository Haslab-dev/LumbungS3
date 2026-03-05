import { ReactNode } from 'react';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

interface CardProps {
  children: ReactNode;
  className?: string;
}

export const Card = ({ children, className }: CardProps) => (
  <div className={cn("glass-card rounded-2xl p-6", className)}>
    {children}
  </div>
);

interface StatCardProps {
  title: string;
  value: string | number;
  icon: ReactNode;
  description?: string;
  trend?: {
    value: number;
    isUp: boolean;
  };
}

export const StatCard = ({ title, value, icon, description, trend }: StatCardProps) => (
  <Card className="relative overflow-hidden group">
    <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity">
      {icon}
    </div>
    <div className="flex flex-col gap-1">
      <span className="text-slate-400 text-sm font-medium">{title}</span>
      <div className="flex items-baseline gap-2">
        <h3 className="text-3xl font-bold text-white">{value}</h3>
        {trend && (
          <span className={cn(
            "text-xs font-bold px-2 py-0.5 rounded-full",
            trend.isUp ? "bg-emerald-500/20 text-emerald-400" : "bg-rose-500/20 text-rose-400"
          )}>
            {trend.isUp ? '+' : '-'}{Math.abs(trend.value)}%
          </span>
        )}
      </div>
      {description && <p className="text-slate-500 text-xs mt-1">{description}</p>}
    </div>
  </Card>
);
