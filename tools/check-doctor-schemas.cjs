const spec = require('./swagger-spec.json');
console.log('POST /admin/doctors:');
console.log(JSON.stringify(spec.paths['/admin/doctors']?.post?.requestBody?.content?.['application/json']?.schema, null, 2));
console.log('PATCH /admin/doctors/{publicId}:');
console.log(JSON.stringify(spec.paths['/admin/doctors/{publicId}']?.patch?.requestBody?.content?.['application/json']?.schema, null, 2));
