import { Injectable } from '@nestjs/common';
import { Prisma } from '../../generated/prisma/client';

import { BaseCrudService } from '../../common/services/base-crud.service';
import { PrismaService } from '../../infra/prisma/prisma.service';
import { CacheService } from '../../infra/cache/cache.service';
import {
  BusinessRuleError,
  ConflictError,
  NotFoundError,
} from '../../common/errors/domain.error';
import { getTenantContext, orgScope } from '../../infra/tenant/tenant-context';
import type { CreateInvoiceDto, RecordPaymentDto, UpdateInvoiceDto } from './dto/invoice.dto';

type InvoiceRow = { id: string };

/**
 * Invoicing.
 *
 * The money rules the frontend implemented client-side live here now, where
 * they cannot be bypassed: totals are computed from line items, `paidAmount`
 * is derived from payments rather than accepted from the caller, and status
 * follows from the two.
 */
@Injectable()
export class InvoicesService extends BaseCrudService<InvoiceRow> {
  constructor(prisma: PrismaService, private readonly cache: CacheService) {
    super(
      prisma,
      'invoice',
      ['number', 'note'],
      ['issuedOn', 'dueOn', 'total', 'status', 'createdAt'],
      'Invoice',
    );
  }

  protected override buildFilters(query: Record<string, any>) {
    const where: Record<string, unknown> = {};
    if (query.status) where.status = query.status;
    if (query.clientId) where.clientId = query.clientId;
    if (query.projectId) where.projectId = query.projectId;
    if (query.from || query.to) {
      where.issuedOn = {
        ...(query.from ? { gte: new Date(query.from) } : {}),
        ...(query.to ? { lte: new Date(query.to) } : {}),
      };
    }
    // "Overdue" is a derived state, not a stored one — express it as a filter
    // so the list and the badge can never disagree.
    if (query.overdue === 'true' || query.overdue === true) {
      where.dueOn = { lt: new Date() };
      where.status = { in: ['UNPAID', 'PARTIALLY_PAID', 'OVERDUE'] };
    }
    return where;
  }

  protected override listInclude() {
    return {
      client: { select: { id: true, name: true, company: true, email: true } },
      project: { select: { id: true, name: true, code: true } },
    };
  }

  protected override detailInclude() {
    return {
      client: true,
      project: { select: { id: true, name: true, code: true } },
      items: { orderBy: { position: 'asc' as const } },
      payments: { orderBy: { paidOn: 'desc' as const } },
    };
  }

  /* ----------------------------------------------------------- create */

  async createInvoice(dto: CreateInvoiceDto) {
    const totals = computeTotals(dto.items ?? []);
    const number = dto.number ?? (await this.nextNumber());

    const invoice = await this.prisma.transaction(async (tx) => {
      const created = await tx.invoice.create({
        data: {
          ...orgScope(),
          clientId: dto.clientId ?? null,
          projectId: dto.projectId ?? null,
          number,
          issuedOn: new Date(dto.issuedOn),
          dueOn: dto.dueOn ? new Date(dto.dueOn) : null,
          currency: dto.currency ?? 'USD',
          subtotal: totals.subtotal,
          taxTotal: totals.taxTotal,
          total: totals.total,
          status: dto.status ?? 'DRAFT',
          note: dto.note ?? null,
          items: {
            create: (dto.items ?? []).map((item, index) => ({
              description: item.description,
              quantity: new Prisma.Decimal(item.quantity),
              unitPrice: new Prisma.Decimal(item.unitPrice),
              taxRate: new Prisma.Decimal(item.taxRate ?? 0),
              amount: lineAmount(item),
              position: index,
            })),
          },
        },
        include: { items: true },
      });
      return created;
    });

    await this.invalidate();
    await this.audit('CREATE', invoice.id, `Invoice ${invoice.number}`, undefined, invoice);
    return invoice;
  }

