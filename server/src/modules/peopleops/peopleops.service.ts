import { Injectable } from '@nestjs/common';
import { Prisma } from '../../generated/prisma/client';

import { BaseCrudService } from '../../common/services/base-crud.service';
import { PrismaService } from '../../infra/prisma/prisma.service';
import { ConflictError } from '../../common/errors/domain.error';
import { orgScope } from '../../infra/tenant/tenant-context';
import type {
  CreateHolidayDto, CreateLeaveTypeDto, UpdateHolidayDto, UpdateLeaveTypeDto,
} from './dto/peopleops.dto';

type Row = { id: string };

@Injectable()
export class LeaveTypesService extends BaseCrudService<Row> {
  constructor(prisma: PrismaService) {
    super(prisma, 'leaveType', ['name'], ['name', 'createdAt'], 'Leave type');
  }

  createType(dto: CreateLeaveTypeDto) {
    return this.create({
      ...orgScope(),
      ...dto,
      defaultQuota: new Prisma.Decimal(dto.defaultQuota ?? 0),
    });
  }

  updateType(id: string, dto: UpdateLeaveTypeDto) {
    return this.update(id, {
      ...dto,
      ...(dto.defaultQuota != null ? { defaultQuota: new Prisma.Decimal(dto.defaultQuota) } : {}),
    });
  }

  /** Deleting a type would orphan its requests and balances. */
  override async remove(id: string) {
    const count = await this.prisma.db.leaveRequest.count({ where: { leaveTypeId: id } });
    if (count > 0) {
      throw new ConflictError(
        'LEAVE_TYPE_IN_USE',
        `${count} leave request(s) use this type. It cannot be deleted.`,
      );
    }
    return super.remove(id);
  }
}

@Injectable()
export class ShiftsService extends BaseCrudService<Row> {
  constructor(prisma: PrismaService) {
    super(prisma, 'shift', ['name'], ['name', 'createdAt'], 'Shift');
  }

  override create(data: Record<string, unknown>) {
    return super.create({ ...orgScope(), ...data });
  }
}

@Injectable()
export class HolidaysService extends BaseCrudService<Row> {
  constructor(prisma: PrismaService) {
    super(prisma, 'holiday', ['name'], ['holidayOn', 'name'], 'Holiday');
  }

  createHoliday(dto: CreateHolidayDto) {
    return this.create({ ...orgScope(), name: dto.name, holidayOn: new Date(dto.holidayOn) });
  }

  updateHoliday(id: string, dto: UpdateHolidayDto) {
    return this.update(id, {
      ...(dto.name ? { name: dto.name } : {}),
      ...(dto.holidayOn ? { holidayOn: new Date(dto.holidayOn) } : {}),
    });
  }
}
