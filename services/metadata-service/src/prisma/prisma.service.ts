import { Injectable, OnModuleInit } from '@nestjs/common';
import { PrismaClient } from '../../generated/prisma';
import { Pool } from 'pg';
import { PrismaPg } from '@prisma/adapter-pg';

@Injectable()
export class PrismaService extends PrismaClient implements OnModuleInit {
  constructor() {
    const pool = new Pool({ connectionString: process.env.DATABASE_URL! });
    const adapter = new PrismaPg(pool as any);
    super({ adapter });
  }

  async onModuleInit() {
    await this.$connect();
  }

  /**
   * Run `fn` inside a transaction with the RLS session variable
   * `app.current_org` set, so Postgres row-level security policies scope
   * every query to the caller's organization. This is the DB-layer second
   * line of defense; app-layer organizationId filtering remains primary.
   *
   * SET LOCAL is transaction-scoped, so the value never leaks between
   * requests sharing a pooled connection.
   */
  async withOrgContext<T>(
    organizationId: string,
    fn: (
      tx: Omit<
        PrismaClient,
        | '$connect'
        | '$disconnect'
        | '$on'
        | '$transaction'
        | '$use'
        | '$extends'
      >,
    ) => Promise<T>,
  ): Promise<T> {
    return this.$transaction(async (tx) => {
      // Parameterized to prevent injection via organizationId.
      await tx.$executeRaw`SELECT set_config('app.current_org', ${organizationId}, true)`;
      return fn(tx);
    });
  }
}
