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

  const [services] = await conn.query('SELECT * FROM services');
  console.log('Services in DB:', services);

  // Check structure of doctors table
  const [docCols] = await conn.query('DESCRIBE doctors');
  console.log('doctors table columns:', docCols.map(c => ({ Field: c.Field, Type: c.Type, Null: c.Null })));

  // Check structure of doctor_schedules table
  const [schedCols] = await conn.query('DESCRIBE doctor_schedules');
  console.log('doctor_schedules table columns:', schedCols.map(c => ({ Field: c.Field, Type: c.Type, Null: c.Null })));

  await conn.end();
}

check().catch(console.error);

