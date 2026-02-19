/**
 * Script to execute SQL migrations against a Postgres DB.
 *
 * Usage (PowerShell):
 *   $env:SUPABASE_DB_URL = "postgres://user:pass@host:port/db"
 *   node scripts/run-migrations.js
 *
 * This uses the `pg` package to run the SQL in `backend/supabase-migrations.sql`.
 */

const fs = require('fs')
const { Client } = require('pg')

const sqlFile = 'backend/supabase-migrations.sql'

async function run() {
  const dbUrl = process.env.SUPABASE_DB_URL
  if (!dbUrl) {
    console.error('Please set SUPABASE_DB_URL environment variable (postgres connection string)')
    process.exit(1)
  }

  const sql = fs.readFileSync(sqlFile, 'utf-8')
  const client = new Client({ connectionString: dbUrl })
  try {
    await client.connect()
    console.log('Connected to DB, running migrations...')
    await client.query(sql)
    console.log('Migrations applied successfully.')
  } catch (err) {
    console.error('Error applying migrations:', err)
  } finally {
    await client.end()
  }
}

run()
