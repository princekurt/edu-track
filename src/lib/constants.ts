import type {
  AccountStatus,
  ComplianceStatus,
  ConcernStatus,
  DisbursementStatus,
  NotificationType,
  RequirementStatus,
  Role,
  ScholarStatus,
} from "./types";

export const ROLE_LABELS: Record<Role, string> = {
  administrator: "Administrator",
  scholarship_staff: "Scholarship Staff",
  compliance: "Compliance Personnel",
  disbursement: "Disbursement Personnel",
  scholar: "Scholar",
};

export const STAFF_ROLES: Role[] = [
  "administrator",
  "scholarship_staff",
  "compliance",
  "disbursement",
];

export const ACCOUNT_LABELS: Record<AccountStatus, string> = {
  pending: "Pending approval",
  active: "Active",
  disabled: "Disabled",
};

export const SCHOLAR_LABELS: Record<ScholarStatus, string> = {
  active: "Active",
  inactive: "Inactive",
  graduated: "Graduated",
};

export const REQUIREMENT_LABELS: Record<RequirementStatus, string> = {
  pending: "Pending",
  submitted: "Submitted",
  verified: "Verified",
  rejected: "Rejected",
};

export const COMPLIANCE_LABELS: Record<ComplianceStatus, string> = {
  pending: "Pending",
  compliant: "Compliant",
  non_compliant: "Non-compliant",
};

export const DISBURSEMENT_LABELS: Record<DisbursementStatus, string> = {
  pending: "Pending",
  processing: "Processing",
  released: "Released",
  on_hold: "On hold",
};

export const CONCERN_LABELS: Record<ConcernStatus, string> = {
  open: "Open",
  in_progress: "In progress",
  resolved: "Resolved",
};

export const NOTIFICATION_LABELS: Record<NotificationType, string> = {
  reminder: "Reminder",
  flag: "Flag",
  info: "Information",
  concern: "Concern",
};

export const SCHOLAR_STATUS_OPTIONS: ScholarStatus[] = ["active", "inactive", "graduated"];
export const COMPLIANCE_STATUS_OPTIONS: ComplianceStatus[] = ["pending", "compliant", "non_compliant"];
export const DISBURSEMENT_STATUS_OPTIONS: DisbursementStatus[] = ["pending", "processing", "released", "on_hold"];
export const REQUIREMENT_STATUS_OPTIONS: RequirementStatus[] = ["pending", "submitted", "verified", "rejected"];
export const CONCERN_STATUS_OPTIONS: ConcernStatus[] = ["open", "in_progress", "resolved"];

export const appName = "EduTrack";
export const programName = "EduKar Scholarship Program";
