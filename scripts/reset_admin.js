const sqlite3 = require('sqlite3').verbose();
const bcrypt = require('bcryptjs');
const path = require('path');

if(process.argv.length < 4){
  console.error('Usage: node scripts/reset_admin.js <email> <newpassword>');
  process.exit(1);
}
const email = process.argv[2];
const newPass = process.argv[3];
if(newPass.length < 8){
  console.error('Password must be at least 8 characters');
  process.exit(1);
}

const DB_PATH = path.join(__dirname, '..', 'users.db');
const db = new sqlite3.Database(DB_PATH, (err)=>{
  if(err){ console.error('DB open error', err); process.exit(1); }
});

const hash = bcrypt.hashSync(newPass, 10);

db.run('UPDATE users SET passwordHash = ? WHERE email = ?', [hash, email], function(err){
  if(err){ console.error('Error updating password', err); process.exit(1); }
  if(this.changes === 0){
    console.error('No user found with that email');
    process.exit(1);
  }
  console.log('Password updated for', email);
  process.exit(0);
});
