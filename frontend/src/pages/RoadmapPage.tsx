import React, { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  CheckCircle2,
  Clock,
  Calendar,
  Download,
  ShieldAlert,
  Layers,
  AlertTriangle,
  Users,
  Check,
  TrendingUp,
  Activity
} from 'lucide-react';
import { api } from '../lib/api';
import { Project, DueDiaryReport, EmployeeWorkloadRecord } from '../types';

export const RoadmapPage: React.FC = () => {
  const { data: projects = [], isLoading: isProjectsLoading } = useQuery<Project[]>({
    queryKey: ['projects'],
    queryFn: () => api.getProjects(),
  });

  const { data: workload = [] } = useQuery<EmployeeWorkloadRecord[]>({
    queryKey: ['employees', 'workload'],
    queryFn: () => api.getEmployeesWorkload({ active_only: true }),
  });

  const { data: summary } = useQuery({
    queryKey: ['summary'],
    queryFn: () => api.getSummary(),
  });

  const { data: dueReport } = useQuery<DueDiaryReport>({
    queryKey: ['diary', 'due'],
    queryFn: () => api.getDueDiary(),
  });

  // Calculate dynamic phases from real database projects
  const dynamicPhases = useMemo(() => {
    if (!projects || projects.length === 0) {
      return [];
    }

    const completedProjects = projects.filter(p => p.status === 'Completed' || (p.progress ?? 0) >= 100);
    const inProgressProjects = projects.filter(p => p.status === 'In Progress' && (p.progress ?? 0) < 100);
    const planningProjects = projects.filter(p => p.status === 'Planning');

    const calcAvgProg = (list: Project[]) => {
      if (list.length === 0) return 0;
      const sum = list.reduce((acc, curr) => acc + (curr.progress ?? 0), 0);
      return Math.round(sum / list.length);
    };

    const calcDateRange = (list: Project[]) => {
      const starts = list.map(p => p.start_date).filter(Boolean) as string[];
      const ends = list.map(p => p.end_date).filter(Boolean) as string[];
      starts.sort();
      ends.sort();
      const earliest = starts[0] || 'Q4 2026';
      const latest = ends[ends.length - 1] || 'Target 2026';
      return `${earliest} → ${latest}`;
    };

    const phasesList = [
      {
        phase: `Phase 1: Delivered & Completed (${completedProjects.length} Projects)`,
        title: 'Production Delivered Systems & Finalized Milestones',
        category: 'Delivered Portfolio',
        description: completedProjects.length > 0
          ? `Delivered ${completedProjects.length} enterprise solutions at 100% completion including ${completedProjects.slice(0, 3).map(p => p.name).join(', ')}${completedProjects.length > 3 ? ' and more' : ''}.`
          : 'Projects transitioned to completed state upon 100% module verification.',
        status: completedProjects.length > 0 ? ('completed' as const) : ('upcoming' as const),
        count: completedProjects.length,
        avgProgress: 100,
        timeline: calcDateRange(completedProjects),
      },
      {
        phase: `Phase 2: Core Engineering & Build (${inProgressProjects.length} Projects)`,
        title: 'Active Sprint Execution & Full-Stack Development',
        category: 'Active Operations',
        description: inProgressProjects.length > 0
          ? `Currently executing ${inProgressProjects.length} active initiatives with ${calcAvgProg(inProgressProjects)}% average progress. Top initiatives: ${inProgressProjects.slice(0, 3).map(p => p.name).join(', ')}.`
          : 'Active developments scheduled in current sprint.',
        status: inProgressProjects.length > 0 ? ('in_progress' as const) : ('upcoming' as const),
        count: inProgressProjects.length,
        avgProgress: calcAvgProg(inProgressProjects),
        timeline: calcDateRange(inProgressProjects),
      },
      {
        phase: `Phase 3: Scope Discovery & Planning (${planningProjects.length} Projects)`,
        title: 'Architecture Specification & Sprint Backlog',
        category: 'Pipeline & Design',
        description: planningProjects.length > 0
          ? `${planningProjects.length} projects in scoping and architectural planning stage awaiting engineering team allocations (${planningProjects.slice(0, 3).map(p => p.name).join(', ')}).`
          : 'Upcoming initiatives staged for architecture review and resource allocation.',
        status: planningProjects.length > 0 ? ('in_progress' as const) : ('upcoming' as const),
        count: planningProjects.length,
        avgProgress: calcAvgProg(planningProjects),
        timeline: calcDateRange(planningProjects),
      },
      {
        phase: `Milestone: Target Deliveries & Verification`,
        title: 'Automated Testing, Verification & Milestone Reviews',
        category: 'Target Milestones',
        description: `Enterprise-wide verification across all ${projects.length} portfolio items, automated work diary submissions, and PostgreSQL backend synchronization.`,
        status: inProgressProjects.length === 0 && planningProjects.length === 0 ? ('completed' as const) : ('upcoming' as const),
        count: projects.length,
        avgProgress: calcAvgProg(projects),
        timeline: 'Continuous CI/CD Delivery',
      },
    ];

    return phasesList;
  }, [projects]);

  // Calculate dynamic operational risk matrix from real database data
  const dynamicRisks = useMemo(() => {
    const today = new Date().toISOString().split('T')[0];

    // 1. Overdue projects
    const overdueProjects = projects.filter(p => {
      if (p.status === 'Completed' || p.status === 'Cancelled' || !p.end_date) return false;
      return p.end_date < today;
    });

    // 2. Overloaded staff (>= 5 active projects)
    const overloadedStaff = workload.filter(w => w.active_count >= 5 || w.status === 'OVERLOADED');

    // 3. Missing daily diary updates
    const missingDiary = dueReport?.total_missing ?? 0;

    // 4. Active projects missing dedicated POC
    const activeProjects = projects.filter(p => p.status === 'In Progress' || p.status === 'Planning');
    const noPocProjects = activeProjects.filter(p => !p.poc);

    return [
      {
        risk: overdueProjects.length > 0
          ? `${overdueProjects.length} Project(s) Past Delivery Deadline`
          : 'Portfolio Schedule & Deadline Adherence',
        impact: overdueProjects.length > 0 ? 'High' : 'Low',
        levelColor: overdueProjects.length > 0
          ? 'bg-rose-100 text-rose-800 dark:bg-rose-950/60 dark:text-rose-300'
          : 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300',
        details: overdueProjects.length > 0
          ? `Past deadline: ${overdueProjects.slice(0, 3).map(p => p.name).join(', ')}${overdueProjects.length > 3 ? ` (+${overdueProjects.length - 3} more)` : ''}.`
          : projects.length === 0
          ? 'No projects registered; schedule is clear.'
          : '100% of active projects are on track with scheduled completion target dates.',
        mitigation: overdueProjects.length > 0
          ? 'Prioritize sprint blockers in Work Diary and re-evaluate milestone delivery targets with POCs.'
          : 'Automated daily deadline tracking active; flags overdue items automatically at midnight.',
      },
      {
        risk: overloadedStaff.length > 0
          ? `${overloadedStaff.length} Staff Member(s) Overloaded (5+ Active Projects)`
          : 'Team Capacity & Workload Balance',
        impact: overloadedStaff.length > 0 ? 'High' : 'Low',
        levelColor: overloadedStaff.length > 0
          ? 'bg-rose-100 text-rose-800 dark:bg-rose-950/60 dark:text-rose-300'
          : 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300',
        details: overloadedStaff.length > 0
          ? `Overloaded engineers: ${overloadedStaff.map(s => `${s.name} (${s.active_count})`).join(', ')}.`
          : workload.length === 0
          ? 'No staff members registered in the team roster.'
          : 'Workload evenly balanced across engineering squads with 0 overloaded team members.',
        mitigation: overloadedStaff.length > 0
          ? 'Reallocate active project memberships via Team Directory or apply temporary availability overrides.'
          : 'Constant-driven thresholds (0=Available, 1-2=Busy, 3-4=Heavy, 5+=Overloaded) guide all assignments.',
      },
      {
        risk: missingDiary > 0
          ? `${missingDiary} Daily Work Diary Update(s) Pending Today`
          : 'Work Diary Daily Reporting Compliance',
        impact: missingDiary > 0 ? 'Medium' : 'Low',
        levelColor: missingDiary > 0
          ? 'bg-amber-100 text-amber-800 dark:bg-amber-950/60 dark:text-amber-300'
          : 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300',
        details: missingDiary > 0
          ? `${missingDiary} staff across active squads have not logged their daily engineering progress updates.`
          : 'All assigned project contributors have submitted their daily engineering log entries.',
        mitigation: missingDiary > 0
          ? 'POC review notifications visible on main dashboard; 1-click review verification available for managers.'
          : 'Automated /api/diary/due/ tracking monitors submissions and flags gaps after 2 business days.',
      },
      {
        risk: noPocProjects.length > 0
          ? `${noPocProjects.length} Active Project(s) Without Designated Technical POC`
          : 'Technical Ownership & POC Designation Coverage',
        impact: noPocProjects.length > 0 ? 'Medium' : 'Low',
        levelColor: noPocProjects.length > 0
          ? 'bg-amber-100 text-amber-800 dark:bg-amber-950/60 dark:text-amber-300'
          : 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300',
        details: noPocProjects.length > 0
          ? `Active projects lacking POC: ${noPocProjects.slice(0, 3).map(p => p.name).join(', ')}${noPocProjects.length > 3 ? '...' : ''}.`
          : projects.length === 0
          ? 'No active projects requiring technical POC assignment.'
          : 'All active and planning projects have a designated Point of Contact (POC) assigned.',
        mitigation: noPocProjects.length > 0
          ? 'Assign POC from existing project members in Project Details to unlock module-level progress updates.'
          : 'Role-based access enforces POC ownership over Frontend, Backend, and Database progress metrics.',
      },
    ];
  }, [projects, workload, dueReport]);

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      {/* Header Banner */}
      <div className="bg-gradient-to-r from-[#0B192C] to-[#1565C0] text-white p-6 rounded-2xl shadow-md flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <span className="px-2.5 py-1 rounded-md text-[10px] font-bold bg-blue-500 text-white uppercase tracking-wider mb-2 inline-block">
            Live Portfolio Roadmap
          </span>
          <h1 className="text-xl font-extrabold tracking-tight">AI Samrat Dynamic Delivery &amp; Risk Matrix</h1>
          <p className="text-xs text-blue-100 mt-1 max-w-2xl">
            Real-time synchronization of project lifecycle stages, live completion metrics, team workload distributions, and architectural risk mitigations.
          </p>
        </div>

        <div className="flex items-center space-x-3 shrink-0">
          <button
            onClick={() => {
              const roadmapDoc = projects.flatMap((p) => p.documents || []).find((d) => d.file_type === 'roadmap');
              if (roadmapDoc) {
                api.downloadDocument(roadmapDoc.id, roadmapDoc.original_filename || 'AI_Samrat_Roadmap.pptx');
              } else {
                window.open('/api/export/csv/', '_blank');
              }
            }}
            className="px-4 py-2 bg-white hover:bg-slate-100 text-slate-900 font-bold rounded-xl text-xs transition flex items-center space-x-2 shadow-xs cursor-pointer"
          >
            <Download className="w-4 h-4 text-[#0174E7]" />
            <span>Export Portfolio</span>
          </button>
        </div>
      </div>

      {/* Dynamic Execution Phases Timeline */}
      <div className="bg-white dark:bg-[#0F1B30] p-6 rounded-2xl border border-slate-200 dark:border-[#1E2D4A] shadow-xs space-y-6">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-bold text-slate-900 dark:text-white uppercase tracking-wider flex items-center space-x-2">
            <Calendar className="w-4 h-4 text-[#0174E7]" />
            <span>Dynamic Execution Phases ({projects.length} Total Projects)</span>
          </h2>
          <span className="text-xs text-slate-400">Live Database Cohorts</span>
        </div>

        {isProjectsLoading ? (
          <div className="p-12 flex items-center justify-center">
            <div className="w-8 h-8 rounded-full border-2 border-[#0174E7] border-t-transparent animate-spin" />
          </div>
        ) : dynamicPhases.length === 0 ? (
          <div className="p-12 text-center text-xs text-slate-400 italic">
            No projects registered in the system yet. Once projects are created or imported, the dynamic execution phases and lifecycle cohorts will automatically calculate here.
          </div>
        ) : (
          <div className="relative border-l-2 border-blue-200 dark:border-blue-900/60 ml-4 pl-6 space-y-8">
            {dynamicPhases.map((p, idx) => (
              <div key={idx} className="relative">
                <div
                  className={`absolute -left-[33px] top-0 w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-bold shadow-xs ${
                    p.status === 'completed'
                      ? 'bg-emerald-500 text-white'
                      : p.status === 'in_progress'
                      ? 'bg-[#0174E7] text-white ring-4 ring-blue-100 dark:ring-blue-900/40 animate-pulse'
                      : 'bg-slate-300 dark:bg-slate-700 text-slate-600 dark:text-slate-300'
                  }`}
                >
                  {p.status === 'completed' ? (
                    <CheckCircle2 className="w-3.5 h-3.5" />
                  ) : p.status === 'in_progress' ? (
                    <Clock className="w-3.5 h-3.5" />
                  ) : (
                    <span>{idx + 1}</span>
                  )}
                </div>

                <div>
                  <div className="flex flex-wrap items-center gap-2">
                    <span
                      className={`text-xs font-bold px-2 py-0.5 rounded ${
                        p.status === 'completed'
                          ? 'text-emerald-700 bg-emerald-50 border border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-300 dark:border-emerald-800'
                          : p.status === 'in_progress'
                          ? 'text-blue-700 bg-blue-50 border border-blue-200 dark:bg-blue-950/40 dark:text-blue-300 dark:border-blue-800'
                          : 'text-slate-600 bg-slate-100 dark:bg-slate-800 dark:text-slate-400'
                      }`}
                    >
                      {p.phase}
                    </span>
                    <span className="text-xs text-slate-400 dark:text-slate-500">{p.category}</span>
                    <span className="text-[11px] font-mono text-slate-400 dark:text-slate-500 ml-auto">
                      {p.timeline}
                    </span>
                  </div>
                  <h3 className="text-sm font-bold text-slate-900 dark:text-white mt-1.5">{p.title}</h3>
                  <p className="text-xs text-slate-600 dark:text-slate-400 mt-1 leading-relaxed">{p.description}</p>

                  {/* Live Progress Bar for Phase */}
                  <div className="mt-2.5 max-w-md">
                    <div className="flex items-center justify-between text-[10px] text-slate-500 mb-1">
                      <span>Phase Completion</span>
                      <span className="font-bold text-slate-700 dark:text-slate-300">{p.avgProgress}%</span>
                    </div>
                    <div className="w-full bg-slate-100 dark:bg-slate-800 h-1.5 rounded-full overflow-hidden">
                      <div
                        className={`h-full rounded-full transition-all duration-500 ${
                          p.avgProgress >= 100
                            ? 'bg-emerald-500'
                            : p.avgProgress >= 50
                            ? 'bg-blue-500'
                            : 'bg-amber-500'
                        }`}
                        style={{ width: `${p.avgProgress}%` }}
                      />
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Active Projects Roadmap Gantt / Milestone Overview */}
      <div className="bg-white dark:bg-[#0F1B30] p-6 rounded-2xl border border-slate-200 dark:border-[#1E2D4A] shadow-xs space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-bold text-slate-900 dark:text-white uppercase tracking-wider flex items-center space-x-2">
            <Layers className="w-4 h-4 text-[#0174E7]" />
            <span>Active Project Milestones ({projects.filter((p) => p.status === 'In Progress' || p.status === 'Planning').length})</span>
          </h2>
          <span className="text-xs text-slate-400">Total Portfolio: {projects.length}</span>
        </div>

        {isProjectsLoading ? (
          <div className="p-8 flex items-center justify-center">
            <div className="w-8 h-8 rounded-full border-2 border-[#0174E7] border-t-transparent animate-spin" />
          </div>
        ) : projects.length === 0 ? (
          <div className="p-8 text-center text-xs text-slate-400 italic">
            No active project milestones to display.
          </div>
        ) : (
          <div className="space-y-3">
            {projects.slice(0, 10).map((proj) => {
              const progress = proj.progress ?? 0;
              return (
                <div
                  key={proj.id}
                  className="p-4 rounded-xl border border-slate-200 dark:border-[#1E2D4A] bg-slate-50/50 dark:bg-[#15223C]/40 flex flex-col md:flex-row md:items-center justify-between gap-3"
                >
                  <div className="min-w-[200px]">
                    <div className="flex items-center space-x-2">
                      <span className="font-bold text-slate-900 dark:text-white text-xs">{proj.name || proj.title}</span>
                      <span className="px-1.5 py-0.5 rounded text-[10px] font-mono bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-300">
                        {proj.project_code || `#${proj.id}`}
                      </span>
                    </div>
                    <div className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
                      {proj.start_date || 'Q4 2026'} &rarr; {proj.end_date || 'Target Nov 2026'}
                    </div>
                  </div>

                  <div className="flex-1 max-w-md">
                    <div className="flex items-center justify-between text-[11px] mb-1">
                      <span className="text-slate-500 font-medium">Overall Progress</span>
                      <span className="font-bold text-slate-700 dark:text-slate-300">{progress}%</span>
                    </div>
                    <div className="w-full bg-slate-200 dark:bg-slate-700 h-2 rounded-full overflow-hidden">
                      <div
                        className={`h-full rounded-full transition-all duration-500 ${
                          progress >= 100
                            ? 'bg-emerald-500'
                            : progress >= 50
                            ? 'bg-blue-500'
                            : 'bg-amber-500'
                        }`}
                        style={{ width: `${progress}%` }}
                      />
                    </div>
                  </div>

                  <div className="flex items-center space-x-3 shrink-0">
                    <span
                      className={`px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider ${
                        proj.status === 'In Progress'
                          ? 'bg-blue-100 text-blue-800 dark:bg-blue-950/60 dark:text-blue-300'
                          : proj.status === 'Planning'
                          ? 'bg-purple-100 text-purple-800 dark:bg-purple-950/60 dark:text-purple-300'
                          : proj.status === 'Completed'
                          ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300'
                          : 'bg-slate-100 text-slate-800 dark:bg-slate-800 dark:text-slate-300'
                      }`}
                    >
                      {proj.status}
                    </span>
                    {proj.poc && (
                      <span className="text-[11px] text-slate-500 font-medium">
                        POC: <strong className="text-slate-700 dark:text-slate-200">{proj.poc.name}</strong>
                      </span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Dynamic Operational Risk Matrix */}
      <div className="bg-white dark:bg-[#0F1B30] p-6 rounded-2xl border border-slate-200 dark:border-[#1E2D4A] shadow-xs space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-bold text-slate-900 dark:text-white uppercase tracking-wider flex items-center space-x-2">
            <ShieldAlert className="w-4 h-4 text-amber-500" />
            <span>Live Operational Risk Matrix &amp; Mitigations</span>
          </h2>
          <span className="text-xs text-slate-400">Calculated from Live Metrics</span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="bg-slate-50 dark:bg-[#15223C] text-slate-500 dark:text-slate-400 border-b border-slate-200 dark:border-[#1E2D4A] font-semibold">
                <th className="py-2.5 px-3">Operational Risk Area</th>
                <th className="py-2.5 px-3">Impact</th>
                <th className="py-2.5 px-3">Live System Status</th>
                <th className="py-2.5 px-3">Architecture Mitigation Strategy</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-[#1E2D4A]">
              {dynamicRisks.map((r, idx) => (
                <tr key={idx} className="hover:bg-slate-50/50 dark:hover:bg-[#15223C]/50 transition">
                  <td className="py-3 px-3 font-semibold text-slate-900 dark:text-white">{r.risk}</td>
                  <td className="py-3 px-3">
                    <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase ${r.levelColor}`}>
                      {r.impact}
                    </span>
                  </td>
                  <td className="py-3 px-3 text-slate-600 dark:text-slate-300 font-medium">
                    {r.details}
                  </td>
                  <td className="py-3 px-3 text-slate-600 dark:text-slate-400 leading-relaxed">
                    {r.mitigation}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
