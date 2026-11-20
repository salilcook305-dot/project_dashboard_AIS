import React, { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import {
  BookOpen,
  CheckCircle2,
  Clock,
  Send,
  LoaderCircle,
  FolderGit2,
  AlertCircle,
  ShieldAlert,
  ChevronDown,
  ChevronUp
} from 'lucide-react';
import { toast } from 'sonner';
import { api } from '../lib/api';
import { MyDiaryItem, DueDiaryReport } from '../types';
import { useCurrentUser } from '../components/ProtectedRoute';

const diarySchema = z.object({
  done: z.string().min(1, 'What you completed today is required').max(2000, 'Max 2000 characters'),
  in_progress: z.string().min(1, 'What is currently in progress is required').max(2000, 'Max 2000 characters'),
  next_up: z.string().min(1, 'What is next up is required').max(2000, 'Max 2000 characters'),
  blockers: z.string().max(2000, 'Max 2000 characters').optional().default(''),
});

type DiaryFormData = z.infer<typeof diarySchema>;

const DiaryProjectCard: React.FC<{
  item: MyDiaryItem;
  onSuccess: () => void;
}> = ({ item, onSuccess }) => {
  const [savedTime, setSavedTime] = useState<string | null>(() => {
    if (item.today_entry?.updated_at) {
      try {
        const parts = item.today_entry.updated_at.split(' ');
        return parts[1] ? parts[1].slice(0, 5) : null;
      } catch {
        return null;
      }
    }
    return null;
  });

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<DiaryFormData>({
    resolver: zodResolver(diarySchema),
    defaultValues: {
      done: item.today_entry?.done || '',
      in_progress: item.today_entry?.in_progress || item.prefill.in_progress || '',
      next_up: item.today_entry?.next_up || '',
      blockers: item.today_entry?.blockers || '',
    },
  });

  const onSubmit = async (data: DiaryFormData) => {
    try {
      const res = await api.saveProjectDiary(item.project.id, {
        done: data.done,
        in_progress: data.in_progress,
        next_up: data.next_up,
        blockers: data.blockers || '',
      });
      if (res.success) {
        const now = new Date();
        const hhmm = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
        setSavedTime(hhmm);
        toast.success(`Saved diary entry for ${item.project.name}`);
        onSuccess();
      }
    } catch (err: any) {
      toast.error(err.message || 'Failed to save diary entry');
    }
  };

  return (
    <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-5 shadow-sm space-y-4">
      {/* Project Card Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800 gap-2">
        <div className="flex items-center gap-2.5 min-w-0">
          <div className="w-8 h-8 rounded-lg bg-blue-50 dark:bg-blue-950/40 text-brand-royal flex items-center justify-center shrink-0">
            <FolderGit2 className="w-4 h-4" />
          </div>
          <div className="min-w-0">
            <h3 className="font-bold text-sm text-slate-900 dark:text-slate-100 truncate">
              {item.project.name}
            </h3>
            <span className="text-[10px] text-slate-400 font-mono">
              {item.project.project_code}
            </span>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {item.project.poc && (
            <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-amber-50 text-amber-700 border border-amber-200 dark:bg-amber-950/40 dark:text-amber-300 dark:border-amber-800">
              POC: {item.project.poc.name}
            </span>
          )}
          {item.can_update === false && (
            <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-slate-100 text-slate-600 border border-slate-200 dark:bg-slate-800 dark:text-slate-400 dark:border-slate-700">
              View Only
            </span>
          )}
          {savedTime && (
            <span className="inline-flex items-center gap-1 text-[11px] font-bold text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/40 px-2 py-0.5 rounded-full border border-emerald-200 dark:border-emerald-800">
              <CheckCircle2 className="w-3 h-3" />
              Saved at {savedTime}
            </span>
          )}
        </div>
      </div>

      {item.can_update === false ? (
        <div className="space-y-3">
          {item.today_entry ? (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3 text-xs">
              <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/40 border border-slate-200 dark:border-slate-800">
                <span className="font-bold text-slate-500 text-[10px] uppercase block mb-1">Done Today</span>
                <p className="text-slate-800 dark:text-slate-200 whitespace-pre-wrap">{item.today_entry.done}</p>
              </div>
              <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/40 border border-slate-200 dark:border-slate-800">
                <span className="font-bold text-slate-500 text-[10px] uppercase block mb-1">In Progress</span>
                <p className="text-slate-800 dark:text-slate-200 whitespace-pre-wrap">{item.today_entry.in_progress}</p>
              </div>
              <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/40 border border-slate-200 dark:border-slate-800">
                <span className="font-bold text-slate-500 text-[10px] uppercase block mb-1">Next Up Tomorrow</span>
                <p className="text-slate-800 dark:text-slate-200 whitespace-pre-wrap">{item.today_entry.next_up}</p>
              </div>
              {item.today_entry.blockers && (
                <div className="col-span-full p-2.5 rounded-xl bg-rose-50 dark:bg-rose-950/20 border border-rose-200 dark:border-rose-900/60 text-xs">
                  <span className="font-bold text-rose-700 dark:text-rose-300 text-[10px] uppercase block">Blockers / Impediments</span>
                  <p className="text-rose-900 dark:text-rose-200 whitespace-pre-wrap mt-0.5">{item.today_entry.blockers}</p>
                </div>
              )}
            </div>
          ) : (
            <div className="p-4 rounded-xl border border-dashed border-slate-200 dark:border-slate-800 text-xs text-slate-400 italic text-center">
              No daily diary update posted today yet by Point of Contact ({item.project.poc?.name || 'Unassigned'}).
            </div>
          )}
        </div>
      ) : (
        /* Diary Form */
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-3.5">
        <div>
          <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
            Done Today <span className="text-red-500">*</span>
          </label>
          <textarea
            {...register('done')}
            rows={2}
            placeholder="Key milestones completed today..."
            className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/40 text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-brand-royal"
          />
          {errors.done && (
            <p className="text-[11px] text-red-500 mt-0.5">{errors.done.message}</p>
          )}
        </div>

        <div>
          <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
            In Progress <span className="text-red-500">*</span>
          </label>
          <textarea
            {...register('in_progress')}
            rows={2}
            placeholder="Currently working on..."
            className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/40 text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-brand-royal"
          />
          {errors.in_progress && (
            <p className="text-[11px] text-red-500 mt-0.5">{errors.in_progress.message}</p>
          )}
        </div>

        <div>
          <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
            Next Up Tomorrow <span className="text-red-500">*</span>
          </label>
          <textarea
            {...register('next_up')}
            rows={2}
            placeholder="Next priorities planned for tomorrow..."
            className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/40 text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-brand-royal"
          />
          {errors.next_up && (
            <p className="text-[11px] text-red-500 mt-0.5">{errors.next_up.message}</p>
          )}
        </div>

        <div>
          <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
            Blockers / Impediments <span className="text-[10px] text-slate-400 font-normal">(Optional)</span>
          </label>
          <textarea
            {...register('blockers')}
            rows={1}
            placeholder="Any blockers or external dependencies..."
            className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/40 text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-brand-royal"
          />
          {errors.blockers && (
            <p className="text-[11px] text-red-500 mt-0.5">{errors.blockers.message}</p>
          )}
        </div>

        <div className="flex items-center justify-between pt-2">
          <span className="text-[11px] text-slate-400">
            {item.today_entry?.reviewed_by ? (
              <span className="text-emerald-600 font-medium">
                Reviewed by {item.today_entry.reviewed_by.name}
              </span>
            ) : (
              'Pending review'
            )}
          </span>
          <button
            type="submit"
            disabled={isSubmitting}
            className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-bold rounded-xl text-white bg-brand-royal hover:bg-blue-700 shadow-sm transition disabled:opacity-50"
          >
            {isSubmitting ? (
              <>
                <LoaderCircle className="w-3.5 h-3.5 animate-spin" />
                <span>Saving...</span>
              </>
            ) : (
              <>
                <Send className="w-3.5 h-3.5" />
                <span>Save Today's Diary</span>
              </>
            )}
          </button>
        </div>
      </form>
      )}
    </div>
  );
};

