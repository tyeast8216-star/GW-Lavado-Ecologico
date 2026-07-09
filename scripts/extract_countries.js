const fs = require('fs');
const s = fs.readFileSync('js/phone-select.js','utf8');
const start = s.indexOf('const COUNTRIES = [');
if(start===-1) { console.error('start not found'); process.exit(1); }
let i = s.indexOf('[', start);
let depth = 0;
let endIndex = -1;
for(let j=i;j<s.length;j++){
  const ch = s[j];
  if(ch === '[') depth++;
  else if(ch === ']'){ depth--; if(depth===0){ endIndex = j; break; }}
}
if(endIndex===-1){ console.error('end not found'); process.exit(1); }
const arrayText = s.slice(i, endIndex+1);
fs.writeFileSync('js/countries.json', arrayText);
console.log('wrote js/countries.json');
