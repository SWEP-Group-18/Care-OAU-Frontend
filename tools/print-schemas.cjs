const spec = require('./swagger-spec.json');

console.log('=== ENDPOINTS SCHEMAS ===\n');

for (const [path, methods] of Object.entries(spec.paths)) {
  for (const [method, op] of Object.entries(methods)) {
    console.log(`\n========================================`);
    console.log(`${method.toUpperCase()} ${path}`);
    console.log(`Summary: ${op.summary}`);
    console.log(`Tags:`, op.tags);
    if (op.parameters) {
      console.log('Parameters:', op.parameters.map(p => `${p.name} (${p.in}, required=${p.required})`));
    }
    if (op.requestBody) {
      const content = op.requestBody.content?.['application/json']?.schema;
      console.log('Request Body:', JSON.stringify(content, null, 2));
    }
    if (op.responses) {
      for (const [code, res] of Object.entries(op.responses)) {
        const schema = res.content?.['application/json']?.schema;
        console.log(`Response ${code}:`, schema ? (schema.$ref || schema.type || JSON.stringify(schema).slice(0, 200)) : res.description);
      }
    }
  }
}

