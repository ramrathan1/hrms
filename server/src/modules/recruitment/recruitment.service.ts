import { Injectable } from '@nestjs/common';
import { Prisma } from '../../generated/prisma/client';

import { BaseCrudService } from '../../common/services/base-crud.service';
import { PrismaService } from '../../infra/prisma/prisma.service';
import {
  BusinessRuleError, ConflictError, NotFoundError,
} from '../../common/errors/domain.error';
import { getTenantContext, orgScope } from '../../infra/tenant/tenant-context';
import type {
  AcceptOfferDto, ApplicationQueryDto, CreateApplicationDto, CreateInterviewDto,
  CreateJobDto, CreateOfferDto, InterviewFeedbackDto, JobQueryDto, MoveStageDto,
  UpdateApplicationDto, UpdateInterviewDto, UpdateJobDto,
} from './dto/recruitment.dto';

type Row = { id: string };

/** Stages an application may move between. Anything else is rejected. */
const LEGAL_TRANSITIONS: Record<string, string[]> = {
  APPLIED: ['PHONE_SCREEN', 'INTERVIEW', 'REJECTED'],
  PHONE_SCREEN: ['INTERVIEW', 'REJECTED'],
  INTERVIEW: ['OFFER', 'REJECTED'],
  OFFER: ['HIRED', 'REJECTED'],
  HIRED: [],
  REJECTED: ['APPLIED'],
};

/* ------------------------------------------------------------------- jobs */

@Injectable()
export class JobsService extends BaseCrudService<Row> {
  constructor(prisma: PrismaService) {
    super(prisma, 'job', ['title', 'description', 'location'], ['title', 'createdAt'], 'Job');
  }

  protected override buildFilters(query: JobQueryDto) {
    const where: Record<string, unknown> = {};
    if (query.status) where.status = query.status;
    if (query.departmentId) where.departmentId = query.departmentId;
    return where;
  }

  protected override listInclude() {
    return { _count: { select: { applications: true } } };
  }

  createJob(dto: CreateJobDto) {
    return this.create({
      ...orgScope(),
      ...dto,
      opensOn: dto.opensOn ? new Date(dto.opensOn) : null,
      closesOn: dto.closesOn ? new Date(dto.closesOn) : null,
    });
  }

  updateJob(id: string, dto: UpdateJobDto) {
    return this.update(id, {
      ...dto,
      ...(dto.opensOn ? { opensOn: new Date(dto.opensOn) } : {}),
      ...(dto.closesOn ? { closesOn: new Date(dto.closesOn) } : {}),
    });
  }

  /** Funnel counts per stage for one job, or across all open jobs. */
  private static readonly STAGES = [
    'APPLIED', 'PHONE_SCREEN', 'INTERVIEW', 'OFFER', 'HIRED', 'REJECTED',
  ] as const;

  /**
   * How applicants are distributed across the pipeline, one row per job.
   *
   * Per job rather than in aggregate, because "23 people at interview" tells
   * you nothing about which role is stuck — which is the only reason to look at
   * a funnel. Pass `jobId` to narrow to one.
   */
  async funnel(jobId?: string) {
    const [jobs, grouped] = await Promise.all([
      this.prisma.db.job.findMany({
        where: jobId ? { id: jobId } : {},
        select: { id: true, title: true },
        orderBy: { title: 'asc' },
      }),
      this.prisma.db.application.groupBy({
        by: ['jobId', 'stage'],
        _count: { _all: true },
        ...(jobId ? { where: { jobId } } : {}),
      }),
    ]);

    const counts = new Map<string, number>(
      grouped.map((g) => [`${g.jobId}:${g.stage}`, g._count._all]),
    );

    return jobs.map((job) => {
      const stages = Object.fromEntries(
        JobsService.STAGES.map((stage) => [stage, counts.get(`${job.id}:${stage}`) ?? 0]),
      ) as Record<(typeof JobsService.STAGES)[number], number>;

      return {
        jobId: job.id,
        job: job.title,
        // Rejected applicants were still applicants, so they count in the total.
        total: Object.values(stages).reduce((a, n) => a + n, 0),
        ...stages,
      };
    });
  }
}

/* ----------------------------------------------------------- applications */

@Injectable()
export class ApplicationsService extends BaseCrudService<Row> {
  constructor(prisma: PrismaService) {
    super(prisma, 'application', ['name', 'email'], ['name', 'createdAt', 'rating'], 'Application');
  }

  protected override buildFilters(query: ApplicationQueryDto) {
    const where: Record<string, unknown> = {};
    if (query.jobId) where.jobId = query.jobId;
    if (query.stage) where.stage = query.stage;
    return where;
  }

