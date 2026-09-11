/**
 * Which models the tenant extension guards, and how.
 *
 * Keeping this as an explicit list rather than "every model with an
 * organizationId column" is deliberate: adding a tenant-scoped model should be
 * a conscious act, and a model missing from here fails loudly in the guard test
 * rather than quietly leaking across tenants.
 */

/** ORG scope — filtered by organizationId on read, stamped on write. */
export const ORG_SCOPED_MODELS = new Set<string>([
  'User',
  'Role',
  'RefreshToken',
  'Employee',
  'Department',
  'Designation',
  'Client',
  'ClientContact',
  'Lead',
  'LeadNote',
  'PipelineStage',
  'Deal',
  'Project',
  'Milestone',
  'Task',
  'TimeLog',
  'Discussion',
  'DiscussionReply',
  'Contract',
  'Invoice',
  'Payment',
  'Estimate',
  'CreditNote',
  'Expense',
  'BankAccount',
  'LeaveType',
  'LeaveRequest',
  'AttendanceRecord',
  'Shift',
  'Holiday',
  'Salary',
  'Payslip',
  'Objective',
  'Job',
  'Application',
  'Interview',
  'Offer',
  'Ticket',
  'TicketReply',
  'Asset',
  'Event',
  'Notice',
  'KbArticle',
  'LetterTemplate',
  'GeneratedLetter',
  'MailAccount',
  'MailMessage',
  'Channel',
  'ChannelMessage',
  'ReviewMeeting',
  'Attachment',
  'Notification',
  'Todo',
  'Setting',
  'AuditLog',
  'LeadForm',
  'LeadEmail',
  'Proposal',
  'RecurringInvoice',
  'RecurringExpense',
  'BankTransaction',
  'Award',
  'Appreciation',
  'SalaryChange',
  'OvertimeRequest',
  'RoadmapIdea',
  'BioLink',
  'QrCode',
  'Webhook',
  'Hosting',
  'Domain',
  'BiometricDevice',
  'BiometricPunch',
  'Floor',
  'OfficeRoom',
  'TeamMeeting',
  'Recording',
]);

/**
 * USER scope — org-scoped *and* private to one person. The extension adds the
 * userId filter on top of the organization filter, so one user cannot read
 * another's mail accounts, notifications or to-dos even inside the same tenant.
 */
export const USER_SCOPED_MODELS = new Set<string>([
  'MailAccount',
  'Notification',
  'Todo',
]);

/**
 * GLOBAL — shared reference data, never filtered.
 * Organization itself is here: it is the tenant, so it cannot filter by one.
 */
export const GLOBAL_MODELS = new Set<string>(['Permission', 'Organization']);

/**
 * JOIN tables reached only through an org-scoped parent. They carry no
 * organizationId, so the extension leaves them alone; the service layer is
 * responsible for only ever writing them inside the parent's transaction.
 */
export const JOIN_MODELS = new Set<string>([
  'RolePermission',
  'UserRole',
  'ProjectMember',
  'TaskAssignee',
  'ChannelMember',
  'InvoiceItem',
  'KeyResult',
  'EmergencyContact',
  'EmployeeDocument',
  'LeaveBalance',
  'AssetMovement',
  'RoadmapIdeaVote',
  'TeamMeetingAttendee',
]);

export const isOrgScoped = (model?: string) => !!model && ORG_SCOPED_MODELS.has(model);
export const isUserScoped = (model?: string) => !!model && USER_SCOPED_MODELS.has(model);

/** Operations that read and therefore need a WHERE filter injected. */
export const READ_OPERATIONS = new Set([
  'findUnique',
  'findUniqueOrThrow',
  'findFirst',
  'findFirstOrThrow',
  'findMany',
  'count',
  'aggregate',
  'groupBy',
]);

/** Operations that mutate existing rows — filter, don't stamp. */
export const MUTATE_MANY_OPERATIONS = new Set([
  'updateMany',
  'deleteMany',
]);

/** Operations that create rows — stamp the tenant on the payload. */
export const CREATE_OPERATIONS = new Set(['create', 'createMany', 'createManyAndReturn']);

/** Single-row mutations addressed by unique key — filter and stamp. */
export const SINGLE_MUTATE_OPERATIONS = new Set(['update', 'delete', 'upsert']);
