const fs = require('fs');
let s = fs.readFileSync('js/countries.json','utf8');
// replace key:'value' for keys cc, name, dial
s = s.replace(/(cc|name|dial):'([^']*)'/g, '"$1":"$2"');
// remove trailing commas before closing if any (not expected but safe)
s = s.replace(/,\s*\]/g, ']');
fs.writeFileSync('js/countries.json', s);
try{ JSON.parse(s); console.log('countries.json valid JSON'); }catch(e){ console.error('invalid JSON:', e.message); process.exit(1); }
