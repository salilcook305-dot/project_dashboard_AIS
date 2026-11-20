import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  FileText,
  Download,
  Trash2,
  Upload,
  Search,
  Filter,
  Layers,
  FileSpreadsheet,
  FileCode,
  FileCheck,
  AlertCircle
} from 'lucide-react';
import { api } from '../lib/api';
import { User, Project } from '../types';
import { useCurrentUser } from '../components/ProtectedRoute';
import { toast } from 'sonner';

interface DocumentsPageProps {
  currentUser?: User;
}

export const DocumentsPage: React.FC<DocumentsPageProps> = ({ currentUser: propUser }) => {
  const { user: authUser } = useCurrentUser();
  const currentUser = propUser || authUser || ({} as User);
  const queryClient = useQueryClient();
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedProject, setSelectedProject] = useState<string>('all');
  const [selectedType, setSelectedType] = useState<string>('all');
  const [isUploadOpen, setIsUploadOpen] = useState(false);
  const [uploadProjectId, setUploadProjectId] = useState<number | ''>('');
  const [uploadFileType, setUploadFileType] = useState('documentation');
  const [uploadFile, setUploadFile] = useState<File | null>(null);

  const { data: files = [], isLoading, error } = useQuery({
    queryKey: ['documents-hub'],
    queryFn: () => api.getFiles(),
  });

  const { data: projects = [] } = useQuery<Project[]>({
    queryKey: ['projects'],
    queryFn: () => api.getProjects(),
  });

  const uploadMutation = useMutation({
    mutationFn: async () => {
      if (!uploadProjectId || !uploadFile) throw new Error('Please select project and file');
      return api.uploadDocument(Number(uploadProjectId), uploadFile, uploadFileType);
    },
    onSuccess: () => {
      toast.success('Document uploaded successfully');
      setIsUploadOpen(false);
      setUploadFile(null);
      setUploadProjectId('');
      queryClient.invalidateQueries({ queryKey: ['documents-hub'] });
      queryClient.invalidateQueries({ queryKey: ['projects'] });
    },
    onError: (err: any) => {
      toast.error(err.message || 'Failed to upload document');
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: number) => api.deleteDocument(id),
    onSuccess: () => {
      toast.success('Document deleted successfully');
      queryClient.invalidateQueries({ queryKey: ['documents-hub'] });
      queryClient.invalidateQueries({ queryKey: ['projects'] });
    },
    onError: (err: any) => {
      toast.error(err.message || 'Failed to delete document');
    },
  });

  const canManage = currentUser.is_admin || currentUser.is_manager;

  const filteredFiles = files.filter((f: any) => {
    const filename = (f.original_filename || f.stored_filename || '').toLowerCase();
    const projName = (f.project_name || '').toLowerCase();
    const searchMatch = !searchTerm || filename.includes(searchTerm.toLowerCase()) || projName.includes(searchTerm.toLowerCase());
    const projectMatch = selectedProject === 'all' || String(f.project || f.project_id) === selectedProject;
    const typeMatch = selectedType === 'all' || (f.file_type || '').toLowerCase() === selectedType.toLowerCase();
    return searchMatch && projectMatch && typeMatch;
  });

  const getFileIcon = (fileType: string) => {
    switch ((fileType || '').toLowerCase()) {
      case 'roadmap':
        return <Layers className="w-5 h-5 text-amber-500" />;
      case 'specification':
        return <FileCheck className="w-5 h-5 text-emerald-500" />;
      case 'architecture':
        return <FileCode className="w-5 h-5 text-purple-500" />;
      case 'spreadsheet':
      case 'excel':
        return <FileSpreadsheet className="w-5 h-5 text-emerald-600" />;
      default:
        return <FileText className="w-5 h-5 text-blue-500" />;
    }
  };

  const handleDownload = async (id: number, filename: string) => {
    try {
      toast.info(`Downloading ${filename}...`);
      await api.downloadDocument(id, filename);
      toast.success('Download ready');
    } catch (err: any) {
      toast.error(err.message || 'Download failed');
    }
  };

  return (
    <div className="space-y-6">
      {/* Header Banner */}
      <div className="bg-white dark:bg-[#0F1B30] p-6 rounded-2xl border border-slate-200 dark:border-[#1E2D4A] shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center space-x-2">
            <h1 className="text-xl font-bold text-slate-900 dark:text-white">Documents Hub & Specifications</h1>
            <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-blue-100 dark:bg-blue-950/70 text-blue-700 dark:text-blue-300 uppercase">
              Secure Repo
            </span>
          </div>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
            Centralized engineering repository for project roadmaps, architecture blueprints, design specs, and deliverable files.
          </p>
        </div>

        <div className="flex items-center space-x-3 shrink-0">
          <button
            onClick={() => setIsUploadOpen(true)}
            className="px-4 py-2 bg-[#0174E7] hover:bg-blue-600 active:scale-95 text-white font-semibold rounded-xl text-xs transition flex items-center space-x-2 shadow-xs cursor-pointer"
          >
            <Upload className="w-4 h-4" />
            <span>Upload Document</span>
          </button>
        </div>
      </div>

      {/* Filters Bar */}
      <div className="bg-white dark:bg-[#0F1B30] p-4 rounded-xl border border-slate-200 dark:border-[#1E2D4A] shadow-xs flex flex-wrap gap-3 items-center justify-between">
        <div className="relative flex-1 min-w-[240px]">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            placeholder="Search documents or projects..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-9 pr-4 py-2 bg-slate-50 dark:bg-[#15223C] border border-slate-200 dark:border-[#253554] rounded-xl text-xs text-slate-900 dark:text-white placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-[#0174E7]"
          />
        </div>

        <div className="flex items-center space-x-3 w-full sm:w-auto">
          <div className="flex items-center space-x-1.5">
            <Filter className="w-3.5 h-3.5 text-slate-400" />
            <select
              value={selectedProject}
              onChange={(e) => setSelectedProject(e.target.value)}
              className="px-3 py-2 bg-slate-50 dark:bg-[#15223C] border border-slate-200 dark:border-[#253554] rounded-xl text-xs text-slate-700 dark:text-slate-300 focus:outline-none focus:ring-2 focus:ring-[#0174E7]"
            >
              <option value="all">All Projects ({projects.length})</option>
              {projects.map((p) => (
                <option key={p.id} value={String(p.id)}>
                  {p.name || p.title}
                </option>
              ))}
            </select>
          </div>

          <select
            value={selectedType}
            onChange={(e) => setSelectedType(e.target.value)}
            className="px-3 py-2 bg-slate-50 dark:bg-[#15223C] border border-slate-200 dark:border-[#253554] rounded-xl text-xs text-slate-700 dark:text-slate-300 focus:outline-none focus:ring-2 focus:ring-[#0174E7]"
          >
            <option value="all">All File Types</option>
            <option value="roadmap">Roadmap</option>
            <option value="specification">Specification</option>
            <option value="architecture">Architecture</option>
            <option value="documentation">Documentation</option>
          </select>
        </div>
      </div>

      {/* Files List */}
      {isLoading ? (
        <div className="bg-white dark:bg-[#0F1B30] p-12 rounded-2xl border border-slate-200 dark:border-[#1E2D4A] text-center">
          <div className="w-8 h-8 border-2 border-blue-500 border-t-transparent rounded-full animate-spin mx-auto mb-3" />
          <p className="text-xs text-slate-500">Loading document registry...</p>
        </div>
      ) : error ? (
        <div className="bg-rose-50 dark:bg-rose-950/20 p-6 rounded-2xl border border-rose-200 dark:border-rose-900/40 text-center">
          <AlertCircle className="w-6 h-6 text-rose-500 mx-auto mb-2" />
          <p className="text-xs font-semibold text-rose-700 dark:text-rose-400">Failed to load documents</p>
        </div>
      ) : filteredFiles.length === 0 ? (
        <div className="bg-white dark:bg-[#0F1B30] p-12 rounded-2xl border border-slate-200 dark:border-[#1E2D4A] text-center text-slate-400">
          <FileText className="w-10 h-10 mx-auto mb-3 text-slate-300 dark:text-slate-600" />
          <p className="text-sm font-semibold text-slate-600 dark:text-slate-300">No documents found</p>
          <p className="text-xs text-slate-400 mt-1">
            {searchTerm || selectedProject !== 'all' || selectedType !== 'all'
              ? 'Try adjusting your filters or search query.'
              : 'Upload a project roadmap or specification to populate the registry.'}
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredFiles.map((f: any) => {
            const filename = f.original_filename || f.stored_filename || 'Document';
            const fType = f.file_type || 'documentation';
            const sizeStr = f.file_size_formatted || (f.file_size ? `${(f.file_size / 1024).toFixed(1)} KB` : 'Unknown size');

            return (
              <div
                key={f.id}
                className="bg-white dark:bg-[#0F1B30] p-4 rounded-xl border border-slate-200 dark:border-[#1E2D4A] shadow-2xs hover:border-[#0174E7] dark:hover:border-blue-500 transition flex flex-col justify-between"
              >
                <div>
                  <div className="flex items-start justify-between gap-2 mb-2">
                    <div className="w-10 h-10 rounded-xl bg-slate-50 dark:bg-[#15223C] border border-slate-200 dark:border-[#253554] flex items-center justify-center shrink-0">
                      {getFileIcon(fType)}
                    </div>
                    <span className="px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300">
                      {fType}
                    </span>
                  </div>

                  <h3 className="font-bold text-slate-900 dark:text-white text-xs line-clamp-1" title={filename}>
                    {filename}
                  </h3>

                  <div className="mt-1 flex items-center space-x-2 text-[11px] text-slate-500 dark:text-slate-400">
                    <span className="font-medium text-[#0174E7] dark:text-blue-400 line-clamp-1">
                      {f.project_name || `Project #${f.project || f.project_id}`}
                    </span>
                    <span>•</span>
                    <span>{sizeStr}</span>
                  </div>

                  <div className="mt-2 text-[10px] text-slate-400 dark:text-slate-500">
                    Uploaded {f.uploaded_at ? new Date(f.uploaded_at).toLocaleDateString() : 'Recently'}
                    {f.uploader_name && ` by ${f.uploader_name}`}
                  </div>
                </div>

                <div className="mt-4 pt-3 border-t border-slate-100 dark:border-[#1E2D4A] flex items-center justify-between">
                  <button
                    onClick={() => handleDownload(f.id, filename)}
                    className="inline-flex items-center space-x-1.5 px-3 py-1.5 bg-blue-50 hover:bg-blue-100 dark:bg-blue-950/40 dark:hover:bg-blue-900/40 text-[#0174E7] dark:text-blue-400 rounded-lg text-xs font-semibold transition cursor-pointer"
                  >
                    <Download className="w-3.5 h-3.5" />
                    <span>Download</span>
                  </button>

                  {canManage && (
                    <button
                      onClick={() => {
                        if (confirm(`Permanently delete "${filename}"?`)) {
                          deleteMutation.mutate(f.id);
                        }
                      }}
                      disabled={deleteMutation.isPending}
                      className="p-1.5 text-slate-400 hover:text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-950/30 rounded-lg transition cursor-pointer"
                      title="Delete Document"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Upload Modal */}
      {isUploadOpen && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white dark:bg-[#0F1B30] w-full max-w-md rounded-2xl border border-slate-200 dark:border-[#1E2D4A] shadow-xl p-6 space-y-4">
            <h2 className="text-base font-bold text-slate-900 dark:text-white">Upload Project Document</h2>
            <p className="text-xs text-slate-500">Select a project and file to upload securely.</p>

            <div className="space-y-3">
              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Target Project *
                </label>
                <select
                  value={uploadProjectId}
                  onChange={(e) => setUploadProjectId(e.target.value ? Number(e.target.value) : '')}
                  className="w-full px-3 py-2 bg-slate-50 dark:bg-[#15223C] border border-slate-200 dark:border-[#253554] rounded-xl text-xs text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-[#0174E7]"
                >
                  <option value="">-- Choose Project --</option>
                  {projects.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name || p.title} ({p.project_code || `#${p.id}`})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Document Type *
                </label>
                <select
                  value={uploadFileType}
                  onChange={(e) => setUploadFileType(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-50 dark:bg-[#15223C] border border-slate-200 dark:border-[#253554] rounded-xl text-xs text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-[#0174E7]"
                >
                  <option value="documentation">General Documentation</option>
                  <option value="roadmap">Roadmap / Presentation</option>
                  <option value="specification">Technical Specification</option>
                  <option value="architecture">Architecture Blueprint</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  File Attachment *
                </label>
                <input
                  type="file"
                  onChange={(e) => setUploadFile(e.target.files?.[0] || null)}
                  className="w-full px-3 py-2 bg-slate-50 dark:bg-[#15223C] border border-slate-200 dark:border-[#253554] rounded-xl text-xs text-slate-700 dark:text-slate-300 file:mr-3 file:py-1 file:px-2.5 file:rounded-lg file:border-0 file:text-xs file:font-semibold file:bg-blue-50 file:text-[#0174E7]"
                />
              </div>
            </div>

            <div className="pt-3 flex justify-end space-x-2 border-t border-slate-100 dark:border-[#1E2D4A]">
              <button
                type="button"
                onClick={() => {
                  setIsUploadOpen(false);
                  setUploadFile(null);
                }}
                className="px-4 py-2 text-xs font-semibold text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl transition cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => uploadMutation.mutate()}
                disabled={uploadMutation.isPending || !uploadProjectId || !uploadFile}
                className="px-4 py-2 bg-[#0174E7] hover:bg-blue-600 active:scale-95 text-white font-semibold rounded-xl text-xs transition disabled:opacity-50 cursor-pointer"
              >
                {uploadMutation.isPending ? 'Uploading...' : 'Confirm Upload'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
