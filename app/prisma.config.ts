import 'dotenv/config';
import { defineConfig } from 'prisma/config';

export default defineConfig({
	schema: 'prisma/schema.prisma',
	migrations: {
		path: 'prisma/migrations'
	},
	datasource: {
		// Use process.env directly so `prisma generate` doesn't fail without a DB
		url: process.env.DATABASE_URL ?? ''
	}
});
