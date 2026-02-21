import { Database } from 'bun:sqlite';
import { drizzle } from 'drizzle-orm/bun-sqlite';
import * as schema from './schema';

export const createDb = () => {
  const sqlite = new Database(':memory:');
  sqlite.run(`
    PRAGMA foreign_keys = ON;
    CREATE TABLE users (
      id TEXT PRIMARY KEY NOT NULL,
      name TEXT NOT NULL UNIQUE,
      password TEXT NOT NULL,
      role TEXT NOT NULL DEFAULT 'member'
    );
    CREATE TABLE posts (
      id TEXT PRIMARY KEY NOT NULL,
      title TEXT NOT NULL,
      content TEXT NOT NULL,
      tags TEXT NOT NULL DEFAULT '[]',
      author_id TEXT NOT NULL REFERENCES users(id),
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );
    CREATE TABLE comments (
      id TEXT PRIMARY KEY NOT NULL,
      post_id TEXT NOT NULL REFERENCES posts(id) ON DELETE CASCADE,
      text TEXT NOT NULL,
      author_id TEXT NOT NULL REFERENCES users(id),
      created_at TEXT NOT NULL
    );
  `);
  const db = drizzle(sqlite, { schema });
  db.insert(schema.users)
    .values([
      { id: 'u1', name: 'alice', password: 'password', role: 'admin' },
      { id: 'u2', name: 'bob', password: 'password', role: 'member' }
    ])
    .run();
  return db;
};

export type Db = ReturnType<typeof createDb>;
