/** Queue names, kept in one place so producers and consumers cannot drift. */
export const QUEUES = {
  MAIL: 'mail',
  REPORTS: 'reports',
  RECURRING: 'recurring',
  NOTIFICATIONS: 'notifications',
  MAINTENANCE: 'maintenance',
} as const;

export const JOBS = {
  /** Deliver an outbound message through the tenant's SMTP account. */
  SEND_MAIL: 'send-mail',
  /** Pull new messages for a connected IMAP account. */
  SYNC_MAILBOX: 'sync-mailbox',
  /** Generate the invoices due today from recurring schedules. */
  GENERATE_RECURRING_INVOICES: 'generate-recurring-invoices',
  /** Flip unpaid invoices past their due date to OVERDUE. */
  MARK_OVERDUE_INVOICES: 'mark-overdue-invoices',
  /** Build a heavy export off the request path. */
  BUILD_EXPORT: 'build-export',
  /** Fan a notification out to its recipients. */
  DISPATCH_NOTIFICATION: 'dispatch-notification',
  /** Delete expired refresh tokens. */
  PURGE_EXPIRED_TOKENS: 'purge-expired-tokens',
} as const;
