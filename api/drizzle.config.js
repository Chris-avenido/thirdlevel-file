import { defineConfig } from 'drizzle-kit';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config({ path: path.resolve(__dirname, '../.env') });

function getDbCredentials() {
  if (process.env.DATABASE_URL) {
    try {
      const parsedUrl = new URL(process.env.DATABASE_URL);
      const isAzure = process.env.DATABASE_URL.includes('azure');
      return {
        host: parsedUrl.hostname,
        port: Number(parsedUrl.port) || 5432,
        user: decodeURIComponent(parsedUrl.username),
        password: decodeURIComponent(parsedUrl.password),
        database: parsedUrl.pathname.replace(/^\//, ''),
        ssl: isAzure ? { rejectUnauthorized: false } : false,
      };
    } catch {
      return {
        url: process.env.DATABASE_URL,
      };
    }
  }

  return {
    host: process.env.DB_HOST || 'localhost',
    port: Number(process.env.DB_PORT) || 5432,
    user: process.env.DB_USER || 'postgres',
    password: process.env.DB_PASSWORD || 'root',
    database: process.env.DB_NAME || 'insighted_standalone',
    ssl: false,
  };
}

export default defineConfig({
  dialect: 'postgresql',
  schema: './src/db/schema.js',
  out: './src/db',
  dbCredentials: getDbCredentials(),
});
