import React, { useState, useRef } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  UserPlus,
  Search,
  Key,
  Trash2,
  Calendar,
  AlertTriangle,
  UserCheck,
  Shield,
  Briefcase,
  Users,
  FileSpreadsheet,
  FileText,
  Upload,
  Download,
  CheckCircle2,
  RotateCw,
  Check,
  CheckSquare,
  Square,
  X
} from 'lucide-react';
import { api } from '../lib/api';
import { User } from '../types';
import { AvailabilityBadge } from '../components/AvailabilityBadge';
import { useCurrentUser } from '../components/ProtectedRoute';
import { toast } from 'sonner';

interface TeamManagementPageProps {
  currentUser?: User;
}

export const TeamManagementPage: React.FC<TeamManagementPageProps> = ({ currentUser: propUser }) => {
  const { user: authUser } = useCurrentUser();
  const currentUser = propUser || authUser || ({} as User);
  const queryClient = useQueryClient();
  const [searchTerm, setSearchTerm] = useState('');
  const [roleFilter, setRoleFilter] = useState('all');

  // Modals state
  const [isAddOpen, setIsAddOpen] = useState(false);
  const [isPasswordOpen, setIsPasswordOpen] = useState(false);
  const [isAvailabilityOpen, setIsAvailabilityOpen] = useState(false);
  const [selectedUser, setSelectedUser] = useState<any>(null);

  // Upload Excel / CSV State
  const excelInputRef = useRef<HTMLInputElement>(null);
  const csvInputRef = useRef<HTMLInputElement>(null);
  const [isUploadPreviewOpen, setIsUploadPreviewOpen] = useState(false);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [isImporting, setIsImporting] = useState(false);
  const [uploadPreviewData, setUploadPreviewData] = useState<{
    filename: string;
    file_type: string;
    total_rows: number;
    valid_count: number;
    existing_count: number;
    rows: any[];
  } | null>(null);
  const [selectedRowIndices, setSelectedRowIndices] = useState<Set<number>>(new Set());
  const [previewSearch, setPreviewSearch] = useState('');
  const [updateExistingAccounts, setUpdateExistingAccounts] = useState(true);

  // Add Employee Form State
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [role, setRole] = useState<'ADMIN' | 'MANAGER' | 'EMPLOYEE'>('EMPLOYEE');
  const [department, setDepartment] = useState('Engineering');
  const [jobTitle, setJobTitle] = useState('');

  // Password Form State
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');

  // Availability Override Form State
  const [overrideStatus, setOverrideStatus] = useState<string>('NONE');
  const [leaveUntil, setLeaveUntil] = useState<string>('');

  const { data: users = [], isLoading } = useQuery<any[]>({
    queryKey: ['users-management'],
    queryFn: () => api.getUsers(),
  });

  const isAllowed = currentUser.is_admin || currentUser.is_manager;

  const addEmployeeMutation = useMutation({
    mutationFn: async () => {
      if (!firstName.trim() || !lastName.trim() || !email.trim()) {
        throw new Error('First name, last name, and email are required');
      }
      if (!password || password.length < 6) {
        throw new Error('Password must be at least 6 characters');
      }
      return api.createUser({
        first_name: firstName.trim(),
        last_name: lastName.trim(),
        email: email.trim(),
        password,
        role,
        department,
        job_title: jobTitle.trim(),
      });
    },
    onSuccess: () => {
      toast.success('Employee created successfully');
      setIsAddOpen(false);
      setFirstName('');
      setLastName('');
      setEmail('');
      setPassword('');
      setJobTitle('');
      queryClient.invalidateQueries({ queryKey: ['users-management'] });
      queryClient.invalidateQueries({ queryKey: ['users'] });
      queryClient.invalidateQueries({ queryKey: ['employees-workload'] });
    },
    onError: (err: any) => {
      toast.error(err.message || 'Failed to create employee');
    },
  });

  const changePasswordMutation = useMutation({
    mutationFn: async () => {
      if (!newPassword || newPassword.length < 6) {
        throw new Error('Password must be at least 6 characters');
      }
      if (newPassword !== confirmPassword) {
        throw new Error('Passwords do not match');
      }
      return api.changeUserPassword(selectedUser.id, newPassword);
    },
    onSuccess: () => {
      toast.success('Password updated successfully');
      setIsPasswordOpen(false);
      setSelectedUser(null);
      setNewPassword('');
      setConfirmPassword('');
    },
    onError: (err: any) => {
      toast.error(err.message || 'Failed to update password');
    },
  });

  const deleteEmployeeMutation = useMutation({
    mutationFn: (userId: number) => api.deleteUser(userId),
    onSuccess: () => {
      toast.success('Employee removed successfully');
      queryClient.invalidateQueries({ queryKey: ['users-management'] });
      queryClient.invalidateQueries({ queryKey: ['users'] });
      queryClient.invalidateQueries({ queryKey: ['employees-workload'] });
    },
    onError: (err: any) => {
      toast.error(err.message || 'Failed to delete employee');
    },
  });

  const updateAvailabilityMutation = useMutation({
    mutationFn: async () => {
      const override = overrideStatus === 'NONE' ? null : overrideStatus;
      const leave = override ? (leaveUntil || null) : null;
      return api.updateAvailability(selectedUser.id, override, leave);
    },
    onSuccess: () => {
      toast.success('Availability updated successfully');
      setIsAvailabilityOpen(false);
      setSelectedUser(null);
      queryClient.invalidateQueries({ queryKey: ['users-management'] });
      queryClient.invalidateQueries({ queryKey: ['users'] });
      queryClient.invalidateQueries({ queryKey: ['employees-workload'] });
    },
    onError: (err: any) => {
      toast.error(err.message || 'Failed to update availability');
    },
  });

  if (!isAllowed) {
    return (
      <div className="bg-rose-50 dark:bg-rose-950/20 p-8 rounded-2xl border border-rose-200 dark:border-rose-900/40 text-center max-w-xl mx-auto my-12">
        <AlertTriangle className="w-8 h-8 text-rose-500 mx-auto mb-2" />
        <h2 className="text-base font-bold text-rose-800 dark:text-rose-300">Access Restricted</h2>
        <p className="text-xs text-rose-600 dark:text-rose-400 mt-1">
          Team and Access Management is available only for Administrators and Project Managers.
        </p>
      </div>
    );
  }

  // Admin authorization flag
  const isAdmin = Boolean(currentUser.is_admin || currentUser.role === 'ADMIN' || currentUser.role === 'admin' || currentUser.is_superuser);

  // Filter out Administrator account for non-admin viewers
  const visibleUsers = users.filter((u) => {
    if (!isAdmin) {
      const isSuper = u.is_superuser || (u.role && u.role.toUpperCase() === 'ADMIN') || (u.raw_role && u.raw_role.toUpperCase() === 'ADMIN') || u.username === 'admin';
      if (isSuper) return false;
    }
    return true;
  });

  // Summary Metrics
  const totalEmployees = visibleUsers.length;
  const managersCount = visibleUsers.filter((u) => {
    const r = (u.raw_role || u.role || '').toUpperCase();
    return r === 'MANAGER' || (isAdmin && r === 'ADMIN');
  }).length;
  const devCount = visibleUsers.filter((u) => {
    const r = (u.raw_role || u.role || '').toUpperCase();
    return r === 'EMPLOYEE' || r === 'DEVELOPER';
  }).length;
  const totalAllocations = visibleUsers.reduce((acc, u) => acc + (u.active_count || 0), 0);

  const filteredUsers = visibleUsers.filter((u) => {
    const nameMatch = (u.name || `${u.first_name || ''} ${u.last_name || ''}` || u.username || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
      (u.email || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
      (u.department || '').toLowerCase().includes(searchTerm.toLowerCase());
    const roleMatch = roleFilter === 'all' || (u.role || '').toUpperCase() === roleFilter.toUpperCase() || (u.raw_role || '').toUpperCase() === roleFilter.toUpperCase();
    return nameMatch && roleMatch;
  });

  const handleExcelClick = () => {
    if (excelInputRef.current) {
      excelInputRef.current.value = '';
      excelInputRef.current.click();
    }
  };

  const handleCsvClick = () => {
    if (csvInputRef.current) {
      csvInputRef.current.value = '';
      csvInputRef.current.click();
    }
  };

  const handleFileSelected = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsAnalyzing(true);
    const toastId = toast.loading(`Parsing ${file.name} and validating team roster...`);
    try {
      const data = await api.uploadTeamPreview(file);
      setUploadPreviewData(data);
      // Select all rows that are not invalid
      const initialSelected = new Set<number>(
        data.rows.filter((r: any) => r.status !== 'invalid').map((r: any) => r.row_index)
      );
      setSelectedRowIndices(initialSelected);
      setPreviewSearch('');
      setIsUploadPreviewOpen(true);
      toast.success(`Loaded ${data.total_rows} records from ${file.name}`, { id: toastId });
    } catch (err: any) {
      toast.error(err.message || 'Failed to parse file', { id: toastId });
    } finally {
      setIsAnalyzing(false);
      e.target.value = '';
    }
  };

  const handleConfirmImport = async () => {
    if (!uploadPreviewData) return;
    const selectedRows = uploadPreviewData.rows.filter((r: any) => selectedRowIndices.has(r.row_index));
    if (selectedRows.length === 0) {
      toast.error('Please select at least one team member to upload.');
      return;
    }

    setIsImporting(true);
    const toastId = toast.loading(`Uploading ${selectedRows.length} team members...`);
    try {
      const res = await api.confirmTeamUpload({
        rows: selectedRows,
        update_existing: updateExistingAccounts,
      });
      toast.success(res.message || `Successfully uploaded ${selectedRows.length} team members!`, { id: toastId });
      setIsUploadPreviewOpen(false);
      setUploadPreviewData(null);
      queryClient.invalidateQueries({ queryKey: ['users-management'] });
      queryClient.invalidateQueries({ queryKey: ['users'] });
      queryClient.invalidateQueries({ queryKey: ['employees-workload'] });
      queryClient.invalidateQueries({ queryKey: ['projects'] });
    } catch (err: any) {
      toast.error(err.message || 'Failed to upload team members', { id: toastId });
    } finally {
      setIsImporting(false);
    }
  };

  const previewRows = (uploadPreviewData?.rows || []).filter((r: any) => {
    if (!previewSearch.trim()) return true;
    const q = previewSearch.toLowerCase();
    return (
      (r.name || '').toLowerCase().includes(q) ||
      (r.email || '').toLowerCase().includes(q) ||
      (r.department || '').toLowerCase().includes(q) ||
      (r.job_title || '').toLowerCase().includes(q) ||
      (r.username || '').toLowerCase().includes(q) ||
      (r.role || '').toLowerCase().includes(q)
    );
  });

  const toggleSelectAll = () => {
    const allFilteredIndices = previewRows.map((r: any) => r.row_index);
    const allSelected = allFilteredIndices.every((idx: number) => selectedRowIndices.has(idx));
    const next = new Set(selectedRowIndices);
    if (allSelected) {
      allFilteredIndices.forEach((idx: number) => next.delete(idx));
    } else {
      allFilteredIndices.forEach((idx: number) => next.add(idx));
    }
    setSelectedRowIndices(next);
  };

  const toggleRowSelect = (index: number) => {
    const next = new Set(selectedRowIndices);
    if (next.has(index)) {
      next.delete(index);
    } else {
      next.add(index);
    }
    setSelectedRowIndices(next);
  };

  return (
    <div className="space-y-6">
      {/* Header Card */}
      <div className="bg-white dark:bg-[#0F1B30] p-6 rounded-2xl border border-slate-200 dark:border-[#1E2D4A] shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center space-x-2">
            <h1 className="text-xl font-bold text-slate-900 dark:text-white">Team & Access Management</h1>
            <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-blue-100 dark:bg-blue-950/70 text-blue-800 dark:text-blue-300 uppercase tracking-wide">
              Admin &amp; Manager
            </span>
          </div>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
            Provision company staff, manage role permissions, set availability overrides, and reset security credentials.
          </p>
        </div>

        {/* Action Buttons: Upload Excel, Upload CSV, Download Template, Add Employee */}
        <div className="flex flex-wrap items-center gap-2.5 shrink-0">
          {/* Hidden inputs */}
          <input
            type="file"
            ref={excelInputRef}
            onChange={handleFileSelected}
            accept=".xlsx, .xls"
            className="hidden"
          />
          <input
            type="file"
            ref={csvInputRef}
            onChange={handleFileSelected}
            accept=".csv"
            className="hidden"
          />

          {/* Upload Excel Button */}
          <button
            type="button"
            onClick={handleExcelClick}
            disabled={isAnalyzing}
            className="px-3.5 py-2 bg-emerald-600 hover:bg-emerald-700 active:scale-95 text-white font-semibold rounded-xl text-xs transition flex items-center space-x-1.5 shadow-xs cursor-pointer disabled:opacity-50"
            title="Upload team details from Excel file (.xlsx, .xls)"
          >
            {isAnalyzing ? (
              <RotateCw className="w-4 h-4 animate-spin" />
            ) : (
              <FileSpreadsheet className="w-4 h-4" />
            )}
            <span>Upload Excel</span>
          </button>

          {/* Upload CSV Button */}
          <button
            type="button"
            onClick={handleCsvClick}
            disabled={isAnalyzing}
            className="px-3.5 py-2 bg-sky-600 hover:bg-sky-700 active:scale-95 text-white font-semibold rounded-xl text-xs transition flex items-center space-x-1.5 shadow-xs cursor-pointer disabled:opacity-50"
            title="Upload team details from CSV file (.csv)"
          >
            {isAnalyzing ? (
              <RotateCw className="w-4 h-4 animate-spin" />
            ) : (
              <FileText className="w-4 h-4" />
            )}
            <span>Upload CSV</span>
          </button>

          {/* Download Template Dropdown */}
          <div className="relative group">
            <button
              type="button"
              className="px-2.5 py-2 bg-slate-100 hover:bg-slate-200 dark:bg-[#15223C] dark:hover:bg-[#1E2D4A] text-slate-700 dark:text-slate-300 rounded-xl text-xs font-medium transition flex items-center gap-1 shadow-xs cursor-pointer"
              title="Download sample import templates"
            >
              <Download className="w-3.5 h-3.5 text-slate-500" />
              <span className="hidden sm:inline text-[11px]">Template</span>
            </button>
            <div className="absolute right-0 top-full mt-1 hidden group-hover:flex flex-col bg-white dark:bg-[#0F1B30] border border-slate-200 dark:border-[#1E2D4A] rounded-xl shadow-xl p-1.5 w-48 z-40 text-xs">
              <button
                type="button"
                onClick={() => api.downloadTeamTemplate('excel')}
                className="text-left px-2.5 py-1.5 hover:bg-slate-50 dark:hover:bg-[#15223C] rounded-lg text-slate-700 dark:text-slate-200 flex items-center gap-2 cursor-pointer transition"
              >
                <FileSpreadsheet className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                <span>Excel Template (.xlsx)</span>
              </button>
              <button
                type="button"
                onClick={() => api.downloadTeamTemplate('csv')}
                className="text-left px-2.5 py-1.5 hover:bg-slate-50 dark:hover:bg-[#15223C] rounded-lg text-slate-700 dark:text-slate-200 flex items-center gap-2 cursor-pointer transition"
              >
                <FileText className="w-3.5 h-3.5 text-sky-600 shrink-0" />
                <span>CSV Template (.csv)</span>
              </button>
            </div>
          </div>

          {/* Add Employee Button */}
          <button
            type="button"
            onClick={() => setIsAddOpen(true)}
            className="px-4 py-2 bg-[#0174E7] hover:bg-blue-600 active:scale-95 text-white font-semibold rounded-xl text-xs transition flex items-center space-x-2 shadow-xs cursor-pointer shrink-0"
          >
            <UserPlus className="w-4 h-4" />
            <span>Add Employee</span>
          </button>
        </div>
      </div>

      {/* Metric Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <div className="bg-white dark:bg-[#0F1B30] p-4 rounded-xl border border-slate-200 dark:border-[#1E2D4A] shadow-2xs">
          <span className="text-[11px] font-semibold text-slate-400 flex items-center space-x-1.5">
            <Users className="w-3.5 h-3.5" />
            <span>Total Team</span>
          </span>
          <h4 className="text-xl font-extrabold text-slate-900 dark:text-white mt-1">{totalEmployees}</h4>
        </div>
        <div className="bg-white dark:bg-[#0F1B30] p-4 rounded-xl border border-slate-200 dark:border-[#1E2D4A] shadow-2xs">
          <span className="text-[11px] font-semibold text-slate-400 flex items-center space-x-1.5">
            <Shield className="w-3.5 h-3.5 text-blue-500" />
            <span>Managers &amp; Admins</span>
          </span>
          <h4 className="text-xl font-extrabold text-blue-600 dark:text-blue-400 mt-1">{managersCount}</h4>
        </div>
        <div className="bg-white dark:bg-[#0F1B30] p-4 rounded-xl border border-slate-200 dark:border-[#1E2D4A] shadow-2xs">
          <span className="text-[11px] font-semibold text-slate-400 flex items-center space-x-1.5">
            <Briefcase className="w-3.5 h-3.5 text-emerald-500" />
            <span>Staff &amp; Engineers</span>
          </span>
          <h4 className="text-xl font-extrabold text-emerald-600 dark:text-emerald-400 mt-1">{devCount}</h4>
        </div>
        <div className="bg-white dark:bg-[#0F1B30] p-4 rounded-xl border border-slate-200 dark:border-[#1E2D4A] shadow-2xs">
          <span className="text-[11px] font-semibold text-slate-400 flex items-center space-x-1.5">
            <UserCheck className="w-3.5 h-3.5 text-purple-500" />
            <span>Active Allocations</span>
          </span>
          <h4 className="text-xl font-extrabold text-purple-600 dark:text-purple-400 mt-1">{totalAllocations}</h4>
        </div>
      </div>

      {/* Filters Bar */}
      <div className="bg-white dark:bg-[#0F1B30] p-4 rounded-xl border border-slate-200 dark:border-[#1E2D4A] shadow-xs flex flex-wrap gap-3 items-center justify-between">
        <div className="relative flex-1 min-w-[240px]">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            placeholder="Search team member by name, email, department..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-9 pr-4 py-2 bg-slate-50 dark:bg-[#15223C] border border-slate-200 dark:border-[#253554] rounded-xl text-xs text-slate-900 dark:text-white placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-[#0174E7]"
          />
        </div>

        <select
          value={roleFilter}
          onChange={(e) => setRoleFilter(e.target.value)}
          className="px-3 py-2 bg-slate-50 dark:bg-[#15223C] border border-slate-200 dark:border-[#253554] rounded-xl text-xs text-slate-700 dark:text-slate-300 focus:outline-none focus:ring-2 focus:ring-[#0174E7]"
        >
          <option value="all">All Roles ({visibleUsers.length})</option>
          {isAdmin && <option value="ADMIN">Admins</option>}
          <option value="MANAGER">Project Managers</option>
          <option value="EMPLOYEE">Employees</option>
        </select>
      </div>

      {/* Users Table */}
      <div className="bg-white dark:bg-[#0F1B30] rounded-2xl border border-slate-200 dark:border-[#1E2D4A] shadow-xs overflow-hidden flex flex-col">
        <div className="overflow-x-auto overflow-y-auto max-h-[calc(100vh-320px)] min-h-[350px] custom-scrollbar">
          <table className="w-full text-left border-collapse text-xs">
            <thead className="sticky top-0 z-10 bg-slate-50 dark:bg-[#15223C] shadow-xs">
              <tr className="text-slate-500 dark:text-slate-400 border-b border-slate-200 dark:border-[#1E2D4A] font-semibold">
                <th className="py-3 px-4">Employee</th>
                <th className="py-3 px-4">Role</th>
                <th className="py-3 px-4">Department &amp; Title</th>
                <th className="py-3 px-4">Availability</th>
                <th className="py-3 px-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-[#1E2D4A]">
              {isLoading ? (
                <tr>
                  <td colSpan={5} className="py-8 text-center text-slate-400">
                    Loading team roster...
                  </td>
                </tr>
              ) : filteredUsers.length === 0 ? (
                <tr>
                  <td colSpan={5} className="py-8 text-center text-slate-400">
                    No matching employees found.
                  </td>
                </tr>
              ) : (
                filteredUsers.map((u) => {
                  const initials = u.avatar_initials || u.initials || 'EM';
                  const roleUpper = (u.role || 'EMPLOYEE').toUpperCase();
                  const roleBadgeColor =
                    roleUpper === 'ADMIN'
                      ? 'bg-purple-100 text-purple-800 dark:bg-purple-950/60 dark:text-purple-300'
                      : roleUpper === 'MANAGER'
                        ? 'bg-blue-100 text-blue-800 dark:bg-blue-950/60 dark:text-blue-300'
                        : 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300';

                  return (
                    <tr key={u.id} className="hover:bg-slate-50/60 dark:hover:bg-[#15223C]/50 transition">
                      <td className="py-3 px-4">
                        <div className="flex items-center space-x-3">
                          <div className="w-8 h-8 rounded-full bg-gradient-to-tr from-[#0B1F5C] to-[#1E7BE0] text-white flex items-center justify-center font-bold text-[11px] shrink-0">
                            {initials}
                          </div>
                          <div>
                            <div className="font-bold text-slate-900 dark:text-white">
                              {u.name || `${u.first_name || ''} ${u.last_name || ''}`.trim() || u.username}
                            </div>
                            <div className="text-[11px] text-slate-500 dark:text-slate-400">{u.email}</div>
                          </div>
                        </div>
                      </td>
                      <td className="py-3 px-4">
                        <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider ${roleBadgeColor}`}>
                          {roleUpper}
                        </span>
                      </td>
                      <td className="py-3 px-4">
                        <div className="font-medium text-slate-800 dark:text-slate-200">{u.department || 'General'}</div>
                        <div className="text-[11px] text-slate-500">{u.job_title || 'Software Engineer'}</div>
                      </td>
                      <td className="py-3 px-4">
                        <div className="flex items-center space-x-2">
                          <AvailabilityBadge
                            status={u.status}
                            activeCount={u.active_count}
                            override={u.availability_override}
                            leaveUntil={u.leave_until}
                          />
                          <button
                            onClick={() => {
                              setSelectedUser(u);
                              setOverrideStatus(u.availability_override || 'NONE');
                              setLeaveUntil(u.leave_until || '');
                              setIsAvailabilityOpen(true);
                            }}
                            className="p-1.5 rounded-lg bg-blue-600 hover:bg-blue-700 text-white shadow-2xs transition cursor-pointer flex items-center justify-center"
                            title="Edit availability status"
                            aria-label="Edit availability status"
                          >
                            <Calendar className="w-3.5 h-3.5 text-white" />
                          </button>
                        </div>
                      </td>
                      <td className="py-3 px-4 text-right">
                        <div className="flex items-center justify-end space-x-1.5">
                          <button
                            onClick={() => {
                              setSelectedUser(u);
                              setNewPassword('');
                              setConfirmPassword('');
                              setIsPasswordOpen(true);
                            }}
                            className="px-2.5 py-1.5 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 rounded-lg text-[11px] font-semibold transition flex items-center space-x-1 cursor-pointer"
                            title="Reset Password"
                          >
                            <Key className="w-3.5 h-3.5" />
                            <span>Password</span>
                          </button>

                          {currentUser.id !== u.id && (
                            <button
                              onClick={() => {
                                if (confirm(`Are you sure you want to delete employee "${u.name || u.email}"?`)) {
                                  deleteEmployeeMutation.mutate(u.id);
                                }
                              }}
                              className="p-1.5 text-slate-400 hover:text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-950/30 rounded-lg transition cursor-pointer"
                              title="Delete Employee"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Add Employee Modal */}
      {isAddOpen && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white dark:bg-[#0F1B30] w-full max-w-lg rounded-2xl border border-slate-200 dark:border-[#1E2D4A] shadow-xl p-6 space-y-4">
            <h2 className="text-base font-bold text-slate-900 dark:text-white">Add New Employee</h2>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-[11px] font-semibold text-slate-700 dark:text-slate-300 mb-1">First Name *</label>
                <input
                  type="text"
                  value={firstName}
                  onChange={(e) => setFirstName(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-50 dark:bg-[#15223C] border border-slate-200 dark:border-[#253554] rounded-xl text-xs text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-[#0174E7]"
                />
              </div>
              <div>
                <label className="block text-[11px] font-semibold text-slate-700 dark:text-slate-300 mb-1">Last Name *</label>
                <input
                  type="text"
                  value={lastName}
                  onChange={(e) => setLastName(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-50 dark:bg-[#15223C] border border-slate-200 dark:border-[#253554] rounded-xl text-xs text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-[#0174E7]"
                />
              </div>
            </div>

            <div>
              <label className="block text-[11px] font-semibold text-slate-700 dark:text-slate-300 mb-1">Company Email *</label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="employee@aisamrat.com"
                className="w-full px-3 py-2 bg-slate-50 dark:bg-[#15223C] border border-slate-200 dark:border-[#253554] rounded-xl text-xs text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-[#0174E7]"
              />
            </div>

            <div>
              <label className="block text-[11px] font-semibold text-slate-700 dark:text-slate-300 mb-1">Initial Password * (min 6 chars)</label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full px-3 py-2 bg-slate-50 dark:bg-[#15223C] border border-slate-200 dark:border-[#253554] rounded-xl text-xs text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-[#0174E7]"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-[11px] font-semibold text-slate-700 dark:text-slate-300 mb-1">Role *</label>
                <select
                  value={role}
                  onChange={(e) => setRole(e.target.value as any)}
                  className="w-full px-3 py-2 bg-slate-50 dark:bg-[#15223C] border border-slate-200 dark:border-[#253554] rounded-xl text-xs text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-[#0174E7]"
                >
                  <option value="EMPLOYEE">Employee</option>
                  <option value="MANAGER">Project Manager</option>
                  {isAdmin && <option value="ADMIN">Administrator</option>}
                </select>
              </div>

              <div>
                <label className="block text-[11px] font-semibold text-slate-700 dark:text-slate-300 mb-1">Department</label>
                <input
                  type="text"
                  value={department}
                  onChange={(e) => setDepartment(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-50 dark:bg-[#15223C] border border-slate-200 dark:border-[#253554] rounded-xl text-xs text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-[#0174E7]"
                />
              </div>
            </div>

            <div>
              <label className="block text-[11px] font-semibold text-slate-700 dark:text-slate-300 mb-1">Job Title</label>
              <input
                type="text"
                value={jobTitle}
                onChange={(e) => setJobTitle(e.target.value)}
                placeholder="Senior Full Stack Engineer"
                className="w-full px-3 py-2 bg-slate-50 dark:bg-[#15223C] border border-slate-200 dark:border-[#253554] rounded-xl text-xs text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-[#0174E7]"
              />
            </div>

            <div className="pt-3 flex justify-end space-x-2 border-t border-slate-100 dark:border-[#1E2D4A]">
              <button
                type="button"
                onClick={() => setIsAddOpen(false)}
                className="px-4 py-2 text-xs font-semibold text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl transition cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => addEmployeeMutation.mutate()}
                disabled={addEmployeeMutation.isPending}
                className="px-4 py-2 bg-[#0174E7] hover:bg-blue-600 active:scale-95 text-white font-semibold rounded-xl text-xs transition disabled:opacity-50 cursor-pointer"
              >
                {addEmployeeMutation.isPending ? 'Saving...' : 'Add Employee'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Password Reset Modal */}
      {isPasswordOpen && selectedUser && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white dark:bg-[#0F1B30] w-full max-w-sm rounded-2xl border border-slate-200 dark:border-[#1E2D4A] shadow-xl p-6 space-y-4">
            <h2 className="text-base font-bold text-slate-900 dark:text-white">
              Reset Password: {selectedUser.name || selectedUser.email}
            </h2>

            <div className="space-y-3">
              <div>
                <label className="block text-[11px] font-semibold text-slate-700 dark:text-slate-300 mb-1">New Password (min 6 chars)</label>
                <input
                  type="password"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-50 dark:bg-[#15223C] border border-slate-200 dark:border-[#253554] rounded-xl text-xs text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-[#0174E7]"
                />
              </div>

              <div>
                <label className="block text-[11px] font-semibold text-slate-700 dark:text-slate-300 mb-1">Confirm New Password</label>
                <input
                  type="password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-50 dark:bg-[#15223C] border border-slate-200 dark:border-[#253554] rounded-xl text-xs text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-[#0174E7]"
                />
              </div>
            </div>

            <div className="pt-3 flex justify-end space-x-2 border-t border-slate-100 dark:border-[#1E2D4A]">
              <button
                type="button"
                onClick={() => {
                  setIsPasswordOpen(false);
                  setSelectedUser(null);
                }}
                className="px-4 py-2 text-xs font-semibold text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl transition cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => changePasswordMutation.mutate()}
                disabled={changePasswordMutation.isPending}
                className="px-4 py-2 bg-[#0174E7] hover:bg-blue-600 active:scale-95 text-white font-semibold rounded-xl text-xs transition disabled:opacity-50 cursor-pointer"
              >
                {changePasswordMutation.isPending ? 'Updating...' : 'Update Password'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Availability Override Modal */}
      {isAvailabilityOpen && selectedUser && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white dark:bg-[#0F1B30] w-full max-w-sm rounded-2xl border border-slate-200 dark:border-[#1E2D4A] shadow-xl p-6 space-y-4">
            <h2 className="text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
              <span className="w-6 h-6 rounded-md bg-blue-600 text-white flex items-center justify-center shadow-2xs shrink-0">
                <Calendar className="w-3.5 h-3.5 text-white" />
              </span>
              <span>Set Availability: {selectedUser.name || selectedUser.email}</span>
            </h2>

            <div className="space-y-3">
              <div>
                <label className="block text-[11px] font-semibold text-slate-700 dark:text-slate-300 mb-1">Status Override</label>
                <select
                  value={overrideStatus}
                  onChange={(e) => setOverrideStatus(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-50 dark:bg-[#15223C] border border-slate-200 dark:border-[#253554] rounded-xl text-xs text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-[#0174E7]"
                >
                  <option value="NONE">Computed automatically from active projects</option>
                  <option value="ON_LEAVE">On Leave</option>
                  <option value="AWAY">Away</option>
                </select>
              </div>

              {overrideStatus !== 'NONE' && (
                <div>
                  <label className="block text-[11px] font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Leave Until (optional)
                  </label>
                  <input
                    type="date"
                    value={leaveUntil}
                    onChange={(e) => setLeaveUntil(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-50 dark:bg-[#15223C] border border-slate-200 dark:border-[#253554] rounded-xl text-xs text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-[#0174E7]"
                  />
                </div>
              )}
            </div>

            <div className="pt-3 flex justify-end space-x-2 border-t border-slate-100 dark:border-[#1E2D4A]">
              <button
                type="button"
                onClick={() => {
                  setIsAvailabilityOpen(false);
                  setSelectedUser(null);
                }}
                className="px-4 py-2 text-xs font-semibold text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl transition cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => updateAvailabilityMutation.mutate()}
                disabled={updateAvailabilityMutation.isPending}
                className="px-4 py-2 bg-[#0174E7] hover:bg-blue-600 active:scale-95 text-white font-semibold rounded-xl text-xs transition disabled:opacity-50 cursor-pointer"
              >
                {updateAvailabilityMutation.isPending ? 'Saving...' : 'Save Availability'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Review & Confirm Team Upload Modal (Excel & CSV) */}
      {isUploadPreviewOpen && uploadPreviewData && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-6 animate-in fade-in duration-150">
          <div className="bg-white dark:bg-[#0F1B30] w-full max-w-5xl max-h-[90vh] rounded-2xl border border-slate-200 dark:border-[#1E2D4A] shadow-2xl flex flex-col overflow-hidden animate-in zoom-in-95 duration-150">
            {/* Modal Header */}
            <div className="p-5 border-b border-slate-200 dark:border-[#1E2D4A] flex items-center justify-between shrink-0 bg-slate-50/50 dark:bg-[#15223C]/40">
              <div className="flex items-center space-x-3">
                <div
                  className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 shadow-xs ${uploadPreviewData.file_type === 'Excel'
                      ? 'bg-emerald-50 dark:bg-emerald-950/40 text-emerald-600 border border-emerald-200 dark:border-emerald-900/60'
                      : 'bg-sky-50 dark:bg-sky-950/40 text-sky-600 border border-sky-200 dark:border-sky-900/60'
                    }`}
                >
                  {uploadPreviewData.file_type === 'Excel' ? (
                    <FileSpreadsheet className="w-5 h-5" />
                  ) : (
                    <FileText className="w-5 h-5" />
                  )}
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h2 className="text-base font-bold text-slate-900 dark:text-white">
                      Review &amp; Confirm Team Upload
                    </h2>
                    <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700">
                      {uploadPreviewData.file_type} File
                    </span>
                  </div>
                  <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
                    File: <span className="font-semibold text-slate-700 dark:text-slate-300 font-mono">{uploadPreviewData.filename}</span> &bull; {uploadPreviewData.total_rows} total rows detected
                  </p>
                </div>
              </div>

              <button
                type="button"
                onClick={() => {
                  setIsUploadPreviewOpen(false);
                  setUploadPreviewData(null);
                }}
                className="p-1.5 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 transition cursor-pointer"
                title="Close"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Status Pills & Controls */}
            <div className="p-4 bg-slate-50/80 dark:bg-[#121E36] border-b border-slate-200 dark:border-[#1E2D4A] shrink-0 space-y-3">
              <div className="flex flex-wrap items-center justify-between gap-3">
                {/* Metric Badges */}
                <div className="flex flex-wrap items-center gap-2 text-xs">
                  <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-lg bg-white dark:bg-[#1A2844] border border-slate-200 dark:border-[#253554] font-semibold text-slate-700 dark:text-slate-200 shadow-2xs">
                    <Users className="w-3.5 h-3.5 text-slate-400" />
                    <span>Total Rows: <b>{uploadPreviewData.total_rows}</b></span>
                  </span>
                  <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-lg bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-900/60 font-semibold text-emerald-700 dark:text-emerald-300 shadow-2xs">
                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" />
                    <span>Ready to Add: <b>{uploadPreviewData.valid_count}</b></span>
                  </span>
                  {uploadPreviewData.existing_count > 0 && (
                    <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-lg bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-900/60 font-semibold text-amber-700 dark:text-amber-300 shadow-2xs">
                      <AlertTriangle className="w-3.5 h-3.5 text-amber-500" />
                      <span>Existing Accounts: <b>{uploadPreviewData.existing_count}</b></span>
                    </span>
                  )}
                  <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-lg bg-blue-50 dark:bg-blue-950/40 border border-blue-200 dark:border-blue-900/60 font-semibold text-blue-700 dark:text-blue-300 shadow-2xs">
                    <Check className="w-3.5 h-3.5 text-blue-500" />
                    <span>Selected: <b>{selectedRowIndices.size}</b></span>
                  </span>
                </div>

                {/* Option: Update existing accounts */}
                <label className="flex items-center gap-2 text-xs text-slate-700 dark:text-slate-300 cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={updateExistingAccounts}
                    onChange={(e) => setUpdateExistingAccounts(e.target.checked)}
                    className="w-4 h-4 rounded text-blue-600 focus:ring-blue-500 border-slate-300"
                  />
                  <span>Update existing users if email or username matches</span>
                </label>
              </div>

              {/* Search & Selection Filter Bar */}
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="relative flex-1 min-w-[220px]">
                  <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                  <input
                    type="text"
                    value={previewSearch}
                    onChange={(e) => setPreviewSearch(e.target.value)}
                    placeholder="Search rows in preview by name, email, department, role..."
                    className="w-full pl-8 pr-3 py-1.5 bg-white dark:bg-[#15223C] border border-slate-200 dark:border-[#253554] rounded-lg text-xs text-slate-900 dark:text-white placeholder:text-slate-400 focus:outline-none focus:ring-1 focus:ring-[#0174E7]"
                  />
                </div>

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={toggleSelectAll}
                    className="px-2.5 py-1.5 bg-white dark:bg-[#1A2844] hover:bg-slate-100 dark:hover:bg-[#253554] border border-slate-200 dark:border-[#253554] rounded-lg text-xs font-semibold text-slate-700 dark:text-slate-200 transition cursor-pointer"
                  >
                    {previewRows.every((r: any) => selectedRowIndices.has(r.row_index))
                      ? 'Deselect All'
                      : 'Select All Visible'}
                  </button>
                </div>
              </div>
            </div>

            {/* Scrollable Preview Table Area */}
            <div className="flex-1 overflow-x-auto overflow-y-auto max-h-[48vh] custom-scrollbar p-3">
              <table className="w-full text-left border-collapse text-xs">
                <thead className="sticky top-0 z-10 bg-slate-100 dark:bg-[#15223C] shadow-xs">
                  <tr className="text-slate-500 dark:text-slate-400 border-b border-slate-200 dark:border-[#1E2D4A] font-semibold">
                    <th className="py-2.5 px-3 w-10 text-center">
                      <input
                        type="checkbox"
                        checked={previewRows.length > 0 && previewRows.every((r: any) => selectedRowIndices.has(r.row_index))}
                        onChange={toggleSelectAll}
                        className="w-3.5 h-3.5 rounded text-blue-600 focus:ring-blue-500 border-slate-300 cursor-pointer"
                      />
                    </th>
                    <th className="py-2.5 px-3">#</th>
                    <th className="py-2.5 px-3">Member Name</th>
                    <th className="py-2.5 px-3">Email</th>
                    <th className="py-2.5 px-3">Role</th>
                    <th className="py-2.5 px-3">Department &amp; Title</th>
                    <th className="py-2.5 px-3">Username</th>
                    <th className="py-2.5 px-3">Initial Password</th>
                    <th className="py-2.5 px-3">Upload Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-[#1E2D4A]">
                  {previewRows.length === 0 ? (
                    <tr>
                      <td colSpan={9} className="py-8 text-center text-slate-400">
                        No rows match your filter.
                      </td>
                    </tr>
                  ) : (
                    previewRows.map((r: any) => {
                      const isSelected = selectedRowIndices.has(r.row_index);
                      const isExisting = r.is_existing;
                      const isInvalid = r.status === 'invalid';

                      return (
                        <tr
                          key={r.row_index}
                          className={`transition ${isSelected
                              ? 'bg-blue-50/40 dark:bg-blue-950/20 hover:bg-blue-50/70 dark:hover:bg-blue-950/30'
                              : 'opacity-60 hover:opacity-100 hover:bg-slate-50 dark:hover:bg-[#15223C]/50'
                            }`}
                        >
                          <td className="py-2.5 px-3 text-center">
                            <input
                              type="checkbox"
                              checked={isSelected}
                              onChange={() => toggleRowSelect(r.row_index)}
                              className="w-3.5 h-3.5 rounded text-blue-600 focus:ring-blue-500 border-slate-300 cursor-pointer"
                            />
                          </td>
                          <td className="py-2.5 px-3 font-mono text-[11px] text-slate-400">
                            {r.row_index}
                          </td>
                          <td className="py-2.5 px-3">
                            <div className="font-bold text-slate-900 dark:text-white">
                              {r.name}
                            </div>
                            {r.first_name && r.last_name && (
                              <div className="text-[10px] text-slate-400">
                                {r.first_name} &bull; {r.last_name}
                              </div>
                            )}
                          </td>
                          <td className="py-2.5 px-3 font-mono text-[11px] text-slate-700 dark:text-slate-300">
                            {r.email || (
                              <span className="text-amber-500 italic">auto-generated</span>
                            )}
                          </td>
                          <td className="py-2.5 px-3">
                            <span
                              className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider ${r.role === 'ADMIN'
                                  ? 'bg-purple-100 text-purple-800 dark:bg-purple-950/60 dark:text-purple-300'
                                  : r.role === 'MANAGER'
                                    ? 'bg-blue-100 text-blue-800 dark:bg-blue-950/60 dark:text-blue-300'
                                    : 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300'
                                }`}
                            >
                              {r.role}
                            </span>
                          </td>
                          <td className="py-2.5 px-3">
                            <div className="font-medium text-slate-800 dark:text-slate-200">
                              {r.department || 'Engineering'}
                            </div>
                            <div className="text-[10px] text-slate-400">
                              {r.job_title || 'Software Engineer'}
                            </div>
                          </td>
                          <td className="py-2.5 px-3 font-mono text-[11px] text-slate-700 dark:text-slate-300">
                            {r.username}
                          </td>
                          <td className="py-2.5 px-3 font-mono text-[10px] text-slate-500">
                            {r.initial_password}
                          </td>
                          <td className="py-2.5 px-3">
                            {isInvalid ? (
                              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-semibold bg-rose-50 text-rose-700 dark:bg-rose-950/40 dark:text-rose-300 border border-rose-200 dark:border-rose-900/60">
                                <AlertTriangle className="w-3 h-3 text-rose-500" />
                                <span>Incomplete</span>
                              </span>
                            ) : isExisting ? (
                              <span
                                className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-semibold bg-amber-50 text-amber-700 dark:bg-amber-950/40 dark:text-amber-300 border border-amber-200 dark:border-amber-900/60"
                                title={r.status_message}
                              >
                                <Check className="w-3 h-3 text-amber-500" />
                                <span>Update Existing</span>
                              </span>
                            ) : (
                              <span
                                className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-semibold bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-900/60"
                                title={r.status_message}
                              >
                                <CheckCircle2 className="w-3 h-3 text-emerald-500" />
                                <span>New Member</span>
                              </span>
                            )}
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>

            {/* Modal Footer */}
            <div className="p-4 border-t border-slate-200 dark:border-[#1E2D4A] bg-slate-50/50 dark:bg-[#15223C]/40 flex flex-wrap items-center justify-between gap-3 shrink-0">
              <div className="text-[11px] text-slate-500 dark:text-slate-400">
                Ready to upload <span className="font-bold text-slate-900 dark:text-white">{selectedRowIndices.size}</span> selected member{selectedRowIndices.size === 1 ? '' : 's'} into team management details.
              </div>

              <div className="flex items-center space-x-2">
                <button
                  type="button"
                  onClick={() => {
                    setIsUploadPreviewOpen(false);
                    setUploadPreviewData(null);
                  }}
                  className="px-4 py-2 text-xs font-semibold text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl transition cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleConfirmImport}
                  disabled={isImporting || selectedRowIndices.size === 0}
                  className="px-5 py-2 bg-[#0174E7] hover:bg-blue-600 active:scale-95 text-white font-bold rounded-xl text-xs transition flex items-center space-x-2 shadow-xs cursor-pointer disabled:opacity-50 disabled:pointer-events-none"
                >
                  {isImporting ? (
                    <>
                      <RotateCw className="w-3.5 h-3.5 animate-spin" />
                      <span>Uploading to Team...</span>
                    </>
                  ) : (
                    <>
                      <Check className="w-4 h-4" />
                      <span>Confirm &amp; Upload ({selectedRowIndices.size} Members)</span>
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
