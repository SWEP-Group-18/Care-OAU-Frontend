const spec = require('./swagger-spec.json');
const op = spec.paths['/appointments/slots']?.get;
console.log('GET /appointments/slots response:');
console.log(JSON.stringify(op?.responses?.['200']?.content?.['application/json']?.schema, null, 2));