  async updateInvoice(id: string, dto: UpdateInvoiceDto) {
    const before = await this.findOne(id);

    const invoice = await this.prisma.transaction(async (tx) => {
      // Replacing line items wholesale is simpler to reason about than diffing,
      // and the totals must be recomputed either way.
      if (dto.items) {
        await tx.invoiceItem.deleteMany({ where: { invoiceId: id } });
      }
      const totals = dto.items ? computeTotals(dto.items) : null;

      return tx.invoice.update({
        where: { id },
        data: {
          ...(dto.clientId !== undefined ? { clientId: dto.clientId } : {}),
          ...(dto.projectId !== undefined ? { projectId: dto.projectId } : {}),
          ...(dto.issuedOn ? { issuedOn: new Date(dto.issuedOn) } : {}),
          ...(dto.dueOn !== undefined ? { dueOn: dto.dueOn ? new Date(dto.dueOn) : null } : {}),
          ...(dto.currency ? { currency: dto.currency } : {}),
          ...(dto.note !== undefined ? { note: dto.note } : {}),
          ...(dto.status ? { status: dto.status } : {}),
          ...(totals
            ? { subtotal: totals.subtotal, taxTotal: totals.taxTotal, total: totals.total }
            : {}),
          ...(dto.items
            ? {
                items: {
                  create: dto.items.map((item, index) => ({
                    description: item.description,
                    quantity: new Prisma.Decimal(item.quantity),
                    unitPrice: new Prisma.Decimal(item.unitPrice),
                    taxRate: new Prisma.Decimal(item.taxRate ?? 0),
                    amount: lineAmount(item),
                    position: index,
                  })),
                },
              }
            : {}),
        },
        include: { items: true, payments: true },
      });
    });

    const settled = await this.recalculate(invoice.id);
    await this.invalidate();
    await this.audit('UPDATE', id, `Invoice ${invoice.number}`, before, settled);
    return settled;
  }

  /* ---------------------------------------------------------- payments */

  /**
   * Record a payment against an invoice.
   *
   * Insert and recompute happen in one transaction: a partial write here would
   * leave the ledger disagreeing with the invoice, which is the failure mode
   * the frontend version had no protection against.
   */
  async recordPayment(invoiceId: string, dto: RecordPaymentDto) {
    const result = await this.prisma.transaction(async (tx) => {
      const invoice = await tx.invoice.findFirst({
        where: { id: invoiceId },
        include: { payments: true },
      });
      if (!invoice) throw new NotFoundError('Invoice', invoiceId);

      if (invoice.status === 'CANCELLED') {
        throw new ConflictError('INVOICE_CANCELLED', 'A cancelled invoice cannot take payment');
      }

      const alreadyPaid = sum(invoice.payments.map((p) => p.amount));
      const outstanding = toNumber(invoice.total) - alreadyPaid;

      if (outstanding <= 0.001) {
        throw new ConflictError('INVOICE_SETTLED', 'This invoice is already settled');
      }

      const amount = dto.amount ?? outstanding;
      if (!Number.isFinite(amount) || amount <= 0) {
        throw new BusinessRuleError('INVALID_AMOUNT', 'Payment amount must be greater than zero');
      }
      if (amount > outstanding + 0.001) {
        throw new BusinessRuleError(
          'OVERPAYMENT',
          `That is more than the ${outstanding.toFixed(2)} outstanding on this invoice`,
        );
      }

      const payment = await tx.payment.create({
        data: {
          ...orgScope(),
          invoiceId,
          amount: new Prisma.Decimal(amount),
          paidOn: dto.paidOn ? new Date(dto.paidOn) : new Date(),
          method: dto.method ?? 'Manual',
          reference: dto.reference ?? null,
          bankAccountId: dto.bankAccountId ?? null,
        },
      });

      const paidAmount = alreadyPaid + amount;
      const updated = await tx.invoice.update({
        where: { id: invoiceId },
        data: {
          paidAmount: new Prisma.Decimal(paidAmount),
          status: deriveStatus(toNumber(invoice.total), paidAmount, invoice.dueOn, invoice.status),
        },
        include: { items: true, payments: true, client: true },
      });

      return { invoice: updated, payment };
    });

    await this.invalidate();
    await this.audit(
      'PAYMENT',
      invoiceId,
      `Recorded ${toNumber(result.payment.amount).toFixed(2)} against ${result.invoice.number}`,
      undefined,
      result.payment,
    );
    return result;
  }

  /** Refund reverses a payment as a negative row, keeping the ledger append-only. */
  async refundPayment(paymentId: string, reason?: string) {
    const result = await this.prisma.transaction(async (tx) => {
      const original = await tx.payment.findFirst({ where: { id: paymentId } });
      if (!original) throw new NotFoundError('Payment', paymentId);
      if (toNumber(original.amount) < 0) {
        throw new ConflictError('ALREADY_REFUND', 'That row is itself a refund');
      }

      const refund = await tx.payment.create({
        data: {
          ...orgScope(),
          invoiceId: original.invoiceId,
          amount: new Prisma.Decimal(-Math.abs(toNumber(original.amount))),
          paidOn: new Date(),
          method: `${original.method} (refund)`,
          reference: reason ?? null,
          refundOfId: original.id,
        },
      });

      const invoice = await tx.invoice.findFirstOrThrow({
        where: { id: original.invoiceId },
        include: { payments: true },
      });
      const paidAmount = sum(invoice.payments.map((p) => p.amount));

      const updated = await tx.invoice.update({
        where: { id: invoice.id },
        data: {
          paidAmount: new Prisma.Decimal(paidAmount),
          status: deriveStatus(toNumber(invoice.total), paidAmount, invoice.dueOn, invoice.status),
        },
      });

      return { invoice: updated, refund };
    });

    await this.invalidate();
    await this.audit('PAYMENT', result.invoice.id, `Refunded payment ${paymentId}`);
    return result;
  }

