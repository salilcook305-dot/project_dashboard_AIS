import React from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { api } from '../lib/api';
import { TeamDirectory } from '../components/TeamDirectory';
import { EmployeeOption } from '../components/EmployeeSearchCombobox';
import { Project } from '../types';
import { useCurrentUser } from '../components/ProtectedRoute';

export const TeamDirectoryPage: React.FC = () => {
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const { user: currentUser } = useCurrentUser();
  const isAdmin = Boolean(currentUser?.is_admin || currentUser?.role === 'ADMIN' || currentUser?.role === 'admin' || currentUser?.is_superuser);

  const { data: users = [], isLoading: isUsersLoading } = useQuery({
    queryKey: ['users'],
    queryFn: () => api.getUsers(),
  });

  const { data: projects = [], isLoading: isProjectsLoading } = useQuery<Project[]>({
    queryKey: ['projects'],
    queryFn: () => api.getProjects(),
  });

  const employeeOptions: EmployeeOption[] = users
    .filter((u: any) => {
      if (!isAdmin) {
        const isSuper = u.is_superuser || (u.role && u.role.toUpperCase() === 'ADMIN') || (u.raw_role && u.raw_role.toUpperCase() === 'ADMIN') || u.username === 'admin';
        if (isSuper) return false;
      }
      return true;
    })
    .map((u: any) => ({
      id: u.id,
      name: u.name || `${u.first_name || ''} ${u.last_name || ''}`.trim() || u.username,
      email: u.email,
      job_title: u.job_title,
      department: u.department,
      avatar_initials: u.avatar_initials || u.initials || 'EM',
      role: u.role,
      active_count: u.active_count ?? 0,
      status: u.status,
      availability_override: u.availability_override,
      leave_until: u.leave_until,
    }));

  const handleRefresh = () => {
    queryClient.invalidateQueries({ queryKey: ['users'] });
    queryClient.invalidateQueries({ queryKey: ['projects'] });
  };

  const handleSelectProject = (projectName: string) => {
    navigate(`/?search=${encodeURIComponent(projectName)}`);
  };

  return (
    <div className="p-6">
      <TeamDirectory
        employees={employeeOptions}
        projects={projects}
        isLoading={isUsersLoading || isProjectsLoading}
        onRefresh={handleRefresh}
        onSelectProject={handleSelectProject}
      />
    </div>
  );
};
