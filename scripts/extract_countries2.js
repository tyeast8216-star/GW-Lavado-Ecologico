const fs = require('fs');
const s = fs.readFileSync('js/phone-select.js','utf8');
const marker = 'const COUNTRIES = [';
const start = s.indexOf(marker);
if(start===-1) { console.error('start not found'); process.exit(1); }
const after = s.indexOf('];', start);
if(after===-1){ console.error('end marker not found'); process.exit(1); }
const arrayText = s.slice(start + marker.length - 1, after+1); // include leading [
fs.writeFileSync('js/countries.json', arrayText);
console.log('wrote js/countries.json from', start, 'to', after+1);
