import { pgTable, text, timestamp, integer, boolean, jsonb, serial } from 'drizzle-orm/pg-core';

// Cloud SQL KV / Document Store table for storing system state & entities
export const appData = pgTable('app_data', {
  key: text('key').primaryKey(),
  data: jsonb('data').notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

// Users table matching Cloud SQL / Auth schema standards
export const users = pgTable('users', {
  id: serial('id').primaryKey(),
  uid: text('uid').notNull().unique(),
  username: text('username').notNull(),
  name: text('name').notNull(),
  role: text('role').notNull(),
  club: text('club'),
  email: text('email'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});
