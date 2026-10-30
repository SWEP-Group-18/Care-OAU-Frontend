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

  console.log('Connected to DB successfully!');

  // List tables
  const [tables] = await conn.query('SHOW TABLES');
  console.log('Tables:', tables.map(t => Object.values(t)[0]));

  // Check services
  try {
    const [services] = await conn.query('SELECT * FROM clinical_services LIMIT 10');
    console.log('clinical_services count:', services.length);
    console.log('clinical_services sample:', services.map(s => ({ id: s.id, publicId: s.public_id || s.publicId, name: s.name })));
  } catch (e) {
    console.log('clinical_services error:', e.message);
  }

  // Check doctors table
  try {
    const [doctors] = await conn.query('SELECT * FROM doctors LIMIT 10');
    console.log('doctors count:', doctors.length);
    console.log('doctors sample:', doctors);
  } catch (e) {
    console.log('doctors error:', e.message);
  }

  // Check users table for admin
  try {
    const [users] = await conn.query("SELECT id, public_id, email, role FROM users LIMIT 10");
    console.log('users sample:', users);
  } catch (e) {
    console.log('users error:', e.message);
  }

  await conn.end();
}

check().catch(console.error);

