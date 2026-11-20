export type ProjectStatus = 'Planning' | 'In Progress' | 'Completed' | 'Cancelled' | 'On Hold' | 'PLANNING' | 'IN_PROGRESS' | 'COMPLETED' | 'CANCELLED';
export type ProjectPriority = 'Low' | 'Medium' | 'High' | 'Urgent' | 'LOW' | 'MEDIUM' | 'HIGH' | 'URGENT';
export type AvailabilityStatus = 'AVAILABLE' | 'BUSY' | 'HEAVY' | 'OVERLOADED' | 'ON_LEAVE' | 'AWAY';

export interface Employee {
  id: number;
  username: string;
  email: string;
  first_name: string;
  last_name: string;
  name?: string;
  full_name?: string;
  job_title?: string;
  department?: string;
  avatar?: string | null;
  avatar_initials?: string;
  initials?: string;
  is_active?: boolean;
  role?: string;
  raw_role?: string;
  assigned_projects_count?: number;
  active_count?: number;
  total_count?: number;
  status?: AvailabilityStatus;
  availability_override?: string | null;
  leave_until?: string | null;
}

export interface User {
  id: number;
  username: string;
  name?: string;
  email: string;
  first_name?: string;
  last_name?: string;
  role: 'ADMIN' | 'MANAGER' | 'EMPLOYEE' | 'admin' | 'project_manager' | 'developer';
  role_label?: string;
  is_admin: boolean;
  is_manager: boolean;
  is_employee?: boolean;
  is_superuser?: boolean;
  avatar?: string | null;
  avatar_initials?: string;
  initials?: string;
  department?: string;
  job_title?: string;
  status?: AvailabilityStatus;
  active_count?: number;
  availability_override?: string | null;
  leave_until?: string | null;
}

export interface ProjectTeamMember {
  id?: number;
  member_record_id?: number;
  employee?: number;
  user_id?: number;
  name?: string;
  email?: string;
  avatar_initials?: string;
  department?: string;
  employee_detail?: Employee;
  project_role: string;
  role_on_project?: string;
  joined_at?: string;
  status?: AvailabilityStatus;
  active_count?: number;
  availability_override?: string | null;
  leave_until?: string | null;
}

export interface ProjectDocument {
  id: number;
  project?: number;
  project_id?: number;
  title?: string;
  original_filename?: string;
  stored_filename?: string;
  file_type?: string;
  doc_type?: string;
  file?: string;
  file_size?: number;
  size_bytes?: number;
  file_size_formatted?: string;
  uploader_name?: string;
  uploaded_by?: number | any;
  uploaded_by_detail?: Employee;
  uploaded_at: string;
}

export interface Project {
  id: number;
  project_code?: string;
  name?: string;
  title?: string;
  description: string;
  status: string;
  priority: string;
  progress?: number;
  frontend_progress?: number;
  backend_progress?: number;
  database_progress?: number;
  latest_progress_report?: string;
  progress_reported_at?: string | null;
  category?: string;
  start_date: string;
  end_date: string;
  start_date_formatted?: string;
  end_date_formatted?: string;
  deadline_status?: string;
  deadline_label?: string;
  deadline_badge?: string;
  budget?: string | number;
  manager?: number;
  creator_name?: string;
  creator_email?: string;
  manager_detail?: Employee;
  project_manager?: {
    id: number;
    name: string;
    email: string;
  } | null;
  poc?: {
    id: number;
    name: string;
    email?: string;
    initials?: string;
  } | null;
  last_diary_date?: string | null;
  diary_overdue?: boolean;
  team?: ProjectTeamMember[];
  documents?: ProjectDocument[];
  files?: ProjectDocument[];
  roadmaps?: ProjectDocument[];
  docs?: ProjectDocument[];
  activity?: Array<{
    id: number;
    user_name: string;
    action: string;
    details: string;
    timestamp: string;
  }>;
  created_at?: string;
  updated_at?: string;
}

export interface DiaryEntry {
  id: number;
  project_id: number;
  project_name?: string;
  project_code?: string;
  author: {
    id: number;
    name: string;
    initials: string;
    job_title?: string;
    department?: string;
  };
  entry_date: string;
  done: string;
  in_progress: string;
  next_up: string;
  blockers?: string;
  reviewed_by?: {
    id: number;
    name: string;
  } | null;
  reviewed_at?: string | null;
  created_at: string;
  updated_at: string;
}

export interface EmployeeWorkloadRecord {
  id: number;
  name: string;
  initials: string;
  job_title: string;
  department: string;
  active_count: number;
  total_count: number;
  status: AvailabilityStatus;
  availability_override?: string | null;
  leave_until?: string | null;
  projects: Array<{
    id: number;
    name: string;
    status: string;
    priority: string;
  }>;
}

export interface MyDiaryItem {
  project: {
    id: number;
    name: string;
    project_code: string;
    status: string;
    priority: string;
    poc?: { id: number; name: string } | null;
  };
  today_entry?: DiaryEntry | null;
  can_update?: boolean;
  prefill: {
    done: string;
    in_progress: string;
    next_up: string;
    blockers: string;
  };
}

export interface DueDiaryProject {
  project_id: number;
  project_name: string;
  project_code: string;
  poc?: { id: number; name: string } | null;
  missing_count: number;
  missing_members: Array<{
    id: number;
    name: string;
    initials: string;
    email: string;
    role_on_project: string;
    status: AvailabilityStatus;
  }>;
}

export interface DueDiaryReport {
  total_missing: number;
  projects: DueDiaryProject[];
}
