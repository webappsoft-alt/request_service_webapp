import { createEntityNotesSlice } from "@/store/notes/createEntityNotesSlice";
import type { NotesEntityType, NotesModuleKey } from "@/store/notes/types";
import type { ReminderSubjectKind } from "@/lib/data/crm-people";

/** Exact API entityType values from CRM_UNIVERSAL_NOTES_INTEGRATION_GUIDE.md */
export const NOTES_ENTITY_BY_SUBJECT: Record<
  ReminderSubjectKind,
  NotesEntityType
> = {
  customer: "Customer",
  employee: "Employee",
  contractor: "Contractor",
  vendor: "Vendor",
  estimate: "Estimate",
  request: "Request",
  job: "Job",
  invoice: "Invoice",
};

export const customerNotesModule = createEntityNotesSlice({
  name: "customerNotes",
  entityType: "Customer",
  /** CRM contract + product rule: Customer Notes always page size 10. */
  fixedLimit: 10,
});

export const estimateNotesModule = createEntityNotesSlice({
  name: "estimateNotes",
  entityType: "Estimate",
});

export const requestNotesModule = createEntityNotesSlice({
  name: "requestNotes",
  entityType: "Request",
});

export const jobNotesModule = createEntityNotesSlice({
  name: "jobNotes",
  entityType: "Job",
});

export const employeeNotesModule = createEntityNotesSlice({
  name: "employeeNotes",
  entityType: "Employee",
});

export const contractorNotesModule = createEntityNotesSlice({
  name: "contractorNotes",
  entityType: "Contractor",
});

export const vendorNotesModule = createEntityNotesSlice({
  name: "vendorNotes",
  entityType: "Vendor",
});

export const invoiceNotesModule = createEntityNotesSlice({
  name: "invoiceNotes",
  entityType: "Invoice",
});

export const notesModulesByKey = {
  customerNotes: customerNotesModule,
  estimateNotes: estimateNotesModule,
  requestNotes: requestNotesModule,
  jobNotes: jobNotesModule,
  employeeNotes: employeeNotesModule,
  contractorNotes: contractorNotesModule,
  vendorNotes: vendorNotesModule,
  invoiceNotes: invoiceNotesModule,
} as const;

export const notesModuleKeyBySubject: Record<
  ReminderSubjectKind,
  NotesModuleKey
> = {
  customer: "customerNotes",
  estimate: "estimateNotes",
  request: "requestNotes",
  job: "jobNotes",
  employee: "employeeNotes",
  contractor: "contractorNotes",
  vendor: "vendorNotes",
  invoice: "invoiceNotes",
};

export function getNotesModuleForSubject(kind: ReminderSubjectKind) {
  return notesModulesByKey[notesModuleKeyBySubject[kind]];
}
