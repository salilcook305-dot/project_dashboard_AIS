import React, { useState, useMemo } from 'react';
import {
  Users,
  Search,
  RotateCw,
  Mail,
  Briefcase,
  Layers,
  ShieldCheck,
  UserCheck,
  FolderGit2,
  X
} from 'lucide-react';
import { EmployeeOption } from './EmployeeSearchCombobox';
import { AvailabilityBadge } from './AvailabilityBadge';

interface TeamDirectoryProps {
  employees: EmployeeOption[];
  projects: any[];
  isLoading?: boolean;
  onRefresh?: () => void;
  onSelectProject?: (projectName: string) => void;
}

export const TeamDirectory: React.FC<TeamDirectoryProps> = ({
  employees,
  projects,
  isLoading = false,
  onRefresh,
  onSelectProject,
}) => {
  const [search, setSearch] = useState('');
  const [selectedDept, setSelectedDept] = useState('');
  const [selectedRole, setSelectedRole] = useState('');
  const [selectedAvailability, setSelectedAvailability] = useState('');

  // Extract unique departments and roles
  const departments = useMemo(() => {
    const set = new Set<string>();
    employees.forEach(e => {
      if (e.department) set.add(e.department);
    });
    return Array.from(set).sort();
  }, [employees]);

  // Compute map of employee ID -> assigned projects
  const employeeProjectsMap = useMemo(() => {
    const map = new Map<number, Array<{ id: number; name: string; status: string; role: string }>>();

    projects.forEach(p => {
      const projId = p.id;
      const projName = p.name || p.title;
      const projStatus = p.status;

      // Check if project manager
      if (p.project_manager && p.project_manager.id) {
        const pmId = p.project_manager.id;
        const list = map.get(pmId) || [];
        if (!list.some(item => item.id === projId)) {
          list.push({
            id: projId,
            name: projName,
            status: projStatus,
            role: 'Project Manager',
          });
          map.set(pmId, list);
        }
      }

      // Check if point of contact
      if (p.poc && p.poc.id) {
        const pocId = p.poc.id;
        const list = map.get(pocId) || [];
        if (!list.some(item => item.id === projId)) {
          list.push({
            id: projId,
            name: projName,
            status: projStatus,
            role: 'Point of Contact',
          });
          map.set(pocId, list);
        }
      }

      // Check team members
      if (Array.isArray(p.team)) {
        p.team.forEach((m: any) => {
          const empId = m.user_id || m.employee_id || m.id;
          const roleTitle = m.project_role || m.role_on_project || m.role || 'Contributor';
          if (empId) {
            const list = map.get(empId) || [];
            if (!list.some(item => item.id === projId)) {
              list.push({
                id: projId,
                name: projName,
                status: projStatus,
                role: roleTitle,
              });
              map.set(empId, list);
            }
          }
        });
      }
    });

    return map;
  }, [projects]);

  // Calculate statistics
  const totalMembers = employees.length;
  const adminCount = employees.filter(e => e.role === 'ADMIN').length;
  const managerCount = employees.filter(e => e.role === 'MANAGER').length;
  const totalAssignments = useMemo(() => {
    let count = 0;
    employeeProjectsMap.forEach(list => {
      count += list.length;
    });
    return count;
  }, [employeeProjectsMap]);

  // Filter employees
  const filteredEmployees = useMemo(() => {
    const seenIds = new Set<number>();
    return employees.filter(emp => {
      // Deduplicate by ID
      if (!emp || !emp.id || seenIds.has(emp.id)) return false;
      seenIds.add(emp.id);

      // Department filter
      if (selectedDept && emp.department !== selectedDept) {
        return false;
      }

      // Role filter
      if (selectedRole && emp.role !== selectedRole) {
        return false;
      }

      // Availability filter
      if (selectedAvailability && emp.status !== selectedAvailability) {
        return false;
      }

      // Search query (multi-word match)
      if (search.trim()) {
        const terms = search.trim().toLowerCase().split(/\s+/);
        const corpus = [
          emp.name,
          emp.username,
          emp.email,
          emp.job_title,
          emp.department,
          emp.role,
        ]
          .filter(Boolean)
          .join(' ')
          .toLowerCase();

        const matches = terms.every(t => corpus.includes(t));
        if (!matches) return false;
      }

      return true;
    });
  }, [employees, employeeProjectsMap, selectedDept, selectedRole, search]);

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'IN_PROGRESS':
        return { label: 'In Progress', bg: 'bg-blue-100 dark:bg-blue-950/40 text-blue-700 dark:text-blue-300 border-blue-200 dark:border-blue-800' };
      case 'PLANNING':
        return { label: 'Planning', bg: 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-700' };
      case 'COMPLETED':
        return { label: 'Completed', bg: 'bg-green-100 dark:bg-green-950/40 text-green-700 dark:text-green-300 border-green-200 dark:border-green-800' };
      case 'CANCELLED':
        return { label: 'Cancelled', bg: 'bg-red-100 dark:bg-red-950/40 text-red-700 dark:text-red-300 border-red-200 dark:border-red-800' };
      default:
        return { label: status, bg: 'bg-slate-100 text-slate-700 border-slate-200' };
    }
  };

  const getRoleBadge = (role?: string) => {
    switch (role) {
      case 'ADMIN':
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-100 dark:bg-amber-950/40 text-amber-800 dark:text-amber-300 border border-amber-300 dark:border-amber-800">
            <ShieldCheck className="w-3 h-3" />
            ADMIN
          </span>
        );
      case 'MANAGER':
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-blue-100 dark:bg-blue-950/40 text-[#1565C0] dark:text-[#2AA0F0] border border-blue-300 dark:border-blue-800">
            <Briefcase className="w-3 h-3" />
            MANAGER
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border border-slate-300 dark:border-slate-700">
            <UserCheck className="w-3 h-3" />
            EMPLOYEE
          </span>
        );
    }
  };

  return (
    <div className="space-y-6">
      {/* Team Summary Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3.5 mb-6">
        <div className="p-4 rounded-xl border border-blue-200/60 dark:border-blue-900/50 bg-blue-50/70 dark:bg-blue-950/20 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-600 dark:text-slate-300">Total Team Members</span>
            <Users className="w-4 h-4 text-brand-royal dark:text-[#60A5FA]" />
          </div>
          <div className="mt-2 text-2xl font-bold tracking-tight text-slate-900 dark:text-slate-100">
            {totalMembers}
          </div>
        </div>

        <div className="p-4 rounded-xl border border-amber-200/60 dark:border-amber-900/50 bg-amber-50/70 dark:bg-amber-950/20 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-600 dark:text-slate-300">Departments</span>
            <Layers className="w-4 h-4 text-amber-600 dark:text-amber-400" />
          </div>
          <div className="mt-2 text-2xl font-bold tracking-tight text-slate-900 dark:text-slate-100">
            {departments.length}
          </div>
        </div>

        <div className="p-4 rounded-xl border border-purple-200/60 dark:border-purple-900/50 bg-purple-50/70 dark:bg-purple-950/20 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-600 dark:text-slate-300">Project Managers</span>
            <Briefcase className="w-4 h-4 text-purple-600 dark:text-purple-400" />
          </div>
          <div className="mt-2 text-2xl font-bold tracking-tight text-slate-900 dark:text-slate-100">
            {managerCount}
          </div>
        </div>

        <div className="p-4 rounded-xl border border-emerald-200/60 dark:border-emerald-900/50 bg-emerald-50/70 dark:bg-emerald-950/20 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-600 dark:text-slate-300">Project Assignments</span>
            <FolderGit2 className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
          </div>
          <div className="mt-2 text-2xl font-bold tracking-tight text-slate-900 dark:text-slate-100">
            {totalAssignments}
          </div>
        </div>
      </div>

      {/* Search and Filters Toolbar */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
        <div className="flex flex-1 items-center gap-2.5 flex-wrap sm:flex-nowrap">
          {/* Search Input */}
          <div className="relative flex-1 min-w-[220px]">
            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400">
              <Search className="w-4 h-4" />
            </div>
            <input
              type="text"
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Search by name, username, title, or department..."
              className="w-full pl-9 pr-8 py-2 text-xs rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-brand-royal shadow-sm"
            />
            {search && (
              <button
                type="button"
                onClick={() => setSearch('')}
                className="absolute inset-y-0 right-0 pr-2.5 flex items-center text-slate-400 hover:text-slate-600"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          {/* Department Filter */}
          <div className="relative">
            <select
              value={selectedDept}
              onChange={e => setSelectedDept(e.target.value)}
              className="py-2 pl-3 pr-8 text-xs rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-300 focus:outline-none focus:ring-2 focus:ring-brand-royal shadow-sm appearance-none cursor-pointer"
            >
              <option value="">All Departments ({departments.length})</option>
              {departments.map(d => (
                <option key={d} value={d}>{d}</option>
              ))}
            </select>
          </div>

          {/* Role Filter */}
          <div className="relative">
            <select
              value={selectedRole}
              onChange={e => setSelectedRole(e.target.value)}
              className="py-2 pl-3 pr-8 text-xs rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-300 focus:outline-none focus:ring-2 focus:ring-brand-royal shadow-sm appearance-none cursor-pointer"
            >
              <option value="">All Roles</option>
              <option value="ADMIN">Admins ({adminCount})</option>
              <option value="MANAGER">Managers ({managerCount})</option>
              <option value="EMPLOYEE">Employees ({totalMembers - adminCount - managerCount})</option>
            </select>
          </div>

          {/* Availability Filter */}
          <div className="relative">
            <select
              value={selectedAvailability}
              onChange={e => setSelectedAvailability(e.target.value)}
              className="py-2 pl-3 pr-8 text-xs rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-300 focus:outline-none focus:ring-2 focus:ring-brand-royal shadow-sm appearance-none cursor-pointer"
            >
              <option value="">All Availability</option>
              <option value="AVAILABLE">Available</option>
              <option value="BUSY">Busy</option>
              <option value="HEAVY">Heavy</option>
              <option value="OVERLOADED">Overloaded</option>
              <option value="ON_LEAVE">On Leave</option>
              <option value="AWAY">Away</option>
            </select>
          </div>

          {/* Refresh Button */}
          {onRefresh && (
            <button
              onClick={onRefresh}
              className="p-2 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-300 hover:text-brand-royal hover:bg-slate-50 dark:hover:bg-slate-800 shadow-sm transition-colors"
              title="Refresh directory"
            >
              <RotateCw className={`w-4 h-4 ${isLoading ? 'animate-spin text-brand-royal' : ''}`} />
            </button>
          )}
        </div>

        <div className="text-xs text-slate-500 dark:text-slate-400 font-medium shrink-0">
          Showing <span className="font-bold text-slate-700 dark:text-slate-200">{filteredEmployees.length}</span> of {totalMembers} members
        </div>
      </div>

      {/* Scrollable Members Details Area */}
      <div className="overflow-y-auto max-h-[calc(100vh-320px)] min-h-[360px] pr-1.5 custom-scrollbar">
        {filteredEmployees.length === 0 ? (
          <div className="bg-white dark:bg-slate-900 rounded-xl border border-dashed border-slate-300 dark:border-slate-800 p-12 text-center shadow-sm">
            <Users className="w-12 h-12 mx-auto text-slate-400 dark:text-slate-500 mb-3" />
            <h3 className="text-base font-semibold text-slate-800 dark:text-slate-200">No team members found</h3>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 max-w-sm mx-auto">
              No team members match the search query or filters. Try adjusting your search term or clearing filters.
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {filteredEmployees.map((emp, idx) => {
              const assignedProjects = employeeProjectsMap.get(emp.id) || [];
              const inits = emp.initials || (emp.name ? emp.name.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase() : emp.username.slice(0, 2).toUpperCase());
              const avatarColor = emp.role === 'ADMIN'
                ? '#D97706'
                : emp.role === 'MANAGER'
                  ? '#1565C0'
                  : ['#0B1F5C', '#1565C0', '#1E7BE0', '#0284C7'][idx % 4];

              return (
                <div
                  key={emp.id}
                  className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 p-4 shadow-sm hover:shadow-md transition-all flex flex-col justify-between"
                >
                  <div>
                    {/* Member Header */}
                    <div className="flex items-start justify-between gap-3 mb-3">
                      <div className="flex items-center gap-3 min-w-0">
                        <div
                          className="w-10 h-10 rounded-full text-white text-xs font-bold flex items-center justify-center shrink-0 shadow-sm ring-2 ring-white dark:ring-slate-800"
                          style={{ backgroundColor: avatarColor }}
                        >
                          {inits}
                        </div>
                        <div className="min-w-0">
                          <div className="font-bold text-slate-900 dark:text-slate-100 text-xs sm:text-sm truncate">
                            {emp.name}
                          </div>
                          <div className="text-[11px] text-slate-400 dark:text-slate-500 truncate">
                            @{emp.username}
                          </div>
                          <div className="mt-1">
                            <AvailabilityBadge
                              status={emp.status}
                              activeCount={emp.active_count}
                              leaveUntil={emp.leave_until}
                            />
                          </div>
                        </div>
                      </div>
                      {getRoleBadge(emp.role)}
                    </div>

                    {/* Title & Department */}
                    <div className="space-y-1.5 mb-3.5 bg-slate-50 dark:bg-slate-800/50 p-2.5 rounded-lg border border-slate-100 dark:border-slate-800">
                      {emp.job_title && (
                        <div className="flex items-center gap-1.5 text-xs text-slate-700 dark:text-slate-300">
                          <Briefcase className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                          <span className="font-medium truncate">{emp.job_title}</span>
                        </div>
                      )}
                      {emp.department && (
                        <div className="flex items-center gap-1.5 text-[11px] text-slate-500 dark:text-slate-400">
                          <Layers className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                          <span className="truncate">{emp.department}</span>
                        </div>
                      )}
                      {emp.email && (
                        <div className="flex items-center gap-1.5 text-[11px] text-brand-royal dark:text-[#2AA0F0] truncate">
                          <Mail className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                          <a href={`mailto:${emp.email}`} className="hover:underline truncate">
                            {emp.email}
                          </a>
                        </div>
                      )}
                    </div>

                    {/* Assigned Projects */}
                    <div>
                      <div className="flex items-center justify-between text-xs font-semibold text-slate-600 dark:text-slate-400 mb-2">
                        <span className="flex items-center gap-1">
                          <FolderGit2 className="w-3.5 h-3.5 text-brand-royal" />
                          Assigned Projects
                        </span>
                        <span className="text-[11px] font-bold px-1.5 py-0.2 rounded bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400">
                          {assignedProjects.length}
                        </span>
                      </div>

                      {assignedProjects.length === 0 ? (
                        <p className="text-[11px] text-slate-400 italic bg-white dark:bg-slate-900/60 p-2 rounded border border-dashed border-slate-200 dark:border-slate-800 text-center">
                          No active project assignments
                        </p>
                      ) : (
                        <div className="space-y-1.5 max-h-36 overflow-y-auto pr-1">
                          {assignedProjects.map(p => {
                            const badge = getStatusBadge(p.status);
                            return (
                              <div
                                key={`${p.id}-${p.role}`}
                                onClick={() => onSelectProject && onSelectProject(p.name)}
                                className="flex items-center justify-between p-1.5 rounded-lg bg-white dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700/60 text-[11px] hover:border-brand-royal/40 cursor-pointer transition-colors"
                              >
                                <div className="min-w-0 pr-1.5">
                                  <div className="font-semibold text-slate-800 dark:text-slate-200 truncate">
                                    {p.name}
                                  </div>
                                  <div className="text-[10px] text-slate-500 dark:text-slate-400 truncate">
                                    {p.role}
                                  </div>
                                </div>
                                <span className={`px-1.5 py-0.5 rounded text-[9px] font-bold shrink-0 border ${badge.bg}`}>
                                  {badge.label}
                                </span>
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};

