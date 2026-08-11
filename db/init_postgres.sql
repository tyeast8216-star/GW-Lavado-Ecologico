-- init_postgres.sql
-- Crea las tablas básicas para la aplicación GW Lavado Ecologico

CREATE TABLE IF NOT EXISTS users (
  id SERIAL PRIMARY KEY,
  name TEXT,
  email TEXT UNIQUE,
  passwordHash TEXT,
  isAdmin INTEGER DEFAULT 0,
  phone TEXT
);

CREATE TABLE IF NOT EXISTS products (
  id SERIAL PRIMARY KEY,
  name TEXT,
  description TEXT,
  price NUMERIC DEFAULT 0,
  image TEXT,
  category TEXT,
  stock INTEGER DEFAULT 0
);

CREATE TABLE IF NOT EXISTS purchases (
  id SERIAL PRIMARY KEY,
  user_id INTEGER REFERENCES users(id),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  description TEXT,
  total NUMERIC,
  items TEXT,
  delivered INTEGER DEFAULT 0,
  delivered_at TIMESTAMP WITH TIME ZONE,
  hidden INTEGER DEFAULT 0,
  external_id TEXT
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_purchases_external_id ON purchases(external_id);

CREATE TABLE IF NOT EXISTS contacts (
  id SERIAL PRIMARY KEY,
  name TEXT,
  email TEXT,
  phone TEXT,
  service TEXT,
  message TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

CREATE TABLE IF NOT EXISTS email_verifications (
  id SERIAL PRIMARY KEY,
  email TEXT,
  code TEXT,
  expires_at INTEGER
);
