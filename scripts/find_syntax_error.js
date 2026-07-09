const fs = require('fs');
const path = process.argv[2] || 'js/phone-select.js';
const s = fs.readFileSync(path,'utf8');
let lo = 0, hi = s.length;
let lastGood = 0;
while(lo < hi){
  const mid = Math.floor((lo+hi)/2);
  try{
    new Function(s.slice(0, mid));
    lastGood = mid;
    lo = mid + 1;
  }catch(e){
    hi = mid;
  }
}
const start = Math.max(0, lastGood-120);
const end = Math.min(s.length, lastGood+120);
console.log('lastGood index:', lastGood);
console.log('context:\n---\n'+ s.slice(start,end) + '\n---');
console.log('remaining starts with:', s.slice(lastGood, lastGood+40).replace(/\n/g,'\\n'));
console.log('full length:', s.length);
