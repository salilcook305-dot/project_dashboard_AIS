import React from 'react';
import { AvailabilityStatus } from '../types';

interface AvailabilityBadgeProps {
  status?: AvailabilityStatus | string;
  override?: string | null;
  activeCount?: number;
  leaveUntil?: string | null;
  className?: string;
  size?: 'xs' | 'sm' | 'md';
}

function formatLeaveDate(dateStr: string): string {
  try {
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return dateStr;
    return d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });
  } catch {
    return dateStr;
  }
}

export const AvailabilityBadge: React.FC<AvailabilityBadgeProps> = ({
  status = 'AVAILABLE',
  override,
  activeCount,
  leaveUntil,
  className = '',
  size = 'xs',
}) => {
  const effectiveStatus = override || status || 'AVAILABLE';
  const normStatus = effectiveStatus.toUpperCase();

  let text = 'Available';
  let badgeClasses = 'bg-emerald-50 text-[#2E7D32] border-[#2E7D32]/30 dark:bg-emerald-950/40 dark:text-emerald-300 dark:border-emerald-800';

  if (normStatus === 'ON_LEAVE') {
    text = leaveUntil ? `On leave until ${formatLeaveDate(leaveUntil)}` : 'On leave';
    badgeClasses = 'bg-slate-100 text-[#6B7A99] border-[#6B7A99]/30 dark:bg-slate-800 dark:text-slate-300 dark:border-slate-700';
  } else if (normStatus === 'AWAY') {
    text = leaveUntil ? `Away until ${formatLeaveDate(leaveUntil)}` : 'Away';
    badgeClasses = 'bg-slate-100 text-[#6B7A99] border-[#6B7A99]/30 dark:bg-slate-800 dark:text-slate-300 dark:border-slate-700';
  } else if (normStatus === 'BUSY') {
    text = activeCount !== undefined ? `Busy · ${activeCount} ${activeCount === 1 ? 'project' : 'projects'}` : 'Busy';
    badgeClasses = 'bg-blue-50 text-[#1E7BE0] border-[#1E7BE0]/30 dark:bg-blue-950/40 dark:text-blue-300 dark:border-blue-800';
  } else if (normStatus === 'HEAVY') {
    text = activeCount !== undefined ? `Heavy · ${activeCount} projects` : 'Heavy';
    badgeClasses = 'bg-amber-50 text-[#D4921A] border-[#D4921A]/30 dark:bg-amber-950/40 dark:text-amber-300 dark:border-amber-800 font-semibold';
  } else if (normStatus === 'OVERLOADED') {
    text = activeCount !== undefined ? `Overloaded · ${activeCount} projects` : 'Overloaded';
    badgeClasses = 'bg-rose-50 text-[#C62828] border-[#C62828]/30 dark:bg-rose-950/40 dark:text-rose-300 dark:border-rose-800 font-bold';
  } else {
    // AVAILABLE
    text = 'Available';
    badgeClasses = 'bg-emerald-50 text-[#2E7D32] border-[#2E7D32]/30 dark:bg-emerald-950/40 dark:text-emerald-300 dark:border-emerald-800';
  }

  const sizeClasses =
    size === 'xs'
      ? 'px-1.5 py-0.5 text-[10px]'
      : size === 'sm'
      ? 'px-2 py-0.5 text-xs'
      : 'px-2.5 py-1 text-xs';

  return (
    <span
      className={`inline-flex items-center rounded-full border leading-none tracking-tight select-none ${sizeClasses} ${badgeClasses} ${className}`}
    >
      <span className="w-1.5 h-1.5 rounded-full mr-1.5 shrink-0 bg-current opacity-80" />
      <span>{text}</span>
    </span>
  );
};
