import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '@prisma/client';
import { env } from '$env/dynamic/private';

const DEFAULT_LOCAL_DATABASE_URL = 'postgresql://mediaserver:mediaserver@localhost:5432/mediaserver';

function getDatabaseUrl() {
	const databaseUrl = env.DATABASE_URL?.trim();

	if (!databaseUrl) {
		if (process.env.NODE_ENV !== 'production') {
			return DEFAULT_LOCAL_DATABASE_URL;
		}

		throw new Error('DATABASE_URL is not set');
	}

	let parsedUrl: URL;
	try {
		parsedUrl = new URL(databaseUrl);
	} catch {
		throw new Error('DATABASE_URL must be a valid PostgreSQL connection string');
	}

	if (!parsedUrl.password) {
		if (process.env.NODE_ENV !== 'production') {
			parsedUrl.password = env.DB_PASSWORD?.trim();
			if (!parsedUrl.password) {
				throw new Error('DB_PASSWORD must be set in development when DATABASE_URL does not include a password');
			}
			return parsedUrl.toString();
		}

		throw new Error('DATABASE_URL must include a database password');
	}

	return databaseUrl;
}

function createClient() {
	const adapter = new PrismaPg(getDatabaseUrl());
	return new PrismaClient({ adapter });
}

// Re-use a single client in development (hot-reload safe via globalThis)
const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };
export const db = globalForPrisma.prisma ?? createClient();

if (process.env.NODE_ENV !== 'production') {
	globalForPrisma.prisma = db;
}