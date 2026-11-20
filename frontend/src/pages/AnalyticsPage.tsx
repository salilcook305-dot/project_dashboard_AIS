import React, { useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import {
  PieChart,
  Pie,
  Cell,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  Legend
} from 'recharts';
import {
  BarChart3,
  PieChart as PieIcon,
  Users,
  Layers,
  ArrowUpDown,
  RotateCw,
  AlertCircle
} from 'lucide-react';
import { api } from '../lib/api';
import { EmployeeWorkloadRecord, Project } from '../types';
import { AvailabilityBadge } from '../components/AvailabilityBadge';
import { EmployeeProjectsModal } from '../components/EmployeeProjectsModal';

const STATUS_COLORS: Record<string, string> = {
  'In Progress': '#1E7BE0',
  'Planning': '#6B7A99',
  'Completed': '#2E7D32',
  'Cancelled': '#94A3B8',
  'On Hold': '#D4921A',
};

const PRIORITY_COLORS: Record<string, string> = {
  'Urgent': '#C62828',
  'High': '#E65100',
  'Medium': '#1E7BE0',
  'Low': '#6B7A99',
};

const TOP_EMPLOYEE_COLORS = [
  '#0B1F5C',
  '#1565C0',
  '#1E7BE0',
  '#2AA0F0',
  '#0284C7',
  '#0D9488',
  '#D4921A',
  '#7C3AED',
  '#94A3B8', // Others
];

const AVAILABILITY_COLORS: Record<string, string> = {
  'AVAILABLE': '#2E7D32',
  'BUSY': '#1E7BE0',
  'HEAVY': '#D4921A',
  'OVERLOADED': '#C62828',
  'ON_LEAVE': '#6B7A99',
  'AWAY': '#64748B',
};

const WHITE_TOOLTIP_STYLE: React.CSSProperties = {
  backgroundColor: '#FFFFFF',
  color: '#0F172A',
  borderRadius: '10px',
  fontSize: '12px',
  fontWeight: 600,
  border: '1px solid #CBD5E1',
  boxShadow: '0 10px 15px -3px rgba(0, 0, 0, 0.12), 0 4px 6px -4px rgba(0, 0, 0, 0.08)',
  padding: '8px 12px',
};

const WHITE_TOOLTIP_ITEM_STYLE: React.CSSProperties = {
  color: '#0F172A',
  fontWeight: 600,
  fontSize: '11px',
};

const WHITE_TOOLTIP_LABEL_STYLE: React.CSSProperties = {
  color: '#0F172A',
  fontWeight: 700,
  fontSize: '12px',
  marginBottom: '4px',
};

export const AnalyticsPage: React.FC = () => {
  const navigate = useNavigate();
  const [activeOnly, setActiveOnly] = useState<boolean>(true);
  const [sortBy, setSortBy] = useState<'projects_desc' | 'projects_asc' | 'name'>('projects_desc');
  const [selectedEmployee, setSelectedEmployee] = useState<EmployeeWorkloadRecord | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);

  // Projects data for Status and Priority charts
  const {
    data: projects = [],
    isLoading: isProjectsLoading,
    isError: isProjectsError,
    refetch: refetchProjects,
  } = useQuery<Project[]>({
    queryKey: ['projects', 'analytics'],
    queryFn: () => api.getProjects(),
  });

  // Workload data
  const {
    data: workload = [],
    isLoading: isWorkloadLoading,
    isError: isWorkloadError,
    refetch: refetchWorkload,
  } = useQuery<EmployeeWorkloadRecord[]>({
    queryKey: ['workload', activeOnly, sortBy],
    queryFn: () => api.getEmployeesWorkload({ active_only: activeOnly, sort: sortBy }),
  });

  // Compute status chart data
  const statusData = useMemo(() => {
    const counts: Record<string, number> = {
      'In Progress': 0,
      'Planning': 0,
      'Completed': 0,
      'Cancelled': 0,
      'On Hold': 0,
    };
    projects.forEach(p => {
      const st = p.status || 'Planning';
      if (counts[st] !== undefined) {
        counts[st]++;
      } else {
        counts[st] = (counts[st] || 0) + 1;
      }
    });
    return Object.entries(counts).map(([name, value]) => ({
      name,
      value,
      color: STATUS_COLORS[name] || '#64748B',
    })).filter(item => item.value > 0);
  }, [projects]);

  // Compute priority chart data
  const priorityData = useMemo(() => {
    const counts: Record<string, number> = {
      'Urgent': 0,
      'High': 0,
      'Medium': 0,
      'Low': 0,
    };
    projects.forEach(p => {
      const pr = p.priority || 'Medium';
      if (counts[pr] !== undefined) {
        counts[pr]++;
      } else {
        counts[pr] = (counts[pr] || 0) + 1;
      }
    });
    return Object.entries(counts).map(([name, count]) => ({
      name,
      count,
      fill: PRIORITY_COLORS[name] || '#1E7BE0',
    }));
  }, [projects]);

  // Compute top 8 employees + Others for workload doughnut
  const { topEmployeesData, totalWorkloadCount } = useMemo(() => {
    let total = 0;
    const sorted = [...workload].sort((a, b) => {
      const countA = activeOnly ? a.active_count : a.total_count;
      const countB = activeOnly ? b.active_count : b.total_count;
      return countB - countA;
    });

    sorted.forEach(e => {
      total += (activeOnly ? e.active_count : e.total_count);
    });

    const top8 = sorted.slice(0, 8);
    const others = sorted.slice(8);
    const othersCount = others.reduce((sum, e) => sum + (activeOnly ? e.active_count : e.total_count), 0);

    const slices = top8.map((e, idx) => ({
      name: e.name,
      value: activeOnly ? e.active_count : e.total_count,
      color: TOP_EMPLOYEE_COLORS[idx % TOP_EMPLOYEE_COLORS.length],
      record: e,
    }));

    if (othersCount > 0) {
      slices.push({
        name: 'Others',
        value: othersCount,
        color: TOP_EMPLOYEE_COLORS[8],
        record: null as any,
      });
    }

    return { topEmployeesData: slices, totalWorkloadCount: total };
  }, [workload, activeOnly]);

  // Compute availability breakdown doughnut
  const availabilityData = useMemo(() => {
    const counts: Record<string, number> = {
      'AVAILABLE': 0,
      'BUSY': 0,
      'HEAVY': 0,
      'OVERLOADED': 0,
      'ON_LEAVE': 0,
    };

    workload.forEach(e => {
      const st = (e.status || 'AVAILABLE').toUpperCase();
      if (st === 'AWAY') {
        counts['ON_LEAVE'] = (counts['ON_LEAVE'] || 0) + 1;
      } else if (counts[st] !== undefined) {
        counts[st]++;
      } else {
        counts[st] = 1;
      }
    });

    return [
      { name: 'Available', value: counts['AVAILABLE'], color: AVAILABILITY_COLORS['AVAILABLE'] },
      { name: 'Busy', value: counts['BUSY'], color: AVAILABILITY_COLORS['BUSY'] },
      { name: 'Heavy', value: counts['HEAVY'], color: AVAILABILITY_COLORS['HEAVY'] },
      { name: 'Overloaded', value: counts['OVERLOADED'], color: AVAILABILITY_COLORS['OVERLOADED'] },
      { name: 'On Leave', value: counts['ON_LEAVE'], color: AVAILABILITY_COLORS['ON_LEAVE'] },
    ].filter(i => i.value > 0);
  }, [workload]);

  const handleOpenEmployeeProjects = (emp: EmployeeWorkloadRecord) => {
    setSelectedEmployee(emp);
    setIsModalOpen(true);
  };

  const handleNavigateProject = (projectName: string) => {
    navigate(`/?search=${encodeURIComponent(projectName)}`);
  };

  return (
    <div className="p-6 space-y-6 max-w-7xl mx-auto">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-black text-slate-900 dark:text-slate-100 tracking-tight flex items-center gap-2">
            <BarChart3 className="w-5 h-5 text-brand-royal" />
            Executive Portfolio Analytics
          </h1>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
            Real-time project distribution, priority analysis, and team workload telemetry
          </p>
        </div>
        <button
          onClick={() => {
            refetchProjects();
            refetchWorkload();
          }}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-300 hover:bg-slate-50 shadow-sm transition"
        >
          <RotateCw className="w-3.5 h-3.5" />
          <span>Refresh Metrics</span>
        </button>
      </div>

      {/* Top Row: Status Doughnut & Priority Bar */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Project Status Doughnut */}
        <div className="bg-white dark:bg-slate-900 p-5 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm flex flex-col justify-between">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-sm font-bold text-slate-900 dark:text-slate-100 flex items-center gap-2">
              <PieIcon className="w-4 h-4 text-brand-royal" />
              Project Status Distribution
            </h2>
            <span className="text-xs text-slate-400 font-medium">{projects.length} Total</span>
          </div>

          {isProjectsLoading ? (
            <div className="h-64 flex items-center justify-center">
              <div className="w-8 h-8 rounded-full border-2 border-brand-royal border-t-transparent animate-spin" />
            </div>
          ) : isProjectsError ? (
            <div className="h-64 flex items-center justify-center text-xs text-rose-500 gap-1.5">
              <AlertCircle className="w-4 h-4" /> Failed to load status metrics
            </div>
          ) : statusData.length === 0 ? (
            <div className="h-64 flex items-center justify-center text-xs text-slate-400 italic">
              No project records available
            </div>
          ) : (
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={statusData}
                    dataKey="value"
                    nameKey="name"
                    cx="50%"
                    cy="50%"
                    innerRadius={60}
                    outerRadius={85}
                    paddingAngle={3}
                    isAnimationActive={true}
                    animationBegin={0}
                    animationDuration={3000}
                    animationEasing="ease-out"
                  >
                    {statusData.map((entry, index) => (
                      <Cell key={`cell-status-${index}`} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip
                    formatter={(val: number, name: string) => [`${val} projects`, name]}
                    contentStyle={WHITE_TOOLTIP_STYLE}
                    itemStyle={WHITE_TOOLTIP_ITEM_STYLE}
                    labelStyle={WHITE_TOOLTIP_LABEL_STYLE}
                  />
                  <Legend verticalAlign="bottom" height={36} iconType="circle" wrapperStyle={{ fontSize: '11px' }} />
                </PieChart>
              </ResponsiveContainer>
            </div>
          )}
        </div>

        {/* Priority Bar Chart */}
        <div className="bg-white dark:bg-slate-900 p-5 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm flex flex-col justify-between">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-sm font-bold text-slate-900 dark:text-slate-100 flex items-center gap-2">
              <Layers className="w-4 h-4 text-brand-gold" />
              Priority Breakdown
            </h2>
            <span className="text-xs text-slate-400 font-medium">All Projects</span>
          </div>

          {isProjectsLoading ? (
            <div className="h-64 flex items-center justify-center">
              <div className="w-8 h-8 rounded-full border-2 border-brand-royal border-t-transparent animate-spin" />
            </div>
          ) : isProjectsError ? (
            <div className="h-64 flex items-center justify-center text-xs text-rose-500 gap-1.5">
              <AlertCircle className="w-4 h-4" /> Failed to load priority metrics
            </div>
          ) : (
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={priorityData} margin={{ top: 20, right: 20, left: 0, bottom: 20 }}>
                  <XAxis dataKey="name" tick={{ fontSize: 11 }} />
                  <YAxis allowDecimals={false} tick={{ fontSize: 11 }} />
                  <Tooltip
                    cursor={{ fill: 'rgba(241, 245, 249, 0.6)' }}
                    formatter={(val: number) => [`${val} projects`, 'Count']}
                    contentStyle={WHITE_TOOLTIP_STYLE}
                    itemStyle={WHITE_TOOLTIP_ITEM_STYLE}
                    labelStyle={WHITE_TOOLTIP_LABEL_STYLE}
                  />
                  <Bar dataKey="count" radius={[6, 6, 0, 0]}>
                    {priorityData.map((entry, index) => (
                      <Cell key={`cell-prio-${index}`} fill={entry.fill} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}
        </div>
      </div>

      {/* Section 7B: Employee Workload Section */}
      <div className="bg-white dark:bg-slate-900 p-5 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm space-y-5">
        {/* Controls Bar */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-4 border-b border-slate-100 dark:border-slate-800">
          <div>
            <h2 className="text-base font-bold text-slate-900 dark:text-slate-100 flex items-center gap-2">
              <Users className="w-4 h-4 text-brand-royal" />
              Employee Workload & Capacity
            </h2>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
              Top assignees telemetry, availability states, and individual project quotas
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            {/* Active only / All projects toggle */}
            <div className="inline-flex rounded-xl bg-slate-100 dark:bg-slate-800 p-1 border border-slate-200 dark:border-slate-700 text-xs">
              <button
                type="button"
                onClick={() => setActiveOnly(true)}
                className={`px-3 py-1 rounded-lg font-semibold transition ${
                  activeOnly
                    ? 'bg-white dark:bg-slate-900 text-brand-royal shadow-sm'
                    : 'text-slate-600 dark:text-slate-400 hover:text-slate-900'
                }`}
              >
                Active Only
              </button>
              <button
                type="button"
                onClick={() => setActiveOnly(false)}
                className={`px-3 py-1 rounded-lg font-semibold transition ${
                  !activeOnly
                    ? 'bg-white dark:bg-slate-900 text-brand-royal shadow-sm'
                    : 'text-slate-600 dark:text-slate-400 hover:text-slate-900'
                }`}
              >
                All Projects
              </button>
            </div>

            {/* Sort Dropdown */}
            <div className="flex items-center gap-1.5 text-xs text-slate-500">
              <ArrowUpDown className="w-3.5 h-3.5" />
              <select
                value={sortBy}
                onChange={e => setSortBy(e.target.value as any)}
                className="py-1.5 pl-2.5 pr-8 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300 focus:outline-none focus:ring-2 focus:ring-brand-royal shadow-sm appearance-none cursor-pointer"
              >
                <option value="projects_desc">Most Projects</option>
                <option value="projects_asc">Fewest Projects</option>
                <option value="name">Name A–Z</option>
              </select>
            </div>
          </div>
        </div>

        {/* Workload Body: Top 8 Doughnut + Availability Doughnut + Sortable List */}
        {isWorkloadLoading ? (
          <div className="h-72 flex items-center justify-center">
            <div className="w-8 h-8 rounded-full border-2 border-brand-royal border-t-transparent animate-spin" />
          </div>
        ) : isWorkloadError ? (
          <div className="p-8 text-center text-xs text-rose-500 flex items-center justify-center gap-2">
            <AlertCircle className="w-4 h-4" /> Failed to load employee workload data.
          </div>
        ) : workload.length === 0 ? (
          <div className="p-12 text-center text-xs text-slate-400 italic">
            No employee records match the filter.
          </div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
            {/* Charts Left Column (5 cols) */}
            <div className="lg:col-span-5 space-y-6">
              {/* Doughnut: Top 8 employees with center total */}
              <div className="bg-slate-50 dark:bg-slate-800/40 p-4 rounded-xl border border-slate-200 dark:border-slate-800">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs font-bold text-slate-800 dark:text-slate-200">
                    Top Assignees ({activeOnly ? 'Active Projects' : 'Total Projects'})
                  </span>
                  <span className="text-[10px] text-slate-400">Click slice to view projects</span>
                </div>

                <div className="h-64 relative flex items-center justify-center">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={topEmployeesData}
                        dataKey="value"
                        nameKey="name"
                        cx="50%"
                        cy="50%"
                        innerRadius={65}
                        outerRadius={95}
                        paddingAngle={2}
                        isAnimationActive={true}
                        animationBegin={0}
                        animationDuration={3000}
                        animationEasing="ease-out"
                        onClick={(_, index) => {
                          const item = topEmployeesData[index];
                          if (item && item.record) {
                            handleOpenEmployeeProjects(item.record);
                          }
                        }}
                        cursor="pointer"
                      >
                        {topEmployeesData.map((entry, index) => (
                          <Cell key={`cell-top-${index}`} fill={entry.color} />
                        ))}
                      </Pie>
                      <Tooltip
                        formatter={(val: number, name: string) => [`${val} assignments`, name]}
                        contentStyle={WHITE_TOOLTIP_STYLE}
                        itemStyle={WHITE_TOOLTIP_ITEM_STYLE}
                        labelStyle={WHITE_TOOLTIP_LABEL_STYLE}
                      />
                    </PieChart>
                  </ResponsiveContainer>
                  {/* Centered Total Overlay */}
                  <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                    <span className="text-2xl font-black text-slate-900 dark:text-slate-100 leading-none">
                      {totalWorkloadCount}
                    </span>
                    <span className="text-[10px] text-slate-400 uppercase tracking-wider font-semibold mt-1">
                      Assignments
                    </span>
                  </div>
                </div>
              </div>

              {/* Second Small Doughnut: Availability Breakdown */}
              <div className="bg-slate-50 dark:bg-slate-800/40 p-4 rounded-xl border border-slate-200 dark:border-slate-800">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs font-bold text-slate-800 dark:text-slate-200">
                    Capacity & Availability States
                  </span>
                  <span className="text-[10px] text-slate-400">{workload.length} Total Staff</span>
                </div>
                <div className="h-44">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={availabilityData}
                        dataKey="value"
                        nameKey="name"
                        cx="50%"
                        cy="50%"
                        innerRadius={45}
                        outerRadius={65}
                        paddingAngle={3}
                        isAnimationActive={true}
                        animationBegin={0}
                        animationDuration={3000}
                        animationEasing="ease-out"
                      >
                        {availabilityData.map((entry, index) => (
                          <Cell key={`cell-avail-${index}`} fill={entry.color} />
                        ))}
                      </Pie>
                      <Tooltip
                        formatter={(val: number, name: string) => [`${val} staff`, name]}
                        contentStyle={WHITE_TOOLTIP_STYLE}
                        itemStyle={WHITE_TOOLTIP_ITEM_STYLE}
                        labelStyle={WHITE_TOOLTIP_LABEL_STYLE}
                      />
                      <Legend verticalAlign="bottom" height={28} iconType="circle" wrapperStyle={{ fontSize: '10px' }} />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
              </div>
            </div>

            {/* Sortable List Right Column (7 cols) */}
            <div className="lg:col-span-7 bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 overflow-hidden shadow-sm">
              <div className="p-3 bg-slate-50 dark:bg-slate-800/60 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between">
                <span className="text-xs font-bold text-slate-700 dark:text-slate-300">
                  Staff Workload Roster ({workload.length})
                </span>
                <span className="text-[10px] text-slate-400">Click row for assigned projects</span>
              </div>

              <div className="max-h-[480px] overflow-y-auto divide-y divide-slate-100 dark:divide-slate-800">
                {workload.map(emp => {
                  const count = activeOnly ? emp.active_count : emp.total_count;
                  return (
                    <div
                      key={emp.id}
                      onClick={() => handleOpenEmployeeProjects(emp)}
                      className="p-3 hover:bg-blue-50/50 dark:hover:bg-slate-800/60 transition cursor-pointer flex items-center justify-between gap-3"
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        <div className="w-8 h-8 rounded-full bg-brand-royal text-white text-xs font-bold flex items-center justify-center shrink-0 shadow-inner">
                          {emp.initials}
                        </div>
                        <div className="min-w-0">
                          <div className="font-semibold text-xs text-slate-900 dark:text-slate-100 truncate">
                            {emp.name}
                          </div>
                          <div className="text-[10px] text-slate-400 truncate">
                            {[emp.job_title, emp.department].filter(Boolean).join(' · ')}
                          </div>
                        </div>
                      </div>

                      <div className="flex items-center gap-2.5 shrink-0">
                        <span className="text-xs font-bold text-slate-800 dark:text-slate-200">
                          {count} {count === 1 ? 'proj' : 'projs'}
                        </span>
                        <AvailabilityBadge
                          status={emp.status}
                          activeCount={emp.active_count}
                          leaveUntil={emp.leave_until}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Employee Projects Modal */}
      <EmployeeProjectsModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        employee={selectedEmployee}
        onSelectProject={handleNavigateProject}
      />
    </div>
  );
};
