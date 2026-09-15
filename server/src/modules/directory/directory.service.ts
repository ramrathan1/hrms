import { Injectable } from '@nestjs/common';
import { Prisma } from '../../generated/prisma/client';

import { BaseCrudService } from '../../common/services/base-crud.service';
import { PrismaService } from '../../infra/prisma/prisma.service';
import { ConflictError } from '../../common/errors/domain.error';
import { orgScope } from '../../infra/tenant/tenant-context';
import { currentUserId, peopleScope } from '../../common/self-scope';
import type {
  CreateDepartmentDto, CreateDesignationDto, CreateEmployeeDto,
  EmployeeQueryDto, UpdateEmployeeDto,
} from './dto/directory.dto';

type Row = { id: string };

/**
 * The people directory: Employee, Department, Designation.
 *
 * Employee is the HR record and User is the login — separate on purpose. A
 * contractor has an Employee row with no `userId`; an owner may have a User
 * with no Employee row.
 */
@Injectable()
export class EmployeesService extends BaseCrudService<Row> {
  constructor(prisma: PrismaService) {
    super(
      prisma,
      'employee',
      ['name', 'email', 'employeeCode', 'phone'],
      ['name', 'joinedOn', 'createdAt'],
      'Employee',
    );
  }

  protected override buildFilters(query: EmployeeQueryDto) {
    const where: Record<string, unknown> = {};
    if (query.status) where.status = query.status;
    if (query.departmentId) where.departmentId = query.departmentId;
    if (query.designationId) where.designationId = query.designationId;
    if (query.reportsToId) where.reportsToId = query.reportsToId;
    return where;
  }

  protected override listInclude() {
    return {
      department: { select: { id: true, name: true } },
      designation: { select: { id: true, name: true } },
      user: { select: { id: true, email: true, avatarUrl: true, status: true } },
    };
  }

  protected override detailInclude() {
    return {
      ...this.listInclude(),
      reportsTo: { select: { id: true, name: true } },
      directReports: { select: { id: true, name: true, employeeCode: true } },
      emergencyContacts: true,
      salaries: { orderBy: { effectiveFrom: 'desc' as const }, take: 5 },
    };
  }

  /* ------------------------------------------------------------ privacy */

  /**
   * A directory is not a personnel file.
   *
   * Everyone needs to look a colleague up — a task assignee and a meeting
   * attendee are just an id without it, which is why `employees:read` is on
   * every role. But the record behind that name carries pay rate, home address
   * and, on the detail route, salary history and next of kin. Those belong to
   * the person and to HR.
   *
   * So the row is trimmed to what a colleague may see, unless it is your own
   * record or you hold reach over other people's (see common/self-scope.ts).
   */
  private static readonly PERSONAL_FIELDS = [
    'hourlyRate', 'address', 'about', 'salaries', 'emergencyContacts',
    'employmentType', 'exitedOn',
  ] as const;

  private mayReadInFull(row: Record<string, unknown>): boolean {
    const scope = peopleScope();
    if (scope === 'all') return true;
    if (row.userId && row.userId === currentUserId()) return true; // your own file
    return false;
  }

  private redact<T>(row: T): T {
    const record = row as Record<string, unknown>;
    if (this.mayReadInFull(record)) return row;
    const trimmed = { ...record };
    for (const field of EmployeesService.PERSONAL_FIELDS) delete trimmed[field];
    return trimmed as T;
  }

  override async findAll(query: EmployeeQueryDto) {
    const page = await super.findAll(query);
    return { ...page, data: page.data.map((row) => this.redact(row)) };
  }

  override async findOne(id: string) {
    return this.redact(await super.findOne(id));
  }

  /* The directory itself stays visible to everyone — a task assignee and a
     meeting attendee are just an id without it. What a colleague may read of
     the record behind the name is the `redact` rule above. */

  async createEmployee(dto: CreateEmployeeDto) {
    const code = dto.employeeCode ?? (await this.nextCode());
    return this.create({
      ...orgScope(),
      ...dto,
      employeeCode: code,
      email: dto.email.toLowerCase(),
      joinedOn: new Date(dto.joinedOn),
      hourlyRate: new Prisma.Decimal(dto.hourlyRate ?? 0),
    });
  }

  updateEmployee(id: string, dto: UpdateEmployeeDto) {
    return this.update(id, {
      ...dto,
      ...(dto.email ? { email: dto.email.toLowerCase() } : {}),
      ...(dto.joinedOn ? { joinedOn: new Date(dto.joinedOn) } : {}),
      ...(dto.hourlyRate != null ? { hourlyRate: new Prisma.Decimal(dto.hourlyRate) } : {}),
    });
  }

  /** The org chart, as a tree rooted at people with no manager. */
  async orgChart() {
    const employees = await this.prisma.db.employee.findMany({
      where: { status: { not: 'EXITED' } },
      select: {
        id: true, name: true, employeeCode: true, reportsToId: true,
        designation: { select: { name: true } },
      },
      orderBy: { name: 'asc' },
    });

    type Node = (typeof employees)[number] & { reports: Node[] };
    const byId = new Map<string, Node>(employees.map((e) => [e.id, { ...e, reports: [] }]));
    const roots: Node[] = [];

    for (const node of byId.values()) {
      const parent = node.reportsToId ? byId.get(node.reportsToId) : undefined;
      // A manager outside the active set leaves the report at the root rather
      // than dropping them from the chart entirely.
      if (parent) parent.reports.push(node);
      else roots.push(node);
    }
    return roots;
  }

  private async nextCode(): Promise<string> {
    const count = await this.prisma.db.employee.count();
    return `E${count + 1}`;
  }
}

@Injectable()
export class DepartmentsService extends BaseCrudService<Row> {
  constructor(prisma: PrismaService) {
    super(prisma, 'department', ['name'], ['name', 'createdAt'], 'Department');
  }

  protected override listInclude() {
    return { _count: { select: { employees: true } } };
  }

  createDepartment(dto: CreateDepartmentDto) {
    return this.create({ ...orgScope(), ...dto });
  }

  /** Reassign people before removing the department they belong to. */
  override async remove(id: string) {
    const count = await this.prisma.db.employee.count({ where: { departmentId: id } });
    if (count > 0) {
      throw new ConflictError(
        'DEPARTMENT_IN_USE',
        `${count} employee(s) are in this department. Move them first.`,
      );
    }
    return super.remove(id);
  }
}

@Injectable()
export class DesignationsService extends BaseCrudService<Row> {
  constructor(prisma: PrismaService) {
    super(prisma, 'designation', ['name'], ['name', 'createdAt'], 'Designation');
  }

  protected override listInclude() {
    return { _count: { select: { employees: true } } };
  }

  createDesignation(dto: CreateDesignationDto) {
    return this.create({ ...orgScope(), ...dto });
  }

  override async remove(id: string) {
    const count = await this.prisma.db.employee.count({ where: { designationId: id } });
    if (count > 0) {
      throw new ConflictError(
        'DESIGNATION_IN_USE',
        `${count} employee(s) hold this designation. Change them first.`,
      );
    }
    return super.remove(id);
  }
}
