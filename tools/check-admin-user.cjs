const mysql = require('c:/Users/USER/Documents/COLDWANDE.DEV/care-oau-api/node_modules/mysql2/promise');

async function check() {
  const conn = await mysql.createConnection({
    host: 'gateway01.eu-central-1.prod.aws.tidbcloud.com',
    port: 4000,
    user: 'x5qxXguH8GHdyhb.root',
    password: 'dvV9HAtW9pVbyjXj',
    database: 'care-oau-db',
    ssl: { rejectUnauthorized: true }
  });

  const [users] = await conn.query("SELECT id, public_id, email, role, email_verified, password_hash FROM users WHERE role = 'admin' OR email LIKE '%admin%'");
  console.log('Admins in DB:', users);

  await conn.end();
}

check().catch(console.error);

