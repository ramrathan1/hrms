import { Injectable } from '@nestjs/common';

import { BaseCrudService } from '../../common/services/base-crud.service';
import { PrismaService } from '../../infra/prisma/prisma.service';
import { ConflictError, NotFoundError } from '../../common/errors/domain.error';
import { orgScope } from '../../infra/tenant/tenant-context';

import type {
  ClientQueryDto, ContactQueryDto, CreateClientDto, CreateContactDto,
  UpdateClientDto, UpdateContactDto,
} from './dto/client.dto';

type ClientRow = { id: string };

@Injectable()
export class ClientsService extends BaseCrudService<ClientRow> {
  constructor(prisma: PrismaService) {
    super(
      prisma,
      'client',
      ['name', 'company', 'email', 'phone'],
      ['name', 'company', 'createdAt'],
      'Client',
    );
  }

  protected override buildFilters(query: ClientQueryDto) {
    const where: Record<string, unknown> = {};
    if (query.status) where.status = query.status;
    if (query.category) where.category = query.category;
    return where;
  }

  protected override listInclude() {
    return {
      _count: { select: { projects: true, invoices: true, tickets: true } },
    };
  }

  protected override detailInclude() {
    return {
      contacts: { orderBy: [{ isPrimary: 'desc' as const }, { name: 'asc' as const }] },
      projects: {
        select: { id: true, code: true, name: true, status: true, progress: true, deadlineOn: true },
      },
      _count: { select: { projects: true, invoices: true, tickets: true } },
    };
  }

  createClient(dto: CreateClientDto) {
    return this.create({ ...orgScope(), ...dto });
  }

  updateClient(id: string, dto: UpdateClientDto) {
    return this.update(id, { ...dto });
  }

  /**
   * Deleting a client would orphan its invoices, so the schema restricts it.
   * Refuse with a message that names what is in the way, rather than letting a
   * foreign-key error surface as a generic conflict.
   */
  override async remove(id: string) {
    const counts = await this.prisma.db.client.findFirst({
      where: { id },
      select: { _count: { select: { invoices: true, projects: true, estimates: true } } },
    });
    if (!counts) throw new NotFoundError('Client', id);

    const blockers: string[] = [];
    if (counts._count.invoices) blockers.push(`${counts._count.invoices} invoice(s)`);
    if (counts._count.estimates) blockers.push(`${counts._count.estimates} estimate(s)`);
    if (counts._count.projects) blockers.push(`${counts._count.projects} project(s)`);

    if (blockers.length) {
      throw new ConflictError(
        'CLIENT_IN_USE',
        `This client still has ${blockers.join(', ')}. Mark them inactive instead of deleting.`,
        blockers,
      );
    }
    return super.remove(id);
  }

  /* --------------------------------------------------------- contacts */

  async addContact(clientId: string, dto: CreateContactDto) {
    await this.findOne(clientId);

    return this.prisma.transaction(async (tx) => {
      // Only one primary contact per client — demote the incumbent first.
      if (dto.isPrimary) {
        await tx.clientContact.updateMany({
          where: { clientId, isPrimary: true },
          data: { isPrimary: false },
        });
      }
      return tx.clientContact.create({ data: { ...orgScope(), clientId, ...dto } });
    });
  }

  async updateContact(clientId: string, contactId: string, dto: UpdateContactDto) {
    return this.prisma.transaction(async (tx) => {
      const existing = await tx.clientContact.findFirst({ where: { id: contactId, clientId } });
      if (!existing) throw new NotFoundError('Contact', contactId);

      if (dto.isPrimary) {
        await tx.clientContact.updateMany({
          where: { clientId, isPrimary: true, id: { not: contactId } },
          data: { isPrimary: false },
        });
      }
      return tx.clientContact.update({ where: { id: contactId }, data: { ...dto } });
    });
  }

  async removeContact(clientId: string, contactId: string) {
    const existing = await this.prisma.db.clientContact.findFirst({
      where: { id: contactId, clientId },
    });
    if (!existing) throw new NotFoundError('Contact', contactId);
    await this.prisma.db.clientContact.delete({ where: { id: contactId } });
    return { id: contactId, deleted: true as const };
  }

  /* -------------------------------------------------------- statement */

  /**
   * The account statement the client portal shows: what was billed, what was
   * paid, and what is still open.
   */
  async statement(clientId: string, range: { from?: string; to?: string }) {
    const client = await this.findOne(clientId);

    const dateFilter =
      range.from || range.to
        ? {
            issuedOn: {
              ...(range.from ? { gte: new Date(range.from) } : {}),
              ...(range.to ? { lte: new Date(range.to) } : {}),
            },
          }
        : {};

    const invoices = await this.prisma.db.invoice.findMany({
      where: { clientId, status: { not: 'CANCELLED' }, ...dateFilter },
      include: { payments: { orderBy: { paidOn: 'asc' } } },
      orderBy: { issuedOn: 'asc' },
    });

    const billed = invoices.reduce((a, i) => a + Number(i.total), 0);
    const paid = invoices.reduce((a, i) => a + Number(i.paidAmount), 0);

    return {
      client,
      period: { from: range.from ?? null, to: range.to ?? null },
      totals: {
        billed: round2(billed),
        paid: round2(paid),
        outstanding: round2(billed - paid),
        invoiceCount: invoices.length,
      },
      lines: invoices.map((i) => ({
        invoiceId: i.id,
        number: i.number,
        issuedOn: i.issuedOn,
        dueOn: i.dueOn,
        total: Number(i.total),
        paid: Number(i.paidAmount),
        outstanding: round2(Number(i.total) - Number(i.paidAmount)),
        status: i.status,
        payments: i.payments.map((p) => ({
          id: p.id,
          amount: Number(p.amount),
          paidOn: p.paidOn,
          method: p.method,
        })),
      })),
    };
  }
}

const round2 = (n: number) => Math.round(n * 100) / 100;

/**
 * A flat view of every client contact.
 *
 * Contacts are managed through their client (`/clients/:id/contacts`); this
 * exists so a screen can load them all in one request instead of one per
 * client, which is the difference between one round trip and thirty.
 */
@Injectable()
export class ClientContactsService extends BaseCrudService<{ id: string }> {
  constructor(prisma: PrismaService) {
    super(prisma, 'clientContact', ['name', 'email', 'phone'], ['name'], 'Contact');
  }

  protected override buildFilters(query: ContactQueryDto) {
    return query.clientId ? { clientId: query.clientId } : {};
  }

  protected override listInclude() {
    return { client: { select: { id: true, name: true, company: true } } };
  }
}
