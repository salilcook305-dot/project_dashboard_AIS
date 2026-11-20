import React, { useState, useRef, useEffect, useMemo } from 'react';
import { Search, X, LoaderCircle, RotateCw, AlertTriangle } from 'lucide-react';
import { AvailabilityBadge } from './AvailabilityBadge';

export interface EmployeeOption {
  id: number;
  username: string;
  name: string;
  email?: string;
  initials?: string;
  job_title?: string;
  department?: string;
  role?: string;
  status?: string;
  active_count?: number;
  availability_override?: string | null;
  leave_until?: string | null;
}

interface EmployeeSearchComboboxProps {
  employees: EmployeeOption[];
  assignedEmployeeIds: number[];
  onSelect: (employee: EmployeeOption) => void;
  isLoading?: boolean;
  error?: string | null;
  onRetry?: () => void;
}

export const EmployeeSearchCombobox: React.FC<EmployeeSearchComboboxProps> = ({
  employees,
  assignedEmployeeIds,
  onSelect,
  isLoading = false,
  error = null,
  onRetry,
}) => {
  const [query, setQuery] = useState('');
  const [isOpen, setIsOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(-1);
  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const itemRefs = useRef<(HTMLDivElement | null)[]>([]);

  // Filter unassigned employees
  const unassignedEmployees = useMemo(() => {
    const assignedSet = new Set(assignedEmployeeIds);
    return employees.filter(emp => !assignedSet.has(emp.id));
  }, [employees, assignedEmployeeIds]);

  // Client-side multi-word AND match across name, username, email, job_title, department
  const filteredEmployees = useMemo(() => {
    const trimmed = query.trim().toLowerCase();
    if (!trimmed) {
      return unassignedEmployees;
    }
    const words = trimmed.split(/\s+/).filter(Boolean);
    return unassignedEmployees.filter(emp => {
      const searchTarget = `${emp.name || ''} ${emp.username || ''} ${emp.email || ''} ${emp.job_title || ''} ${emp.department || ''}`.toLowerCase();
      return words.every(word => searchTarget.includes(word));
    });
  }, [unassignedEmployees, query]);

  // Handle click outside to close
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false);
        setActiveIndex(-1);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Scroll active item into view
  useEffect(() => {
    if (activeIndex >= 0 && itemRefs.current[activeIndex]) {
      itemRefs.current[activeIndex]?.scrollIntoView({ block: 'nearest' });
    }
  }, [activeIndex]);

  const handleSelect = (emp: EmployeeOption) => {
    onSelect(emp);
    setQuery('');
    setActiveIndex(-1);
    // keep focus in the search box so several people can be added quickly
    inputRef.current?.focus();
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      if (!isOpen) {
        setIsOpen(true);
        setActiveIndex(0);
      } else if (filteredEmployees.length > 0) {
        setActiveIndex(prev => (prev + 1) % filteredEmployees.length);
      }
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      if (!isOpen) {
        setIsOpen(true);
        setActiveIndex(filteredEmployees.length - 1);
      } else if (filteredEmployees.length > 0) {
        setActiveIndex(prev => (prev - 1 + filteredEmployees.length) % filteredEmployees.length);
      }
    } else if (e.key === 'Enter') {
      // Must NOT submit the project form!
      e.preventDefault();
      e.stopPropagation();
      if (isOpen && activeIndex >= 0 && activeIndex < filteredEmployees.length) {
        handleSelect(filteredEmployees[activeIndex]);
      }
    } else if (e.key === 'Escape') {
      e.preventDefault();
      setIsOpen(false);
      setActiveIndex(-1);
    }
  };

  const handleClear = () => {
    setQuery('');
    setActiveIndex(-1);
    inputRef.current?.focus();
  };

  const showList = isOpen && (isLoading || error || unassignedEmployees.length === 0 || filteredEmployees.length > 0 || query.trim().length > 0);

  return (
    <div ref={containerRef} className="relative mb-3">
      {/* Search Input Container */}
      <div className="relative">
        <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400">
          <Search className="w-3.5 h-3.5" />
        </div>
        <input
          ref={inputRef}
          type="text"
          role="combobox"
          aria-expanded={isOpen}
          aria-haspopup="listbox"
          aria-controls="employee-combobox-listbox"
          aria-autocomplete="list"
          aria-activedescendant={
            activeIndex >= 0 && filteredEmployees[activeIndex]
              ? `employee-option-${filteredEmployees[activeIndex].id}`
              : undefined
          }
          value={query}
          onFocus={() => setIsOpen(true)}
          onChange={e => {
            setQuery(e.target.value);
            setIsOpen(true);
            setActiveIndex(-1);
          }}
          onKeyDown={handleKeyDown}
          placeholder="Search employees by name, username, job title or department..."
          className="w-full pl-8 pr-8 py-2 text-xs rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-brand-royal transition-shadow"
        />
        {query && (
          <button
            type="button"
            onClick={handleClear}
            className="absolute inset-y-0 right-0 pr-2.5 flex items-center text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
            title="Clear search"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        )}
      </div>

      {/* Results rendered in normal flow under input (never clipped) */}
      {showList && (
        <div
          id="employee-combobox-listbox"
          role="listbox"
          className="mt-1 border border-slate-200 dark:border-slate-700 rounded-lg max-h-48 overflow-y-auto bg-white dark:bg-slate-800 divide-y divide-slate-100 dark:divide-slate-700/60 shadow-lg"
        >
          {error ? (
            <div className="p-3 text-xs text-red-600 dark:text-red-400 flex items-center justify-between">
              <span>{error}</span>
              {onRetry && (
                <button
                  type="button"
                  onClick={onRetry}
                  className="inline-flex items-center gap-1 px-2 py-0.5 text-[11px] font-medium bg-red-50 dark:bg-red-950/40 text-red-700 dark:text-red-300 rounded border border-red-200 dark:border-red-900/60 hover:bg-red-100"
                >
                  <RotateCw className="w-3 h-3" /> Retry
                </button>
              )}
            </div>
          ) : isLoading ? (
            <div className="p-3 text-xs text-slate-500 dark:text-slate-400 flex items-center justify-center gap-2">
              <LoaderCircle className="w-3.5 h-3.5 animate-spin" />
              <span>Loading employees...</span>
            </div>
          ) : unassignedEmployees.length === 0 ? (
            <div className="p-3 text-xs text-slate-500 dark:text-slate-400 text-center italic">
              All employees are already assigned
            </div>
          ) : filteredEmployees.length === 0 ? (
            <div className="p-3 text-xs text-slate-500 dark:text-slate-400 text-center italic">
              No employees found
            </div>
          ) : (
            filteredEmployees.map((emp, index) => {
              const isSelected = index === activeIndex;
              const initials =
                emp.initials ||
                (emp.name
                  ? emp.name
                      .split(' ')
                      .map(w => w[0])
                      .join('')
                      .slice(0, 2)
                      .toUpperCase()
                  : emp.username.slice(0, 2).toUpperCase());

              return (
                <div
                  key={emp.id}
                  id={`employee-option-${emp.id}`}
                  ref={el => (itemRefs.current[index] = el)}
                  role="option"
                  aria-selected={isSelected}
                  onMouseEnter={() => setActiveIndex(index)}
                  onClick={() => handleSelect(emp)}
                  className={`flex items-center gap-2.5 p-2 text-xs cursor-pointer transition-colors ${
                    isSelected
                      ? 'bg-blue-50 dark:bg-blue-950/40 text-brand-royal dark:text-[#60A5FA]'
                      : 'hover:bg-slate-50 dark:hover:bg-slate-700/40 text-slate-900 dark:text-slate-100'
                  }`}
                >
                  {/* Initials Avatar */}
                  <div className="w-7 h-7 rounded-full bg-brand-royal text-white text-[11px] font-bold flex items-center justify-center shrink-0 shadow-inner">
                    {initials}
                  </div>
                  {/* Details */}
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center justify-between gap-1">
                      <div className="font-medium truncate">
                        {emp.name}{' '}
                        <span className="text-[11px] text-slate-400 dark:text-slate-500 font-normal">
                          (@{emp.username})
                        </span>
                      </div>
                      <AvailabilityBadge
                        status={emp.status}
                        activeCount={emp.active_count}
                        leaveUntil={emp.leave_until}
                      />
                    </div>
                    {(emp.job_title || emp.department) && (
                      <div className="text-[11px] text-slate-500 dark:text-slate-400 truncate">
                        {[emp.job_title, emp.department].filter(Boolean).join(' · ')}
                      </div>
                    )}
                    {(emp.status === 'HEAVY' || emp.status === 'OVERLOADED') && (
                      <div className="flex items-center gap-1 text-[10px] text-amber-600 dark:text-amber-400 font-medium mt-0.5">
                        <AlertTriangle className="w-3 h-3 shrink-0" />
                        <span>Workload warning: currently assigned to {emp.active_count || 'several'} active projects</span>
                      </div>
                    )}
                  </div>
                </div>
              );
            })
          )}
        </div>
      )}
    </div>
  );
};

