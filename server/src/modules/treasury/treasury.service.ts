import { Injectable } from '@nestjs/common';
import { Prisma } from '../../generated/prisma/client';

import { BaseCrudService } from '../../common/services/base-crud.service';
import { PrismaService } from '../../infra/prisma/prisma.service';
import { BusinessRuleError, ConflictError, NotFoundError } from '../../common/errors/domain.error';
import { orgScope } from '../../infra/tenant/tenant-context';
import type {
  CreateBankAccountDto, CreateCreditNoteDto, CreateRecurringExpenseDto,
  CreateRecurringInvoiceDto, CreateTransactionDto, TransactionQueryDto,
  UpdateBankAccountDto, UpdateCreditNoteDto, UpdateRecurringExpenseDto,
  UpdateRecurringInvoiceDto,
} from './dto/treasury.dto';

type Row = { id: string };

/** Move a date forward by one billing cycle. */
export function advance(from: Date, cycle: string): Date {
  const next = new Date(from);
  switch (cycle) {
    case 'Weekly':
      next.setDate(next.getDate() + 7);
      break;
    case 'Quarterly':
      next.setMonth(next.getMonth() + 3);
      break;
    case 'Yearly':
      next.setFullYear(next.getFullYear() + 1);
      break;
    default:
      next.setMonth(next.getMonth() + 1);
  }
  return next;
}

/**
 * Bank accounts and the ledger behind them.
 *
 * The balance is never a stored number that someone edits: it is the opening
 * balance plus every transaction. A stored balance and a transaction list will
 * disagree eventually, and then neither can be trusted.
 */
@Injectable()
export class BankAccountsService extends BaseCrudService<Row> {
  constructor(prisma: PrismaService) {
    super(prisma, 'bankAccount', ['name', 'bankName'], ['name', 'createdAt'], 'Bank account');
  }

  /** Accounts with their computed balances. */
  override async findAll(query: Parameters<BaseCrudService<Row>['findAll']>[0]) {
    const page = await super.findAll(query);
    const balances = await this.balances((page.data as Array<{ id: string }>).map((a) => a.id));

    const withBalance = (page.data as unknown as Array<Record<string, unknown>>).map((a) => ({
      ...a,
      balance: balances.get(String(a.id)) ?? Number(a.openingBalance ?? 0),
    }));

    return { ...page, data: withBalance as unknown as typeof page.data };
  }

  override async findOne(id: string) {
    const account = (await super.findOne(id)) as Record<string, unknown>;
    const balances = await this.balances([id]);
    return { ...account, balance: balances.get(id) ?? Number(account.openingBalance ?? 0) } as never;
  }

  private async balances(ids: string[]): Promise<Map<string, number>> {
    if (!ids.length) return new Map();

    const [accounts, credits, debits] = await Promise.all([
      this.prisma.db.bankAccount.findMany({
        where: { id: { in: ids } },
        select: { id: true, openingBalance: true },
      }),
      this.prisma.db.bankTransaction.groupBy({
        by: ['bankAccountId'],
        where: { bankAccountId: { in: ids }, direction: 'CREDIT' },
        _sum: { amount: true },
      }),
      this.prisma.db.bankTransaction.groupBy({
        by: ['bankAccountId'],
        where: { bankAccountId: { in: ids }, direction: 'DEBIT' },
        _sum: { amount: true },
      }),
    ]);

    const sum = (rows: Array<{ bankAccountId: string; _sum: { amount: Prisma.Decimal | null } }>) =>
      new Map(rows.map((r) => [r.bankAccountId, Number(r._sum.amount ?? 0)]));

    const inflow = sum(credits);
    const outflow = sum(debits);

    return new Map(
      accounts.map((a) => [
        a.id,
        Number(a.openingBalance) + (inflow.get(a.id) ?? 0) - (outflow.get(a.id) ?? 0),
      ]),
    );
  }

  createAccount(dto: CreateBankAccountDto) {
    return this.create({
      ...orgScope(),
      name: dto.name,
      bankName: dto.bankName ?? null,
      kind: dto.kind ?? 'Bank',
      accountNumber: dto.accountNumber ?? null,
      currency: dto.currency ?? 'USD',
      openingBalance: new Prisma.Decimal(dto.openingBalance ?? 0),
    });
  }

  updateAccount(id: string, dto: UpdateBankAccountDto) {
    return this.update(id, {
      ...dto,
      ...(dto.openingBalance !== undefined
        ? { openingBalance: new Prisma.Decimal(dto.openingBalance) }
        : {}),
    });
  }

  /** Removing an account would orphan its ledger, so refuse while it has one. */
  override async remove(id: string) {
    const count = await this.prisma.db.bankTransaction.count({ where: { bankAccountId: id } });
    if (count > 0) {
      throw new ConflictError(
        'ACCOUNT_IN_USE',
        `${count} transaction(s) belong to this account. Move or delete them first.`,
      );
    }
    return super.remove(id);
  }
}

