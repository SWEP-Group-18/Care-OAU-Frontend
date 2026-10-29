const spec = require('./swagger-spec.json');

const targets = [
  'PATCH /admin/appointments/{publicId}/approve',
  'PATCH /admin/appointments/{publicId}/reject',
  'PATCH /admin/appointments/{publicId}/check-in',
  'PATCH /admin/appointments/{publicId}/complete'
];

for (const t of targets) {
  const [method, path] = t.split(' ');
  const op = spec.paths[path]?.[method.toLowerCase()];
  console.log(`\n=================== ${t} ===================`);
  console.log('Params:', op.parameters);
  if (op.requestBody) {
    console.log('Request body:', JSON.stringify(op.requestBody.content?.['application/json']?.schema, null, 2));
  }
  const res200 = op.responses?.['200'];
  if (res200) {
    console.log('Response:', JSON.stringify(res200.content?.['application/json']?.schema, null, 2));
  }
}
