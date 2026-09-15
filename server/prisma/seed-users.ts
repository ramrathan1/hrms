/**
 * Identity-only seed: the organization, the system permission catalogue, the
 * system roles, and one sign-in account per role.
 *
 * This is `seed.ts` stopped early. The full seed continues on into employees,
 * clients, projects, invoices and the rest of the demo content; this one
 * deliberately does not, so you get a database you can actually sign in to
 * while every business table stays empty for hand-entered data.
 *
 * Note that no Employee rows are created, so the six accounts are logins with
 * no HR record behind them — headcount reads zero and people screens start
 * empty. Create the employees through the app.
 *
 * Idempotent — every write is an upsert, so re-running it is safe.
 *
 * Runs unscoped on purpose: there is no request, so the tenant guard would
 * otherwise refuse.
 */
import { PrismaPg } from '@prisma/adapter-pg';
import * as bcrypt from 'bcrypt';
import { Pool } from 'pg';
import 'dotenv/config';

import { PrismaClient } from '../src/generated/prisma/client';
import { SYSTEM_PERMISSIONS, SYSTEM_ROLES } from '../src/modules/rbac/rbac.constants';

const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const prisma = new PrismaClient({ adapter: new PrismaPg(pool) });

const DEMO_PASSWORD = 'Password123!';

async function main(): Promise<void> {
  console.log('Seeding Worksuite users…');

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
    { email: 'owner@worksuite.demo', name: 'Mohammed Ziemann', role: 'OWNER' },
    { email: 'manager@worksuite.demo', name: 'Alden Glover', role: 'MANAGER' },
    { email: 'lead@worksuite.demo', name: 'Lila Lueilwitz', role: 'TEAM_LEADER' },
    { email: 'hr@worksuite.demo', name: 'Charley Marquardt', role: 'HR' },
    { email: 'accounts@worksuite.demo', name: 'Naomi Rempel', role: 'ACCOUNTANT' },
    { email: 'employee@worksuite.demo', name: 'Kole Johnston', role: 'EMPLOYEE' },
  ];

  for (const person of people) {
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

    await prisma.userRole.upsert({
      where: { userId_roleId: { userId: user.id, roleId: roleIdByKey.get(person.role)! } },
      update: {},
      create: { userId: user.id, roleId: roleIdByKey.get(person.role)! },
    });

    console.log(`  user ${person.email} (${person.role})`);
  }

  console.log(`\nDone. ${people.length} accounts, password "${DEMO_PASSWORD}".`);
}

main()
  .catch((err) => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
    await pool.end();
  });
