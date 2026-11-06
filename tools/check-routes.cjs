const fs = require('fs');

async function main() {
  const res = await fetch('https://care-oau-api.onrender.com/api-docs/swagger-ui-init.js');
  const text = await res.text();
  const startIdx = text.indexOf('"swaggerDoc":');
  const after = text.slice(startIdx + '"swaggerDoc":'.length).trim();
  let depth = 0, endIdx = -1;
  for (let i = 0; i < after.length; i++) {
    if (after[i] === '{') depth++;
    else if (after[i] === '}') {
      depth--;
      if (depth === 0) { endIdx = i + 1; break; }
    }
  }
  const doc = JSON.parse(after.slice(0, endIdx));
  console.log('Servers:', doc.servers);
  console.log('basePath:', doc.basePath);
  console.log('All appointment paths:');
  for (const p of Object.keys(doc.paths)) {
    if (p.includes('appointment')) {
      console.log(p, Object.keys(doc.paths[p]));
    }
  }
}

main().catch(console.error);