@Injectable()
export class TransactionsService extends BaseCrudService<Row> {
  constructor(prisma: PrismaService) {
    super(prisma, 'bankTransaction', ['memo'], ['occurredOn', 'amount'], 'Transaction');
  }

  protected override buildFilters(query: TransactionQueryDto) {
    const where: Record<string, unknown> = {};
    if (query.bankAccountId) where.bankAccountId = query.bankAccountId;
    if (query.from || query.to) {
      where.occurredOn = {
        ...(query.from ? { gte: new Date(query.from) } : {}),
        ...(query.to ? { lte: new Date(query.to) } : {}),
      };
    }
    return where;
  }

  protected override listInclude() {
    return { bankAccount: { select: { id: true, name: true, currency: true } } };
  }

  async record(dto: CreateTransactionDto) {
    const account = await this.prisma.db.bankAccount.findFirst({
      where: { id: dto.bankAccountId },
      select: { id: true },
    });
    if (!account) throw new NotFoundError('Bank account', dto.bankAccountId);

    return this.create({
      ...orgScope(),
      bankAccountId: dto.bankAccountId,
      direction: dto.direction,
      amount: new Prisma.Decimal(dto.amount),
      occurredOn: new Date(dto.occurredOn),
      memo: dto.memo ?? null,
    });
  }

  /** A row produced by a payment belongs to that payment, not to an editor. */
  override async remove(id: string) {
    const row = await this.prisma.db.bankTransaction.findFirst({ where: { id } });
    if (!row) throw new NotFoundError('Transaction', id);
    if (row.paymentId) {
      throw new BusinessRuleError(
        'LINKED_TO_PAYMENT',
        'This line came from a recorded payment. Refund the payment instead.',
      );
    }
    return super.remove(id);
  }
}

/** Credit notes. Status is derived from how much has been applied. */
@Injectable()
export class CreditNotesService extends BaseCrudService<Row> {
  constructor(prisma: PrismaService) {
    super(prisma, 'creditNote', ['number', 'reason'], ['issuedOn', 'amount'], 'Credit note');
  }

  protected override listInclude() {
    return { client: { select: { id: true, name: true, company: true } } };
  }

  async createNote(dto: CreateCreditNoteDto) {
    return this.prisma.transaction(async (tx) => {
      const number = dto.number?.trim() || `CN#${String((await tx.creditNote.count()) + 1).padStart(4, '0')}`;
      const clash = await tx.creditNote.findFirst({ where: { number }, select: { id: true } });
      if (clash) throw new ConflictError('NUMBER_TAKEN', `Credit note ${number} already exists`);

      const created = await tx.creditNote.create({
        data: {
          ...orgScope(),
          clientId: dto.clientId ?? null,
          invoiceId: dto.invoiceId ?? null,
          number,
          issuedOn: new Date(dto.issuedOn ?? Date.now()),
          amount: new Prisma.Decimal(dto.total),
          reason: dto.reason ?? null,
        },
        include: this.listInclude() as never,
      });
      await this.audit('CREATE', created.id, number);
      return created;
    });
  }

  updateNote(id: string, dto: UpdateCreditNoteDto) {
    return this.update(id, {
      ...(dto.clientId !== undefined ? { clientId: dto.clientId ?? null } : {}),
      ...(dto.total !== undefined ? { amount: new Prisma.Decimal(dto.total) } : {}),
      ...(dto.issuedOn ? { issuedOn: new Date(dto.issuedOn) } : {}),
      ...(dto.reason !== undefined ? { reason: dto.reason } : {}),
    });
  }

  /** Apply part of a credit note. Refuses to hand out more than it holds. */
  async apply(id: string, amount: number) {
    return this.prisma.transaction(async (tx) => {
      const note = await tx.creditNote.findFirst({ where: { id } });
      if (!note) throw new NotFoundError('Credit note', id);

      const remaining = Number(note.amount) - Number(note.appliedAmount);
      if (amount > remaining + 0.001) {
        throw new BusinessRuleError(
          'INSUFFICIENT_CREDIT',
          `Only ${remaining.toFixed(2)} remains on ${note.number}`,
        );
      }

      const updated = await tx.creditNote.update({
        where: { id },
        data: { appliedAmount: new Prisma.Decimal(Number(note.appliedAmount) + amount) },
      });
      await this.audit('UPDATE', id, `Applied ${amount.toFixed(2)} of ${note.number}`);
      return updated;
    });
  }
}

@Injectable()
export class RecurringInvoicesService extends BaseCrudService<Row> {
  constructor(prisma: PrismaService) {
    super(prisma, 'recurringInvoice', ['memo'], ['nextRunOn', 'amount'], 'Recurring invoice');
  }

  protected override listInclude() {
    return { client: { select: { id: true, name: true, company: true } } };
  }

