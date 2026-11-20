import React, { useState, useEffect } from 'react';
import {
  Laptop,
  Server,
  Database,
  CheckCircle2,
} from 'lucide-react';
import { toast } from 'sonner';
import { api } from '../lib/api';
import { Project } from '../types';

interface ProjectProgressUpdaterProps {
  project: Project;
  canUpdate: boolean;
  onSuccess: (updatedProject: Project) => void;
  onLiveChange?: (frontend: number, backend: number, database: number, overall: number) => void;
}

export const ProjectProgressUpdater: React.FC<ProjectProgressUpdaterProps> = ({
  project,
  canUpdate,
  onSuccess,
  onLiveChange,
}) => {
  const [frontendProg, setFrontendProg] = useState<number>(project.frontend_progress ?? 0);
  const [backendProg, setBackendProg] = useState<number>(project.backend_progress ?? 0);
  const [databaseProg, setDatabaseProg] = useState<number>(project.database_progress ?? 0);
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);

  // Sync state if project changes
  useEffect(() => {
    setFrontendProg(project.frontend_progress ?? 0);
    setBackendProg(project.backend_progress ?? 0);
    setDatabaseProg(project.database_progress ?? 0);
  }, [project.id, project.frontend_progress, project.backend_progress, project.database_progress]);

  // Computed overall delivery automatically generated from the 3 modules
  const overallDelivery = Math.round((frontendProg + backendProg + databaseProg) / 3);

  const handleSliderChange = (module: 'fe' | 'be' | 'db', val: number) => {
    const clamped = Math.max(0, Math.min(100, val));
    let nextFe = frontendProg;
    let nextBe = backendProg;
    let nextDb = databaseProg;

    if (module === 'fe') {
      nextFe = clamped;
      setFrontendProg(clamped);
    } else if (module === 'be') {
      nextBe = clamped;
      setBackendProg(clamped);
    } else if (module === 'db') {
      nextDb = clamped;
      setDatabaseProg(clamped);
    }

    const nextOverall = Math.round((nextFe + nextBe + nextDb) / 3);
    onLiveChange?.(nextFe, nextBe, nextDb, nextOverall);
  };

  const handleSaveAndGenerateReport = async () => {
    if (!canUpdate) {
      toast.error('Only the designated Point of Contact (POC) can update project progress.');
      return;
    }

    setIsSubmitting(true);
    try {
      const res: any = await api.updateProjectProgress(project.id, {
        frontend_progress: frontendProg,
        backend_progress: backendProg,
        database_progress: databaseProg,
        notes: '',
      });

      toast.success('Progress updated successfully!');
      if (res.project) {
        onSuccess(res.project);
      }
    } catch (err: any) {
      toast.error(err.message || 'Failed to update progress');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="space-y-4 pt-3 border-t border-slate-100 dark:border-slate-800">
      {/* Interactive Controls (Enabled for POC / Admin / Manager) */}
      {canUpdate && (
        <div className="p-4 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-2xs space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {/* 1. Frontend Slider */}
            <div className="p-3 rounded-xl bg-sky-50/50 dark:bg-sky-950/20 border border-sky-100 dark:border-sky-900/40 space-y-2">
              <div className="flex items-center justify-between text-xs font-bold">
                <span className="flex items-center gap-1.5 text-sky-700 dark:text-sky-300">
                  <Laptop className="w-3.5 h-3.5 text-sky-600" />
                  <span>Frontend</span>
                </span>
                <span className="font-mono text-sky-800 dark:text-sky-200 text-sm">
                  {frontendProg}%
                </span>
              </div>
              <input
                type="range"
                min="0"
                max="100"
                value={frontendProg}
                onChange={e => handleSliderChange('fe', Number(e.target.value))}
                className="w-full accent-sky-600 cursor-pointer h-1.5 bg-sky-200 dark:bg-sky-900 rounded-lg"
              />
              <div className="flex justify-between text-[10px] text-slate-400 font-mono">
                <span>0%</span>
                <span>50%</span>
                <span>100%</span>
              </div>
            </div>

            {/* 2. Backend Slider */}
            <div className="p-3 rounded-xl bg-emerald-50/50 dark:bg-emerald-950/20 border border-emerald-100 dark:border-emerald-900/40 space-y-2">
              <div className="flex items-center justify-between text-xs font-bold">
                <span className="flex items-center gap-1.5 text-emerald-700 dark:text-emerald-300">
                  <Server className="w-3.5 h-3.5 text-emerald-600" />
                  <span>Backend</span>
                </span>
                <span className="font-mono text-emerald-800 dark:text-emerald-200 text-sm">
                  {backendProg}%
                </span>
              </div>
              <input
                type="range"
                min="0"
                max="100"
                value={backendProg}
                onChange={e => handleSliderChange('be', Number(e.target.value))}
                className="w-full accent-emerald-600 cursor-pointer h-1.5 bg-emerald-200 dark:bg-emerald-900 rounded-lg"
              />
              <div className="flex justify-between text-[10px] text-slate-400 font-mono">
                <span>0%</span>
                <span>50%</span>
                <span>100%</span>
              </div>
            </div>

            {/* 3. Database Slider */}
            <div className="p-3 rounded-xl bg-purple-50/50 dark:bg-purple-950/20 border border-purple-100 dark:border-purple-900/40 space-y-2">
              <div className="flex items-center justify-between text-xs font-bold">
                <span className="flex items-center gap-1.5 text-purple-700 dark:text-purple-300">
                  <Database className="w-3.5 h-3.5 text-purple-600" />
                  <span>Database</span>
                </span>
                <span className="font-mono text-purple-800 dark:text-purple-200 text-sm">
                  {databaseProg}%
                </span>
              </div>
              <input
                type="range"
                min="0"
                max="100"
                value={databaseProg}
                onChange={e => handleSliderChange('db', Number(e.target.value))}
                className="w-full accent-purple-600 cursor-pointer h-1.5 bg-purple-200 dark:bg-purple-900 rounded-lg"
              />
              <div className="flex justify-between text-[10px] text-slate-400 font-mono">
                <span>0%</span>
                <span>50%</span>
                <span>100%</span>
              </div>
            </div>
          </div>

          {/* Action Button */}
          <div className="flex items-center justify-end gap-2 pt-1">
            <button
              type="button"
              disabled={isSubmitting}
              onClick={handleSaveAndGenerateReport}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold text-white bg-brand-royal hover:bg-blue-700 disabled:opacity-50 transition shadow-sm cursor-pointer"
            >
              {isSubmitting ? (
                <>
                  <div className="w-3.5 h-3.5 rounded-full border-2 border-white border-t-transparent animate-spin" />
                  <span>Updating Progress...</span>
                </>
              ) : (
                <>
                  <CheckCircle2 className="w-3.5 h-3.5" />
                  <span>Update Module Progress</span>
                </>
              )}
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
