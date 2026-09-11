/**
 * Seed: one organization, its roles and permissions, and enough data for every
 * portal to render something real.
 *
 * Runs unscoped on purpose — there is no request, so the tenant guard would
 * otherwise refuse. This is the only place besides login that legitimately
 * writes across the tenant boundary.
 */
import { PrismaPg } from '@prisma/adapter-pg';
import * as bcrypt from 'bcrypt';
import { Pool } from 'pg';
import 'dotenv/config';

import { PrismaClient, Prisma } from '../src/generated/prisma/client';
import { SYSTEM_PERMISSIONS, SYSTEM_ROLES } from '../src/modules/rbac/rbac.constants';

const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const prisma = new PrismaClient({ adapter: new PrismaPg(pool) });

const DEMO_PASSWORD = 'Password123!';

async function main(): Promise<void> {
  console.log('Seeding Worksuite…');

  /* ------------------------------------------------ permissions (global) */
  await prisma.permission.createMany({
    data: SYSTEM_PERMISSIONS.map((p) => ({
      key: p.key,
      module: p.module,
      action: p.action,
      description: p.description,
    })),
    skipDuplicates: true,
  });
  const permissions = await prisma.permission.findMany();
  const permissionByKey = new Map(permissions.map((p) => [p.key, p.id]));
  console.log(`  permissions: ${permissions.length}`);

  /* ------------------------------------------------------- organization */
  const org = await prisma.organization.upsert({
    where: { slug: 'worksuite' },
    update: {},
    create: {
      name: 'Worksuite',
      slug: 'worksuite',
      email: 'hello@worksuite.demo',
      currency: 'USD',
      timezone: 'UTC',
    },
  });
  console.log(`  organization: ${org.name}`);

  /* --------------------------------------------------------------- roles */
  const roleIdByKey = new Map<string, string>();
  for (const seed of SYSTEM_ROLES) {
    const keys = seed.permissions.flatMap((pattern) =>
      pattern === '*'
        ? [...permissionByKey.keys()]
        : pattern.endsWith(':*')
          ? [...permissionByKey.keys()].filter((k) => k.startsWith(`${pattern.slice(0, -2)}:`))
          : [pattern],
    );

    const role = await prisma.role.upsert({
      where: { organizationId_key: { organizationId: org.id, key: seed.key } },
      update: { name: seed.name, description: seed.description },
      create: {
        organizationId: org.id,
        key: seed.key,
        name: seed.name,
        description: seed.description,
        isSystem: true,
      },
    });
    roleIdByKey.set(seed.key, role.id);

    await prisma.rolePermission.deleteMany({ where: { roleId: role.id } });
    await prisma.rolePermission.createMany({
      data: [...new Set(keys)]
        .map((k) => permissionByKey.get(k))
        .filter((id): id is string => Boolean(id))
        .map((permissionId) => ({ roleId: role.id, permissionId })),
      skipDuplicates: true,
    });
    console.log(`  role ${seed.key}: ${new Set(keys).size} permissions`);
  }

  /* --------------------------------------------------------------- users */
  const passwordHash = await bcrypt.hash(DEMO_PASSWORD, 10);

  const people = [
    { email: 'owner@worksuite.demo', name: 'Mohammed Ziemann', role: 'OWNER', designation: 'Founder', dept: 'Engineering', rate: 90 },
    { email: 'manager@worksuite.demo', name: 'Alden Glover', role: 'MANAGER', designation: 'Project Manager', dept: 'Delivery', rate: 84 },
    { email: 'lead@worksuite.demo', name: 'Lila Lueilwitz', role: 'TEAM_LEADER', designation: 'Senior Developer', dept: 'Engineering', rate: 78 },
    { email: 'hr@worksuite.demo', name: 'Charley Marquardt', role: 'HR', designation: 'Recruiter', dept: 'Human Resource', rate: 42 },
    { email: 'accounts@worksuite.demo', name: 'Naomi Rempel', role: 'ACCOUNTANT', designation: 'Accountant', dept: 'Finance', rate: 55 },
    { email: 'employee@worksuite.demo', name: 'Kole Johnston', role: 'EMPLOYEE', designation: 'Junior Developer', dept: 'Engineering', rate: 45 },
  ];

  const departments = new Map<string, string>();
  for (const name of [...new Set(people.map((p) => p.dept))]) {
    const d = await prisma.department.upsert({
      where: { organizationId_name: { organizationId: org.id, name } },
      update: {},
      create: { organizationId: org.id, name },
    });
    departments.set(name, d.id);
  }

  const designations = new Map<string, string>();
  for (const name of [...new Set(people.map((p) => p.designation))]) {
    const d = await prisma.designation.upsert({
      where: { organizationId_name: { organizationId: org.id, name } },
      update: {},
      create: { organizationId: org.id, name },
    });
    designations.set(name, d.id);
  }

  const userIdByEmail = new Map<string, string>();
  const employeeIdByEmail = new Map<string, string>();

  for (const [index, person] of people.entries()) {
    const user = await prisma.user.upsert({
      where: { organizationId_email: { organizationId: org.id, email: person.email } },
      update: { name: person.name },
      create: {
        organizationId: org.id,
        email: person.email,
        name: person.name,
        passwordHash,
      },
    });
    userIdByEmail.set(person.email, user.id);

    await prisma.userRole.upsert({
      where: { userId_roleId: { userId: user.id, roleId: roleIdByKey.get(person.role)! } },
      update: {},
      create: { userId: user.id, roleId: roleIdByKey.get(person.role)! },
    });

    const employee = await prisma.employee.upsert({
      where: { organizationId_employeeCode: { organizationId: org.id, employeeCode: `E${index + 1}` } },
      update: {},
      create: {
        organizationId: org.id,
        userId: user.id,
        employeeCode: `E${index + 1}`,
        name: person.name,
        email: person.email,
        departmentId: departments.get(person.dept),
        designationId: designations.get(person.designation),
        joinedOn: new Date('2024-01-15'),
        hourlyRate: new Prisma.Decimal(person.rate),
      },
    });
    employeeIdByEmail.set(person.email, employee.id);
  }
  console.log(`  users + employees: ${people.length}`);

  /* ------------------------------------------------------------- clients */

  /* Everything below is demo content: created once, then left alone. Re-running
     the seed must not duplicate it, or a second run leaves two of every client
     and fails on the unique project code. */
  const existingClients = await prisma.client.findMany({
    where: { organizationId: org.id },
    orderBy: { createdAt: 'asc' },
  });
  const clients = existingClients.length
    ? existingClients
    : await Promise.all(
    [
      { name: 'Aleen Miller', company: 'Northwind', email: 'aleen@northwind.example' },
      { name: 'Jalon Cronin', company: 'RTA', email: 'jalon@rta.example' },
      { name: 'Vernice Rohan', company: 'Meridian', email: 'vernice@meridian.example' },
    ].map((c) =>
      prisma.client.create({ data: { organizationId: org.id, ...c, status: 'ACTIVE' } }),
    ),
  );
  console.log(`  clients: ${clients.length}`);

  /* ------------------------------------------------------------ projects */
  const existingProject = await prisma.project.findFirst({
    where: { organizationId: org.id, code: 'UM' },
  });
  const project = existingProject ?? await prisma.project.create({
    data: {
      organizationId: org.id,
      clientId: clients[0].id,
      code: 'UM',
      name: 'User Management',
      status: 'IN_PROGRESS',
      startsOn: new Date('2026-06-01'),
      deadlineOn: new Date('2026-09-28'),
      budget: new Prisma.Decimal(42000),
      progress: 45,
      members: {
        create: [
          { userId: userIdByEmail.get('lead@worksuite.demo')! },
          { userId: userIdByEmail.get('employee@worksuite.demo')! },
        ],
      },
      milestones: {
        create: [
          { organizationId: org.id, title: 'Auth foundation', cost: new Prisma.Decimal(12000), dueOn: new Date('2026-07-01'), status: 'COMPLETE', position: 0 },
          { organizationId: org.id, title: 'RBAC & audit', cost: new Prisma.Decimal(18000), dueOn: new Date('2026-09-05'), status: 'IN_PROGRESS', position: 1 },
        ],
      },
    },
  });

  await prisma.task.createMany({
    data: [
      { organizationId: org.id, projectId: project.id, code: 'UM-1', title: 'Design login & session flow', status: 'COMPLETED', priority: 'HIGH', dueOn: new Date('2026-07-10') },
      { organizationId: org.id, projectId: project.id, code: 'UM-2', title: 'Role & permission matrix API', status: 'DOING', priority: 'HIGH', dueOn: new Date('2026-05-29') },
      { organizationId: org.id, projectId: project.id, code: 'UM-3', title: 'Password policies + 2FA', status: 'INCOMPLETE', priority: 'MEDIUM', dueOn: new Date('2026-03-25') },
      { organizationId: org.id, projectId: project.id, code: 'UM-4', title: 'Audit log viewer', status: 'TODO', priority: 'MEDIUM', dueOn: new Date('2026-08-31') },
    ],
    skipDuplicates: true,
  });
  console.log('  project: User Management + 2 milestones + 4 tasks');

  /* ------------------------------------------------------------ invoices */
  const existingInvoice = await prisma.invoice.findFirst({
    where: { organizationId: org.id, number: 'INV#0001' },
  });
  const invoice = existingInvoice ?? await prisma.invoice.create({
    data: {
      organizationId: org.id,
      clientId: clients[0].id,
      projectId: project.id,
      number: 'INV#0001',
      issuedOn: new Date('2026-08-01'),
      dueOn: new Date('2026-08-31'),
      subtotal: new Prisma.Decimal(13100),
      taxTotal: new Prisma.Decimal(1310),
      total: new Prisma.Decimal(14410),
      status: 'UNPAID',
      items: {
        create: [
          { description: 'Discovery & UX audit', quantity: new Prisma.Decimal(1), unitPrice: new Prisma.Decimal(4200), taxRate: new Prisma.Decimal(10), amount: new Prisma.Decimal(4620), position: 0 },
          { description: 'Implementation sprint', quantity: new Prisma.Decimal(1), unitPrice: new Prisma.Decimal(6000), taxRate: new Prisma.Decimal(10), amount: new Prisma.Decimal(6600), position: 1 },
          { description: 'QA & launch support', quantity: new Prisma.Decimal(1), unitPrice: new Prisma.Decimal(2900), taxRate: new Prisma.Decimal(10), amount: new Prisma.Decimal(3190), position: 2 },
        ],
      },
    },
  });

  // One partial payment, so the derived-status logic has something to show.
  if (!existingInvoice) await prisma.payment.create({
    data: {
      organizationId: org.id,
      invoiceId: invoice.id,
      amount: new Prisma.Decimal(5000),
      paidOn: new Date('2026-08-15'),
      method: 'Bank Transfer',
    },
  });
  await prisma.invoice.update({
    where: { id: invoice.id },
    data: { paidAmount: new Prisma.Decimal(5000), status: 'PARTIALLY_PAID' },
  });
  console.log('  invoice INV#0001 with a partial payment');

  /* --------------------------------------------------------- leave types */
  for (const name of ['Casual', 'Sick', 'Earned']) {
    const type = await prisma.leaveType.upsert({
      where: { organizationId_name: { organizationId: org.id, name } },
      update: {},
      create: { organizationId: org.id, name, defaultQuota: new Prisma.Decimal(10) },
    });
    // Entitlement is now per employee per year, not a hardcoded constant.
    for (const employeeId of employeeIdByEmail.values()) {
      await prisma.leaveBalance.upsert({
        where: {
          employeeId_leaveTypeId_year: { employeeId, leaveTypeId: type.id, year: 2026 },
        },
        update: {},
        create: { employeeId, leaveTypeId: type.id, year: 2026, quota: new Prisma.Decimal(10) },
      });
    }
  }
  console.log('  leave types + per-employee balances');


  /* ------------------------------------------------------ pipeline & CRM */
  const stageSeeds = [
    { name: 'Qualifying', position: 0, outcome: 'OPEN' as const },
    { name: 'Proposal', position: 1, outcome: 'OPEN' as const },
    { name: 'Negotiation', position: 2, outcome: 'OPEN' as const },
    { name: 'Won', position: 3, outcome: 'WON' as const },
    { name: 'Lost', position: 4, outcome: 'LOST' as const },
  ];
  const stageIds = new Map<string, string>();
  for (const stage of stageSeeds) {
    const row = await prisma.pipelineStage.upsert({
      where: { organizationId_name: { organizationId: org.id, name: stage.name } },
      update: { position: stage.position, outcome: stage.outcome },
      create: { organizationId: org.id, ...stage },
    });
    stageIds.set(stage.name, row.id);
  }

  const existingLead = await prisma.lead.findFirst({
    where: { organizationId: org.id, company: 'Lumen Health' },
  });
  const lead = existingLead ?? await prisma.lead.create({
    data: {
      organizationId: org.id,
      name: 'Priya Raman',
      company: 'Lumen Health',
      email: 'priya@lumen.example',
      source: 'Website',
      status: 'QUALIFIED',
      value: new Prisma.Decimal(28000),
    },
  });
  if (!existingLead) await prisma.deal.create({
    data: {
      organizationId: org.id,
      leadId: lead.id,
      stageId: stageIds.get('Proposal')!,
      title: 'Lumen Health — patient portal',
      value: new Prisma.Decimal(28000),
      probability: 60,
      expectedCloseOn: new Date('2026-10-30'),
    },
  });
  console.log('  pipeline: 5 stages, 1 lead, 1 deal');

  /* -------------------------------------------------------- shift & misc */
  await prisma.shift.upsert({
    where: { organizationId_name: { organizationId: org.id, name: 'General' } },
    update: {},
    create: {
      organizationId: org.id, name: 'General', startsAt: '09:00', endsAt: '18:00',
      workingDays: 'Mon-Fri',
    },
  });

  await prisma.holiday.upsert({
    where: {
      organizationId_holidayOn_name: {
        organizationId: org.id, holidayOn: new Date('2026-12-25'), name: 'Christmas Day',
      },
    },
    update: {},
    create: { organizationId: org.id, name: 'Christmas Day', holidayOn: new Date('2026-12-25') },
  });

  const ticketCount = await prisma.ticket.count({ where: { organizationId: org.id } });
  if (ticketCount === 0) {
    await prisma.ticket.create({
      data: {
        organizationId: org.id,
        number: 'TKT#0001',
        subject: 'Cannot download invoice PDF',
        body: 'The download button returns a 404 for INV#0001.',
        clientId: clients[0].id,
        requesterName: clients[0].name,
        priority: 'HIGH',
        status: 'OPEN',
        channel: 'Email',
      },
    });
  }

  const assetCount = await prisma.asset.count({ where: { organizationId: org.id } });
  if (assetCount === 0) {
    await prisma.asset.create({
      data: {
        organizationId: org.id,
        name: 'MacBook Pro 16"',
        assetCode: 'AST-001',
        category: 'Laptop',
        serialNumber: 'C02X1234JGH7',
        purchasedOn: new Date('2025-11-02'),
        cost: new Prisma.Decimal(2899),
        status: 'AVAILABLE',
      },
    });
  }

  const jobCount = await prisma.job.count({ where: { organizationId: org.id } });
  if (jobCount === 0) {
    const job = await prisma.job.create({
      data: {
        organizationId: org.id,
        title: 'Senior Backend Engineer',
        departmentId: departments.get('Engineering'),
        location: 'Remote',
        employmentType: 'FULL_TIME',
        openings: 2,
        status: 'OPEN',
        description: 'NestJS, Postgres, and a taste for correct money handling.',
      },
    });
    await prisma.application.create({
      data: {
        organizationId: org.id,
        jobId: job.id,
        name: 'Devon Marsh',
        email: 'devon@example.com',
        skills: ['nestjs', 'postgres', 'prisma'],
        stage: 'INTERVIEW',
      },
    });
  }

  await prisma.letterTemplate.upsert({
    where: { organizationId_name: { organizationId: org.id, name: 'Offer Letter' } },
    update: {},
    create: {
      organizationId: org.id,
      name: 'Offer Letter',
      body:
        'Dear {{employee_name}},\n\n' +
        'We are delighted to offer you the position of {{designation}} in our {{department}} ' +
        'team at {{company}}.\n\n' +
        'Your appointment takes effect from {{joining_date}}, with annual compensation of ' +
        '{{salary}}.\n\nWarm regards,\n{{company}} · People Team\n{{today}}',
    },
  });
  console.log('  shift, holiday, ticket, asset, job, letter template');

  /* ------------------------------------------------------------ channels */

  /* A workspace with no channels has nowhere to talk, and Chat opens on an
     empty screen. Everyone is a member of the company-wide ones. */
  const everyone = [...userIdByEmail.values()];

  for (const seed of [
    { slug: 'general', name: 'general', description: 'Company-wide chatter and wins' },
    { slug: 'announcements', name: 'announcements', description: 'Official announcements only' },
    { slug: 'engineering', name: 'engineering', description: 'Builds, reviews and releases' },
  ]) {
    const channel = await prisma.channel.upsert({
      where: { organizationId_slug: { organizationId: org.id, slug: seed.slug } },
      update: {},
      create: {
        organizationId: org.id,
        slug: seed.slug,
        name: seed.name,
        description: seed.description,
        kind: 'PUBLIC',
        createdById: userIdByEmail.get('owner@worksuite.demo') ?? null,
      },
    });

    await prisma.channelMember.createMany({
      data: everyone.map((userId) => ({ channelId: channel.id, userId })),
      skipDuplicates: true,
    });
  }
  console.log('  3 channels, everyone joined');

  /* ------------------------------------------------------- the rest */

  /* Everything below is demo content for the modules added later. Guarded the
     same way as the rest: created once, then left alone. */
  const day = (offset: number) => {
    const d = new Date();
    d.setDate(d.getDate() + offset);
    return d;
  };

  const owner = userIdByEmail.get('owner@worksuite.demo')!;
  const staff = [...employeeIdByEmail.values()];

  if ((await prisma.bankAccount.count({ where: { organizationId: org.id } })) === 0) {
    const primary = await prisma.bankAccount.create({
      data: {
        organizationId: org.id,
        name: 'Primary Account',
        bankName: 'First National',
        kind: 'Bank',
        accountNumber: '•••• 4410',
        openingBalance: new Prisma.Decimal(120000),
        isPrimary: true,
      },
    });
    await prisma.bankAccount.create({
      data: {
        organizationId: org.id,
        name: 'Petty Cash',
        kind: 'Cash',
        openingBalance: new Prisma.Decimal(1240),
      },
    });
    await prisma.bankTransaction.createMany({
      data: [
        { organizationId: org.id, bankAccountId: primary.id, direction: 'CREDIT', amount: new Prisma.Decimal(25713), occurredOn: day(-24), memo: 'INV#0001 part payment' },
        { organizationId: org.id, bankAccountId: primary.id, direction: 'DEBIT', amount: new Prisma.Decimal(942), occurredOn: day(-22), memo: 'Workstation upgrade' },
        { organizationId: org.id, bankAccountId: primary.id, direction: 'DEBIT', amount: new Prisma.Decimal(2400), occurredOn: day(-9), memo: 'Office rent' },
      ],
    });

    await prisma.recurringInvoice.create({
      data: {
        organizationId: org.id,
        clientId: clients[0].id,
        amount: new Prisma.Decimal(4500),
        cycle: 'Monthly',
        startedOn: day(-240),
        nextRunOn: day(12),
        issuedCount: 8,
        memo: 'Retainer — support & maintenance',
      },
    });
    await prisma.recurringExpense.createMany({
      data: [
        { organizationId: org.id, item: 'Office rent', category: 'Facilities', amount: new Prisma.Decimal(2400), nextRunOn: day(20) },
        { organizationId: org.id, item: 'CI runner pool', category: 'Software', amount: new Prisma.Decimal(260), nextRunOn: day(6) },
      ],
    });
    console.log('  2 bank accounts + ledger, recurring invoice & expenses');
  }

  if ((await prisma.contract.count({ where: { organizationId: org.id } })) === 0) {
    await prisma.contract.create({
      data: {
        organizationId: org.id,
        number: 'CONTRACT#0001',
        title: 'User Management — annual support',
        kind: 'Support',
        clientId: clients[0].id,
        projectId: project.id,
        value: new Prisma.Decimal(24000),
        startsOn: day(-200),
        endsOn: day(165),
        status: 'Signed',
        signedAt: day(-200),
      },
    });

    await prisma.proposal.create({
      data: {
        organizationId: org.id,
        leadId: lead.id,
        number: 'PROP#0001',
        title: 'Lumen Health — patient portal',
        total: new Prisma.Decimal(28000),
        issuedOn: day(-14),
        validUntil: day(16),
        status: 'Sent',
      },
    });

    const discussion = await prisma.discussion.create({
      data: {
        organizationId: org.id,
        projectId: project.id,
        title: 'Audit log retention policy',
        body: 'How long do we keep audit rows before archiving? Compliance asked for 24 months.',
        authorId: owner,
      },
    });
    await prisma.discussionReply.createMany({
      data: [
        { organizationId: org.id, discussionId: discussion.id, authorId: userIdByEmail.get('lead@worksuite.demo')!, body: '24 months is fine — the table is small. I would archive rather than delete.' },
        { organizationId: org.id, discussionId: discussion.id, authorId: owner, body: 'Agreed. I will write it up in the knowledge base.' },
      ],
    });

    for (const idea of [
      { title: 'Dark mode across the client portal', category: 'UI', status: 'In Progress' },
      { title: 'Slack notifications for invoice payments', category: 'Integrations', status: 'Planned' },
      { title: 'Custom report builder', category: 'Reports', status: 'Under Review' },
    ]) {
      const row = await prisma.roadmapIdea.create({
        data: { organizationId: org.id, ...idea, createdById: owner },
      });
      // A couple of real votes, so the counts are not all zero.
      await prisma.roadmapIdeaVote.createMany({
        data: [...userIdByEmail.values()]
          .slice(0, idea.category === 'Reports' ? 4 : 2)
          .map((userId) => ({ ideaId: row.id, userId })),
        skipDuplicates: true,
      });
    }
    console.log('  contract, proposal, discussion + replies, 3 roadmap ideas');
  }

  if ((await prisma.salary.count({ where: { organizationId: org.id } })) === 0) {
    const annual = [96000, 84000, 90000, 52000, 46000, 62000];
    for (const [i, employeeId] of staff.entries()) {
      await prisma.salary.create({
        data: {
          organizationId: org.id,
          employeeId,
          annualAmount: new Prisma.Decimal(annual[i] ?? 50000),
          effectiveFrom: day(-300),
        },
      });
    }

    await prisma.salaryChange.create({
      data: {
        organizationId: org.id,
        employeeId: staff[1],
        fromAmount: new Prisma.Decimal(76000),
        toAmount: new Prisma.Decimal(84000),
        effectiveOn: day(-70),
        note: 'Annual review',
      },
    });

    await prisma.overtimeRequest.createMany({
      data: [
        { organizationId: org.id, employeeId: staff[3], workedOn: day(-20), hours: new Prisma.Decimal(3), reason: 'Release hotfix', status: 'APPROVED' },
        { organizationId: org.id, employeeId: staff[2], workedOn: day(-16), hours: new Prisma.Decimal(2), reason: 'Load test window' },
      ],
    });
    console.log('  salaries, one raise on record, 2 overtime requests');
  }

  if ((await prisma.objective.count({ where: { organizationId: org.id } })) === 0) {
    const objective = await prisma.objective.create({
      data: {
        organizationId: org.id,
        title: 'Ship the RBAC overhaul to production',
        kind: 'Team',
        employeeId: staff[0],
        priority: 'High',
        checkinCadence: 'Weekly',
        periodStart: day(-70),
        periodEnd: day(20),
      },
    });
    await prisma.keyResult.createMany({
      data: [
        { objectiveId: objective.id, title: 'Migrate 100% of roles to the new matrix', target: new Prisma.Decimal(100), current: new Prisma.Decimal(80) },
        { objectiveId: objective.id, title: 'Zero P1 auth incidents for 30 days', target: new Prisma.Decimal(30), current: new Prisma.Decimal(17) },
        { objectiveId: objective.id, title: 'Docs and training complete', target: new Prisma.Decimal(100), current: new Prisma.Decimal(40) },
      ],
    });
    // Progress is derived, so set it to match what the key results say.
    await prisma.objective.update({ where: { id: objective.id }, data: { progress: 59 } });

    await prisma.reviewMeeting.createMany({
      data: [
        { organizationId: org.id, employeeId: staff[2], heldById: owner, scheduledAt: day(4), durationMins: 30, agenda: 'Quarterly check-in' },
        { organizationId: org.id, employeeId: staff[3], heldById: owner, scheduledAt: day(-10), durationMins: 30, status: 'Completed', completedAt: day(-10), notes: 'Going well; wants more backend work.' },
      ],
    });

    const award = await prisma.award.create({
      data: { organizationId: org.id, name: 'Employee of the Month', icon: '🏆', summary: 'Outstanding overall contribution' },
    });
    await prisma.award.create({
      data: { organizationId: org.id, name: 'Best Team Player', icon: '🤝', summary: 'Collaboration above and beyond' },
    });
    await prisma.appreciation.create({
      data: { organizationId: org.id, awardId: award.id, employeeId: staff[1], givenById: owner, awardedOn: day(-30) },
    });
    console.log('  objective + 3 key results, 2 review meetings, awards');
  }

  if ((await prisma.emergencyContact.count({ where: { employeeId: staff[0] } })) === 0) {
    await prisma.emergencyContact.createMany({
      data: [
        { employeeId: staff[0], name: 'Amira Ziemann', relation: 'Spouse', phone: '1-330-118-6690' },
        { employeeId: staff[1], name: 'Rolf Lueilwitz', relation: 'Father', phone: '1-601-577-1204' },
      ],
    });
    await prisma.employeeDocument.createMany({
      data: [
        { employeeId: staff[0], name: 'Offer letter.pdf', category: 'Contract', issuedOn: day(-300) },
        { employeeId: staff[0], name: 'NDA (signed).pdf', category: 'Legal', issuedOn: day(-298) },
      ],
    });
    console.log('  emergency contacts + employee documents');
  }

  if ((await prisma.hosting.count({ where: { organizationId: org.id } })) === 0) {
    const hosting = await prisma.hosting.create({
      data: {
        organizationId: org.id,
        title: 'Production cluster',
        provider: 'Google Cloud Platform',
        plan: 'VPS — SSD',
        status: 'Active',
        purchasedOn: day(-290),
        expiresOn: day(75),
        cost: new Prisma.Decimal(2400),
      },
    });
    await prisma.domain.createMany({
      data: [
        { organizationId: org.id, name: 'worksuite.example', provider: 'GoDaddy', kind: 'PROD', hostingId: hosting.id, status: 'Active', purchasedOn: day(-360), expiresOn: day(5) },
        { organizationId: org.id, name: 'staging.worksuite.example', provider: 'GoDaddy', kind: 'DEV', hostingId: hosting.id, status: 'Active', purchasedOn: day(-360), expiresOn: day(120) },
      ],
    });

    await prisma.bioLink.create({
      data: {
        organizationId: org.id,
        name: 'Worksuite — Official',
        slug: 'official',
        links: [
          { label: 'Website', url: 'https://worksuite.example' },
          { label: 'Careers', url: 'https://worksuite.example/careers' },
        ],
        clicks: 1240,
      },
    });
    await prisma.qrCode.create({
      data: { organizationId: org.id, title: 'Office WiFi', kind: 'WiFi', payload: 'WIFI:S:Worksuite;T:WPA;;', color: '#e8983c' },
    });

    const device = await prisma.biometricDevice.create({
      data: {
        organizationId: org.id,
        name: 'HQ Entrance — ZK F18',
        serialNumber: 'ZK-88-1042',
        location: 'Main Door',
        status: 'Online',
        lastSyncAt: new Date(),
      },
    });
    await prisma.biometricPunch.createMany({
      data: staff.slice(0, 3).map((employeeId, i) => ({
        organizationId: org.id,
        deviceId: device.id,
        employeeId,
        direction: 'IN',
        punchedAt: new Date(new Date().setHours(9, 2 + i * 5, 0, 0)),
      })),
    });
    console.log('  hosting + domains, bio link, QR code, door reader');
  }

  if ((await prisma.floor.count({ where: { organizationId: org.id } })) === 0) {
    const floor = await prisma.floor.create({
      data: { organizationId: org.id, name: 'Floor 1 · Product', position: 0 },
    });
    await prisma.officeRoom.createMany({
      data: [
        { organizationId: org.id, floorId: floor.id, name: 'Lobby', slug: 'lobby', kind: 'social', icon: '🛋️', capacity: 20, position: 0 },
        { organizationId: org.id, floorId: floor.id, name: 'Open Desks', slug: 'desks-a', kind: 'work', icon: '💻', capacity: 12, position: 1 },
        { organizationId: org.id, floorId: floor.id, name: 'Focus Pods', slug: 'focus-pods', kind: 'quiet', icon: '🎧', capacity: 6, position: 2 },
        { organizationId: org.id, floorId: floor.id, name: 'Boardroom', slug: 'boardroom', kind: 'meeting', icon: '📊', capacity: 10, position: 3 },
      ],
    });

    const meeting = await prisma.teamMeeting.create({
      data: {
        organizationId: org.id,
        title: 'Sprint Review — User Management',
        roomKey: 'meet-sprint-um',
        projectId: project.id,
        organizerId: owner,
        startsAt: day(3),
        durationMins: 45,
      },
    });
    await prisma.teamMeetingAttendee.createMany({
      data: [...userIdByEmail.values()].slice(0, 4).map((userId) => ({ meetingId: meeting.id, userId })),
      skipDuplicates: true,
    });
    console.log('  1 floor + 4 rooms, 1 scheduled meeting');
  }


  console.log('\nDone.');
  console.log(`Sign in with any of these — password: ${DEMO_PASSWORD}`);
  for (const p of people) console.log(`  ${p.role.padEnd(12)} ${p.email}`);
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
    await pool.end();
  });