  protected override listInclude() {
    return {
      job: { select: { id: true, title: true } },
      _count: { select: { interviews: true, offers: true } },
    };
  }

  protected override detailInclude() {
    return {
      job: true,
      interviews: { orderBy: { scheduledAt: 'desc' as const } },
      offers: { orderBy: { createdAt: 'desc' as const } },
    };
  }

  async createApplication(dto: CreateApplicationDto) {
    const job = await this.prisma.db.job.findFirst({ where: { id: dto.jobId } });
    if (!job) throw new NotFoundError('Job', dto.jobId);
    if (job.status !== 'OPEN') {
      throw new ConflictError('JOB_NOT_OPEN', 'That role is not accepting applications');
    }

    // One application per person per job.
    const existing = await this.prisma.db.application.findFirst({
      where: { jobId: dto.jobId, email: dto.email.toLowerCase() },
    });
    if (existing) {
      throw new ConflictError('ALREADY_APPLIED', 'This candidate has already applied for that role');
    }

    return this.create({
      ...orgScope(),
      ...dto,
      email: dto.email.toLowerCase(),
      skills: dto.skills ?? [],
    });
  }

  updateApplication(id: string, dto: UpdateApplicationDto) {
    // Stage changes go through moveStage so the transition rules apply.
    return this.update(id, { ...dto, stage: undefined, jobId: undefined });
  }

  /**
   * Move an application along the pipeline.
   *
   * The stage machine is enforced here rather than left to the UI: skipping
   * from APPLIED straight to HIRED would bypass the offer that creates the
   * employee record.
   */
  async moveStage(id: string, dto: MoveStageDto) {
    const application = await this.findOne(id);
    const from = (application as any).stage as string;
    const to = dto.stage;

    if (from === to) return application;

    const allowed = LEGAL_TRANSITIONS[from] ?? [];
    if (!allowed.includes(to)) {
      throw new BusinessRuleError(
        'ILLEGAL_STAGE_TRANSITION',
        `An application at ${from} cannot move to ${to}`,
        allowed.length ? [`Allowed from here: ${allowed.join(', ')}`] : ['This is a terminal stage'],
      );
    }

    const updated = await this.prisma.db.application.update({
      where: { id },
      data: { stage: to },
      include: this.listInclude() as never,
    });
    await this.audit('UPDATE', id, `${from} → ${to}`, application, updated);
    return updated;
  }
}

/* ------------------------------------------------------------ interviews */

@Injectable()
export class InterviewsService extends BaseCrudService<Row> {
  constructor(prisma: PrismaService) {
    super(prisma, 'interview', ['round', 'feedback'], ['scheduledAt', 'createdAt'], 'Interview');
  }

  protected override buildFilters(query: Record<string, any>) {
    const where: Record<string, unknown> = {};
    if (query.applicationId) where.applicationId = query.applicationId;
    if (query.status) where.status = query.status;
    if (query.upcoming === 'true') {
      where.scheduledAt = { gte: new Date() };
      where.status = 'SCHEDULED';
    }
    return where;
  }

  protected override listInclude() {
    return {
      application: {
        select: { id: true, name: true, email: true, job: { select: { id: true, title: true } } },
      },
    };
  }

  async schedule(dto: CreateInterviewDto) {
    const application = await this.prisma.db.application.findFirst({
      where: { id: dto.applicationId },
    });
    if (!application) throw new NotFoundError('Application', dto.applicationId);

    const scheduledAt = new Date(dto.scheduledAt);
    if (scheduledAt < new Date()) {
      throw new BusinessRuleError('PAST_DATE', 'An interview cannot be scheduled in the past');
    }

    return this.create({
      ...orgScope(),
      ...dto,
      scheduledAt,
    });
  }

  /** Record the outcome. Rating is bounded so a stray value can't skew reports. */
  async recordFeedback(id: string, dto: InterviewFeedbackDto) {
    if (dto.rating != null && (dto.rating < 1 || dto.rating > 5)) {
      throw new BusinessRuleError('INVALID_RATING', 'Rating must be between 1 and 5');
    }
    return this.update(id, {
      status: dto.status ?? 'COMPLETED',
      rating: dto.rating ?? null,
      feedback: dto.feedback ?? null,
    });
  }

  updateInterview(id: string, dto: UpdateInterviewDto) {
    return this.update(id, {
      ...dto,
      ...(dto.scheduledAt ? { scheduledAt: new Date(dto.scheduledAt) } : {}),
    });
  }
}

/* ---------------------------------------------------------------- offers */

