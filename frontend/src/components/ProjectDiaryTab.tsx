import React, { useState, useMemo } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import {
  BookOpen,
  CheckCircle2,
  AlertTriangle,
  Plus,
  Send,
  LoaderCircle,
  ShieldCheck,
  Edit2
} from 'lucide-react';
import { toast } from 'sonner';
import { api } from '../lib/api';
import { DiaryEntry } from '../types';
import { useCurrentUser } from './ProtectedRoute';

interface ProjectDiaryTabProps {
  projectId: number;
  pocId?: number | null;
  projectManagerId?: number | null;
  isMember?: boolean;
}

export const ProjectDiaryTab: React.FC<ProjectDiaryTabProps> = ({
  projectId,
  pocId,
  projectManagerId,
  isMember = false,
}) => {
  const { user } = useCurrentUser();
  const queryClient = useQueryClient();
  const [authorFilter, setAuthorFilter] = useState<string>('');
  const [showAddForm, setShowAddForm] = useState(false);
  const [done, setDone] = useState('');
  const [inProgress, setInProgress] = useState('');
  const [nextUp, setNextUp] = useState('');
  const [blockers, setBlockers] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Edit entry state
  const [editingEntryId, setEditingEntryId] = useState<number | null>(null);
  const [editDone, setEditDone] = useState('');
  const [editInProgress, setEditInProgress] = useState('');
  const [editNextUp, setEditNextUp] = useState('');
  const [editBlockers, setEditBlockers] = useState('');
  const [isUpdating, setIsUpdating] = useState(false);

  const {
    data: entries = [],
    isLoading,
    isError,
  } = useQuery<DiaryEntry[]>({
    queryKey: ['projectDiary', projectId, authorFilter],
    queryFn: () => api.getProjectDiary(projectId, authorFilter ? { author: Number(authorFilter) } : undefined),
  });

  // Rule: Only Point of Contact (or Admin) can update works diary; other employees in that group can only view
  const isPocOrAdmin = !!(
    user && (
      user.id === pocId ||
      user.is_admin ||
      user.role === 'ADMIN'
    )
  );

  const canPost = isPocOrAdmin;

  const canEditEntry = (_entry: DiaryEntry) => {
    return isPocOrAdmin;
  };

  const handleStartEdit = (entry: DiaryEntry) => {
    setEditingEntryId(entry.id);
    setEditDone(entry.done);
    setEditInProgress(entry.in_progress);
    setEditNextUp(entry.next_up);
    setEditBlockers(entry.blockers || '');
  };

  const handleSaveEdit = async (entryId: number) => {
    if (!editDone.trim() || !editInProgress.trim() || !editNextUp.trim()) {
      toast.error('Done, In Progress, and Next Up are required');
      return;
    }
    setIsUpdating(true);
    try {
      await api.updateDiaryEntry(entryId, {
        done: editDone.trim(),
        in_progress: editInProgress.trim(),
        next_up: editNextUp.trim(),
        blockers: editBlockers.trim(),
      });
      toast.success('Diary entry updated successfully');
      setEditingEntryId(null);
      queryClient.invalidateQueries({ queryKey: ['projectDiary', projectId] });
    } catch (err: any) {
      toast.error(err.message || 'Failed to update diary entry');
    } finally {
      setIsUpdating(false);
    }
  };

  const canReview = user && (
    user.id === pocId ||
    user.id === projectManagerId ||
    user.is_admin ||
    user.is_manager ||
    user.role === 'ADMIN' ||
    user.role === 'MANAGER'
  );

  const handleReview = async (entryId: number) => {
    try {
      await api.reviewDiaryEntry(entryId);
      toast.success('Diary entry marked as reviewed');
      queryClient.invalidateQueries({ queryKey: ['projectDiary', projectId] });
    } catch (err: any) {
      toast.error(err.message || 'Failed to review diary entry');
    }
  };

  const handleAddSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!done.trim() || !inProgress.trim() || !nextUp.trim()) {
      toast.error('Done, In Progress, and Next Up are required');
      return;
    }

    setIsSubmitting(true);
    try {
      await api.saveProjectDiary(projectId, {
        done: done.trim(),
        in_progress: inProgress.trim(),
        next_up: nextUp.trim(),
        blockers: blockers.trim(),
      });
      toast.success('Diary entry saved for today');
      setDone('');
      setInProgress('');
      setNextUp('');
      setBlockers('');
      setShowAddForm(false);
      queryClient.invalidateQueries({ queryKey: ['projectDiary', projectId] });
      queryClient.invalidateQueries({ queryKey: ['diary'] });
    } catch (err: any) {
      toast.error(err.message || 'Failed to save diary entry');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Group entries by entry_date (newest first)
  const groupedEntries = useMemo(() => {
    const groups: Record<string, DiaryEntry[]> = {};
    entries.forEach(e => {
      const d = e.entry_date;
      if (!groups[d]) groups[d] = [];
      groups[d].push(e);
    });
    return Object.entries(groups).sort((a, b) => (a[0] < b[0] ? 1 : -1));
  }, [entries]);

  // Unique authors for filtering
  const authors = useMemo(() => {
    const map = new Map<number, string>();
    entries.forEach(e => {
      if (e.author && e.author.id) {
        map.set(e.author.id, e.author.name);
      }
    });
    return Array.from(map.entries());
  }, [entries]);

  return (
    <div className="space-y-4">
      {/* Tab Controls Bar */}
      <div className="flex flex-wrap items-center justify-between gap-3 pb-3 border-b border-slate-200 dark:border-slate-800">
        <div className="flex items-center gap-2">
          <BookOpen className="w-4 h-4 text-brand-royal" />
          <span className="text-xs font-bold text-slate-900 dark:text-slate-100">
            Work Diary Timeline ({entries.length} {entries.length === 1 ? 'entry' : 'entries'})
          </span>
        </div>

        <div className="flex items-center gap-2">
          {authors.length > 1 && (
            <div className="relative">
              <select
                value={authorFilter}
                onChange={e => setAuthorFilter(e.target.value)}
                className="py-1 pl-2.5 pr-7 text-[11px] rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300 focus:outline-none focus:ring-1 focus:ring-brand-royal"
              >
                <option value="">All Authors</option>
                {authors.map(([id, name]) => (
                  <option key={id} value={id}>
                    {name}
                  </option>
                ))}
              </select>
            </div>
          )}

          {!canPost && (
            <span className="text-[11px] text-slate-500 dark:text-slate-400 bg-slate-100 dark:bg-slate-800 px-2.5 py-1 rounded-lg border border-slate-200 dark:border-slate-700">
              View Only · Only Point of Contact can update
            </span>
          )}

          {canPost && (
            <button
              type="button"
              onClick={() => setShowAddForm(!showAddForm)}
              className="inline-flex items-center gap-1 px-2.5 py-1 text-[11px] font-bold rounded-lg bg-brand-royal text-white hover:bg-blue-700 transition"
            >
              <Plus className="w-3 h-3" />
              <span>{showAddForm ? 'Cancel' : 'Post Update'}</span>
            </button>
          )}
        </div>
      </div>

      {/* Inline Post Update Form */}
      {showAddForm && (
        <form onSubmit={handleAddSubmit} className="p-4 rounded-xl border border-blue-200 dark:border-blue-900/60 bg-blue-50/40 dark:bg-blue-950/20 space-y-3">
          <div className="text-xs font-bold text-brand-royal dark:text-[#60A5FA]">
            Submit Today's Diary Entry
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <div>
              <label className="block text-[11px] font-semibold text-slate-700 dark:text-slate-300 mb-1">
                Done Today <span className="text-red-500">*</span>
              </label>
              <textarea
                value={done}
                onChange={e => setDone(e.target.value)}
                rows={2}
                placeholder="What was completed today..."
                className="w-full p-2 text-xs rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-1 focus:ring-brand-royal"
              />
            </div>

            <div>
              <label className="block text-[11px] font-semibold text-slate-700 dark:text-slate-300 mb-1">
                In Progress <span className="text-red-500">*</span>
              </label>
              <textarea
                value={inProgress}
                onChange={e => setInProgress(e.target.value)}
                rows={2}
                placeholder="What is currently in progress..."
                className="w-full p-2 text-xs rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-1 focus:ring-brand-royal"
              />
            </div>

            <div>
              <label className="block text-[11px] font-semibold text-slate-700 dark:text-slate-300 mb-1">
                Next Up Tomorrow <span className="text-red-500">*</span>
              </label>
              <textarea
                value={nextUp}
                onChange={e => setNextUp(e.target.value)}
                rows={2}
                placeholder="Planned next steps..."
                className="w-full p-2 text-xs rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-1 focus:ring-brand-royal"
              />
            </div>
          </div>

          <div>
            <label className="block text-[11px] font-semibold text-slate-700 dark:text-slate-300 mb-1">
              Blockers / Impediments <span className="text-slate-400 font-normal">(Optional)</span>
            </label>
            <input
              type="text"
              value={blockers}
              onChange={e => setBlockers(e.target.value)}
              placeholder="Any blockers or external dependencies..."
              className="w-full p-2 text-xs rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-1 focus:ring-brand-royal"
            />
          </div>

          <div className="flex justify-end gap-2 pt-1">
            <button
              type="button"
              onClick={() => setShowAddForm(false)}
              className="px-3 py-1.5 text-xs text-slate-600 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-800 rounded-lg"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold rounded-lg text-white bg-brand-royal hover:bg-blue-700 disabled:opacity-50"
            >
              {isSubmitting ? <LoaderCircle className="w-3.5 h-3.5 animate-spin" /> : <Send className="w-3.5 h-3.5" />}
              <span>Save Entry</span>
            </button>
          </div>
        </form>
      )}

      {/* Timeline entries */}
      {isLoading ? (
        <div className="p-8 flex items-center justify-center">
          <LoaderCircle className="w-6 h-6 text-brand-royal animate-spin" />
        </div>
      ) : isError ? (
        <div className="p-4 text-xs text-rose-500 text-center">
          Failed to load project diary entries.
        </div>
      ) : entries.length === 0 ? (
        <div className="p-8 text-center text-xs text-slate-400 italic bg-slate-50 dark:bg-slate-800/30 rounded-xl border border-dashed border-slate-200 dark:border-slate-800">
          No work diary updates have been posted for this project yet.
        </div>
      ) : (
        <div className="space-y-6">
          {groupedEntries.map(([dateStr, dateEntries]) => (
            <div key={dateStr} className="space-y-3">
              {/* Date Header */}
              <div className="flex items-center gap-2">
                <span className="text-xs font-bold text-slate-900 dark:text-slate-100 bg-slate-100 dark:bg-slate-800 px-2.5 py-1 rounded-full border border-slate-200 dark:border-slate-700">
                  {dateStr}
                </span>
                <div className="flex-1 h-px bg-slate-200 dark:bg-slate-800" />
              </div>

              {/* Entries for this date */}
              <div className="space-y-3 pl-2 border-l-2 border-slate-200 dark:border-slate-800 ml-3">
                {dateEntries.map(entry => (
                  <div
                    key={entry.id}
                    className="p-4 rounded-xl border border-slate-200 dark:border-slate-700/60 bg-white dark:bg-slate-800 shadow-sm space-y-3 ml-2"
                  >
                    {/* Author & Review status */}
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-2">
                        <div className="w-6 h-6 rounded-full bg-brand-royal text-white text-[10px] font-bold flex items-center justify-center shrink-0">
                          {entry.author.initials}
                        </div>
                        <div>
                          <span className="text-xs font-bold text-slate-900 dark:text-slate-100">
                            {entry.author.name}
                          </span>
                          {entry.author.job_title && (
                            <span className="text-[10px] text-slate-400 ml-1.5">
                              ({entry.author.job_title})
                            </span>
                          )}
                        </div>
                      </div>

                      <div className="flex items-center gap-2">
                        {canEditEntry(entry) && editingEntryId !== entry.id && (
                          <button
                            type="button"
                            onClick={() => handleStartEdit(entry)}
                            className="inline-flex items-center gap-1 text-[11px] font-semibold text-slate-500 hover:text-slate-800 dark:hover:text-slate-200 px-2 py-0.5 rounded-md hover:bg-slate-100 dark:hover:bg-slate-700 transition"
                          >
                            <Edit2 className="w-3 h-3" />
                            <span>Edit</span>
                          </button>
                        )}

                        {entry.reviewed_by ? (
                          <span className="inline-flex items-center gap-1 text-[11px] font-bold text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/40 px-2 py-0.5 rounded-full border border-emerald-200 dark:border-emerald-800">
                            <CheckCircle2 className="w-3.5 h-3.5" />
                            <span>Reviewed by {entry.reviewed_by.name}</span>
                          </span>
                        ) : canReview ? (
                          <button
                            type="button"
                            onClick={() => handleReview(entry.id)}
                            className="inline-flex items-center gap-1 text-[11px] font-bold text-brand-royal bg-blue-50 dark:bg-blue-950/40 hover:bg-blue-100 dark:hover:bg-blue-900/60 px-2.5 py-0.5 rounded-full border border-blue-200 dark:border-blue-800 transition"
                          >
                            <ShieldCheck className="w-3.5 h-3.5" />
                            <span>Review</span>
                          </button>
                        ) : (
                          <span className="text-[11px] text-slate-400">
                            Pending review
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Entry Content or Edit Form */}
                    {editingEntryId === entry.id ? (
                      <div className="p-3 bg-slate-50 dark:bg-slate-900/60 rounded-xl border border-slate-200 dark:border-slate-700 space-y-3">
                        <div className="text-xs font-bold text-slate-800 dark:text-slate-200">
                          Edit Diary Update
                        </div>
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-2.5">
                          <div>
                            <label className="block text-[10px] font-bold uppercase text-slate-500 mb-1">Done</label>
                            <textarea
                              value={editDone}
                              onChange={e => setEditDone(e.target.value)}
                              rows={2}
                              className="w-full p-2 text-xs rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-1 focus:ring-brand-royal"
                            />
                          </div>
                          <div>
                            <label className="block text-[10px] font-bold uppercase text-slate-500 mb-1">In Progress</label>
                            <textarea
                              value={editInProgress}
                              onChange={e => setEditInProgress(e.target.value)}
                              rows={2}
                              className="w-full p-2 text-xs rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-1 focus:ring-brand-royal"
                            />
                          </div>
                          <div>
                            <label className="block text-[10px] font-bold uppercase text-slate-500 mb-1">Next Up</label>
                            <textarea
                              value={editNextUp}
                              onChange={e => setEditNextUp(e.target.value)}
                              rows={2}
                              className="w-full p-2 text-xs rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-1 focus:ring-brand-royal"
                            />
                          </div>
                        </div>
                        <div>
                          <label className="block text-[10px] font-bold uppercase text-slate-500 mb-1">Blockers (optional)</label>
                          <input
                            type="text"
                            value={editBlockers}
                            onChange={e => setEditBlockers(e.target.value)}
                            placeholder="Any blockers or impediments..."
                            className="w-full p-2 text-xs rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-1 focus:ring-brand-royal"
                          />
                        </div>
                        <div className="flex items-center justify-end gap-2 pt-1">
                          <button
                            type="button"
                            onClick={() => setEditingEntryId(null)}
                            className="px-3 py-1 text-xs font-semibold text-slate-600 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-800 rounded-lg transition"
                          >
                            Cancel
                          </button>
                          <button
                            type="button"
                            onClick={() => handleSaveEdit(entry.id)}
                            disabled={isUpdating}
                            className="px-3 py-1 text-xs font-bold text-white bg-brand-royal hover:bg-blue-700 rounded-lg transition disabled:opacity-50"
                          >
                            {isUpdating ? 'Saving...' : 'Save Update'}
                          </button>
                        </div>
                      </div>
                    ) : (
                      <>
                        {/* Entry Content (Rendered as plain text: No dangerouslySetInnerHTML) */}
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-3 text-xs">
                          <div className="p-2.5 rounded-lg bg-slate-50 dark:bg-slate-900/60 border border-slate-100 dark:border-slate-800">
                            <span className="font-bold text-slate-500 dark:text-slate-400 block text-[10px] uppercase mb-1">
                              Done
                            </span>
                            <p className="text-slate-800 dark:text-slate-200 whitespace-pre-wrap">
                              {entry.done}
                            </p>
                          </div>

                          <div className="p-2.5 rounded-lg bg-slate-50 dark:bg-slate-900/60 border border-slate-100 dark:border-slate-800">
                            <span className="font-bold text-slate-500 dark:text-slate-400 block text-[10px] uppercase mb-1">
                              In Progress
                            </span>
                            <p className="text-slate-800 dark:text-slate-200 whitespace-pre-wrap">
                              {entry.in_progress}
                            </p>
                          </div>

                          <div className="p-2.5 rounded-lg bg-slate-50 dark:bg-slate-900/60 border border-slate-100 dark:border-slate-800">
                            <span className="font-bold text-slate-500 dark:text-slate-400 block text-[10px] uppercase mb-1">
                              Next Up
                            </span>
                            <p className="text-slate-800 dark:text-slate-200 whitespace-pre-wrap">
                              {entry.next_up}
                            </p>
                          </div>
                        </div>

                        {/* Blockers Block (highlighted if present) */}
                        {entry.blockers && entry.blockers.trim() && (
                          <div className="p-2.5 rounded-lg bg-rose-50 dark:bg-rose-950/30 border border-rose-200 dark:border-rose-900/60 flex items-start gap-2">
                            <AlertTriangle className="w-4 h-4 text-rose-600 dark:text-rose-400 shrink-0 mt-0.5" />
                            <div className="text-xs">
                              <span className="font-bold text-rose-700 dark:text-rose-300 block text-[10px] uppercase">
                                Blockers / Impediments
                              </span>
                              <p className="text-rose-900 dark:text-rose-200 whitespace-pre-wrap mt-0.5">
                                {entry.blockers}
                              </p>
                            </div>
                          </div>
                        )}
                      </>
                    )}
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
