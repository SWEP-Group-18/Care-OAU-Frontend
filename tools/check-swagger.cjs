const fs = require('fs');

async function check() {
  const initRes = await fetch('https://care-oau-api.onrender.com/api-docs/swagger-ui-init.js');
  const initJs = await initRes.text();
  
  // Find "swaggerDoc": { ... }
  const startIdx = initJs.indexOf('"swaggerDoc":');
  if (startIdx !== -1) {
    // Write out a slice of initJs or extract swaggerDoc
    const sub = initJs.slice(startIdx + 13);
    // Find matching object
    let depth = 0;
    let endIdx = 0;
    for (let i = 0; i < sub.length; i++) {
      if (sub[i] === '{') depth++;
      else if (sub[i] === '}') {
        depth--;
        if (depth === 0) {
          endIdx = i + 1;
          break;
        }
      }
    }
    const docStr = sub.slice(0, endIdx);
    const spec = JSON.parse(docStr);
    console.log('=== BACKEND SWAGGER SPEC DETAILS ===');
    console.log('Title:', spec.info?.title, 'Version:', spec.info?.version);
    console.log('Servers:', spec.servers);
    console.log('\n--- ALL AVAILABLE PATHS & METHODS ---');
    for (const [p, methods] of Object.entries(spec.paths)) {
      for (const [m, op] of Object.entries(methods)) {
        console.log(`${m.toUpperCase().padEnd(7)} ${p.padEnd(45)} - ${op.summary || op.operationId || ''}`);
      }
    }

    // Save spec to swagger-spec.json for inspection
    fs.writeFileSync('tools/swagger-spec.json', JSON.stringify(spec, null, 2));
    console.log('\nSaved full spec to tools/swagger-spec.json');
  } else {
    console.log('swaggerDoc not found in initJs');
  }
}
check().catch(console.error);
