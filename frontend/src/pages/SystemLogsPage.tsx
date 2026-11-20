import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Terminal,
  Download,
  RotateCw,
  Trash2,
  Search,
  ChevronDown,
  AlertCircle,
  AlertTriangle,
  Info,
  CheckCircle2,
  Copy,
  Check,
  FileText,
  Clock,
  HardDrive
} from 'lucide-react';
import { toast } from 'sonner';
import { api } from '../lib/api';
import { useCurrentUser } from '../components/ProtectedRoute';

export const SystemLogsPage: React.FC = () => {
  const queryClient = useQueryClient();
  const { user } = useCurrentUser();

  const [activeFile, setActiveFile] = useState<'app' | 'error'>('app');
  const [levelFilter, setLevelFilter] = useState<string>('ALL');
  const [searchTerm, setSearchTerm] = useState<string>('');
  const [lineCount, setLineCount] = useState<number>(150);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const isAdmin = Boolean(user?.is_admin || user?.role === 'ADMIN' || user?.role === 'admin' || user?.is_superuser);

  const {
    data: logData,
    isLoading,
    isRefetching,
    refetch,
    isError,
    error
  } = useQuery({
    queryKey: ['admin-logs', activeFile, levelFilter, searchTerm, lineCount],
    queryFn: () =>
      api.getAdminLogs({
        file: activeFile,
        level: levelFilter,
        search: searchTerm,
        lines: lineCount,
      }),
    refetchInterval: 10000, // Background refresh every 10 seconds
  });

  const clearMutation = useMutation({
    mutationFn: () => api.clearAdminLogs(activeFile),
    onSuccess: (res) => {
      toast.success(res.message || 'Log file cleared');
      queryClient.invalidateQueries({ queryKey: ['admin-logs'] });
    },
    onError: (err: any) => {
      toast.error(err.message || 'Failed to clear logs');
    },
  });

  const handleDownload = async () => {
    try {
      toast.info(`Preparing ${activeFile}.log download...`);
      await api.downloadAdminLogs(activeFile);
      toast.success(`Downloaded ${activeFile}.log successfully!`);
    } catch (err: any) {
      toast.error(err.message || 'Download failed');
    }
  };

  const handleClear = () => {
    if (window.confirm(`Are you sure you want to clear all recorded entries in ${activeFile}.log? This cannot be undone.`)) {
      clearMutation.mutate();
    }
  };

  const handleCopyLine = (text: string, id: string) => {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  if (!isAdmin) {
    return (
      <div className="p-8 max-w-4xl mx-auto text-center">
        <div className="w-16 h-16 rounded-2xl bg-rose-50 dark:bg-rose-950/40 text-rose-600 flex items-center justify-center mx-auto mb-4">
          <AlertCircle className="w-8 h-8" />
        </div>
        <h2 className="text-lg font-bold text-slate-900 dark:text-white">Administrator Access Required</h2>
        <p className="text-xs text-slate-500 mt-1 max-w-md mx-auto">
          System and error logs contain sensitive operational tracebacks and are restricted exclusively to System Administrators.
        </p>
      </div>
    );
  }

  const logs = logData?.logs || [];
  const levelsCount = logData?.levels_count || { INFO: 0, WARNING: 0, ERROR: 0 };
  const fileSize = logData?.file_size || '0 B';
  const totalLines = logData?.total_lines || 0;

  return (
    <div className="p-6 space-y-6 max-w-7xl mx-auto">
      {/* Top Header Banner */}
      <div className="bg-gradient-to-r from-[#0B1F5C] via-[#0F357E] to-[#1565C0] text-white p-6 rounded-2xl shadow-md flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-2">
            <span className="px-2.5 py-0.5 rounded-md text-[10px] font-bold bg-blue-500/80 text-white uppercase tracking-wider inline-flex items-center gap-1.5">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
              Live Server Logger
            </span>
            <span className="text-[11px] font-mono text-sky-200">
              Django RotatingFileHandler
            </span>
          </div>
          <h1 className="text-xl font-extrabold tracking-tight flex items-center gap-2">
            <Terminal className="w-5 h-5 text-sky-300" />
            System Audit &amp; Application Logs
          </h1>
          <p className="text-xs text-sky-100 mt-1 max-w-2xl">
            Real-time server activity, user authentication events, Excel ingestion pipelines, database operations, and exception stack traces.
          </p>
        </div>

        <div className="flex items-center gap-2.5 shrink-0">
          <button
            type="button"
            onClick={handleDownload}
            className="px-4 py-2 bg-white hover:bg-slate-100 text-slate-900 font-bold rounded-xl text-xs transition flex items-center gap-2 shadow-xs cursor-pointer"
            title={`Download complete ${activeFile}.log`}
          >
            <Download className="w-4 h-4 text-[#1565C0]" />
            <span>Download .log</span>
          </button>
          <button
            type="button"
            onClick={handleClear}
            disabled={clearMutation.isPending}
            className="px-3.5 py-2 bg-rose-600/80 hover:bg-rose-600 text-white font-semibold rounded-xl text-xs transition flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
            title="Clear current log file"
          >
            <Trash2 className="w-4 h-4" />
            <span className="hidden sm:inline">Clear</span>
          </button>
        </div>
      </div>

      {/* KPI Summary Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {/* Total Events */}
        <div className="p-4 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-bold tracking-wider uppercase text-slate-400">Total Entries</span>
            <FileText className="w-4 h-4 text-blue-500" />
          </div>
          <div className="mt-2 text-2xl font-black tracking-tight text-slate-900 dark:text-white">
            {totalLines}
          </div>
          <div className="mt-1 text-[11px] font-medium text-slate-500 flex items-center gap-1">
            <HardDrive className="w-3 h-3 text-slate-400" />
            <span>File size: <b>{fileSize}</b></span>
          </div>
        </div>

        {/* Info Level */}
        <div className="p-4 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-bold tracking-wider uppercase text-emerald-600 dark:text-emerald-400">Info Events</span>
            <Info className="w-4 h-4 text-emerald-500" />
          </div>
          <div className="mt-2 text-2xl font-black tracking-tight text-emerald-600 dark:text-emerald-400">
            {levelsCount['INFO'] || 0}
          </div>
          <div className="mt-1 text-[11px] text-slate-500">
            Logins, audits &amp; normal operations
          </div>
        </div>

        {/* Warnings */}
        <div className="p-4 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-bold tracking-wider uppercase text-amber-600 dark:text-amber-400">Warnings</span>
            <AlertTriangle className="w-4 h-4 text-amber-500" />
          </div>
          <div className="mt-2 text-2xl font-black tracking-tight text-amber-600 dark:text-amber-400">
            {levelsCount['WARNING'] || 0}
          </div>
          <div className="mt-1 text-[11px] text-slate-500">
            Failed logins &amp; security flags
          </div>
        </div>

        {/* Errors & Crashes */}
        <div className="p-4 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-bold tracking-wider uppercase text-rose-600 dark:text-rose-400">Errors</span>
            <AlertCircle className="w-4 h-4 text-rose-500" />
          </div>
          <div className="mt-2 text-2xl font-black tracking-tight text-rose-600 dark:text-rose-400">
            {(levelsCount['ERROR'] || 0) + (levelsCount['CRITICAL'] || 0)}
          </div>
          <div className="mt-1 text-[11px] text-slate-500">
            Exceptions &amp; HTTP 500 faults
          </div>
        </div>
      </div>

      {/* Toolbar & Filters */}
      <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-3 shadow-xs flex flex-wrap items-center justify-between gap-3">
        {/* Left: File Switcher */}
        <div className="flex items-center bg-slate-100 dark:bg-slate-800 p-1 rounded-xl">
          <button
            type="button"
            onClick={() => setActiveFile('app')}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition flex items-center gap-1.5 cursor-pointer ${
              activeFile === 'app'
                ? 'bg-brand-royal text-white shadow-xs'
                : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
            }`}
          >
            <FileText className="w-3.5 h-3.5" />
            <span>app.log (All Events)</span>
          </button>
          <button
            type="button"
            onClick={() => setActiveFile('error')}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition flex items-center gap-1.5 cursor-pointer ${
              activeFile === 'error'
                ? 'bg-rose-600 text-white shadow-xs'
                : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
            }`}
          >
            <AlertCircle className="w-3.5 h-3.5" />
            <span>error.log (Crashes Only)</span>
          </button>
        </div>

        {/* Middle/Right: Search, Severity Filter & Lines Count */}
        <div className="flex flex-wrap items-center gap-2.5">
          {/* Search Input */}
          <div className="relative min-w-[180px] sm:min-w-[220px]">
            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400">
              <Search className="w-3.5 h-3.5" />
            </div>
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Search log messages..."
              className="w-full pl-8 pr-3 py-1.5 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50/50 dark:bg-slate-800/40 text-slate-900 dark:text-slate-100 placeholder-slate-400 focus:outline-none focus:ring-1 focus:ring-brand-royal"
            />
          </div>

          {/* Level Filter Dropdown */}
          <div className="relative">
            <select
              value={levelFilter}
              onChange={(e) => setLevelFilter(e.target.value)}
              className="py-1.5 pl-3 pr-8 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300 font-medium focus:outline-none focus:ring-1 focus:ring-brand-royal appearance-none cursor-pointer"
            >
              <option value="ALL">All Levels</option>
              <option value="INFO">INFO Only</option>
              <option value="WARNING">WARNING Only</option>
              <option value="ERROR">ERROR Only</option>
            </select>
            <div className="absolute inset-y-0 right-0 pr-2.5 flex items-center pointer-events-none text-slate-400">
              <ChevronDown className="w-3.5 h-3.5" />
            </div>
          </div>

          {/* Max Lines Dropdown */}
          <div className="relative">
            <select
              value={lineCount}
              onChange={(e) => setLineCount(Number(e.target.value))}
              className="py-1.5 pl-3 pr-8 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300 font-medium focus:outline-none focus:ring-1 focus:ring-brand-royal appearance-none cursor-pointer"
            >
              <option value={50}>Last 50 lines</option>
              <option value={150}>Last 150 lines</option>
              <option value={300}>Last 300 lines</option>
              <option value={500}>Last 500 lines</option>
            </select>
            <div className="absolute inset-y-0 right-0 pr-2.5 flex items-center pointer-events-none text-slate-400">
              <ChevronDown className="w-3.5 h-3.5" />
            </div>
          </div>

          {/* Refresh Button */}
          <button
            type="button"
            onClick={() => refetch()}
            className="p-2 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700 transition cursor-pointer"
            title="Refresh logs"
          >
            <RotateCw className={`w-3.5 h-3.5 ${isRefetching ? 'animate-spin text-brand-royal' : ''}`} />
          </button>
        </div>
      </div>

      {/* Terminal Console Box */}
      <div className="bg-[#0D1117] rounded-2xl border border-slate-800 shadow-xl overflow-hidden flex flex-col">
        {/* Terminal Title Bar */}
        <div className="bg-[#161B22] px-4 py-2.5 border-b border-slate-800 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="flex items-center gap-1.5">
              <span className="w-3 h-3 rounded-full bg-[#FF5F56]" />
              <span className="w-3 h-3 rounded-full bg-[#FFBD2E]" />
              <span className="w-3 h-3 rounded-full bg-[#27C93F]" />
            </div>
            <span className="text-xs font-mono font-bold text-slate-400 ml-2">
              logs/{activeFile}.log
            </span>
          </div>

          <div className="flex items-center gap-3 text-[11px] font-mono text-slate-400">
            <span>Showing {logs.length} of {totalLines} lines</span>
          </div>
        </div>

        {/* Log Viewer Body */}
        <div className="p-4 font-mono text-xs overflow-x-auto overflow-y-auto max-h-[600px] min-h-[380px] custom-scrollbar bg-[#0D1117] space-y-1">
          {isLoading ? (
            <div className="h-64 flex flex-col items-center justify-center text-slate-500 gap-2">
              <RotateCw className="w-6 h-6 animate-spin text-blue-400" />
              <span>Loading system logs...</span>
            </div>
          ) : isError ? (
            <div className="h-64 flex flex-col items-center justify-center text-rose-400 gap-2">
              <AlertCircle className="w-6 h-6" />
              <span>Failed to fetch logs: {(error as any)?.message || 'Unknown error'}</span>
            </div>
          ) : logs.length === 0 ? (
            <div className="h-64 flex flex-col items-center justify-center text-slate-500 gap-2 text-center">
              <CheckCircle2 className="w-8 h-8 text-emerald-500/60" />
              <span className="font-semibold text-slate-400">No log entries found</span>
              <span className="text-[11px] text-slate-600 max-w-sm">
                {searchTerm || levelFilter !== 'ALL'
                  ? 'No entries match your search criteria. Try adjusting or resetting the filter.'
                  : `Log file ${activeFile}.log is currently empty or has not recorded any new events.`}
              </span>
            </div>
          ) : (
            logs.map((log, idx) => {
              const isErrorLevel = log.level === 'ERROR' || log.level === 'CRITICAL';
              const isWarnLevel = log.level === 'WARNING';
              const isInfoLevel = log.level === 'INFO';
              const lineKey = `log-${idx}-${log.timestamp}`;

              return (
                <div
                  key={lineKey}
                  className={`group flex items-start gap-2.5 py-1 px-2 rounded hover:bg-white/5 transition-colors ${
                    isErrorLevel
                      ? 'bg-rose-950/20 text-rose-200 border-l-2 border-rose-500'
                      : isWarnLevel
                      ? 'bg-amber-950/15 text-amber-200 border-l-2 border-amber-500'
                      : 'text-slate-300'
                  }`}
                >
                  {/* Timestamp */}
                  <span className="text-slate-500 shrink-0 select-all">
                    {log.timestamp || '------------'}
                  </span>

                  {/* Level Badge */}
                  <span
                    className={`px-1.5 py-0.2 rounded text-[10px] font-bold shrink-0 uppercase tracking-wider ${
                      isErrorLevel
                        ? 'bg-rose-500/20 text-rose-400 border border-rose-500/30'
                        : isWarnLevel
                        ? 'bg-amber-500/20 text-amber-400 border border-amber-500/30'
                        : 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                    }`}
                  >
                    {log.level}
                  </span>

                  {/* Logger Name */}
                  {log.logger && log.logger !== 'system' && (
                    <span className="text-sky-400/80 shrink-0 font-semibold">
                      [{log.logger}]
                    </span>
                  )}

                  {/* Message */}
                  <span className="flex-1 break-all select-all leading-relaxed">
                    {log.message}
                  </span>

                  {/* Copy Line Action */}
                  <button
                    type="button"
                    onClick={() => handleCopyLine(log.raw, lineKey)}
                    className="opacity-0 group-hover:opacity-100 text-slate-500 hover:text-white transition p-1 cursor-pointer shrink-0"
                    title="Copy log entry"
                  >
                    {copiedId === lineKey ? (
                      <Check className="w-3.5 h-3.5 text-emerald-400" />
                    ) : (
                      <Copy className="w-3.5 h-3.5" />
                    )}
                  </button>
                </div>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
};
