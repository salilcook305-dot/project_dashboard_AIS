import React, { useState, useMemo, useEffect } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import {
  PieChart as RechartsPieChart,
  Pie,
  Cell,
  Tooltip,
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid
} from 'recharts';
import {
  Search,
  ChevronDown,
  ChevronRight,
  RotateCw,
  Users,
  Plus,
  AlertTriangle,
  FolderGit2,
  Trash2,
  Edit2,
  Download,
  BookOpen,
  FileText,
  ShieldAlert,
  PieChart as PieIcon,
  BarChart3,
  Database,
  Server,
  Laptop,
  CheckCircle2,
  Calendar
} from 'lucide-react';
import { toast } from 'sonner';
import { api } from '../lib/api';
import { Project, DueDiaryReport, EmployeeWorkloadRecord } from '../types';
import { EmployeeOption } from '../components/EmployeeSearchCombobox';
import { ProjectModal } from '../components/ProjectModal';
import { AvailabilityBadge } from '../components/AvailabilityBadge';
import { ProjectDiaryTab } from '../components/ProjectDiaryTab';
import { ProjectProgressUpdater } from '../components/ProjectProgressUpdater';
import { useCurrentUser } from '../components/ProtectedRoute';

const STATUS_CHART_COLORS: Record<string, string> = {
  'In Progress': '#1E7BE0',
  'Planning': '#6B7A99',
  'Completed': '#2E7D32',
  'Cancelled': '#94A3B8',
  'On Hold': '#D4921A',
};

const WORKLOAD_PALETTE = [
  '#0B1F5C', '#1565C0', '#1E7BE0', '#2AA0F0',
  '#0284C7', '#0D9488', '#D4921A', '#7C3AED', '#94A3B8',
];

const AVAILABILITY_CHART_COLORS: Record<string, string> = {
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
  boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.2), 0 8px 10px -6px rgba(0, 0, 0, 0.1)',
  padding: '8px 12px',
  zIndex: 99999,
};

