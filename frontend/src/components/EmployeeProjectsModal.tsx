import React from 'react';
import { X, FolderGit2 } from 'lucide-react';
import { EmployeeWorkloadRecord } from '../types';
import { AvailabilityBadge } from './AvailabilityBadge';

interface EmployeeProjectsModalProps {
  isOpen: boolean;
  onClose: () => void;
  employee: EmployeeWorkloadRecord | null;
  onSelectProject?: (projectName: string) => void;
}

export const EmployeeProjectsModal: React.FC<EmployeeProjectsModalProps> = ({
  isOpen,
  onClose,
  employee,
  onSelectProject,
}) => {
  if (!isOpen || !employee) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm animate-in fade-in duration-150">
      <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-2xl border border-slate-200 dark:border-slate-800 w-full max-w-lg overflow-hidden">
        {/* Header */}
        <div className="p-5 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between bg-slate-50 dark:bg-slate-800/40">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-brand-royal text-white text-xs font-bold flex items-center justify-center shrink-0 shadow-inner">
              {employee.initials}
            </div>
            <div>
              <h3 className="font-bold text-slate-900 dark:text-slate-100 text-sm">
                {employee.name}
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                {[employee.job_title, employee.department].filter(Boolean).join(' · ')}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Content */}
        <div className="p-5 space-y-4 max-h-[70vh] overflow-y-auto">
          {/* Status Badge */}
          <div className="flex items-center justify-between p-3 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700/60">
            <span className="text-xs font-semibold text-slate-600 dark:text-slate-300">
              Current Availability:
            </span>
            <AvailabilityBadge
              status={employee.status}
              activeCount={employee.active_count}
              leaveUntil={employee.leave_until}
              size="sm"
            />
          </div>

          {/* Assigned Projects */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-bold text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
                <FolderGit2 className="w-3.5 h-3.5 text-brand-royal" />
                Assigned Projects ({employee.projects?.length || 0})
              </span>
            </div>

            {(!employee.projects || employee.projects.length === 0) ? (
              <div className="p-6 text-center text-xs text-slate-400 italic bg-slate-50 dark:bg-slate-800/30 rounded-xl border border-dashed border-slate-200 dark:border-slate-800">
                No active projects currently assigned.
              </div>
            ) : (
              <div className="space-y-2">
                {employee.projects.map(p => (
                  <div
                    key={p.id}
                    onClick={() => {
                      if (onSelectProject) {
                        onSelectProject(p.name);
                        onClose();
                      }
                    }}
                    className="p-3 rounded-xl border border-slate-200 dark:border-slate-700/60 bg-white dark:bg-slate-800 hover:border-brand-royal/40 hover:shadow-sm transition cursor-pointer flex items-center justify-between"
                  >
                    <div>
                      <div className="text-xs font-semibold text-slate-900 dark:text-slate-100">
                        {p.name}
                      </div>
                      <div className="text-[10px] text-slate-400 mt-0.5">
                        Project ID: <span className="font-medium text-slate-600 dark:text-slate-300">#{p.id}</span>
                      </div>
                    </div>
                    <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-blue-50 text-brand-royal border border-blue-200 dark:bg-blue-950/40 dark:text-blue-300 dark:border-blue-800">
                      {p.status}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/30 flex justify-end">
          <button
            onClick={onClose}
            className="px-4 py-2 text-xs font-semibold rounded-lg bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-200 hover:bg-slate-300 dark:hover:bg-slate-600 transition"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};