export const MyDiaryPage: React.FC = () => {
  const { user } = useCurrentUser();
  const queryClient = useQueryClient();
  const [showDuePanel, setShowDuePanel] = useState(true);

  // My diary active projects
  const {
    data: myDiaryItems = [],
    isLoading,
    isError,
    refetch,
  } = useQuery<MyDiaryItem[]>({
    queryKey: ['diary', 'my'],
    queryFn: () => api.getMyDiary(),
  });

  const isAdminOrManager = user?.is_admin || user?.is_manager || user?.role === 'ADMIN' || user?.role === 'MANAGER';

  // Updates due query for POC/Manager/Admin
  const {
    data: dueReport,
    refetch: refetchDue,
  } = useQuery<DueDiaryReport>({
    queryKey: ['diary', 'due'],
    queryFn: () => api.getDueDiary(),
    enabled: !!isAdminOrManager,
  });

  return (
    <div className="p-6 space-y-6 max-w-5xl mx-auto">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-black text-slate-900 dark:text-slate-100 tracking-tight flex items-center gap-2">
            <BookOpen className="w-5 h-5 text-brand-royal" />
            My Work Diary
          </h1>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
            Submit your daily engineering updates: Done, In Progress, Next Up, and Blockers
          </p>
        </div>
        <button
          onClick={() => {
            refetch();
            if (isAdminOrManager) refetchDue();
          }}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-300 hover:bg-slate-50 shadow-sm transition"
        >
          <Clock className="w-3.5 h-3.5" />
          <span>Refresh</span>
        </button>
      </div>

      {/* Due Updates Panel for POC / Manager / Admin */}
      {isAdminOrManager && dueReport && dueReport.total_missing > 0 && (
        <div className="bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-900/60 rounded-2xl p-4 shadow-sm">
          <div className="flex items-center justify-between cursor-pointer" onClick={() => setShowDuePanel(!showDuePanel)}>
            <div className="flex items-center gap-2.5">
              <ShieldAlert className="w-5 h-5 text-amber-600 dark:text-amber-400 shrink-0" />
              <div>
                <h3 className="text-xs font-bold text-amber-900 dark:text-amber-200">
                  Updates Due Today: {dueReport.total_missing} missing across {dueReport.projects.length} active projects
                </h3>
                <p className="text-[11px] text-amber-700 dark:text-amber-300">
                  Team members who haven't logged today's diary entry yet
                </p>
              </div>
            </div>
            <button className="text-amber-700 dark:text-amber-400">
              {showDuePanel ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
            </button>
          </div>

          {showDuePanel && (
            <div className="mt-3 pt-3 border-t border-amber-200 dark:border-amber-900/40 space-y-3">
              {dueReport.projects.map(p => (
                <div key={p.project_id} className="p-3 bg-white dark:bg-slate-900 rounded-xl border border-amber-200/80 dark:border-amber-900/40">
                  <div className="flex items-center justify-between text-xs font-bold text-slate-900 dark:text-slate-100 mb-2">
                    <span>{p.project_name} ({p.project_code})</span>
                    <span className="text-[10px] text-rose-600 dark:text-rose-400 font-semibold">
                      {p.missing_count} missing
                    </span>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {p.missing_members.map(m => (
                      <span
                        key={m.id}
                        className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300"
                      >
                        <span className="w-4 h-4 rounded-full bg-slate-300 dark:bg-slate-700 text-[10px] font-bold flex items-center justify-center">
                          {m.initials}
                        </span>
                        <span>{m.name}</span>
                        <span className="text-[10px] text-slate-400">({m.role_on_project})</span>
                      </span>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Diary Cards Grid */}
      {isLoading ? (
        <div className="p-16 flex items-center justify-center">
          <LoaderCircle className="w-8 h-8 text-brand-royal animate-spin" />
        </div>
      ) : isError ? (
        <div className="p-8 text-center text-xs text-rose-500 flex items-center justify-center gap-2 bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800">
          <AlertCircle className="w-4 h-4" /> Failed to load active projects for diary.
        </div>
      ) : myDiaryItems.length === 0 ? (
        <div className="p-12 text-center text-xs text-slate-400 italic bg-white dark:bg-slate-900 rounded-2xl border border-dashed border-slate-200 dark:border-slate-800">
          You are currently not an assigned contributor on any active projects.
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-6">
          {myDiaryItems.map(item => (
            <DiaryProjectCard
              key={item.project.id}
              item={item}
              onSuccess={() => {
                queryClient.invalidateQueries({ queryKey: ['diary'] });
              }}
            />
          ))}
        </div>
      )}
    </div>
  );
};
