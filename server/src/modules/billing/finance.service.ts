import { Injectable } from '@nestjs/common';
import { Prisma } from '../../generated/prisma/client';

import { BaseCrudService } from '../../common/services/base-crud.service';
import { PrismaService } from '../../infra/prisma/prisma.service';
import { ConflictError, ForbiddenError, NotFoundError } from '../../common/errors/domain.error';
import { getTenantContext, orgScope } from '../../infra/tenant/tenant-context';
import type { CreateExpenseDto, DecideExpenseDto, ExpenseQueryDto } from './dto/finance.dto';

type Row = { id: string };

@Injectable()
export class ExpensesService extends BaseCrudService<Row> {
  constructor(prisma: PrismaService) {
    super(prisma, 'expense', ['item', 'category'], ['spentOn', 'amount', 'createdAt'], 'Expense');
  }

  protected override buildFilters(query: ExpenseQueryDto) {
    const where: Record<string, unknown> = {};
    if (query.status) where.status = query.status;
    if (query.employeeId) where.employeeId = query.employeeId;
    if (query.projectId) where.projectId = query.projectId;
    return where;
  }

  protected override listInclude() {
    return { employee: { select: { id: true, name: true } } };
  }

  createExpense(dto: CreateExpenseDto) {
    return this.create({
      ...orgScope(),
      ...dto,
      amount: new Prisma.Decimal(dto.amount),
      spentOn: new Date(dto.spentOn),
    });
  }

  /** Approve or reject. Nobody signs off their own claim. */
  async decide(id: string, dto: DecideExpenseDto) {
    const ctx = getTenantContext()!;
    const expense = await this.prisma.db.expense.findFirst({ where: { id } });
    if (!expense) throw new NotFoundError('Expense', id);
    if (expense.status !== 'PENDING') {
      throw new ConflictError('ALREADY_DECIDED', `Already ${expense.status.toLowerCase()}`);
    }

    const own = await this.prisma.db.employee.findFirst({
      where: { userId: ctx.userId },
      select: { id: true },
    });
    if (own && own.id === expense.employeeId) {
      throw new ForbiddenError('You cannot approve your own expense claim', 'SELF_APPROVAL');
    }

    const updated = await this.prisma.db.expense.update({
      where: { id },
      data: { status: dto.decision, decidedById: ctx.userId, decidedAt: new Date() },
      include: this.listInclude() as never,
    });
    await this.audit(dto.decision === 'APPROVED' ? 'APPROVE' : 'REJECT', id, (expense as any).item);
    return updated;
  }
}

@Injectable()
export class PaymentsListService extends BaseCrudService<Row> {
  constructor(prisma: PrismaService) {
    super(prisma, 'payment', ['reference', 'method'], ['paidOn', 'amount'], 'Payment');
  }

  protected override buildFilters(query: Record<string, any>) {
    const where: Record<string, unknown> = {};
    if (query.invoiceId) where.invoiceId = query.invoiceId;
    if (query.from || query.to) {
      where.paidOn = {
        ...(query.from ? { gte: new Date(query.from) } : {}),
        ...(query.to ? { lte: new Date(query.to) } : {}),
      };
    }
    return where;
  }

  protected override listInclude() {
    return {
      invoice: {
        select: { id: true, number: true, client: { select: { id: true, company: true } } },
      },
    };
  }
}

@Injectable()
export class EstimatesService extends BaseCrudService<Row> {
  constructor(prisma: PrismaService) {
    super(prisma, 'estimate', ['number'], ['issuedOn', 'total'], 'Estimate');
  }

  protected override buildFilters(query: Record<string, any>) {
    const where: Record<string, unknown> = {};
    if (query.status) where.status = query.status;
    if (query.clientId) where.clientId = query.clientId;
    return where;
  }

  protected override listInclude() {
    return { client: { select: { id: true, name: true, company: true } } };
  }

  /**
   * Turn an accepted estimate into an invoice, carrying the total across and
   * marking the estimate converted so it cannot be billed twice.
   */
  async convertToInvoice(id: string) {
    return this.prisma.transaction(async (tx) => {
      const estimate = await tx.estimate.findFirst({ where: { id } });
      if (!estimate) throw new NotFoundError('Estimate', id);
      if (estimate.convertedInvoiceId) {
        throw new ConflictError('ALREADY_CONVERTED', 'This estimate has already become an invoice');
      }

      const count = await tx.invoice.count();
      const invoice = await tx.invoice.create({
        data: {
          ...orgScope(),
          clientId: estimate.clientId,
          number: `INV#${String(count + 1).padStart(4, '0')}`,
          issuedOn: new Date(),
          currency: estimate.currency,
          subtotal: estimate.total,
          total: estimate.total,
          status: 'UNPAID',
          items: {
            create: [{
              description: `From estimate ${estimate.number}`,
              quantity: new Prisma.Decimal(1),
              unitPrice: estimate.total,
              amount: estimate.total,
              position: 0,
            }],
          },
        },
        include: { items: true },
      });

      await tx.estimate.update({
        where: { id },
        data: { status: 'Converted', convertedInvoiceId: invoice.id },
      });

      return { estimate: { ...estimate, convertedInvoiceId: invoice.id }, invoice };
    });
  }
}
