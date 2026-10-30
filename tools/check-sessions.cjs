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

  const [sessions] = await conn.query("SELECT * FROM sessions ORDER BY created_at DESC LIMIT 5");
  console.log('Recent sessions in DB:', sessions);

  await conn.end();
}

check().catch(console.error);

