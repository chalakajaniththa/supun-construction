import 'dotenv/config';
import { defineConfig } from 'prisma/config';

export default defineConfig({
  schema: 'prisma/schema.prisma',
  migrations: {
    path: 'prisma/migrations',
  },
  datasource: {
    // Not needed for `prisma generate` (e.g. in the Docker build); migrate commands fail
    // with a clear error when it is missing.
    url: process.env.DATABASE_URL ?? '',
  },
});
