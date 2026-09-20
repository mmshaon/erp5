// api/_db.js
import { neon } from '@neondatabase/serverless';

let sql = null;

export function getDb() {
  if (!sql) {
    if (!process.env.DATABASE_URL) throw new Error('DATABASE_URL is not set');
    sql = neon(process.env.DATABASE_URL);
  }
  return sql;
}
