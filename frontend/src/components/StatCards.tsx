import React from 'react';
import { Package, Loader2, Calendar, Check, Ban, Hourglass, AlertTriangle } from 'lucide-react';
import { Project } from '../types';

export function getProjectAttentionStatus(endDate?: string, status?: string) {
  if (status === 'COMPLETED' || status === 'CANCELLED' || !endDate) {
    return { isOverdue: false, isEndingSoon: false, daysRemaining: 0 };
  }
  const [y, m, d] = endDate.split('-').map(Number);
  const targetDate = new Date(y, m - 1, d);
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const diffTime = targetDate.getTime() - today.getTime();
  const daysRemaining = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  if (daysRemaining < 0) {
    return { isOverdue: true, isEndingSoon: false, daysRemaining };
  }
  if (daysRemaining <= 7) {
    return { isOverdue: false, isEndingSoon: true, daysRemaining };
  }
  return { isOverdue: false, isEndingSoon: false, daysRemaining };
}

interface StatCardsProps {
  projects: Project[];
  activeFilter: string;
  onFilterChange: (status: string) => void;
}

export const StatCards: React.FC<StatCardsProps> = ({ projects, activeFilter, onFilterChange }) => {
  const total = projects.length;
  const inProgress = projects.filter(p => {
    const s = (p.status || '').toLowerCase();
    return s.includes('progress') || s === 'in_progress';
  }).length;
  const planning = projects.filter(p => {
    const s = (p.status || '').toLowerCase();
    return s.includes('plan');
  }).length;
  const completed = projects.filter(p => {
    const s = (p.status || '').toLowerCase();
    return s.includes('comp');
  }).length;
  const cancelled = projects.filter(p => {
    const s = (p.status || '').toLowerCase();
    return s.includes('cancel') || s.includes('hold');
  }).length;
  const endingSoon = projects.filter(p => {
    const { isEndingSoon } = getProjectAttentionStatus(p.end_date, p.status);
    return isEndingSoon;
  }).length;
  const overdue = projects.filter(p => {
    const { isOverdue } = getProjectAttentionStatus(p.end_date, p.status);
    return isOverdue;
  }).length;

  const cards = [
    { id: '', title: 'TOTAL', count: total, subtext: 'All Projects', icon: Package },
    { id: 'IN_PROGRESS', title: 'ACTIVE', count: inProgress, subtext: 'In Progress', icon: Loader2 },
    { id: 'PLANNING', title: 'PLANNING', count: planning, subtext: 'Upcoming', icon: Calendar },
    { id: 'COMPLETED', title: 'DONE', count: completed, subtext: 'Delivered', icon: Check },
    { id: 'CANCELLED', title: 'CANCELLED', count: cancelled, subtext: 'On Hold / Stopped', icon: Ban },
    { id: 'ending_soon', title: 'ENDING', count: endingSoon, subtext: '< 7 Days', icon: Hourglass },
    { id: 'overdue', title: 'OVERDUE', count: overdue, subtext: 'Past Deadline', icon: AlertTriangle },
  ];

  return (
    <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-3 mb-6">
      {cards.map(card => {
        const Icon = card.icon;
        const isActive = (card.id === '' && activeFilter === '') || (card.id !== '' && activeFilter === card.id);

        return (
          <div
            key={card.title}
            onClick={() => onFilterChange(card.id === activeFilter ? '' : card.id)}
            className={`p-4 rounded-2xl bg-white border transition-all cursor-pointer shadow-sm ${
              isActive
                ? 'border-2 border-[#186FC8] shadow-sm'
                : 'border-slate-200/90 hover:border-slate-300'
            }`}
          >
            <div className="flex items-center justify-between">
              <span className={`text-[10px] font-bold tracking-wider uppercase ${isActive ? 'text-[#186FC8]' : 'text-slate-500'}`}>
                {card.title}
              </span>
              <Icon className={`w-4 h-4 ${isActive ? 'text-[#186FC8]' : 'text-slate-400'}`} />
            </div>
            <div className="mt-2 text-2xl font-black tracking-tight text-slate-900">
              {card.count}
            </div>
            <div className={`mt-1 text-xs font-semibold ${isActive ? 'text-[#186FC8]' : 'text-slate-500'}`}>
              {card.subtext}
            </div>
          </div>
        );
      })}
    </div>
  );
};
