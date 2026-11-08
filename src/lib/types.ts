export type Role =
  | "administrator"
  | "scholarship_staff"
  | "compliance"
  | "disbursement"
  | "scholar";

export type AccountStatus = "pending" | "active" | "disabled";
export type ScholarStatus = "active" | "inactive" | "graduated";
export type RequirementStatus = "pending" | "submitted" | "verified" | "rejected";
export type ComplianceStatus = "pending" | "compliant" | "non_compliant";
export type DisbursementStatus = "pending" | "processing" | "released" | "on_hold";
export type ConcernStatus = "open" | "in_progress" | "resolved";
export type NotificationType = "reminder" | "flag" | "info" | "concern";
export type NotificationStatus = "unread" | "read";

export interface Profile {
  id: string;
  email: string;
  full_name: string;
  role: Role;
  status: AccountStatus;
  created_at: string;
  updated_at: string;
}

export interface AcademicPeriod {
  id: string;
  name: string;
  school_year: string;
  semester: string;
  start_date: string;
  end_date: string;
  is_active: boolean;
  created_at: string;
}

export interface ProgramSettings {
  id: number;
  required_render_hours: number;
  carry_forward_enabled: boolean;
  deadline_warning_days: number;
  updated_at: string;
}

export interface Scholar {
  id: string;
  scholar_ref: string;
  profile_id: string | null;
  full_name: string;
  email: string | null;
  school: string | null;
  program: string | null;
  year_level: string | null;
  contact_number: string | null;
  status: ScholarStatus;
  created_at: string;
  updated_at: string;
}

export interface Requirement {
  id: string;
  period_id: string;
  name: string;
  description: string | null;
  is_active: boolean;
  created_at: string;
}

export interface DocumentSubmission {
  id: string;
  scholar_id: string;
  requirement_id: string;
  status: RequirementStatus;
  submitted_reference: string | null;
  reviewer_id: string | null;
  remarks: string | null;
  verified_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface ComplianceRecord {
  id: string;
  scholar_id: string;
  period_id: string;
  status: ComplianceStatus;
  verifier_id: string | null;
  remarks: string | null;
  created_at: string;
  updated_at: string;
}

export interface RenderHourRecord {
  id: string;
  scholar_id: string;
  period_id: string;
  activity: string;
  hours: number;
  remarks: string | null;
  recorded_by: string | null;
  created_at: string;
}

export interface Disbursement {
  id: string;
  scholar_id: string;
  period_id: string;
  benefit_type: string;
  amount: number | null;
  status: DisbursementStatus;
  status_date: string;
  reference: string | null;
  remarks: string | null;
  recorded_by: string | null;
  created_at: string;
}

export interface ConcernTicket {
  id: string;
  ticket_no: string;
  scholar_id: string;
  subject: string;
  description: string;
  status: ConcernStatus;
  assigned_to: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
  resolved_at: string | null;
}

export interface ConcernUpdate {
  id: string;
  ticket_id: string;
  author_id: string | null;
  message: string;
  status_after: ConcernStatus | null;
  created_at: string;
}

export interface AppNotification {
  id: string;
  recipient_id: string;
  title: string;
  message: string;
  type: NotificationType;
  status: NotificationStatus;
  related_type: string | null;
  related_id: string | null;
  created_at: string;
}
