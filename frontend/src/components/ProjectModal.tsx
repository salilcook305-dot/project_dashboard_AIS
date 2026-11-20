import React, { useState, useEffect } from 'react';
import { useForm, useFieldArray } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { X, Users, Trash2, LoaderCircle } from 'lucide-react';
import { toast } from 'sonner';
import { api } from '../lib/api';
import { Project } from '../types';
import { EmployeeSearchCombobox, EmployeeOption } from './EmployeeSearchCombobox';

const projectSchema = z.object({
  name: z.string().min(1, 'Project name is required'),
  description: z.string().optional().default(''),
  start_date: z.string().min(1, 'Start date is required'),
  end_date: z.string().min(1, 'End date is required'),
  status: z.string().default('Planning'),
  project_manager_id: z.number().nullable().optional(),
  poc_id: z.number().nullable().optional(),
  members: z.array(
    z.object({
      employee_id: z.number(),
      role_on_project: z.string().default('Developer'),
    })
  ).default([]),
});

type ProjectFormData = z.infer<typeof projectSchema>;

interface ProjectModalProps {
  isOpen: boolean;
  onClose: () => void;
  project: Project | null;
  onSuccess: () => void;
}

export const ProjectModal: React.FC<ProjectModalProps> = ({
  isOpen,
  onClose,
  project,
  onSuccess,
}) => {
  const [employees, setEmployees] = useState<EmployeeOption[]>([]);
  const [empLoading, setEmpLoading] = useState(false);
  const [empError, setEmpError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  const isEdit = !!project;

  const {
    register,
    handleSubmit,
    control,
    reset,
    formState: { errors },
  } = useForm<ProjectFormData>({
    resolver: zodResolver(projectSchema),
    defaultValues: {
      name: '',
      description: '',
      start_date: '',
      end_date: '',
      status: 'In Progress',
      project_manager_id: null,
      poc_id: null,
      members: [],
    },
  });

  const { fields, append, remove } = useFieldArray({
    control,
    name: 'members',
  });

  const loadEmployees = () => {
    setEmpLoading(true);
    setEmpError(null);
    api.getEmployees()
      .then(data => {
        setEmployees(data);
        setEmpLoading(false);
      })
      .catch((err: any) => {
        setEmpError(err?.message || 'Failed to load employees.');
        setEmpLoading(false);
      });
  };

  useEffect(() => {
    if (isOpen) {
      loadEmployees();
    }
  }, [isOpen]);

  useEffect(() => {
    if (isOpen) {
      setSubmitError(null);
      if (project) {
        reset({
          name: project.title || (project as any).name || '',
          description: project.description || '',
          start_date: project.start_date,
          end_date: project.end_date,
          status: project.status || 'In Progress',
          project_manager_id: project.manager || (project as any).project_manager?.id || null,
          poc_id: project.poc?.id || null,
          members: (project.team || []).map((m: any) => ({
            employee_id: m.employee_id || m.employee || m.user_id,
            role_on_project: m.role_on_project || m.project_role || 'Developer',
          })),
        });
      } else {
        const today = new Date().toISOString().split('T')[0];
        reset({
          name: '',
          description: '',
          start_date: today,
          end_date: today,
          status: 'In Progress',
          project_manager_id: null,
          poc_id: null,
          members: [],
        });
      }
    }
  }, [isOpen, project, reset]);

  if (!isOpen) return null;

  const onSubmit = async (data: ProjectFormData) => {
    setIsSubmitting(true);
    setSubmitError(null);
    try {
      const payload = {
        name: data.name,
        description: data.description,
        start_date: data.start_date,
        end_date: data.end_date,
        status: data.status,
        project_manager_id: data.project_manager_id,
        poc_id: data.poc_id ? Number(data.poc_id) : null,
        team: data.members.map(m => ({
          user_id: m.employee_id,
          role: m.role_on_project,
        })),
      };

      if (isEdit && project) {
        await api.updateProject(project.id, payload);
        toast.success(`Project "${data.name}" updated successfully`);
      } else {
        await api.createProject(payload);
        toast.success(`Project "${data.name}" created successfully`);
      }
      onSuccess();
      onClose();
    } catch (err: any) {
      const msg = err.message || 'Failed to save project.';
      setSubmitError(msg);
      toast.error(msg);
    } finally {
      setIsSubmitting(false);
    }
  };

  const assignedEmployeeIds = fields.map(f => f.employee_id);

  const getMemberDisplay = (employeeId: number) => {
    const active = employees.find(e => e.id === employeeId);
    if (active) return active;
    // Fallback to project team data if available
    const existingTeam = project?.team?.find(
      (m: any) => (m.employee_id || m.employee) === employeeId
    );
    if (existingTeam) {
      return {
        id: employeeId,
        username: (existingTeam as any).username || `emp_${employeeId}`,
        name: (existingTeam as any).name || (existingTeam as any).full_name || `Employee #${employeeId}`,
        initials: (existingTeam as any).initials || 'EM',
        job_title: (existingTeam as any).job_title,
        department: (existingTeam as any).department,
      };
    }
    return {
      id: employeeId,
      username: `emp_${employeeId}`,
      name: `Employee #${employeeId}`,
      initials: 'EM',
    };
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm overflow-y-auto animate-in fade-in duration-150">
      <div className="bg-white dark:bg-slate-900 rounded-xl shadow-2xl border border-slate-200 dark:border-slate-800 w-full max-w-2xl my-8 overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200 dark:border-slate-800 bg-brand-surface dark:bg-slate-900/60">
          <h3 className="font-semibold text-slate-900 dark:text-slate-100 text-base">
            {isEdit ? 'Edit Project' : 'Create New Project'}
          </h3>
          <button
            onClick={onClose}
            className="p-1 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit(onSubmit)} className="p-6 space-y-4 max-h-[75vh] overflow-y-auto">
          {submitError && (
            <div className="p-3 text-xs bg-red-50 dark:bg-red-950/30 text-red-700 dark:text-red-400 border border-red-200 dark:border-red-900/50 rounded-lg">
              {submitError}
            </div>
          )}

          <div>
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
              Project Name <span className="text-red-500">*</span>
            </label>
            <input
              {...register('name')}
              type="text"
              placeholder="e.g. Enterprise AI Copilot Platform"
              className="w-full px-3 py-2 text-xs rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-brand-royal"
            />
            {errors.name && (
              <p className="text-[11px] text-red-500 mt-1">{errors.name.message}</p>
            )}
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
              Description
            </label>
            <textarea
              {...register('description')}
              rows={3}
              placeholder="Provide a high-level summary of goals and objectives..."
              className="w-full px-3 py-2 text-xs rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-brand-royal"
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                Start Date <span className="text-red-500">*</span>
              </label>
              <input
                {...register('start_date')}
                type="date"
                className="w-full px-3 py-2 text-xs rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-brand-royal"
              />
              {errors.start_date && (
                <p className="text-[11px] text-red-500 mt-1">{errors.start_date.message}</p>
              )}
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                End Date <span className="text-red-500">*</span>
              </label>
              <input
                {...register('end_date')}
                type="date"
                className="w-full px-3 py-2 text-xs rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-brand-royal"
              />
              {errors.end_date && (
                <p className="text-[11px] text-red-500 mt-1">{errors.end_date.message}</p>
              )}
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                Status <span className="text-red-500">*</span>
              </label>
              <select
                {...register('status')}
                className="w-full px-3 py-2 text-xs rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-brand-royal"
              >
                <option value="Planning">Planning</option>
                <option value="In Progress">In Progress</option>
                <option value="Completed">Completed</option>
                <option value="Cancelled">Cancelled</option>
                <option value="On Hold">On Hold</option>
              </select>
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                Project Manager
              </label>
              <select
                {...register('project_manager_id', {
                  setValueAs: v => (v === '' ? null : Number(v)),
                })}
                className="w-full px-3 py-2 text-xs rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-brand-royal"
              >
                <option value="">Unassigned</option>
                {(() => {
                  const pms = employees.filter(e => {
                    const norm = `${e.name || ''} ${e.username || ''} ${e.email || ''}`.toLowerCase();
                    return (
                      norm.includes('deepak') ||
                      norm.includes('megha') ||
                      (e as any).role === 'project_manager' ||
                      (e as any).raw_role === 'MANAGER' ||
                      (e as any).role === 'MANAGER'
                    );
                  });
                  const list = pms.length > 0 ? pms : employees;
                  return list.map(e => (
                    <option key={e.id} value={e.id}>
                      {e.name} ({e.email})
                    </option>
                  ));
                })()}
              </select>
            </div>
          </div>

          {/* Team Members Section */}
          <div className="pt-2">
            <div className="flex items-center justify-between mb-2">
              <label className="text-xs font-semibold text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
                <Users className="w-3.5 h-3.5 text-brand-royal" />
                Assigned Team Members & Roles ({fields.length})
              </label>
            </div>

            {/* Combobox Search Input at the top of the section */}
            <EmployeeSearchCombobox
              employees={employees}
              assignedEmployeeIds={assignedEmployeeIds}
              onSelect={emp => {
                append({
                  employee_id: emp.id,
                  role_on_project: 'Developer',
                });
              }}
              isLoading={empLoading}
              error={empError}
              onRetry={loadEmployees}
            />

            {fields.length === 0 ? (
              <p className="text-xs text-slate-400 italic bg-slate-50 dark:bg-slate-800/40 p-3 rounded-lg border border-dashed border-slate-200 dark:border-slate-700 text-center">
                No team members assigned yet. Use the search bar above to find and add team members.
              </p>
            ) : (
              <div className="space-y-2 max-h-48 overflow-y-auto pr-1">
                {fields.map((field, index) => {
                  const emp = getMemberDisplay(field.employee_id);
                  return (
                    <div
                      key={field.id}
                      className="flex items-center gap-3 bg-slate-50 dark:bg-slate-800/60 p-2.5 rounded-lg border border-slate-200 dark:border-slate-700"
                    >
                      <input
                        type="hidden"
                        {...register(`members.${index}.employee_id` as const, {
                          valueAsNumber: true,
                        })}
                      />

                      {/* Read-only Employee Display */}
                      <div className="flex items-center gap-2.5 flex-1 min-w-0">
                        <div className="w-7 h-7 rounded-full bg-brand-royal text-white text-[11px] font-bold flex items-center justify-center shrink-0 shadow-inner">
                          {emp.initials}
                        </div>
                        <div className="min-w-0">
                          <div className="text-xs font-semibold text-slate-800 dark:text-slate-200 truncate">
                            {emp.name}{' '}
                            <span className="text-[11px] text-slate-400 font-normal">
                              (@{emp.username})
                            </span>
                          </div>
                          {(emp.job_title || emp.department) && (
                            <div className="text-[11px] text-slate-500 dark:text-slate-400 truncate">
                              {[emp.job_title, emp.department].filter(Boolean).join(' · ')}
                            </div>
                          )}
                        </div>
                      </div>

                      {/* Role Input */}
                      <div className="w-44 sm:w-52 shrink-0">
                        <input
                          {...register(`members.${index}.role_on_project` as const)}
                          type="text"
                          placeholder="e.g. Lead Developer, QA"
                          className="w-full px-2.5 py-1.5 text-xs rounded border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-1 focus:ring-brand-royal"
                        />
                      </div>

                      {/* Remove Button */}
                      <button
                        type="button"
                        onClick={() => remove(index)}
                        className="p-1.5 text-slate-400 hover:text-red-500 rounded hover:bg-red-50 dark:hover:bg-red-950/30 transition-colors"
                        title="Remove member"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Point of Contact (POC) — Last Option */}
          <div className="pt-1">
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
              Point of Contact (POC) — <span className="text-[11px] font-normal text-slate-400">Must be an assigned member</span>
            </label>
            <select
              {...register('poc_id', {
                setValueAs: v => (v === '' ? null : Number(v)),
              })}
              className="w-full px-3 py-2 text-xs rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-brand-royal"
            >
              <option value="">-- No POC assigned --</option>
              {fields.map(f => {
                const member = getMemberDisplay(f.employee_id);
                return (
                  <option key={f.employee_id} value={f.employee_id}>
                    {member.name} ({f.role_on_project})
                  </option>
                );
              })}
            </select>
            {fields.length === 0 && (
              <p className="text-[11px] text-slate-400 dark:text-slate-500 mt-1">
                Assign team members above first to designate a Point of Contact.
              </p>
            )}
          </div>

          {/* Form Actions */}
          <div className="flex items-center justify-between pt-4 border-t border-slate-200 dark:border-slate-800">
            {isEdit && project ? (
              <button
                type="button"
                disabled={isSubmitting}
                onClick={async () => {
                  const projectName = project.title || (project as any).name || 'this project';
                  if (window.confirm(`Are you sure you want to delete project "${projectName}"? This action cannot be undone.`)) {
                    setIsSubmitting(true);
                    try {
                      await api.deleteProject(project.id);
                      toast.success(`Project "${projectName}" deleted successfully`);
                      onSuccess();
                      onClose();
                    } catch (err: any) {
                      const msg = err?.message || 'Failed to delete project';
                      setSubmitError(msg);
                      toast.error(msg);
                    } finally {
                      setIsSubmitting(false);
                    }
                  }
                }}
                className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-medium text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-950/40 border border-red-200 dark:border-red-900 rounded-lg transition-colors"
              >
                <Trash2 className="w-3.5 h-3.5" />
                Delete Project
              </button>
            ) : <div />}
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={onClose}
                disabled={isSubmitting}
                className="px-4 py-2 text-xs font-medium text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition-colors"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={isSubmitting}
                className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-medium text-white bg-brand-royal hover:bg-blue-700 disabled:opacity-50 rounded-lg shadow transition-colors"
              >
                {isSubmitting ? (
                  <>
                    <LoaderCircle className="w-3.5 h-3.5 animate-spin" />
                    Saving...
                  </>
                ) : isEdit ? (
                  'Save Changes'
                ) : (
                  'Create Project'
                )}
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
};