  createSchedule(dto: CreateRecurringInvoiceDto) {
    const startedOn = new Date(dto.startedOn);
    return this.create({
      ...orgScope(),
      clientId: dto.clientId ?? null,
      amount: new Prisma.Decimal(dto.amount),
      currency: dto.currency ?? 'USD',
      cycle: dto.cycle ?? 'Monthly',
      startedOn,
      // Without an explicit date, the first run is one cycle after the start.
      nextRunOn: dto.nextRunOn ? new Date(dto.nextRunOn) : advance(startedOn, dto.cycle ?? 'Monthly'),
      status: dto.status ?? 'Active',
      memo: dto.memo ?? null,
    });
  }

  updateSchedule(id: string, dto: UpdateRecurringInvoiceDto) {
    return this.update(id, {
      ...(dto.clientId !== undefined ? { clientId: dto.clientId ?? null } : {}),
      ...(dto.amount !== undefined ? { amount: new Prisma.Decimal(dto.amount) } : {}),
      ...(dto.cycle ? { cycle: dto.cycle } : {}),
      ...(dto.startedOn ? { startedOn: new Date(dto.startedOn) } : {}),
      ...(dto.nextRunOn ? { nextRunOn: new Date(dto.nextRunOn) } : {}),
      ...(dto.status ? { status: dto.status } : {}),
      ...(dto.memo !== undefined ? { memo: dto.memo } : {}),
    });
  }

  /**
   * Raise the next invoice now and move the schedule on.
   *
   * Both happen in one transaction: an invoice raised without advancing the
   * schedule would be raised again on the next run.
   */
  async runNow(id: string) {
    return this.prisma.transaction(async (tx) => {
      const schedule = await tx.recurringInvoice.findFirst({ where: { id } });
      if (!schedule) throw new NotFoundError('Recurring invoice', id);
      if (schedule.status !== 'Active') {
        throw new BusinessRuleError('NOT_ACTIVE', 'This schedule is paused');
      }

      const number = `INV#${String((await tx.invoice.count()) + 1).padStart(4, '0')}`;
      const invoice = await tx.invoice.create({
        data: {
          ...orgScope(),
          clientId: schedule.clientId,
          number,
          issuedOn: new Date(),
          currency: schedule.currency,
          subtotal: schedule.amount,
          total: schedule.amount,
          status: 'UNPAID',
          note: schedule.memo,
          items: {
            create: [
              {
                description: schedule.memo ?? 'Recurring charge',
                quantity: new Prisma.Decimal(1),
                unitPrice: schedule.amount,
                amount: schedule.amount,
                position: 0,
              },
            ],
          },
        },
        include: { items: true },
      });

      await tx.recurringInvoice.update({
        where: { id },
        data: {
          issuedCount: schedule.issuedCount + 1,
          nextRunOn: advance(schedule.nextRunOn, schedule.cycle),
        },
      });

      await this.audit('CREATE', invoice.id, `${number} from a recurring schedule`);
      return invoice;
    });
  }
}

@Injectable()
export class RecurringExpensesService extends BaseCrudService<Row> {
  constructor(prisma: PrismaService) {
    super(prisma, 'recurringExpense', ['item', 'category'], ['nextRunOn', 'amount'], 'Recurring expense');
  }

  createSchedule(dto: CreateRecurringExpenseDto) {
    return this.create({
      ...orgScope(),
      item: dto.item,
      category: dto.category ?? null,
      amount: new Prisma.Decimal(dto.amount),
      currency: dto.currency ?? 'USD',
      cycle: dto.cycle ?? 'Monthly',
      nextRunOn: new Date(dto.nextRunOn),
      status: dto.status ?? 'Active',
    });
  }

  updateSchedule(id: string, dto: UpdateRecurringExpenseDto) {
    return this.update(id, {
      ...(dto.item ? { item: dto.item } : {}),
      ...(dto.category !== undefined ? { category: dto.category } : {}),
      ...(dto.amount !== undefined ? { amount: new Prisma.Decimal(dto.amount) } : {}),
      ...(dto.cycle ? { cycle: dto.cycle } : {}),
      ...(dto.nextRunOn ? { nextRunOn: new Date(dto.nextRunOn) } : {}),
      ...(dto.status ? { status: dto.status } : {}),
    });
  }

  /** Book this cycle's expense and roll the schedule forward. */
  async runNow(id: string) {
    return this.prisma.transaction(async (tx) => {
      const schedule = await tx.recurringExpense.findFirst({ where: { id } });
      if (!schedule) throw new NotFoundError('Recurring expense', id);
      if (schedule.status !== 'Active') {
        throw new BusinessRuleError('NOT_ACTIVE', 'This schedule is paused');
      }

      const expense = await tx.expense.create({
        data: {
          ...orgScope(),
          item: schedule.item,
          category: schedule.category,
          amount: schedule.amount,
          currency: schedule.currency,
          spentOn: new Date(),
          status: 'APPROVED',
        },
      });

      await tx.recurringExpense.update({
        where: { id },
        data: { nextRunOn: advance(schedule.nextRunOn, schedule.cycle) },
      });

      await this.audit('CREATE', expense.id, `${schedule.item} from a recurring schedule`);
      return expense;
    });
  }
}