  /** Recomputes paidAmount and status from the payment ledger. */
  async recalculate(invoiceId: string) {
    return this.prisma.transaction(async (tx) => {
      const invoice = await tx.invoice.findFirstOrThrow({
        where: { id: invoiceId },
        include: { payments: true, items: true },
      });
      const paidAmount = sum(invoice.payments.map((p) => p.amount));
      return tx.invoice.update({
        where: { id: invoiceId },
        data: {
          paidAmount: new Prisma.Decimal(paidAmount),
          status: deriveStatus(toNumber(invoice.total), paidAmount, invoice.dueOn, invoice.status),
        },
        include: { items: true, payments: true, client: true },
      });
    });
  }

  /* ------------------------------------------------------------ summary */

  /** Dashboard aggregates. Cached — read constantly, changes rarely. */
  async summary() {
    return this.cache.wrap('invoices:summary', 60, async () => {
      const [agg, overdue] = await Promise.all([
        this.prisma.db.invoice.aggregate({
          _sum: { total: true, paidAmount: true },
          _count: true,
          where: { status: { not: 'CANCELLED' } },
        }),
        this.prisma.db.invoice.count({
          where: { dueOn: { lt: new Date() }, status: { in: ['UNPAID', 'PARTIALLY_PAID', 'OVERDUE'] } },
        }),
      ]);

      const billed = toNumber(agg._sum.total ?? 0);
      const collected = toNumber(agg._sum.paidAmount ?? 0);
      return {
        invoices: agg._count,
        billed,
        collected,
        outstanding: billed - collected,
        collectionRate: billed > 0 ? Number(((collected / billed) * 100).toFixed(1)) : 0,
        overdueCount: overdue,
      };
    });
  }

  /* ---------------------------------------------------------- internals */

  /** Next document number for this tenant. */
  private async nextNumber(): Promise<string> {
    const ctx = getTenantContext();
    const last = await this.prisma.db.invoice.findFirst({
      orderBy: { createdAt: 'desc' },
      select: { number: true },
    });
    const digits = Number(String(last?.number ?? '').replace(/\D/g, '')) || 0;
    void ctx;
    return `INV#${String(digits + 1).padStart(4, '0')}`;
  }

  private invalidate() {
    return this.cache.del('invoices:summary');
  }
}

/* ---------------------------------------------------------------- helpers */

interface LineInput {
  description: string;
  quantity: number;
  unitPrice: number;
  taxRate?: number;
}

const toNumber = (d: Prisma.Decimal | number | null | undefined): number =>
  d == null ? 0 : typeof d === 'number' ? d : Number(d.toString());

const sum = (values: Array<Prisma.Decimal | number>) =>
  values.reduce<number>((a, v) => a + toNumber(v), 0);

function lineAmount(item: LineInput): Prisma.Decimal {
  const net = item.quantity * item.unitPrice;
  const tax = net * ((item.taxRate ?? 0) / 100);
  return new Prisma.Decimal(round2(net + tax));
}

function computeTotals(items: LineInput[]) {
  const subtotal = round2(items.reduce((a, i) => a + i.quantity * i.unitPrice, 0));
  const taxTotal = round2(
    items.reduce((a, i) => a + i.quantity * i.unitPrice * ((i.taxRate ?? 0) / 100), 0),
  );
  return {
    subtotal: new Prisma.Decimal(subtotal),
    taxTotal: new Prisma.Decimal(taxTotal),
    total: new Prisma.Decimal(round2(subtotal + taxTotal)),
  };
}

/** Status is always derived — never taken from the client. */
function deriveStatus(
  total: number,
  paid: number,
  dueOn: Date | null,
  current: string,
): 'DRAFT' | 'UNPAID' | 'PARTIALLY_PAID' | 'PAID' | 'OVERDUE' | 'CANCELLED' {
  if (current === 'CANCELLED') return 'CANCELLED';
  if (paid >= total - 0.001 && total > 0) return 'PAID';
  if (current === 'DRAFT') return 'DRAFT';
  if (paid > 0.001) return 'PARTIALLY_PAID';
  if (dueOn && dueOn < new Date()) return 'OVERDUE';
  return 'UNPAID';
}

const round2 = (n: number) => Math.round(n * 100) / 100;