const TOOLTIP_WRAPPER_STYLE: React.CSSProperties = {
  zIndex: 99999,
  pointerEvents: 'none',
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

function getProjectBarData(p: Project) {
  const isCompleted = p.status === 'Completed' || (p.progress ?? 0) >= 100;
  const feProg = isCompleted ? 100 : (p.frontend_progress ?? 0);
  const beProg = isCompleted ? 100 : (p.backend_progress ?? 0);
  const dbProg = isCompleted ? 100 : (p.database_progress ?? 0);
  const overallProg = isCompleted ? 100 : (p.progress ?? Math.round((feProg + beProg + dbProg) / 3));

  return {
    isCompleted,
    overallProg,
    barData: [
      {
        module: 'Frontend',
        progress: feProg,
        fill: '#0284C7',
        icon: Laptop,
        lightBg: 'bg-sky-50 dark:bg-sky-950/30',
        border: 'border-sky-200 dark:border-sky-900/60',
        text: 'text-sky-700 dark:text-sky-300',
      },
      {
        module: 'Backend',
        progress: beProg,
        fill: '#10B981',
        icon: Server,
        lightBg: 'bg-emerald-50 dark:bg-emerald-950/30',
        border: 'border-emerald-200 dark:border-emerald-900/60',
        text: 'text-emerald-700 dark:text-emerald-300',
      },
      {
        module: 'Database',
        progress: dbProg,
        fill: '#8B5CF6',
        icon: Database,
        lightBg: 'bg-purple-50 dark:bg-purple-950/30',
        border: 'border-purple-200 dark:border-purple-900/60',
        text: 'text-purple-700 dark:text-purple-300',
      }
    ]
  };
}

export const DashboardPage: React.FC = () => {
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const { user } = useCurrentUser();

  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [memberFilter, setMemberFilter] = useState('');
  const [sortBy, setSortBy] = useState('created_at');
  const [sortAsc, setSortAsc] = useState(false);
  const [chartViewMode, setChartViewMode] = useState<'pie' | 'bar'>('pie');

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedProject, setSelectedProject] = useState<Project | null>(null);
  const [selectedBarGraphProject, setSelectedBarGraphProject] = useState<Project | null>(null);

  // Row expansion state: set of expanded project IDs
  const [expandedIds, setExpandedIds] = useState<Set<number>>(new Set());
  // Active sub-tab inside expanded drawer: 'overview' | 'team' | 'documents' | 'diary' | 'bargraph'
  const [expandedTabs, setExpandedTabs] = useState<Record<number, 'overview' | 'team' | 'documents' | 'diary' | 'bargraph'>>({});

  // Accordion state for table sections (arrow toggle) - default true so all sections show details upon login
  const [isPocSectionOpen, setIsPocSectionOpen] = useState(true);
  const [isMemberSectionOpen, setIsMemberSectionOpen] = useState(true);
  const [isOtherSectionOpen, setIsOtherSectionOpen] = useState(true);

  // Active hovered chart items for side/header details display
  const [hoveredStatus, setHoveredStatus] = useState<{ name: string; value: number } | null>(null);
  const [hoveredWorkload, setHoveredWorkload] = useState<{ name: string; value: number } | null>(null);
  const [hoveredAvailability, setHoveredAvailability] = useState<{ name: string; value: number } | null>(null);

  // Controls 3-second entrance animation on mount and refresh
  const [isChartReady, setIsChartReady] = useState<boolean>(false);

  useEffect(() => {
    // Small delay ensures parent DOM dimensions are measured before charts mount
    const timer = setTimeout(() => {
      setIsChartReady(true);
    }, 60);
    return () => clearTimeout(timer);
  }, []);

  const handleOpenProjectBarGraph = (p: Project) => {
    setExpandedIds(prev => new Set(prev).add(p.id));
    setExpandedTabs(t => ({ ...t, [p.id]: 'bargraph' }));
    setSelectedBarGraphProject(p);
  };

  const isAdminOrManager = user?.is_admin || user?.is_manager || user?.role === 'ADMIN' || user?.role === 'MANAGER';

  // Fast KPI summary for instant frame-1 Pie Chart rendering
  const { data: summary } = useQuery({
    queryKey: ['summary'],
    queryFn: async () => {
      const res = await api.getSummary();
      if (res) {
        try {
          sessionStorage.setItem('ai_samrat_summary_cache', JSON.stringify(res));
        } catch {}
      }
      return res;
    },
    initialData: () => {
      try {
        const cached = sessionStorage.getItem('ai_samrat_summary_cache');
        if (cached) return JSON.parse(cached);
      } catch {}
      return undefined;
    },
    staleTime: 60 * 1000,
  });

  // Unfiltered projects for stat cards & pie chart
  const { data: allProjects = [] } = useQuery<Project[]>({
    queryKey: ['projects', 'all'],
    queryFn: () => api.getProjects(),
    staleTime: 60 * 1000,
  });

  // Filtered projects
  const {
    data: projects = [],
    isLoading: isProjectsLoading,
    isRefetching,
  } = useQuery<Project[]>({
    queryKey: ['projects', search, statusFilter],
    queryFn: () => api.getProjects({
      search,
      status: statusFilter,
    }),
    staleTime: 30 * 1000,
  });

  // Workload data for Top Workload Pie Chart
  const { data: workload = [] } = useQuery<EmployeeWorkloadRecord[]>({
    queryKey: ['employees', 'workload'],
    queryFn: async () => {
      const res = await api.getEmployeesWorkload({ active_only: true });
      if (res && res.length > 0) {
        try {
          sessionStorage.setItem('ai_samrat_workload_cache', JSON.stringify(res));
        } catch {}
      }
      return res;
    },
    initialData: () => {
      try {
        const cached = sessionStorage.getItem('ai_samrat_workload_cache');
        if (cached) return JSON.parse(cached);
      } catch {}
      return undefined;
    },
    staleTime: 60 * 1000,
  });

  // Employees data
  const {
    data: employees = [],
  } = useQuery<EmployeeOption[]>({
    queryKey: ['employees'],
    queryFn: async () => {
      const res = await api.getEmployees();
      if (res && res.length > 0) {
        try {
          sessionStorage.setItem('ai_samrat_employees_cache', JSON.stringify(res));
        } catch {}
      }
      return res;
    },
    initialData: () => {
      try {
        const cached = sessionStorage.getItem('ai_samrat_employees_cache');
        if (cached) return JSON.parse(cached);
      } catch {}
      return undefined;
    },
    staleTime: 60 * 1000,
  });

  // Due Diary report for POC/Manager/Admin
  const { data: dueReport } = useQuery<DueDiaryReport>({
    queryKey: ['diary', 'due'],
    queryFn: () => api.getDueDiary(),
    enabled: !!isAdminOrManager,
  });

  // Status Pie Data - renders immediately from instant summary or allProjects
  const statusPieData = useMemo(() => {
    const counts: Record<string, number> = {
      'In Progress': 0,
      'Planning': 0,
      'Completed': 0,
      'Cancelled': 0,
      'On Hold': 0,
    };

    if (summary) {
      counts['In Progress'] = Number(summary.in_progress || 0);
      counts['Planning'] = Number(summary.planning || 0);
      counts['Completed'] = Number(summary.completed || 0);
      counts['Cancelled'] = Number(summary.cancelled || 0);
      counts['On Hold'] = Number(summary.on_hold || 0);
    } else if (allProjects.length > 0) {
      allProjects.forEach(p => {
        const s = p.status || 'Planning';
        if (counts[s] !== undefined) counts[s]++;
        else if (s.toLowerCase().includes('progress')) counts['In Progress']++;
        else if (s.toLowerCase().includes('plan')) counts['Planning']++;
        else if (s.toLowerCase().includes('comp')) counts['Completed']++;
        else counts['In Progress']++;
      });
    }

    return Object.entries(counts)
      .filter(([_, count]) => count > 0)
      .map(([name, value]) => ({
        name,
        value,
        color: STATUS_CHART_COLORS[name] || '#1E7BE0',
      }));
  }, [allProjects, summary]);

  // Employee Workload Pie Data (Top 8 + Others)
  const workloadPieData = useMemo(() => {
    if (!workload || workload.length === 0) return [];
    const sorted = [...workload].sort((a, b) => b.active_count - a.active_count);
    const top8 = sorted.slice(0, 8);
    const others = sorted.slice(8);
    const othersCount = others.reduce((acc, curr) => acc + curr.active_count, 0);

    const slices = top8
      .filter(w => w.active_count > 0)
      .map((w, i) => ({
        name: w.name,
        value: w.active_count,
        color: WORKLOAD_PALETTE[i % WORKLOAD_PALETTE.length],
      }));

    if (othersCount > 0) {
      slices.push({
        name: 'Others',
        value: othersCount,
        color: '#94A3B8',
      });
    }
    return slices;
  }, [workload]);

  // Availability Breakdown Pie Data
  const availabilityPieData = useMemo(() => {
    if (!employees || employees.length === 0) return [];
    const counts: Record<string, number> = {
      'AVAILABLE': 0,
      'BUSY': 0,
      'HEAVY': 0,
      'OVERLOADED': 0,
      'ON_LEAVE': 0,
    };
    employees.forEach(e => {
      const st = (e.status || 'AVAILABLE').toUpperCase();
      if (counts[st] !== undefined) counts[st]++;
      else if (st === 'AWAY') counts['ON_LEAVE']++;
      else counts['AVAILABLE']++;
    });
    return Object.entries(counts)
      .filter(([_, value]) => value > 0)
      .map(([name, value]) => ({
        name: name.replace('_', ' '),
        value,
        color: AVAILABILITY_CHART_COLORS[name] || '#6B7A99',
      }));
  }, [employees]);

  const toggleExpand = (id: number) => {
    setExpandedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
        if (!expandedTabs[id]) {
          setExpandedTabs(t => ({ ...t, [id]: 'overview' }));
        }
      }
      return next;
    });
  };

  const handleOpenCreate = () => {
    setSelectedProject(null);
    setIsModalOpen(true);
  };

  useEffect(() => {
    const handleOpen = () => {
      handleOpenCreate();
    };
    window.addEventListener('open-new-project-modal', handleOpen);

    const searchParams = new URLSearchParams(window.location.search);
    if (searchParams.get('new') === '1') {
      handleOpenCreate();
      window.history.replaceState({}, '', window.location.pathname);
    }

    return () => {
      window.removeEventListener('open-new-project-modal', handleOpen);
    };
  }, []);

  const handleOpenEdit = (project: Project, e: React.MouseEvent) => {
    e.stopPropagation();
    setSelectedProject(project);
    setIsModalOpen(true);
  };

  const handleDeleteProject = async (project: Project, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!window.confirm(`Are you sure you want to permanently delete project "${project.name || project.title}"?`)) {
      return;
    }
    try {
      await api.deleteProject(project.id);
      toast.success(`Project "${project.name || project.title}" deleted.`);
      queryClient.invalidateQueries({ queryKey: ['projects'] });
    } catch (err: any) {
      toast.error(err.message || 'Failed to delete project');
    }
  };

  const handleRefresh = () => {
    queryClient.invalidateQueries({ queryKey: ['projects'] });
    queryClient.invalidateQueries({ queryKey: ['employees'] });
    queryClient.invalidateQueries({ queryKey: ['diary'] });
  };

  const handleReset = () => {
    setSearch('');
    setStatusFilter('');
    setMemberFilter('');
    setSortBy('created_at');
    setSortAsc(false);
  };

  const handleFileUpload = async (projectId: number, file: File, fileType: string) => {
    try {
      await api.uploadDocument(projectId, file, fileType);
      toast.success(`Uploaded ${file.name} successfully`);
      queryClient.invalidateQueries({ queryKey: ['projects'] });
    } catch (err: any) {
      toast.error(err.message || 'Failed to upload document');
    }
  };

  const displayedProjects = useMemo(() => {
    let list = projects;
    if (memberFilter) {
      const mid = Number(memberFilter);
      list = list.filter(item => {
        if (item.project_manager && item.project_manager.id === mid) return true;
        if (Array.isArray(item.team) && item.team.some((tm: any) => (tm.employee_id || tm.user_id || tm.id) === mid)) return true;
        return false;
      });
    }
    if (sortBy) {
      list = [...list].sort((a: any, b: any) => {
        const va = a[sortBy] || a.name || a.title || '';
        const vb = b[sortBy] || b.name || b.title || '';
        return sortAsc ? (va > vb ? 1 : -1) : (va < vb ? 1 : -1);
      });
    }
    return list;
  }, [projects, memberFilter, sortBy, sortAsc]);

  // Partition displayed projects:
  // 1st Option: Projects Where User is Point of Contact (POC)
  // 2nd Option: Projects Where User is an Assigned Squad / Team Member
  // 3rd Option: Other Company Projects
  const { pocProjects, memberProjects, otherProjects } = useMemo(() => {
    const currentUserId = user?.id;
    if (!currentUserId) {
      return { pocProjects: [], memberProjects: [], otherProjects: displayedProjects };
    }

    const pocList: Project[] = [];
    const memberList: Project[] = [];
    const otherList: Project[] = [];

    displayedProjects.forEach(p => {
      if (p.poc?.id === currentUserId) {
        pocList.push(p);
      } else {
        const team = p.team || [];
        const isMember = team.some((m: any) => (m.user_id || m.employee_id || m.id) === currentUserId) ||
          (p.project_manager?.id === currentUserId);
        if (isMember) {
          memberList.push(p);
        } else {
          otherList.push(p);
        }
      }
    });

    return { pocProjects: pocList, memberProjects: memberList, otherProjects: otherList };
  }, [displayedProjects, user?.id]);

  const formatLastUpdate = (p: Project) => {
    if (!p.last_diary_date) {
      return (
        <span className={p.diary_overdue ? "text-rose-600 dark:text-rose-400 font-bold flex items-center gap-1 text-[11px]" : "text-slate-400 text-[11px]"}>
          {p.diary_overdue && <AlertTriangle className="w-3 h-3" />}
          No updates yet
        </span>
      );
    }
    try {
      const today = new Date();
      const last = new Date(p.last_diary_date);
      const diffTime = today.getTime() - last.getTime();
      const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));
      const text = diffDays <= 0 ? 'Today' : diffDays === 1 ? '1 day ago' : `${diffDays} days ago`;

      return (
        <span className={p.diary_overdue ? "text-rose-600 dark:text-rose-400 font-bold flex items-center gap-1 text-[11px]" : "text-slate-500 dark:text-slate-400 text-[11px]"}>
          {p.diary_overdue && <AlertTriangle className="w-3 h-3" />}
          Last update: {text}
        </span>
      );
    } catch {
      return <span className="text-slate-400 text-[11px]">Last update: {p.last_diary_date}</span>;
    }
  };

  const getStatusBadgeClass = (status: string) => {
    const s = (status || '').toLowerCase();
    if (s.includes('progress')) return 'bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-950/40 dark:text-blue-300 dark:border-blue-800';
    if (s.includes('completed')) return 'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-300 dark:border-emerald-800';
    if (s.includes('cancel')) return 'bg-slate-100 text-slate-600 border-slate-200 dark:bg-slate-800 dark:text-slate-400 dark:border-slate-700';
    if (s.includes('hold')) return 'bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950/40 dark:text-amber-300 dark:border-amber-800';
    return 'bg-purple-50 text-purple-700 border-purple-200 dark:bg-purple-950/40 dark:text-purple-300 dark:border-purple-800';
  };

  const renderProjectRow = (p: Project, isPocProject: boolean) => {
    const isExpanded = expandedIds.has(p.id);
    const activeDrawerTab = expandedTabs[p.id] || 'overview';
    const teamMembers = p.team || [];
    const isUserMember = teamMembers.some((m: any) => (m.user_id || m.employee_id || m.id) === user?.id);

    return (
      <React.Fragment key={p.id}>
        {/* Project Master Row */}
        <tr
          onClick={() => toggleExpand(p.id)}
          className={`transition cursor-pointer select-none ${isExpanded
              ? 'bg-blue-50/50 dark:bg-blue-950/20'
              : isPocProject
                ? 'bg-amber-50/30 dark:bg-amber-950/15 hover:bg-amber-50/60 dark:hover:bg-amber-950/25'
                : isUserMember
                  ? 'bg-blue-50/25 dark:bg-blue-950/15 hover:bg-blue-50/50 dark:hover:bg-blue-950/25'
                  : 'hover:bg-slate-50/80 dark:hover:bg-slate-800/40'
            }`}
        >
          {/* 1. Project Name, Code, POC badge, and Last update */}
          <td className="py-4 pl-6 pr-4">
            <div className="flex items-start gap-2.5">
              <ChevronRight
                className={`w-4 h-4 text-brand-royal shrink-0 mt-0.5 transition-transform duration-200 ${isExpanded ? 'rotate-90' : ''
                  }`}
              />
              <div className="space-y-1">
                <div className="font-bold text-slate-900 dark:text-slate-100 text-sm flex flex-wrap items-center gap-2">
                  <span>{p.name || p.title}</span>
                  {isPocProject ? (
                    <span className="px-2 py-0.5 rounded text-[10px] font-black bg-amber-500 text-white shadow-2xs flex items-center gap-1">
                      <span>★</span>
                      <span>You are POC</span>
                    </span>
                  ) : (
                    <>
                      {isUserMember && (
                        <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-blue-100 text-blue-800 border border-blue-200 dark:bg-blue-950/60 dark:text-blue-300 dark:border-blue-800 flex items-center gap-1">
                          <span>👥</span>
                          <span>In Project Squad</span>
                        </span>
                      )}
                      {p.poc && (
                        <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-amber-50 text-amber-800 border border-amber-200 dark:bg-amber-950/40 dark:text-amber-300 dark:border-amber-800">
                          POC: {p.poc.name}
                        </span>
                      )}
                    </>
                  )}
                </div>
                <div className="flex flex-wrap items-center gap-3">
                  <span className="text-[10px] text-slate-400 font-mono">
                    {p.project_code || `PRJ-${p.id}`}
                  </span>
                  {formatLastUpdate(p)}
                </div>
              </div>
            </div>
          </td>

          {/* 2. Squad Team Bubbles */}
          <td className="py-4 px-4">
            <div className="flex items-center -space-x-1.5">
              {teamMembers.slice(0, 4).map((m: any, idx: number) => (
                <div
                  key={idx}
                  title={`${m.name} (${m.project_role || m.role_on_project})`}
                  className="w-7 h-7 rounded-full text-white text-[10px] font-bold flex items-center justify-center ring-2 ring-white dark:ring-slate-900 shadow-sm"
                  style={{
                    backgroundColor: ['#0B1F5C', '#1565C0', '#1E7BE0', '#0284C7'][idx % 4],
                  }}
                >
                  {m.avatar_initials || (m.name ? m.name.slice(0, 2).toUpperCase() : 'EM')}
                </div>
              ))}
              {teamMembers.length > 4 && (
                <div className="w-7 h-7 rounded-full bg-slate-700 text-white text-[10px] font-bold flex items-center justify-center ring-2 ring-white dark:ring-slate-900 shadow-sm">
                  +{teamMembers.length - 4}
                </div>
              )}
              {teamMembers.length === 0 && (
                <span className="text-xs text-slate-400 italic">Unassigned</span>
              )}
            </div>
          </td>

          {/* 3. Timeline */}
          <td className="py-4 px-4 text-xs text-slate-600 dark:text-slate-300 whitespace-nowrap">
            <div className="flex items-center gap-2">
              <span className="w-6 h-6 rounded-md bg-blue-600 text-white flex items-center justify-center shrink-0 shadow-2xs">
                <Calendar className="w-3.5 h-3.5 text-white" />
              </span>
              <div>
                <div className="font-semibold text-slate-800 dark:text-slate-200">{p.start_date_formatted || p.start_date}</div>
                <div className="text-[11px] text-slate-400">to {p.end_date_formatted || p.end_date}</div>
              </div>
            </div>
          </td>

          {/* 4. Status / Progress Option */}
          <td className="py-4 px-4 text-center whitespace-nowrap">
            {(() => {
              const isCompleted = p.status === 'Completed' || (p.progress ?? 0) >= 100;
              const isProgress = p.status === 'In Progress' || (!isCompleted && p.status !== 'Cancelled' && p.status !== 'On Hold' && p.status !== 'Planning');
              const { overallProg } = getProjectBarData(p);

              if (isCompleted) {
                return (
                  <span
                    className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-emerald-50 text-emerald-700 border border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-300 dark:border-emerald-800 select-none shadow-2xs"
                    title="Project Completed"
                  >
                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
                    <span>Completed</span>
                  </span>
                );
              }

              if (isProgress) {
                return (
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      handleOpenProjectBarGraph(p);
                    }}
                    className="group inline-flex flex-col items-center gap-1 min-w-[130px] max-w-[160px] p-1.5 rounded-xl border border-blue-200 dark:border-blue-900/60 bg-blue-50/50 dark:bg-blue-950/20 hover:bg-blue-100/70 dark:hover:bg-blue-900/40 hover:border-blue-400 dark:hover:border-blue-600 transition cursor-pointer shadow-2xs text-left"
                    title="Click to display module completion bar chart"
                  >
                    <div className="flex items-center justify-between w-full text-[11px] font-bold">
                      <span className="flex items-center gap-1 text-brand-royal dark:text-blue-400 group-hover:underline">
                        <BarChart3 className="w-3.5 h-3.5 text-brand-royal group-hover:scale-110 transition-transform" />
                        <span>In Progress</span>
                      </span>
                      <span className="font-mono text-blue-700 dark:text-blue-300 font-black">
                        {overallProg}%
                      </span>
                    </div>
                    <div className="w-full bg-slate-200/80 dark:bg-slate-700/60 rounded-full h-2 overflow-hidden">
                      <div
                        className="bg-gradient-to-r from-blue-500 via-brand-royal to-blue-700 h-full rounded-full transition-all duration-300 group-hover:brightness-110"
                        style={{ width: `${Math.max(5, overallProg)}%` }}
                      />
                    </div>
                  </button>
                );
              }

              return (
                <span
                  className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-bold border select-none ${getStatusBadgeClass(
                    p.status
                  )}`}
                >
                  <span className="w-1.5 h-1.5 rounded-full mr-1.5 bg-current" />
                  <span>{p.status}</span>
                </span>
              );
            })()}
          </td>

          {/* 5. Actions */}
          <td className="py-4 pl-4 pr-6 text-right whitespace-nowrap">
            <div className="inline-flex items-center gap-2">
              {isAdminOrManager && (
                <>
                  <button
                    type="button"
                    onClick={e => handleOpenEdit(p, e)}
                    className="p-1.5 rounded-lg text-slate-400 hover:text-brand-royal hover:bg-slate-100 dark:hover:bg-slate-800 transition"
                    title="Edit Project"
                  >
                    <Edit2 className="w-3.5 h-3.5" />
                  </button>
                  <button
                    type="button"
                    onClick={e => handleDeleteProject(p, e)}
                    className="p-1.5 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/40 transition"
                    title="Delete Project"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </>
              )}
            </div>
          </td>
        </tr>

        {/* Expandable Project Drawer */}
        {isExpanded && (
          <tr className="bg-slate-50/50 dark:bg-slate-800/20">
            <td colSpan={5} className="p-0 border-b border-slate-200 dark:border-slate-800">
              <div className="p-4 sm:p-6 bg-slate-50/40 dark:bg-slate-800/30 space-y-4 max-h-[480px] overflow-y-auto custom-scrollbar overscroll-contain">
                {/* Drawer Tab Navigation */}
                <div className="flex flex-wrap items-center gap-2 border-b border-slate-200 dark:border-slate-700/80 pb-3">
                  <button
                    type="button"
                    onClick={() => setExpandedTabs(t => ({ ...t, [p.id]: 'overview' }))}
                    className={`px-3 py-1.5 rounded-lg text-xs font-bold transition ${activeDrawerTab === 'overview'
                        ? 'bg-white dark:bg-slate-800 text-brand-royal shadow-sm border border-slate-200 dark:border-slate-700'
                        : 'text-slate-500 hover:text-slate-900 dark:hover:text-slate-200'
                      }`}
                  >
                    Overview
                  </button>
                  <button
                    type="button"
                    onClick={() => setExpandedTabs(t => ({ ...t, [p.id]: 'team' }))}
                    className={`px-3 py-1.5 rounded-lg text-xs font-bold transition flex items-center gap-1.5 ${activeDrawerTab === 'team'
                        ? 'bg-white dark:bg-slate-800 text-brand-royal shadow-sm border border-slate-200 dark:border-slate-700'
                        : 'text-slate-500 hover:text-slate-900 dark:hover:text-slate-200'
                      }`}
                  >
                    <Users className="w-3.5 h-3.5" />
                    <span>Squad Members ({teamMembers.length})</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setExpandedTabs(t => ({ ...t, [p.id]: 'documents' }))}
                    className={`px-3 py-1.5 rounded-lg text-xs font-bold transition flex items-center gap-1.5 ${activeDrawerTab === 'documents'
                        ? 'bg-white dark:bg-slate-800 text-brand-royal shadow-sm border border-slate-200 dark:border-slate-700'
                        : 'text-slate-500 hover:text-slate-900 dark:hover:text-slate-200'
                      }`}
                  >
                    <FileText className="w-3.5 h-3.5" />
                    <span>Documents ({p.files?.length || p.documents?.length || 0})</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setExpandedTabs(t => ({ ...t, [p.id]: 'diary' }))}
                    className={`px-3 py-1.5 rounded-lg text-xs font-bold transition flex items-center gap-1.5 ${activeDrawerTab === 'diary'
                        ? 'bg-brand-royal text-white shadow-sm'
                        : 'text-brand-royal hover:bg-blue-50 dark:hover:bg-blue-950/40'
                      }`}
                  >
                    <BookOpen className="w-3.5 h-3.5" />
                    <span>Work Diary</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setExpandedTabs(t => ({ ...t, [p.id]: 'bargraph' }))}
                    className={`px-3 py-1.5 rounded-lg text-xs font-bold transition flex items-center gap-1.5 ${activeDrawerTab === 'bargraph'
                        ? 'bg-white dark:bg-slate-800 text-brand-royal shadow-sm border border-slate-200 dark:border-slate-700'
                        : 'text-slate-500 hover:text-slate-900 dark:hover:text-slate-200'
                      }`}
                  >
                    <BarChart3 className="w-3.5 h-3.5 text-blue-500" />
                    <span>Bar Graph</span>
                  </button>
                </div>

                {/* Tab: Overview */}
                {activeDrawerTab === 'overview' && (
                  <div className="space-y-3 text-xs">
                    <div>
                      <span className="font-bold text-slate-700 dark:text-slate-300 block mb-1">
                        Project Scope &amp; Description
                      </span>
                      <p className="text-slate-600 dark:text-slate-400 leading-relaxed whitespace-pre-wrap">
                        {p.description || 'No description provided.'}
                      </p>
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-2">
                      <div className="p-3 bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700/60">
                        <span className="text-[10px] text-slate-400 uppercase font-bold block">
                          Project Manager
                        </span>
                        <span className="font-semibold text-slate-900 dark:text-slate-100 mt-0.5 block">
                          {p.project_manager?.name || p.creator_name || 'Unassigned'}
                        </span>
                      </div>
                      <div className="p-3 bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700/60">
                        <span className="text-[10px] text-slate-400 uppercase font-bold block">
                          Point of Contact (POC)
                        </span>
                        <span className="font-semibold text-slate-900 dark:text-slate-100 mt-0.5 block">
                          {p.poc ? `${p.poc.name} (${p.poc.email || ''})` : 'Unassigned'}
                        </span>
                      </div>
                      <div className="p-3 bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700/60">
                        <span className="text-[10px] text-slate-400 uppercase font-bold block">
                          Category &amp; Sector
                        </span>
                        <span className="font-semibold text-slate-900 dark:text-slate-100 mt-0.5 block">
                          {p.category || 'Software Solutions'}
                        </span>
                      </div>
                    </div>
                  </div>
                )}

                {/* Tab: Squad Members */}
                {activeDrawerTab === 'team' && (
                  <div className="space-y-3">
                    <div className="flex items-center justify-between text-xs">
                      <span className="font-bold text-slate-700 dark:text-slate-300">
                        Assigned Engineers &amp; Roles ({teamMembers.length})
                      </span>
                    </div>
                    {teamMembers.length === 0 ? (
                      <div className="p-4 text-center text-xs text-slate-400 italic bg-white dark:bg-slate-800/40 rounded-xl border border-slate-200 dark:border-slate-700">
                        No team members currently assigned.
                      </div>
                    ) : (
                      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2.5">
                        {teamMembers.map((m: any, idx: number) => (
                          <div
                            key={idx}
                            className="p-2.5 rounded-xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 flex items-center justify-between text-xs"
                          >
                            <div className="flex items-center gap-2">
                              <div
                                className="w-7 h-7 rounded-full text-white text-[10px] font-bold flex items-center justify-center shrink-0"
                                style={{
                                  backgroundColor: ['#0B1F5C', '#1565C0', '#1E7BE0', '#0284C7'][idx % 4],
                                }}
                              >
                                {m.avatar_initials || (m.name ? m.name.slice(0, 2).toUpperCase() : 'EM')}
                              </div>
                              <div className="truncate">
                                <span className="font-semibold text-slate-900 dark:text-slate-100 block truncate">
                                  {m.name}
                                </span>
                                <span className="text-[10px] text-slate-400 truncate block">
                                  {m.project_role || m.role_on_project || 'Contributor'}
                                </span>
                              </div>
                            </div>
                            {p.poc && (p.poc.id === m.user_id || p.poc.id === m.employee_id) && (
                              <span className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-amber-50 text-amber-700 border border-amber-200 shrink-0">
                                POC
                              </span>
                            )}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}

                {/* Tab: Documents & Files */}
                {activeDrawerTab === 'documents' && (
                  <div className="space-y-3">
                    {isAdminOrManager && (
                      <div className="flex items-center gap-2 p-3 bg-white dark:bg-slate-800 rounded-xl border border-dashed border-slate-300 dark:border-slate-700">
                        <input
                          type="file"
                          id={`upload-file-${p.id}`}
                          className="text-xs text-slate-500 file:mr-2 file:py-1 file:px-2.5 file:rounded-lg file:border-0 file:text-xs file:font-semibold file:bg-brand-royal file:text-white"
                          onChange={e => {
                            if (e.target.files && e.target.files[0]) {
                              handleFileUpload(p.id, e.target.files[0], 'documentation');
                            }
                          }}
                        />
                      </div>
                    )}
                    <div className="space-y-2">
                      {(p.files || p.documents || []).map((f: any) => (
                        <div
                          key={f.id}
                          className="p-2.5 rounded-xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 flex items-center justify-between text-xs"
                        >
                          <div className="flex items-center gap-2 truncate">
                            <FileText className="w-4 h-4 text-brand-royal" />
                            <span className="font-medium text-slate-900 dark:text-slate-100 truncate">
                              {f.original_filename || f.title || f.stored_filename}
                            </span>
                          </div>
                          <button
                            type="button"
                            onClick={() => api.downloadDocument(f.id, f.original_filename || 'download')}
                            className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-semibold text-brand-royal hover:bg-blue-50 transition"
                          >
                            <Download className="w-3.5 h-3.5" />
                            <span>Download</span>
                          </button>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Tab: Work Diary Timeline */}
                {activeDrawerTab === 'diary' && (
                  <ProjectDiaryTab
                    projectId={p.id}
                    pocId={p.poc?.id}
                    projectManagerId={p.project_manager?.id}
                    isMember={isUserMember}
                  />
                )}

                {/* Tab: Bar Graph Module Completion */}
                {activeDrawerTab === 'bargraph' && (() => {
                  const { barData, overallProg } = getProjectBarData(p);

                  return (
                    <div className="space-y-4">
                      <div className="bg-white dark:bg-slate-900 rounded-xl p-4 border border-slate-200 dark:border-slate-800 shadow-xs">
                        <div className="flex flex-wrap items-center justify-between gap-2 mb-4 pb-3 border-b border-slate-100 dark:border-slate-800">
                          <div className="flex items-center gap-2">
                            <div className="w-8 h-8 rounded-lg bg-blue-50 dark:bg-blue-950/40 text-brand-royal flex items-center justify-center">
                              <BarChart3 className="w-4 h-4" />
                            </div>
                            <div>
                              <h4 className="text-xs font-bold text-slate-900 dark:text-white">
                                {p.name || p.title} &mdash; Module Completion Progress
                              </h4>
                              <p className="text-[10px] text-slate-500 dark:text-slate-400">
                                Live breakdown of frontend, backend, and database milestone completion
                              </p>
                            </div>
                          </div>

                          <div className="flex items-center gap-2">
                            <span className="text-[11px] font-semibold text-slate-500">
                              Status:
                            </span>
                            <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-blue-50 text-blue-700 border border-blue-200 dark:bg-blue-950/40 dark:text-blue-300 dark:border-blue-800">
                              {overallProg}% Overall Completed
                            </span>
                          </div>
                        </div>

                        {/* Bar Chart */}
                        <div className="h-64 w-full">
                          <ResponsiveContainer width="100%" height="100%">
                            <BarChart
                              data={barData}
                              margin={{ top: 20, right: 30, left: 10, bottom: 5 }}
                            >
                              <CartesianGrid strokeDasharray="3 3" opacity={0.15} vertical={false} />
                              <XAxis
                                dataKey="module"
                                tick={{ fill: '#94A3B8', fontSize: 11, fontWeight: 700 }}
                                axisLine={{ stroke: '#E2E8F0' }}
                                tickLine={false}
                              />
                              <YAxis
                                domain={[0, 100]}
                                tickFormatter={(val) => `${val}%`}
                                tick={{ fill: '#94A3B8', fontSize: 10 }}
                                axisLine={false}
                                tickLine={false}
                              />
                              <Tooltip
                                cursor={{ fill: 'rgba(241, 245, 249, 0.6)' }}
                                formatter={(val: any) => [`${val}% Completed`, 'Completion Rate']}
                                contentStyle={WHITE_TOOLTIP_STYLE}
                                itemStyle={WHITE_TOOLTIP_ITEM_STYLE}
                                labelStyle={WHITE_TOOLTIP_LABEL_STYLE}
                                wrapperStyle={TOOLTIP_WRAPPER_STYLE}
                                allowEscapeViewBox={{ x: true, y: true }}
                                isAnimationActive={false}
                              />
                              <Bar
                                dataKey="progress"
                                radius={[6, 6, 0, 0]}
                                maxBarSize={48}
                                isAnimationActive={true}
                                animationBegin={0}
                                animationDuration={3000}
                                animationEasing="ease-out"
                              >
                                {barData.map((entry, index) => (
                                  <Cell key={`bar-cell-${index}`} fill={entry.fill} />
                                ))}
                              </Bar>
                            </BarChart>
                          </ResponsiveContainer>
                        </div>

                        {/* Cards Breakdown Below the Bar Graph */}
                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mt-4 pt-3 border-t border-slate-100 dark:border-slate-800">
                          {barData.map((item) => {
                            const Icon = item.icon;
                            return (
                              <div
                                key={item.module}
                                className={`p-3 rounded-xl border ${item.lightBg} ${item.border} flex flex-col justify-between`}
                              >
                                <div className="flex items-center justify-between mb-1.5">
                                  <span className="flex items-center gap-1.5 text-xs font-bold text-slate-800 dark:text-slate-200">
                                    <Icon className="w-3.5 h-3.5" style={{ color: item.fill }} />
                                    <span>{item.module}</span>
                                  </span>
                                  <span className={`text-xs font-black ${item.text}`}>
                                    {item.progress}%
                                  </span>
                                </div>
                                <div className="w-full h-2 bg-slate-200/80 dark:bg-slate-700/60 rounded-full overflow-hidden">
                                  <div
                                    className="h-full rounded-full transition-all duration-500"
                                    style={{
                                      width: `${item.progress}%`,
                                      backgroundColor: item.fill,
                                    }}
                                  />
                                </div>
                              </div>
                            );
                          })}
                        </div>

                        {/* POC Module Progress Updater & Report Generator */}
                        <ProjectProgressUpdater
                          project={p}
                          canUpdate={(p.poc?.id === user?.id) || Boolean(isAdminOrManager)}
                          onSuccess={() => {
                            queryClient.invalidateQueries({ queryKey: ['projects'] });
                          }}
                        />
                      </div>
                    </div>
                  );
                })()}
              </div>
            </td>
          </tr>
        )}
      </React.Fragment>
    );
  };

  return (
    <div className="p-6 space-y-6 max-w-7xl mx-auto">
      {/* Action Required: Daily Updates Due Banner (Above the Graph) */}
      {isAdminOrManager && dueReport && dueReport.total_missing > 0 && (
        <div
          onClick={() => navigate('/diary')}
          className="bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-900/60 rounded-2xl p-4 shadow-sm flex items-center justify-between cursor-pointer hover:bg-amber-100/60 dark:hover:bg-amber-950/40 transition"
        >
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-amber-500/10 dark:bg-amber-500/20 text-amber-700 dark:text-amber-400 flex items-center justify-center shrink-0">
              <ShieldAlert className="w-5 h-5" />
            </div>
            <div>
              <div className="text-xs font-bold text-amber-900 dark:text-amber-200">
                Action Required: {dueReport.total_missing} Daily Updates Missing Today
              </div>
              <p className="text-[11px] text-amber-700 dark:text-amber-300">
                Staff across {dueReport.projects.length} active projects haven't posted work updates. Click to view roster.
              </p>
            </div>
          </div>
          <span className="text-xs font-bold text-amber-800 dark:text-amber-300 underline shrink-0">
            View Updates Due &rarr;
          </span>
        </div>
      )}

      {/* Top Section Header & Chart View Switcher (Pie Chart / Bar Graph) */}
      <div className="flex flex-wrap items-center justify-between gap-3 pt-1">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-xl bg-blue-50 dark:bg-blue-950/40 text-brand-royal flex items-center justify-center font-bold">
            {chartViewMode === 'bar' ? (
              <BarChart3 className="w-4 h-4 text-blue-600 dark:text-blue-400" />
            ) : (
              <PieIcon className="w-4 h-4 text-brand-royal" />
            )}
          </div>
          <div>
            <h3 className="text-sm font-bold text-slate-900 dark:text-white">
              Executive Analytics &amp; Operations Distribution
            </h3>
            <p className="text-[11px] text-slate-500 dark:text-slate-400">
              Interactive project status, engineer allocations, and availability roster
            </p>
          </div>
        </div>

        {/* View Switcher */}
        <div className="flex items-center gap-3">
          <div className="flex items-center bg-white dark:bg-slate-900 p-1 rounded-xl border border-slate-200 dark:border-slate-800 shadow-xs">
            <button
              type="button"
              onClick={() => setChartViewMode('pie')}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition flex items-center gap-1.5 cursor-pointer ${
                chartViewMode === 'pie'
                  ? 'bg-brand-royal text-white shadow-xs'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-50 dark:hover:bg-slate-800'
              }`}
              title="Display charts as Pie Charts"
            >
              <PieIcon className="w-3.5 h-3.5" />
              <span>Pie Charts</span>
            </button>

            <button
              type="button"
              onClick={() => setChartViewMode('bar')}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition flex items-center gap-1.5 cursor-pointer ${
                chartViewMode === 'bar'
                  ? 'bg-brand-royal text-white shadow-xs'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-50 dark:hover:bg-slate-800'
              }`}
              title="Display charts as Bar Graphs"
            >
              <BarChart3 className="w-3.5 h-3.5" />
              <span>Bar Graphs</span>
            </button>
          </div>
        </div>
      </div>

      {/* Top Section: Executive Analytics Charts (Bigger Size & Dynamic Bar/Pie View) */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-5 relative z-10">
        {/* Chart 1: Project Status Distribution */}
        <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-5 shadow-xs flex flex-col justify-between relative z-10 overflow-visible">
          <div className="flex items-center justify-between h-7 mb-2 shrink-0">
            <span className="text-xs font-bold text-slate-800 dark:text-slate-200 flex items-center gap-1.5 truncate">
              {chartViewMode === 'bar' ? (
                <BarChart3 className="w-4 h-4 text-brand-royal shrink-0" />
              ) : (
                <PieIcon className="w-4 h-4 text-brand-royal shrink-0" />
              )}
              <span className="truncate">Project Status Distribution</span>
            </span>
            <div className="h-6 flex items-center justify-end shrink-0">
              {hoveredStatus ? (
                <span className="text-[11px] font-bold px-2.5 py-0.5 rounded-full bg-blue-50 text-blue-700 dark:bg-blue-950/60 dark:text-blue-300 border border-blue-200 dark:border-blue-800 shadow-2xs leading-none whitespace-nowrap">
                  {hoveredStatus.name}: {hoveredStatus.value} projects
                </span>
              ) : (
                <span className="text-[11px] font-mono font-bold text-slate-500 leading-none whitespace-nowrap px-1">
                  Total: {allProjects.length}
                </span>
              )}
            </div>
          </div>

          <div className="h-64 relative my-1 overflow-visible">
            {!isChartReady && isProjectsLoading ? (
              <div className="w-full h-full flex items-center justify-center">
                <div className="w-8 h-8 rounded-full border-2 border-brand-royal/20 border-t-brand-royal animate-spin" />
              </div>
            ) : statusPieData.length === 0 ? (
              <div className="w-full h-full flex flex-col items-center justify-center text-center p-4">
                <div className="w-14 h-14 rounded-full border-2 border-dashed border-slate-200 dark:border-slate-700 flex items-center justify-center text-slate-300 dark:text-slate-600 mb-2">
                  <PieIcon className="w-6 h-6" />
                </div>
                <span className="text-xs font-bold text-slate-700 dark:text-slate-300">0 Projects</span>
                <span className="text-[11px] text-slate-400 mt-0.5">No projects in the system yet</span>
              </div>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                {chartViewMode === 'bar' ? (
                  <BarChart
                    key={`barchart-status-${chartViewMode}`}
                    data={statusPieData}
                    margin={{ top: 15, right: 10, left: -20, bottom: 25 }}
                  >
                    <CartesianGrid strokeDasharray="3 3" opacity={0.15} vertical={false} />
                    <XAxis
                      dataKey="name"
                      tick={{ fill: '#94A3B8', fontSize: 10, fontWeight: 600 }}
                      angle={-20}
                      textAnchor="end"
                      height={40}
                      interval={0}
                    />
                    <YAxis allowDecimals={false} tick={{ fill: '#94A3B8', fontSize: 10 }} />
                    <Tooltip
                      cursor={{ fill: 'rgba(241, 245, 249, 0.6)' }}
                      formatter={(val: any, name: any) => [`${val} projects`, name]}
                      contentStyle={WHITE_TOOLTIP_STYLE}
                      itemStyle={WHITE_TOOLTIP_ITEM_STYLE}
                      labelStyle={WHITE_TOOLTIP_LABEL_STYLE}
                      wrapperStyle={TOOLTIP_WRAPPER_STYLE}
                      allowEscapeViewBox={{ x: true, y: true }}
                      isAnimationActive={false}
                    />
                    <Bar
                      dataKey="value"
                      radius={[6, 6, 0, 0]}
                      maxBarSize={36}
                      isAnimationActive={true}
                      animationBegin={0}
                      animationDuration={3000}
                      animationEasing="ease-out"
                      onMouseEnter={(entry: any) => setHoveredStatus({ name: entry.name, value: entry.value })}
                      onMouseLeave={() => setHoveredStatus(null)}
                    >
                      {statusPieData.map((entry, idx) => (
                        <Cell key={idx} fill={entry.color} />
                      ))}
                    </Bar>
                  </BarChart>
                ) : (
                  <RechartsPieChart key={`piechart-status-${chartViewMode}`}>
                    <Pie
                      data={statusPieData}
                      cx="50%"
                      cy="50%"
                      innerRadius={50}
                      outerRadius={75}
                      paddingAngle={3}
                      dataKey="value"
                      isAnimationActive={true}
                      animationBegin={0}
                      animationDuration={3000}
                      animationEasing="ease-out"
                      onMouseEnter={(entry: any) => setHoveredStatus({ name: entry.name, value: entry.value })}
                      onMouseLeave={() => setHoveredStatus(null)}
                    >
                      {statusPieData.map((entry, idx) => (
                        <Cell key={idx} fill={entry.color} />
                      ))}
                    </Pie>
                    <Tooltip
                      formatter={(val: any, name: any) => [`${val} projects`, name]}
                      contentStyle={WHITE_TOOLTIP_STYLE}
                      itemStyle={WHITE_TOOLTIP_ITEM_STYLE}
                      labelStyle={WHITE_TOOLTIP_LABEL_STYLE}
                      wrapperStyle={TOOLTIP_WRAPPER_STYLE}
                      allowEscapeViewBox={{ x: true, y: true }}
                      isAnimationActive={false}
                    />
                  </RechartsPieChart>
                )}
              </ResponsiveContainer>
            )}
            {chartViewMode === 'pie' && isChartReady && statusPieData.length > 0 && (
              <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none z-0">
                <span className="text-xl font-black text-slate-900 dark:text-slate-100">{summary?.total ?? allProjects.length}</span>
                <span className="text-[10px] uppercase font-bold text-slate-400">Projects</span>
              </div>
            )}
          </div>

          <div className="flex flex-wrap items-center justify-center gap-x-3 gap-y-1 pt-2.5 border-t border-slate-100 dark:border-slate-800 text-[10px]">
            {statusPieData.length === 0 ? (
              <span className="text-slate-400 italic">No status data</span>
            ) : (
              statusPieData.map((s, idx) => (
                <span key={idx} className="flex items-center gap-1 text-slate-600 dark:text-slate-400">
                  <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: s.color }} />
                  <span>{s.name}: <b>{s.value}</b></span>
                </span>
              ))
            )}
          </div>
        </div>

        {/* Chart 2: Employee Workload Distribution */}
        <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-5 shadow-xs flex flex-col justify-between relative z-10 overflow-visible">
          <div className="flex items-center justify-between h-7 mb-2 shrink-0">
            <span className="text-xs font-bold text-slate-800 dark:text-slate-200 flex items-center gap-1.5 truncate">
              {chartViewMode === 'bar' ? (
                <BarChart3 className="w-4 h-4 text-brand-royal shrink-0" />
              ) : (
                <Users className="w-4 h-4 text-brand-royal shrink-0" />
              )}
              <span className="truncate">Employee Workload Distribution</span>
            </span>
            <div className="h-6 flex items-center justify-end shrink-0">
              {hoveredWorkload ? (
                <span className="text-[11px] font-bold px-2.5 py-0.5 rounded-full bg-indigo-50 text-indigo-700 dark:bg-indigo-950/60 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-800 shadow-2xs leading-none whitespace-nowrap">
                  {hoveredWorkload.name}: {hoveredWorkload.value} active
                </span>
              ) : (
                <span className="text-[11px] font-mono font-bold text-slate-500 leading-none whitespace-nowrap px-1">
                  Active Allocations
                </span>
              )}
            </div>
          </div>

          <div className="h-64 relative my-1 overflow-visible">
            {!isChartReady && isProjectsLoading ? (
              <div className="w-full h-full flex items-center justify-center">
                <div className="w-8 h-8 rounded-full border-2 border-brand-royal/20 border-t-brand-royal animate-spin" />
              </div>
            ) : workloadPieData.length === 0 ? (
              <div className="w-full h-full flex flex-col items-center justify-center text-center p-4">
                <div className="w-14 h-14 rounded-full border-2 border-dashed border-slate-200 dark:border-slate-700 flex items-center justify-center text-slate-300 dark:text-slate-600 mb-2">
                  <PieIcon className="w-6 h-6" />
                </div>
                <span className="text-xs font-bold text-slate-700 dark:text-slate-300">0 Active Allocations</span>
                <span className="text-[11px] text-slate-400 mt-0.5">Assign staff to active projects to view workload</span>
              </div>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                {chartViewMode === 'bar' ? (
                  <BarChart
                    key={`barchart-workload-${chartViewMode}`}
                    data={workloadPieData}
                    margin={{ top: 15, right: 10, left: -20, bottom: 25 }}
                  >
                    <CartesianGrid strokeDasharray="3 3" opacity={0.15} vertical={false} />
                    <XAxis
                      dataKey="name"
                      tick={{ fill: '#94A3B8', fontSize: 10, fontWeight: 600 }}
                      angle={-20}
                      textAnchor="end"
                      height={40}
                      interval={0}
                    />
                    <YAxis allowDecimals={false} tick={{ fill: '#94A3B8', fontSize: 10 }} />
                    <Tooltip
                      cursor={{ fill: 'rgba(241, 245, 249, 0.6)' }}
                      formatter={(val: any, name: any) => [`${val} active projects`, name]}
                      contentStyle={WHITE_TOOLTIP_STYLE}
                      itemStyle={WHITE_TOOLTIP_ITEM_STYLE}
                      labelStyle={WHITE_TOOLTIP_LABEL_STYLE}
                      wrapperStyle={TOOLTIP_WRAPPER_STYLE}
                      allowEscapeViewBox={{ x: true, y: true }}
                      isAnimationActive={false}
                    />
                    <Bar
                      dataKey="value"
                      radius={[6, 6, 0, 0]}
                      maxBarSize={36}
                      isAnimationActive={true}
                      animationBegin={0}
                      animationDuration={3000}
                      animationEasing="ease-out"
                      onMouseEnter={(entry: any) => setHoveredWorkload({ name: entry.name, value: entry.value })}
                      onMouseLeave={() => setHoveredWorkload(null)}
                    >
                      {workloadPieData.map((entry, idx) => (
                        <Cell key={idx} fill={entry.color} />
                      ))}
                    </Bar>
                  </BarChart>
                ) : (
                  <RechartsPieChart key={`piechart-workload-${chartViewMode}`}>
                    <Pie
                      data={workloadPieData}
                      cx="50%"
                      cy="50%"
                      innerRadius={50}
                      outerRadius={75}
                      paddingAngle={3}
                      dataKey="value"
                      isAnimationActive={true}
                      animationBegin={0}
                      animationDuration={3000}
                      animationEasing="ease-out"
                      onMouseEnter={(entry: any) => setHoveredWorkload({ name: entry.name, value: entry.value })}
                      onMouseLeave={() => setHoveredWorkload(null)}
                    >
                      {workloadPieData.map((entry, idx) => (
                        <Cell key={idx} fill={entry.color} />
                      ))}
                    </Pie>
                    <Tooltip
                      formatter={(val: any, name: any) => [`${val} active projects`, name]}
                      contentStyle={WHITE_TOOLTIP_STYLE}
                      itemStyle={WHITE_TOOLTIP_ITEM_STYLE}
                      labelStyle={WHITE_TOOLTIP_LABEL_STYLE}
                      wrapperStyle={TOOLTIP_WRAPPER_STYLE}
                      allowEscapeViewBox={{ x: true, y: true }}
                      isAnimationActive={false}
                    />
                  </RechartsPieChart>
                )}
              </ResponsiveContainer>
            )}
            {chartViewMode === 'pie' && isChartReady && workloadPieData.length > 0 && (
              <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none z-0">
                <span className="text-xl font-black text-slate-900 dark:text-slate-100">
                  {workloadPieData.reduce((acc, curr) => acc + curr.value, 0)}
                </span>
                <span className="text-[10px] uppercase font-bold text-slate-400">Active</span>
              </div>
            )}
          </div>

          <div className="flex flex-wrap items-center justify-center gap-x-2.5 gap-y-1 pt-2.5 border-t border-slate-100 dark:border-slate-800 text-[10px]">
            {workloadPieData.length === 0 ? (
              <span className="text-slate-400 italic">No allocation data</span>
            ) : (
              workloadPieData.slice(0, 5).map((w, idx) => (
                <span key={idx} className="flex items-center gap-1 text-slate-600 dark:text-slate-400 truncate max-w-[120px]" title={w.name}>
                  <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: w.color }} />
                  <span className="truncate">{w.name.split(' ')[0]}: <b>{w.value}</b></span>
                </span>
              ))
            )}
          </div>
        </div>

        {/* Chart 3: Staff Availability Breakdown */}
        <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-5 shadow-xs flex flex-col justify-between relative z-10 overflow-visible">
          <div className="flex items-center justify-between h-7 mb-2 shrink-0">
            <span className="text-xs font-bold text-slate-800 dark:text-slate-200 flex items-center gap-1.5 truncate">
              {chartViewMode === 'bar' ? (
                <BarChart3 className="w-4 h-4 text-brand-royal shrink-0" />
              ) : (
                <PieIcon className="w-4 h-4 text-brand-royal shrink-0" />
              )}
              <span className="truncate">Staff Availability Breakdown</span>
            </span>
            <div className="h-6 flex items-center justify-end shrink-0">
              {hoveredAvailability ? (
                <span className="text-[11px] font-bold px-2.5 py-0.5 rounded-full bg-emerald-50 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800 shadow-2xs leading-none whitespace-nowrap">
                  {hoveredAvailability.name}: {hoveredAvailability.value} staff
                </span>
              ) : (
                <span className="text-[11px] font-mono font-bold text-slate-500 leading-none whitespace-nowrap px-1">
                  {employees.length} Staff
                </span>
              )}
            </div>
          </div>

          <div className="h-64 relative my-1 overflow-visible">
            {!isChartReady && isProjectsLoading ? (
              <div className="w-full h-full flex items-center justify-center">
                <div className="w-8 h-8 rounded-full border-2 border-brand-royal/20 border-t-brand-royal animate-spin" />
              </div>
            ) : availabilityPieData.length === 0 ? (
              <div className="w-full h-full flex flex-col items-center justify-center text-center p-4">
                <div className="w-14 h-14 rounded-full border-2 border-dashed border-slate-200 dark:border-slate-700 flex items-center justify-center text-slate-300 dark:text-slate-600 mb-2">
                  <PieIcon className="w-6 h-6" />
                </div>
                <span className="text-xs font-bold text-slate-700 dark:text-slate-300">0 Staff Registered</span>
                <span className="text-[11px] text-slate-400 mt-0.5">Add team members via Team Management</span>
              </div>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                {chartViewMode === 'bar' ? (
                  <BarChart
                    key={`barchart-avail-${chartViewMode}`}
                    data={availabilityPieData}
                    margin={{ top: 15, right: 10, left: -20, bottom: 25 }}
                  >
                    <CartesianGrid strokeDasharray="3 3" opacity={0.15} vertical={false} />
                    <XAxis
                      dataKey="name"
                      tick={{ fill: '#94A3B8', fontSize: 10, fontWeight: 600 }}
                      angle={-20}
                      textAnchor="end"
                      height={40}
                      interval={0}
                    />
                    <YAxis allowDecimals={false} tick={{ fill: '#94A3B8', fontSize: 10 }} />
                    <Tooltip
                      cursor={{ fill: 'rgba(241, 245, 249, 0.6)' }}
                      formatter={(val: any, name: any) => [`${val} staff`, name]}
                      contentStyle={WHITE_TOOLTIP_STYLE}
                      itemStyle={WHITE_TOOLTIP_ITEM_STYLE}
                      labelStyle={WHITE_TOOLTIP_LABEL_STYLE}
                      wrapperStyle={TOOLTIP_WRAPPER_STYLE}
                      allowEscapeViewBox={{ x: true, y: true }}
                      isAnimationActive={false}
                    />
                    <Bar
                      dataKey="value"
                      radius={[6, 6, 0, 0]}
                      maxBarSize={36}
                      isAnimationActive={true}
                      animationBegin={0}
                      animationDuration={3000}
                      animationEasing="ease-out"
                      onMouseEnter={(entry: any) => setHoveredAvailability({ name: entry.name, value: entry.value })}
                      onMouseLeave={() => setHoveredAvailability(null)}
                    >
                      {availabilityPieData.map((entry, idx) => (
                        <Cell key={idx} fill={entry.color} />
                      ))}
                    </Bar>
                  </BarChart>
                ) : (
                  <RechartsPieChart key={`piechart-avail-${chartViewMode}`}>
                    <Pie
                      data={availabilityPieData}
                      cx="50%"
                      cy="50%"
                      innerRadius={50}
                      outerRadius={75}
                      paddingAngle={3}
                      dataKey="value"
                      isAnimationActive={true}
                      animationBegin={0}
                      animationDuration={3000}
                      animationEasing="ease-out"
                      onMouseEnter={(entry: any) => setHoveredAvailability({ name: entry.name, value: entry.value })}
                      onMouseLeave={() => setHoveredAvailability(null)}
                    >
                      {availabilityPieData.map((entry, idx) => (
                        <Cell key={idx} fill={entry.color} />
                      ))}
                    </Pie>
                    <Tooltip
                      formatter={(val: any, name: any) => [`${val} staff`, name]}
                      contentStyle={WHITE_TOOLTIP_STYLE}
                      itemStyle={WHITE_TOOLTIP_ITEM_STYLE}
                      labelStyle={WHITE_TOOLTIP_LABEL_STYLE}
                      wrapperStyle={TOOLTIP_WRAPPER_STYLE}
                      allowEscapeViewBox={{ x: true, y: true }}
                      isAnimationActive={false}
                    />
                  </RechartsPieChart>
                )}
              </ResponsiveContainer>
            )}
            {chartViewMode === 'pie' && isChartReady && availabilityPieData.length > 0 && (
              <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none z-0">
                <span className="text-xl font-black text-slate-900 dark:text-slate-100">{employees.length}</span>
                <span className="text-[10px] uppercase font-bold text-slate-400">Total</span>
              </div>
            )}
          </div>

          <div className="flex flex-wrap items-center justify-center gap-x-3 gap-y-1 pt-2.5 border-t border-slate-100 dark:border-slate-800 text-[10px]">
            {availabilityPieData.length === 0 ? (
              <span className="text-slate-400 italic">No staff data</span>
            ) : (
              availabilityPieData.map((a, idx) => (
                <span key={idx} className="flex items-center gap-1 text-slate-600 dark:text-slate-400">
                  <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: a.color }} />
                  <span>{a.name}: <b>{a.value}</b></span>
                </span>
              ))
            )}
          </div>
        </div>
      </div>

      {/* Search, Sort & Filters Toolbar (Below the Charts) */}
      <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-3 shadow-sm flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-2.5 flex-1">
          {/* Search box */}
          <div className="relative min-w-[160px] sm:min-w-[200px]">
            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400">
              <Search className="w-3.5 h-3.5" />
            </div>
            <input
              type="text"
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Search projects..."
              className="w-full pl-8 pr-3 py-2 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50/50 dark:bg-slate-800/40 text-slate-900 dark:text-slate-100 placeholder-slate-400 focus:outline-none focus:ring-1 focus:ring-brand-royal"
            />
          </div>

          {/* Sort By Dropdown */}
          <div className="relative flex items-center gap-1.5">
            <span className="text-[11px] font-semibold text-slate-500 dark:text-slate-400">Sort by:</span>
            <div className="relative">
              <select
                value={`${sortBy}-${sortAsc ? 'asc' : 'desc'}`}
                onChange={e => {
                  const parts = e.target.value.split('-');
                  setSortBy(parts[0]);
                  setSortAsc(parts[1] === 'asc');
                }}
                className="py-2 pl-3 pr-8 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300 font-medium focus:outline-none focus:ring-1 focus:ring-brand-royal appearance-none cursor-pointer"
              >
                <option value="created_at-desc">Newest Projects</option>
                <option value="created_at-asc">Oldest Projects</option>
                <option value="name-asc">Name (A - Z)</option>
                <option value="name-desc">Name (Z - A)</option>
                <option value="status-asc">Status</option>
                <option value="start_date-asc">Start Date</option>
                <option value="end_date-asc">End Date</option>
              </select>
              <div className="absolute inset-y-0 right-0 pr-2.5 flex items-center pointer-events-none text-slate-400">
                <ChevronDown className="w-3.5 h-3.5" />
              </div>
            </div>
          </div>

          {/* Status filter */}
          <div className="relative">
            <select
              value={statusFilter}
              onChange={e => setStatusFilter(e.target.value)}
              className="py-2 pl-3 pr-8 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300 font-medium focus:outline-none focus:ring-1 focus:ring-brand-royal appearance-none cursor-pointer"
            >
              <option value="">All Statuses</option>
              <option value="In Progress">In Progress</option>
              <option value="Planning">Planning</option>
              <option value="Completed">Completed</option>
              <option value="Cancelled">Cancelled</option>
              <option value="On Hold">On Hold</option>
              <option value="ending_soon">Ending Soon</option>
              <option value="overdue">Overdue</option>
            </select>
            <div className="absolute inset-y-0 right-0 pr-2.5 flex items-center pointer-events-none text-slate-400">
              <ChevronDown className="w-3.5 h-3.5" />
            </div>
          </div>

          {/* Member filter */}
          <div className="relative">
            <select
              value={memberFilter}
              onChange={e => setMemberFilter(e.target.value)}
              className="py-2 pl-3 pr-8 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300 font-medium focus:outline-none focus:ring-1 focus:ring-brand-royal appearance-none cursor-pointer"
            >
              <option value="">All Assignees</option>
              {employees.map(emp => (
                <option key={emp.id} value={emp.id}>
                  {emp.name}
                </option>
              ))}
            </select>
            <div className="absolute inset-y-0 right-0 pr-2.5 flex items-center pointer-events-none text-slate-400">
              <ChevronDown className="w-3.5 h-3.5" />
            </div>
          </div>

          {/* Reset button */}
          <button
            type="button"
            onClick={handleReset}
            className="px-3 py-2 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700 flex items-center gap-1.5 transition"
          >
            <RotateCw className={`w-3.5 h-3.5 ${isRefetching ? 'animate-spin text-brand-royal' : ''}`} />
            <span>Reset</span>
          </button>
        </div>

        <div className="flex items-center gap-3">
          <div className="text-xs font-bold text-slate-600 dark:text-slate-300 px-2 shrink-0">
            {displayedProjects.length} {displayedProjects.length === 1 ? 'project' : 'projects'}
          </div>
        </div>
      </div>

      {/* Projects Table */}
      <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden flex flex-col">
        {isProjectsLoading ? (
          <div className="p-16 flex items-center justify-center">
            <div className="w-8 h-8 rounded-full border-2 border-brand-royal border-t-transparent animate-spin" />
          </div>
        ) : allProjects.length === 0 ? (
          <div className="py-16 px-4 flex flex-col items-center justify-center text-center">
            <div className="w-16 h-16 rounded-2xl bg-blue-50 dark:bg-blue-950/40 text-brand-royal flex items-center justify-center mb-4">
              <FolderGit2 className="w-8 h-8" />
            </div>
            <h3 className="text-base font-bold text-slate-800 dark:text-slate-100 mb-1">No Projects in System</h3>
            <p className="text-xs text-slate-500 dark:text-slate-400 max-w-sm mb-5">
              The database is currently clean with zero projects. Get started by creating your first project.
            </p>
            {isAdminOrManager && (
              <button
                type="button"
                onClick={handleOpenCreate}
                className="inline-flex items-center gap-2 px-4 py-2 bg-brand-royal hover:bg-brand-royal/90 text-white rounded-xl text-xs font-semibold shadow-xs transition cursor-pointer"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Create First Project</span>
              </button>
            )}
          </div>
        ) : displayedProjects.length === 0 ? (
          <div className="p-12 text-center text-xs text-slate-400 italic">
            No projects found matching the filter criteria.
          </div>
        ) : (
          <div className="overflow-x-auto overflow-y-auto max-h-[calc(100vh-270px)] min-h-[420px] custom-scrollbar overscroll-contain">
            <table className="w-full text-left border-collapse">
              <thead className="sticky top-0 z-20 bg-slate-50 dark:bg-slate-800 shadow-xs backdrop-blur-sm">
                <tr className="border-b border-slate-200 dark:border-slate-800 text-[11px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                  <th className="py-3.5 pl-6 pr-4">Project &amp; POC</th>
                  <th className="py-3.5 px-4">Squad Team</th>
                  <th className="py-3.5 px-4">Timeline</th>
                  <th className="py-3.5 px-4 text-center">Status / Progress</th>
                  <th className="py-3.5 pl-4 pr-6 text-right">Actions</th>
                </tr>
              </thead>
                            <tbody className="divide-y divide-slate-100 dark:divide-slate-800/80">
                {pocProjects.length > 0 || memberProjects.length > 0 ? (
                  <>
                    {/* 1st Option: Point of Contact (POC) Projects */}
                    {pocProjects.length > 0 && (
                      <>
                        <tr
                          onClick={() => setIsPocSectionOpen(prev => !prev)}
                          className="bg-amber-50/95 dark:bg-amber-950/70 border-y border-amber-300 dark:border-amber-800/80 shadow-2xs cursor-pointer select-none hover:bg-amber-100/80 dark:hover:bg-amber-900/50 transition-colors"
                          title={isPocSectionOpen ? "Click to collapse POC projects" : "Click to show POC projects"}
                        >
                          <td colSpan={5} className="py-2.5 pl-6 pr-4">
                            <div className="flex flex-wrap items-center justify-between gap-2">
                              <div className="flex items-center gap-2.5">
                                {/* Arrow Mark at line start */}
                                <button
                                  type="button"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    setIsPocSectionOpen(prev => !prev);
                                  }}
                                  className="w-7 h-7 rounded-lg bg-amber-200/90 dark:bg-amber-900/80 hover:bg-amber-300 dark:hover:bg-amber-800 flex items-center justify-center transition text-amber-950 dark:text-amber-100 shadow-2xs focus:outline-none cursor-pointer"
                                  aria-label={isPocSectionOpen ? "Collapse POC projects" : "Expand POC projects"}
                                  title={isPocSectionOpen ? "Click arrow to hide details" : "Click arrow to show details"}
                                >
                                  {isPocSectionOpen ? (
                                    <ChevronDown className="w-4 h-4 text-amber-950 dark:text-amber-100 stroke-[2.5]" />
                                  ) : (
                                    <ChevronRight className="w-4 h-4 text-amber-950 dark:text-amber-100 stroke-[2.5]" />
                                  )}
                                </button>
                                <span className="w-5 h-5 rounded-md bg-amber-500 text-white flex items-center justify-center font-black text-xs shadow-2xs">★</span>
                                <span className="text-xs font-bold text-amber-950 dark:text-amber-200 tracking-wide">
                                  Projects Where You Are Point of Contact (POC) &mdash; {pocProjects.length} {pocProjects.length === 1 ? 'Project' : 'Projects'}
                                </span>
                              </div>
                              <div className="flex items-center gap-3">
                                <span className="text-[10px] font-bold text-amber-800 dark:text-amber-400">
                                  {pocProjects.filter(p => p.status === 'In Progress').length} in progress &bull; {pocProjects.filter(p => p.status === 'Completed').length} completed
                                </span>
                                <span className="text-[10px] font-medium text-amber-700/80 dark:text-amber-300/80">
                                  {isPocSectionOpen ? 'Click arrow to hide details' : 'Click arrow to show details'}
                                </span>
                              </div>
                            </div>
                          </td>
                        </tr>
                        {isPocSectionOpen && pocProjects.map(p => renderProjectRow(p, true))}
                      </>
                    )}

                    {/* 2nd Option: Projects Where User is an Assigned Squad / Team Member */}
                    {memberProjects.length > 0 && (
                      <>
                        <tr
                          onClick={() => setIsMemberSectionOpen(prev => !prev)}
                          className="bg-blue-50/95 dark:bg-blue-950/70 border-y border-blue-300 dark:border-blue-800/80 shadow-2xs cursor-pointer select-none hover:bg-blue-100/80 dark:hover:bg-blue-900/50 transition-colors"
                          title={isMemberSectionOpen ? "Click to collapse projects you are in" : "Click to show projects you are in"}
                        >
                          <td colSpan={5} className="py-2.5 pl-6 pr-4">
                            <div className="flex flex-wrap items-center justify-between gap-2">
                              <div className="flex items-center gap-2.5">
                                {/* Arrow Mark at line start */}
                                <button
                                  type="button"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    setIsMemberSectionOpen(prev => !prev);
                                  }}
                                  className="w-7 h-7 rounded-lg bg-blue-200/90 dark:bg-blue-900/80 hover:bg-blue-300 dark:hover:bg-blue-800 flex items-center justify-center transition text-blue-950 dark:text-blue-100 shadow-2xs focus:outline-none cursor-pointer"
                                  aria-label={isMemberSectionOpen ? "Collapse projects you are in" : "Expand projects you are in"}
                                  title={isMemberSectionOpen ? "Click arrow to hide details" : "Click arrow to show details"}
                                >
                                  {isMemberSectionOpen ? (
                                    <ChevronDown className="w-4 h-4 text-blue-950 dark:text-blue-100 stroke-[2.5]" />
                                  ) : (
                                    <ChevronRight className="w-4 h-4 text-blue-950 dark:text-blue-100 stroke-[2.5]" />
                                  )}
                                </button>
                                <span className="w-5 h-5 rounded-md bg-blue-600 text-white flex items-center justify-center font-black text-xs shadow-2xs">👥</span>
                                <span className="text-xs font-bold text-blue-950 dark:text-blue-200 tracking-wide">
                                  Projects You Are In (Squad Member) &mdash; {memberProjects.length} {memberProjects.length === 1 ? 'Project' : 'Projects'}
                                </span>
                              </div>
                              <div className="flex items-center gap-3">
                                <span className="text-[10px] font-bold text-blue-800 dark:text-blue-400">
                                  {memberProjects.filter(p => p.status === 'In Progress').length} in progress &bull; {memberProjects.filter(p => p.status === 'Completed').length} completed
                                </span>
                                <span className="text-[10px] font-medium text-blue-700/80 dark:text-blue-300/80">
                                  {isMemberSectionOpen ? 'Click arrow to hide details' : 'Click arrow to show details'}
                                </span>
                              </div>
                            </div>
                          </td>
                        </tr>
                        {isMemberSectionOpen && memberProjects.map(p => renderProjectRow(p, false))}
                      </>
                    )}

                    {/* 3rd Option: Other Company & Squad Projects */}
                    {otherProjects.length > 0 && (
                      <>
                        <tr
                          onClick={() => setIsOtherSectionOpen(prev => !prev)}
                          className="bg-slate-100/95 dark:bg-slate-800/95 border-y border-slate-200 dark:border-slate-700/80 shadow-2xs cursor-pointer select-none hover:bg-slate-200/70 dark:hover:bg-slate-700/50 transition-colors"
                          title={isOtherSectionOpen ? "Click to collapse other company projects" : "Click to show other company projects"}
                        >
                          <td colSpan={5} className="py-2.5 pl-6 pr-4">
                            <div className="flex flex-wrap items-center justify-between gap-2">
                              <div className="flex items-center gap-2.5">
                                {/* Arrow Mark at line start */}
                                <button
                                  type="button"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    setIsOtherSectionOpen(prev => !prev);
                                  }}
                                  className="w-7 h-7 rounded-lg bg-slate-200 dark:bg-slate-700 hover:bg-slate-300 dark:hover:bg-slate-600 flex items-center justify-center transition text-slate-900 dark:text-slate-100 shadow-2xs focus:outline-none cursor-pointer"
                                  aria-label={isOtherSectionOpen ? "Collapse other projects" : "Expand other projects"}
                                  title={isOtherSectionOpen ? "Click arrow to hide details" : "Click arrow to show details"}
                                >
                                  {isOtherSectionOpen ? (
                                    <ChevronDown className="w-4 h-4 text-slate-900 dark:text-slate-100 stroke-[2.5]" />
                                  ) : (
                                    <ChevronRight className="w-4 h-4 text-slate-900 dark:text-slate-100 stroke-[2.5]" />
                                  )}
                                </button>
                                <span className="w-5 h-5 rounded-md bg-slate-600 text-white flex items-center justify-center font-black text-xs shadow-2xs">💼</span>
                                <span className="text-xs font-bold text-slate-800 dark:text-slate-200 tracking-wide">
                                  Other Company &amp; Squad Projects &mdash; {otherProjects.length} {otherProjects.length === 1 ? 'Project' : 'Projects'}
                                </span>
                                <span className="text-[10px] text-slate-500 dark:text-slate-400">Assigned squad tasks &amp; company directory</span>
                              </div>
                              <div className="flex items-center gap-3">
                                <span className="text-[10px] text-slate-500 dark:text-slate-400 font-medium">
                                  {isOtherSectionOpen ? 'Click arrow to hide details' : 'Click arrow to show details'}
                                </span>
                              </div>
                            </div>
                          </td>
                        </tr>
                        {isOtherSectionOpen && otherProjects.map(p => renderProjectRow(p, false))}
                      </>
                    )}
                  </>
                ) : (
                  displayedProjects.map(p => renderProjectRow(p, false))
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Project Bar Graph Modal */}
      {selectedBarGraphProject && (() => {
        const p = selectedBarGraphProject;
        const { isCompleted, overallProg, barData } = getProjectBarData(p);

        return (
          <div
            className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-xs animate-in fade-in duration-200"
            onClick={() => setSelectedBarGraphProject(null)}
          >
            <div
              className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-2xl max-w-2xl w-full p-6 space-y-4 max-h-[90vh] overflow-y-auto custom-scrollbar"
              onClick={e => e.stopPropagation()}
            >
              {/* Modal Header */}
              <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-blue-50 dark:bg-blue-950/40 text-brand-royal flex items-center justify-center">
                    <BarChart3 className="w-5 h-5 text-brand-royal" />
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <h3 className="text-base font-bold text-slate-900 dark:text-white">
                        {p.name || p.title}
                      </h3>
                      <span className="text-[11px] font-mono px-2 py-0.5 rounded bg-slate-100 dark:bg-slate-800 text-slate-500 font-bold">
                        {p.project_code || `PRJ-${p.id}`}
                      </span>
                    </div>
                    <p className="text-xs text-slate-500 dark:text-slate-400">
                      Module &amp; Milestone Completion Progress
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setSelectedBarGraphProject(null)}
                  className="w-8 h-8 rounded-lg flex items-center justify-center text-slate-400 hover:text-slate-600 hover:bg-slate-100 dark:hover:bg-slate-800 transition cursor-pointer"
                  title="Close"
                >
                  ✕
                </button>
              </div>

              {/* Status Banner */}
              <div className="flex items-center justify-between p-3.5 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700/60">
                <div className="flex items-center gap-2">
                  <span className="text-xs font-semibold text-slate-600 dark:text-slate-400">Project Status:</span>
                  {isCompleted ? (
                    <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-bold bg-emerald-50 text-emerald-700 border border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-300 dark:border-emerald-800">
                      <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                      Completed
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-bold bg-blue-50 text-blue-700 border border-blue-200 dark:bg-blue-950/40 dark:text-blue-300 dark:border-blue-800">
                      <BarChart3 className="w-3.5 h-3.5 text-blue-600" />
                      In Progress ({overallProg}%)
                    </span>
                  )}
                </div>
                <div className="text-right">
                  <span className="text-[11px] text-slate-400 font-medium block">Overall Progress</span>
                  <span className="text-sm font-black text-brand-royal dark:text-blue-400 font-mono">
                    {overallProg}%
                  </span>
                </div>
              </div>

              {/* Bar Chart with White Tooltip */}
              <div className="h-64 w-full pt-2">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart
                    data={barData}
                    margin={{ top: 20, right: 30, left: 10, bottom: 5 }}
                  >
                    <CartesianGrid strokeDasharray="3 3" opacity={0.15} vertical={false} />
                    <XAxis
                      dataKey="module"
                      tick={{ fill: '#64748B', fontSize: 11, fontWeight: 700 }}
                      axisLine={{ stroke: '#CBD5E1' }}
                      tickLine={false}
                    />
                    <YAxis
                      domain={[0, 100]}
                      tickFormatter={(val) => `${val}%`}
                      tick={{ fill: '#64748B', fontSize: 10 }}
                      axisLine={false}
                      tickLine={false}
                    />
                    <Tooltip
                      cursor={{ fill: 'rgba(241, 245, 249, 0.6)' }}
                      formatter={(val: any) => [`${val}% Completed`, 'Completion Rate']}
                      contentStyle={WHITE_TOOLTIP_STYLE}
                      itemStyle={WHITE_TOOLTIP_ITEM_STYLE}
                      labelStyle={WHITE_TOOLTIP_LABEL_STYLE}
                      wrapperStyle={TOOLTIP_WRAPPER_STYLE}
                      allowEscapeViewBox={{ x: true, y: true }}
                      isAnimationActive={false}
                    />
                    <Bar
                      dataKey="progress"
                      radius={[6, 6, 0, 0]}
                      maxBarSize={52}
                      isAnimationActive={true}
                      animationBegin={0}
                      animationDuration={3000}
                      animationEasing="ease-out"
                    >
                      {barData.map((entry, index) => (
                        <Cell key={`modal-bar-cell-${index}`} fill={entry.fill} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>

              {/* Cards Breakdown */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-2">
                {barData.map((item) => {
                  const Icon = item.icon;
                  return (
                    <div
                      key={item.module}
                      className={`p-3 rounded-xl border ${item.lightBg} ${item.border} flex flex-col justify-between`}
                    >
                      <div className="flex items-center justify-between mb-1.5">
                        <span className="flex items-center gap-1.5 text-xs font-bold text-slate-800 dark:text-slate-200">
                          <Icon className="w-4 h-4" style={{ color: item.fill }} />
                          <span>{item.module}</span>
                        </span>
                        <span className={`text-xs font-black ${item.text} font-mono`}>
                          {item.progress}%
                        </span>
                      </div>
                      <div className="w-full bg-white/70 dark:bg-slate-900/60 rounded-full h-1.5 overflow-hidden mt-1 border border-slate-200/50">
                        <div
                          className="h-full rounded-full"
                          style={{ width: `${item.progress}%`, backgroundColor: item.fill }}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* POC Module Progress Updater & Report Generator */}
              <ProjectProgressUpdater
                project={p}
                canUpdate={(p.poc?.id === user?.id) || Boolean(isAdminOrManager)}
                onSuccess={(updated) => {
                  setSelectedBarGraphProject(updated);
                  queryClient.invalidateQueries({ queryKey: ['projects'] });
                }}
              />

              {/* Modal Footer */}
              <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100 dark:border-slate-800">
                <button
                  type="button"
                  onClick={() => setSelectedBarGraphProject(null)}
                  className="px-4 py-2 rounded-xl text-xs font-bold text-white bg-brand-royal hover:bg-blue-700 transition cursor-pointer"
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        );
      })()}

      {/* Project Modal */}
      <ProjectModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        project={selectedProject}
        onSuccess={handleRefresh}
      />
    </div>
  );
};
