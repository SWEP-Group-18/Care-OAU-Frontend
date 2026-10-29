const spec = require('./swagger-spec.json');

const targets = [
  'GET /services',
  'GET /admin/services',
  'GET /admin/appointments',
  'PATCH /admin/appointments/{publicId}/approve',
  'PATCH /admin/appointments/{publicId}/reject',
  'PATCH /admin/appointments/{publicId}/check-in',
  'PATCH /admin/appointments/{publicId}/complete',
  'GET /appointments/slots',
  'POST /appointments',
  'GET /appointments/me',
  'PATCH /appointments/{publicId}/cancel',
  'GET /admin/doctors'
];

for (const t of targets) {
  const [method, path] = t.split(' ');
  const op = spec.paths[path]?.[method.toLowerCase()];
  if (!op) {
    console.log(t, 'NOT FOUND');
    continue;
  }
  console.log(`\n=================== ${t} ===================`);
  if (op.parameters) {
    console.log('Params:', op.parameters);
  }
  if (op.requestBody) {
    console.log('Request body schema:', JSON.stringify(op.requestBody.content?.['application/json']?.schema, null, 2));
  }
  const res200 = op.responses?.['200'] || op.responses?.['201'];
  if (res200) {
    console.log('Response schema:', JSON.stringify(res200.content?.['application/json']?.schema, null, 2));
  }
}