@Injectable()
export class OffersService extends BaseCrudService<Row> {
  constructor(prisma: PrismaService) {
    super(prisma, 'offer', [], ['startsOn', 'createdAt'], 'Offer');
  }

  protected override buildFilters(query: Record<string, any>) {
    const where: Record<string, unknown> = {};
    if (query.status) where.status = query.status;
    if (query.applicationId) where.applicationId = query.applicationId;
    return where;
  }

  protected override listInclude() {
    return {
      application: {
        select: { id: true, name: true, email: true, job: { select: { id: true, title: true } } },
      },
    };
  }

  async createOffer(dto: CreateOfferDto) {
    const application = await this.prisma.db.application.findFirst({
      where: { id: dto.applicationId },
    });
    if (!application) throw new NotFoundError('Application', dto.applicationId);

    const open = await this.prisma.db.offer.findFirst({
      where: { applicationId: dto.applicationId, status: { in: ['DRAFT', 'SENT'] } },
    });
    if (open) {
      throw new ConflictError('OFFER_OUTSTANDING', 'This candidate already has an open offer');
    }

    return this.create({
      ...orgScope(),
      ...dto,
      salaryAmount: new Prisma.Decimal(dto.salaryAmount),
      startsOn: new Date(dto.startsOn),
    });
  }

  /**
   * Accept an offer.
   *
   * Four writes in one transaction: mark the offer accepted, move the
   * application to HIRED, create the Employee record, and decrement the job's
   * remaining openings — closing the job when it reaches zero. Half of this
   * landing would leave either an employee nobody hired or an offer with no
   * hire behind it.
   */
  async accept(offerId: string, dto: AcceptOfferDto) {
    const ctx = getTenantContext();

    const result = await this.prisma.transaction(async (tx) => {
      const offer = await tx.offer.findFirst({
        where: { id: offerId },
        include: { application: { include: { job: true } } },
      });
      if (!offer) throw new NotFoundError('Offer', offerId);

      if (offer.status === 'ACCEPTED') {
        throw new ConflictError('ALREADY_ACCEPTED', 'This offer has already been accepted');
      }
      if (offer.status === 'DECLINED' || offer.status === 'WITHDRAWN') {
        throw new ConflictError(
          'OFFER_CLOSED',
          `This offer was ${offer.status.toLowerCase()} and cannot be accepted`,
        );
      }

      const job = offer.application.job;
      if (job.openings < 1) {
        throw new ConflictError('NO_OPENINGS', 'That role has no remaining openings');
      }

      const employeeCount = await tx.employee.count();
      const employee = await tx.employee.create({
        data: {
          ...orgScope(),
          employeeCode: dto.employeeCode ?? `E${employeeCount + 1}`,
          name: offer.application.name,
          email: offer.application.email,
          phone: offer.application.phone ?? null,
          departmentId: dto.departmentId ?? job.departmentId ?? null,
          designationId: dto.designationId ?? null,
          reportsToId: dto.reportsToId ?? null,
          joinedOn: offer.startsOn,
          employmentType: job.employmentType,
          status: 'ACTIVE',
        },
      });

      // Compensation history starts here, not at the first payslip.
      await tx.salary.create({
        data: {
          ...orgScope(),
          employeeId: employee.id,
          annualAmount: offer.salaryAmount,
          currency: offer.currency,
          effectiveFrom: offer.startsOn,
        },
      });

      const remaining = job.openings - 1;
      await tx.job.update({
        where: { id: job.id },
        data: { openings: remaining, ...(remaining === 0 ? { status: 'CLOSED' } : {}) },
      });

      await tx.application.update({
        where: { id: offer.applicationId },
        data: { stage: 'HIRED' },
      });

      const updatedOffer = await tx.offer.update({
        where: { id: offerId },
        data: {
          status: 'ACCEPTED',
          respondedAt: new Date(),
          createdEmployeeId: employee.id,
        },
      });

      return { offer: updatedOffer, employee, openingsRemaining: remaining };
    });

    void ctx;
    await this.audit(
      'APPROVE',
      offerId,
      `Offer accepted — ${result.employee.name} hired`,
      undefined,
      result,
    );
    return result;
  }

  async decline(offerId: string, reason?: string) {
    const offer = await this.findOne(offerId);
    if ((offer as any).status === 'ACCEPTED') {
      throw new ConflictError('ALREADY_ACCEPTED', 'An accepted offer cannot be declined');
    }
    const updated = await this.update(offerId, {
      status: 'DECLINED',
      respondedAt: new Date(),
    });
    await this.audit('REJECT', offerId, reason ?? 'Offer declined');
    return updated;
  }
}
