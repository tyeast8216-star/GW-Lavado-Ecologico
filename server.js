const express = require('express');
const path = require('path');
const session = require('express-session');
let multer;
try{ multer = require('multer'); }catch(e){ multer = null; }
const bcrypt = require('bcryptjs');
const { Pool } = require('pg');
const nodemailer = require('nodemailer');
// load environment variables from .env when present
try{ require('dotenv').config(); }catch(e){}

// Stripe (optional) - initialize if secret key present
let stripe = null;
try{
  const Stripe = require('stripe');
  if (process.env.STRIPE_SECRET_KEY) stripe = Stripe(process.env.STRIPE_SECRET_KEY);
}catch(e){ /* stripe not installed or not configured */ }

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(session({
  secret: 'change_this_secret',
  resave: false,
  saveUninitialized: false,
  cookie: { secure: false }
}));

app.use(express.static(path.join(__dirname)));

// PostgreSQL pool and lightweight compatibility wrapper
const pgConnectionString = process.env.DATABASE_URL || process.env.PG_CONNECTION;
if (!pgConnectionString) {
  console.error('Error: DATABASE_URL or PG_CONNECTION environment variable is required.');
  process.exit(1);
}
const pool = new Pool({
  connectionString: pgConnectionString,
  ssl: process.env.PG_SSL === '1' || process.env.PG_SSL === 'true' ? { rejectUnauthorized: false } : false
});

function toPg(sql) {
  let i = 0;
  return sql.replace(/\?/g, () => { i += 1; return '$' + i; });
}

const db = {
  get: (sql, params, cb) => {
    pool.query(toPg(sql), params || [])
      .then(r => cb(null, r.rows[0] || null))
      .catch(e => cb(e));
  },
  all: (sql, params, cb) => {
    pool.query(toPg(sql), params || [])
      .then(r => cb(null, r.rows || []))
      .catch(e => cb(e));
  },
  run: (sql, params, cb) => {
    const isInsert = /^\s*insert\s+/i.test(sql);
    const needsReturning = isInsert && !/returning\s+/i.test(sql);
    const finalSql = needsReturning ? (toPg(sql) + ' RETURNING id') : toPg(sql);
    pool.query(finalSql, params || [])
      .then(r => {
        const lastId = (r.rows && r.rows[0] && (r.rows[0].id || r.rows[0].lastval)) ? (r.rows[0].id || r.rows[0].lastval) : undefined;
        const changes = r.rowCount || 0;
        if (typeof cb === 'function') cb.call({ lastID: lastId, changes: changes });
      })
      .catch(e => { if (typeof cb === 'function') cb(e); });
  }
};

// Initialize schema on startup
(async function initDb(){
  try{
    await pool.query(`CREATE TABLE IF NOT EXISTS users (
      id SERIAL PRIMARY KEY,
      name TEXT,
      email TEXT UNIQUE,
      passwordHash TEXT,
      isAdmin INTEGER DEFAULT 0,
      phone TEXT
    )`);

    await pool.query(`CREATE TABLE IF NOT EXISTS purchases (
      id SERIAL PRIMARY KEY,
      user_id INTEGER REFERENCES users(id),
      created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
      description TEXT,
      total NUMERIC,
      items TEXT,
      delivered INTEGER DEFAULT 0,
      delivered_at TIMESTAMP WITH TIME ZONE,
      hidden INTEGER DEFAULT 0,
      external_id TEXT
    )`);

    await pool.query(`CREATE TABLE IF NOT EXISTS products (
      id SERIAL PRIMARY KEY,
      name TEXT,
      description TEXT,
      price NUMERIC DEFAULT 0,
      image TEXT,
      category TEXT,
      stock INTEGER DEFAULT 0
    )`);

    await pool.query(`CREATE TABLE IF NOT EXISTS contacts (
      id SERIAL PRIMARY KEY,
      name TEXT,
      email TEXT,
      phone TEXT,
      service TEXT,
      message TEXT,
      created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
    )`);

    await pool.query(`CREATE TABLE IF NOT EXISTS email_verifications (
      id SERIAL PRIMARY KEY,
      email TEXT,
      code TEXT,
      expires_at INTEGER
    )`);

    // unique index for external_id if present
    await pool.query(`CREATE UNIQUE INDEX IF NOT EXISTS idx_purchases_external_id ON purchases(external_id)`);

    // create demo user if missing
    const demoEmail = 'user@example.com';
    const r = await pool.query('SELECT id FROM users WHERE email = $1', [demoEmail]);
    if (!r.rows.length) {
      const demoHash = bcrypt.hashSync('password123', 10);
      await pool.query('INSERT INTO users (name,email,passwordHash,isAdmin) VALUES ($1,$2,$3,$4)', ['Demo User', demoEmail, demoHash, 1]);
    }
  }catch(e){ console.error('DB init error', e); }
})();

app.post('/login', (req, res) => {
  const { email, password } = req.body;
  if (!email || !password) return res.json({ ok: false, message: 'Faltan credenciales' });
  db.get('SELECT id,name,email,passwordHash,isAdmin FROM users WHERE email = ?', [email], (err, row) => {
    if (err) return res.json({ ok: false, message: 'Error de base de datos' });
    if (!row) return res.json({ ok: false, message: 'Usuario no encontrado' });
    const match = bcrypt.compareSync(password, row.passwordHash);
    if (!match) return res.json({ ok: false, message: 'Contraseña incorrecta' });
    req.session.user = { id: row.id, name: row.name, email: row.email, isAdmin: !!row.isAdmin };
    res.json({ ok: true });
  });
});

app.post('/register', (req, res) => {
  const { name, email, password, phone } = req.body;
  const verificationCode = req.body.verificationCode;
  if (!email || !password) return res.json({ ok: false, message: 'Faltan datos' });
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(email)) return res.json({ ok: false, message: 'Email inválido' });
  if (password.length < 8) return res.json({ ok: false, message: 'La contraseña debe tener al menos 8 caracteres' });
  db.get('SELECT id FROM users WHERE email = ?', [email], (err, row) => {
    if (err) return res.json({ ok: false, message: 'Error de base de datos' });
    if (row) return res.json({ ok: false, message: 'El usuario ya existe' });
    // require verification code
    if (!verificationCode) return res.json({ ok: false, message: 'Se requiere verificar el correo. Envía el código recibido.' });
    db.get('SELECT code,expires_at FROM email_verifications WHERE email = ? ORDER BY id DESC LIMIT 1', [email], (e2, vr) => {
      if (e2) return res.json({ ok: false, message: 'Error de base de datos' });
      const now = Math.floor(Date.now()/1000);
      if (!vr || vr.code !== String(verificationCode) || !vr.expires_at || vr.expires_at < now) return res.json({ ok: false, message: 'Código de verificación inválido o caducado' });
      // proceed to create user
      const passwordHash = bcrypt.hashSync(password, 10);
      db.run('INSERT INTO users (name,email,passwordHash,isAdmin,phone) VALUES (?,?,?,?,?)', [name, email, passwordHash, 0, phone || null], function(err) {
        if (err) return res.json({ ok: false, message: 'Error al crear usuario' });
        req.session.user = { id: this.lastID, name: name || '', email, isAdmin: false };
        res.json({ ok: true });
      });
    });
  });
});

// Send verification code to email
app.post('/api/send-verification', (req, res) => {
  const { email } = req.body || {};
  if (!email) return res.json({ ok: false, message: 'Email requerido' });
  const emailTrim = String(email).trim();
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(emailTrim)) return res.json({ ok: false, message: 'Email inválido' });
  const code = String(Math.floor(100000 + Math.random()*900000));
  const expiresAt = Math.floor(Date.now()/1000) + (10*60); // 10 minutes
  db.run('INSERT INTO email_verifications (email, code, expires_at) VALUES (?,?,?)', [emailTrim, code, expiresAt], function(err){
    if (err) {
      console.error('DB insert verification error', err);
      return res.status(500).json({ ok: false, message: 'Error al generar el código' });
    }
    // send email via nodemailer if configured
    const smtpHost = process.env.SMTP_HOST;
    if (smtpHost) {
      const transporter = nodemailer.createTransport({
        host: smtpHost,
        port: Number(process.env.SMTP_PORT||587),
        secure: process.env.SMTP_SECURE === '1' || process.env.SMTP_SECURE === 'true',
        auth: process.env.SMTP_USER ? { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS } : undefined,
        tls: { rejectUnauthorized: process.env.SMTP_REJECT_UNAUTHORIZED !== 'false' }
      });
      const from = process.env.FROM_EMAIL || ('no-reply@' + (req.hostname || 'localhost'));
      const mailOptions = { from, to: emailTrim, subject: 'GW Lavado Ecologico -Código de verificación', text: `Bienvenido a GW Lavado Ecologico! Tu código de verificación es: ${code} (válido 10 minutos)` };
      // verify transporter connection first for clearer errors
      transporter.verify((verErr, success) => {
        if (verErr) {
          console.error('SMTP verify error:', verErr && verErr.message ? verErr.message : verErr);
          const respErr = { ok: false, sent: false, message: 'No se pudo conectar al servidor SMTP' };
          if (process.env.NODE_ENV !== 'production') respErr.detail = verErr && verErr.message ? String(verErr.message) : String(verErr);
          return res.status(500).json(respErr);
        }
        transporter.sendMail(mailOptions, (mailErr, info) => {
          if (mailErr) {
            console.error('Mail send error', mailErr && mailErr.message ? mailErr.message : mailErr);
            const resp = { ok: false, sent: false, message: 'Error al enviar el correo' };
            if (process.env.NODE_ENV !== 'production') resp.detail = mailErr && mailErr.message ? String(mailErr.message) : String(mailErr);
            return res.status(500).json(resp);
          }
          console.log('Verification email sent to', emailTrim, 'info:', info && info.response ? info.response : info);
          return res.json({ ok: true, sent: true });
        });
      });
    } else {
      // no SMTP configured — in development, log code to console and optionally return it in the response
      console.log(`Verification code for ${emailTrim}: ${code}`);
      const showCode = (process.env.SHOW_VERIFICATION_CODE === '1') || (process.env.NODE_ENV !== 'production');
      const resp = { ok: true, sent: false, dev: true };
      if (showCode) resp.code = code;
      res.json(resp);
    }
  });
});

// Request password reset: send a one-time code to the user's email (if user exists)
app.post('/api/request-password-reset', (req, res) => {
  const { email } = req.body || {};
  if (!email) return res.json({ ok: false, message: 'Email requerido' });
  const emailTrim = String(email).trim();
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(emailTrim)) return res.json({ ok: false, message: 'Email inválido' });
  // check if user exists; only send when a user with that email exists
  db.get('SELECT id FROM users WHERE email = ? LIMIT 1', [emailTrim], (err, row) => {
    if (err) { console.error('DB error checking user for reset', err); return res.status(500).json({ ok: false, message: 'Error de base de datos' }); }
    if (!row) {
      // do not send email if no user found
      console.log('Password reset requested for non-existent user (no email sent):', emailTrim);
      return res.json({ ok: true, sent: false });
    }
    // user exists: generate code, store and send
    const code = String(Math.floor(100000 + Math.random()*900000));
    const expiresAt = Math.floor(Date.now()/1000) + (10*60);
    db.run('INSERT INTO email_verifications (email, code, expires_at) VALUES (?,?,?)', [emailTrim, code, expiresAt], function(err2){
      if (err2) { console.error('DB insert verification error', err2); return res.status(500).json({ ok: false, message: 'Error al generar el código' }); }
      // send email similar to send-verification
      const smtpHost = process.env.SMTP_HOST;
      if (smtpHost) {
        const transporter = nodemailer.createTransport({
          host: smtpHost,
          port: Number(process.env.SMTP_PORT||587),
          secure: process.env.SMTP_SECURE === '1' || process.env.SMTP_SECURE === 'true',
          auth: process.env.SMTP_USER ? { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS } : undefined,
          tls: { rejectUnauthorized: process.env.SMTP_REJECT_UNAUTHORIZED !== 'false' }
        });
        const from = process.env.FROM_EMAIL || ('no-reply@' + (req.hostname || 'localhost'));
        const mailOptions = { from, to: emailTrim, subject: 'GW Lavado Ecologico - Código de restablecimiento', text: `Has solicitado restablecer tu contraseña. Tu código es: ${code} (válido 10 minutos)` };
        transporter.verify((verErr) => {
          if (verErr) {
            console.error('SMTP verify error:', verErr && verErr.message ? verErr.message : verErr);
            const respErr = { ok: false, sent: false, message: 'No se pudo conectar al servidor SMTP' };
            if (process.env.NODE_ENV !== 'production') respErr.detail = verErr && verErr.message ? String(verErr.message) : String(verErr);
            return res.status(500).json(respErr);
          }
          transporter.sendMail(mailOptions, (mailErr) => {
            if (mailErr) { console.error('Mail send error', mailErr && mailErr.message ? mailErr.message : mailErr); const resp = { ok: false, sent: false, message: 'Error al enviar el correo' }; if (process.env.NODE_ENV !== 'production') resp.detail = mailErr && mailErr.message ? String(mailErr.message) : String(mailErr); return res.status(500).json(resp); }
            console.log('Password reset email sent to', emailTrim);
            return res.json({ ok: true, sent: true });
          });
        });
      } else {
        console.log(`Password reset code for ${emailTrim}: ${code}`);
        const resp = { ok: true, sent: false, dev: true };
        if ((process.env.SHOW_VERIFICATION_CODE === '1') || (process.env.NODE_ENV !== 'production')) resp.code = code;
        res.json(resp);
      }
    });
  });
});

// Reset password using code sent to email
app.post('/api/reset-password', (req, res) => {
  const { email, code, password, confirmPassword } = req.body || {};
  if (!email || !code || !password) return res.json({ ok: false, message: 'Faltan datos' });
  if (confirmPassword !== undefined && String(confirmPassword) !== String(password)) return res.json({ ok: false, message: 'Las contraseñas no coinciden' });
  if (String(password).length < 8) return res.json({ ok: false, message: 'La contraseña debe tener al menos 8 caracteres' });
  // complexity: at least one lowercase, one uppercase, one digit and one symbol
  try{
    const pwd = String(password);
    const complexity = /(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[^\w\s]).{8,}/;
    if(!complexity.test(pwd)) return res.json({ ok: false, message: 'La contraseña debe incluir mayúscula, minúscula, número y símbolo' });
  }catch(e){ /* ignore regex errors */ }
  const emailTrim = String(email).trim();
  db.get('SELECT code,expires_at FROM email_verifications WHERE email = ? ORDER BY id DESC LIMIT 1', [emailTrim], (err, row) => {
    if (err) return res.status(500).json({ ok: false, message: 'Error de base de datos' });
    const now = Math.floor(Date.now()/1000);
    if (!row || row.code !== String(code) || !row.expires_at || row.expires_at < now) return res.json({ ok: false, message: 'Código inválido o caducado' });
    const hash = bcrypt.hashSync(String(password), 10);
    db.run('UPDATE users SET passwordHash = ? WHERE email = ?', [hash, emailTrim], function(e2){
      if (e2) { console.error('Error updating password', e2); return res.status(500).json({ ok: false, message: 'Error al actualizar la contraseña' }); }
      res.json({ ok: true });
    });
  });
});

// Verify code endpoint (optional, server also checks code during /register)
app.post('/api/verify-code', (req, res) => {
  const { email, code } = req.body || {};
  if (!email || !code) return res.json({ ok: false, message: 'Faltan datos' });
  const emailTrim = String(email).trim();
  db.get('SELECT code,expires_at FROM email_verifications WHERE email = ? ORDER BY id DESC LIMIT 1', [emailTrim], (err, row) => {
    if (err) return res.status(500).json({ ok: false, message: 'Error de base de datos' });
    const now = Math.floor(Date.now()/1000);
    if (!row || row.code !== String(code) || !row.expires_at || row.expires_at < now) return res.json({ ok: false, valid: false, message: 'Código inválido o caducado' });
    res.json({ ok: true, valid: true });
  });
});

// API: listar usuarios (sin passwordHash). Requiere sesión activa.
app.get('/api/users', (req, res) => {
  if (!req.session || !req.session.user) return res.status(401).json({ ok: false, message: 'No autorizado' });
  if (!req.session.user.isAdmin) return res.status(403).json({ ok: false, message: 'Requiere permisos de administrador' });
  db.all('SELECT id, name, email, isAdmin, phone FROM users ORDER BY id', [], (err, rows) => {
    if (err) return res.status(500).json({ ok: false, message: 'Error de base de datos' });
    res.json({ ok: true, users: rows });
  });
});

// Products CRUD (admin only for create/update/delete, read allowed to all)
app.get('/api/products', (req, res) => {
  // support query filters: q (search), category, minPrice, maxPrice, inStock (1), page, perPage
  const q = req.query.q ? String(req.query.q).trim() : null;
  const category = req.query.category ? String(req.query.category).trim() : null;
  const minPrice = req.query.minPrice ? Number(req.query.minPrice) : null;
  const maxPrice = req.query.maxPrice ? Number(req.query.maxPrice) : null;
  const inStock = req.query.inStock === '1' ? 1 : 0;
  const page = Math.max(1, parseInt(req.query.page||'1',10));
  const perPage = Math.max(6, Math.min(100, parseInt(req.query.perPage||'12',10)));

  const where = [];
  const params = [];
  if (q) { where.push('(name LIKE ? OR description LIKE ?)'); params.push('%'+q+'%', '%'+q+'%'); }
  if (category) { where.push('category = ?'); params.push(category); }
  if (minPrice !== null) { where.push('price >= ?'); params.push(minPrice); }
  if (maxPrice !== null) { where.push('price <= ?'); params.push(maxPrice); }
  if (inStock === 1) { where.push('stock > 0'); }

  const whereSql = where.length ? ('WHERE ' + where.join(' AND ')) : '';
  const offset = (page - 1) * perPage;
  const sql = `SELECT id, name, description, price, image, category, stock FROM products ${whereSql} ORDER BY id DESC LIMIT ? OFFSET ?`;
  params.push(perPage, offset);
  db.all(sql, params, (err, rows) => {
    if (err) return res.status(500).json({ ok: false, message: 'Error de base de datos' });
    // also return available categories for filters
    db.all('SELECT DISTINCT category FROM products WHERE category IS NOT NULL AND category <> ""', [], (e2, cats)=>{
      const categories = (cats || []).map(r=>r.category).filter(Boolean);
      res.json({ ok: true, products: rows, page, perPage, categories });
    });
  });
});

app.post('/api/products', (req, res) => {
  console.log('POST /api/products called, sessionUser=', req.session && req.session.user ? { id: req.session.user.id, isAdmin: req.session.user.isAdmin } : null, 'bodyKeys=', req.body ? Object.keys(req.body) : '<no body>');
  if (!req.session || !req.session.user || !req.session.user.isAdmin) return res.status(403).json({ ok: false, message: 'Requiere permisos de administrador' });
  const { name, description, price, image, category, stock } = req.body || {};
  if (!name) return res.json({ ok: false, message: 'Nombre requerido' });
  const p = Number(price) || 0;
  const s = parseInt(stock||0,10) || 0;
  db.run('INSERT INTO products (name, description, price, image, category, stock) VALUES (?,?,?,?,?,?)', [name, description||'', p, image||'', category||'', s], function(err) {
    if (err) {
      console.error('INSERT product error', err);
      return res.status(500).json({ ok: false, message: 'Error al crear producto', detail: err && err.message });
    }
    res.json({ ok: true, id: this.lastID });
  });
});

app.put('/api/products/:id', (req, res) => {
  if (!req.session || !req.session.user || !req.session.user.isAdmin) return res.status(403).json({ ok: false, message: 'Requiere permisos de administrador' });
  const id = parseInt(req.params.id, 10);
  const { name, description, price, image, category, stock } = req.body || {};
  const updates = []; const params = [];
  if (typeof name === 'string') { updates.push('name = ?'); params.push(name); }
  if (typeof description === 'string') { updates.push('description = ?'); params.push(description); }
  if (typeof price !== 'undefined') { updates.push('price = ?'); params.push(Number(price) || 0); }
  if (typeof image === 'string') { updates.push('image = ?'); params.push(image); }
  if (typeof category === 'string') { updates.push('category = ?'); params.push(category); }
  if (typeof stock !== 'undefined') { updates.push('stock = ?'); params.push(parseInt(stock||0,10)); }
  if (updates.length === 0) return res.json({ ok: false, message: 'Nada para actualizar' });
  params.push(id);
  const sql = `UPDATE products SET ${updates.join(', ')} WHERE id = ?`;
  db.run(sql, params, function(err) {
    if (err) return res.status(500).json({ ok: false, message: 'Error al actualizar producto' });
    res.json({ ok: true, changes: this.changes });
  });
});

app.delete('/api/products/:id', (req, res) => {
  if (!req.session || !req.session.user || !req.session.user.isAdmin) return res.status(403).json({ ok: false, message: 'Requiere permisos de administrador' });
  const id = parseInt(req.params.id, 10);
  db.run('DELETE FROM products WHERE id = ?', [id], function(err) {
    if (err) return res.status(500).json({ ok: false, message: 'Error al borrar producto' });
    res.json({ ok: true, changes: this.changes });
  });
});

// Image upload endpoint (optional; requires multer installed)
if(multer){
  const upload = multer({ dest: path.join(__dirname, 'uploads/') });
  app.post('/api/upload', upload.single('file'), (req, res) => {
    if(!req.file) return res.status(400).json({ ok:false, message: 'No file' });
    // return a relative path usable by the frontend
    const url = '/uploads/' + req.file.filename;
    res.json({ ok: true, url });
  });
} else {
  app.post('/api/upload', (req, res) => res.status(500).json({ ok:false, message: 'Multer not installed. Run npm install multer' }));
}

// Return current session user info
app.get('/api/me', (req, res) => {
  if (!req.session || !req.session.user) return res.json({ ok: false, user: null });
  const id = parseInt(req.session.user.id, 10);
  db.get('SELECT id, name, email, isAdmin, phone FROM users WHERE id = ?', [id], (err, row) => {
    if (err) return res.status(500).json({ ok: false, message: 'Error de base de datos' });
    if (!row) return res.json({ ok: false, user: null });
    row.isAdmin = !!row.isAdmin;
    res.json({ ok: true, user: row });
  });
});

// Edit user (admin only) - update name and/or password and isAdmin
app.put('/api/users/:id', (req, res) => {
  if (!req.session || !req.session.user) return res.status(401).json({ ok: false, message: 'No autorizado' });
  if (!req.session.user.isAdmin) return res.status(403).json({ ok: false, message: 'Requiere permisos de administrador' });
  const id = parseInt(req.params.id, 10);
  const { name, password, isAdmin, email, phone } = req.body;
  if (!id) return res.status(400).json({ ok: false, message: 'ID inválido' });

  const performUpdate = () => {
    const updates = [];
    const params = [];
    if (typeof name === 'string') { updates.push('name = ?'); params.push(name); }
    if (typeof email === 'string') { updates.push('email = ?'); params.push(email); }
    if (typeof phone === 'string') { updates.push('phone = ?'); params.push(phone); }
    if (typeof isAdmin !== 'undefined') { updates.push('isAdmin = ?'); params.push(isAdmin ? 1 : 0); }
    if (typeof password === 'string' && password.length > 0) {
      const hash = bcrypt.hashSync(password, 10);
      updates.push('passwordHash = ?');
      params.push(hash);
    }
    if (updates.length === 0) return res.json({ ok: false, message: 'Nada para actualizar' });
    params.push(id);
    const sql = `UPDATE users SET ${updates.join(', ')} WHERE id = ?`;
    db.run(sql, params, function(err) {
      if (err) return res.status(500).json({ ok: false, message: 'Error al actualizar usuario' });
      res.json({ ok: true, changes: this.changes });
    });
  };

  if (typeof email === 'string'){
    const emailTrim = String(email).trim();
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(emailTrim)) return res.json({ ok: false, message: 'Email inválido' });
    // check uniqueness (excluding current user)
    db.get('SELECT id FROM users WHERE email = ? AND id != ?', [emailTrim, id], (err, row) => {
      if (err) return res.status(500).json({ ok: false, message: 'Error de base de datos' });
      if (row) return res.json({ ok: false, message: 'El email ya está en uso' });
      // proceed with update
      req.body.email = emailTrim;
      performUpdate();
    });
  } else {
    performUpdate();
  }
});

// Update current user's own profile
app.put('/api/me', (req, res) => {
  console.log('PUT /api/me called, body=', req.body && Object.keys(req.body).length ? req.body : '<empty>');
  if (!req.session || !req.session.user) return res.status(401).json({ ok: false, message: 'No autorizado' });
  const id = parseInt(req.session.user.id, 10);
  const { name, email, password, phone } = req.body;

  const performUpdate = () => {
    const updates = [];
    const params = [];
    if (typeof name === 'string') { updates.push('name = ?'); params.push(name); }
    if (typeof email === 'string') { updates.push('email = ?'); params.push(email); }
    if (typeof phone === 'string') { updates.push('phone = ?'); params.push(phone); }
    if (typeof password === 'string' && password.length > 0) {
      const hash = bcrypt.hashSync(password, 10);
      updates.push('passwordHash = ?');
      params.push(hash);
    }
    if (updates.length === 0) return res.json({ ok: false, message: 'Nada para actualizar' });
    params.push(id);
    const sql = `UPDATE users SET ${updates.join(', ')} WHERE id = ?`;
    db.run(sql, params, function(err) {
      if (err) return res.status(500).json({ ok: false, message: 'Error al actualizar usuario' });
      // refresh session email/name/phone
      if (typeof email === 'string') req.session.user.email = email;
      if (typeof name === 'string') req.session.user.name = name;
      if (typeof phone === 'string') req.session.user.phone = phone;
      res.json({ ok: true, changes: this.changes });
    });
  };

  if (typeof email === 'string'){
    const emailTrim = String(email).trim();
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(emailTrim)) return res.json({ ok: false, message: 'Email inválido' });
    db.get('SELECT id FROM users WHERE email = ? AND id != ?', [emailTrim, id], (err, row) => {
      if (err) return res.status(500).json({ ok: false, message: 'Error de base de datos' });
      if (row) return res.json({ ok: false, message: 'El email ya está en uso' });
      req.body.email = emailTrim;
      performUpdate();
    });
  } else {
    performUpdate();
  }
});

// Purchases endpoints for current user: list and create
app.get('/api/me/purchases', (req, res) => {
  if (!req.session || !req.session.user) return res.status(401).json({ ok: false, message: 'No autorizado' });
  const id = parseInt(req.session.user.id, 10);
  db.all('SELECT id, created_at, description, total, items, delivered, delivered_at FROM purchases WHERE user_id = ? ORDER BY id DESC', [id], (err, rows) => {
    if (err) return res.status(500).json({ ok: false, message: 'Error de base de datos' });
    const purchases = (rows || []).map(r => ({ id: r.id, date: r.created_at, description: r.description, total: r.total, items: r.items ? JSON.parse(r.items) : [], delivered: !!r.delivered, delivered_at: r.delivered_at }));
    res.json({ ok: true, purchases });
  });
});

app.post('/api/me/purchases', (req, res) => {
  if (!req.session || !req.session.user) return res.status(401).json({ ok: false, message: 'No autorizado' });
  const id = parseInt(req.session.user.id, 10);
  const { items, total, description } = req.body || {};
  const itemsStr = JSON.stringify(items || []);
  const desc = description || 'Compra desde web';
  const tot = Number(total) || 0;
  db.run('INSERT INTO purchases (user_id, description, total, items) VALUES (?,?,?,?)', [id, desc, tot, itemsStr], function(err) {
    if (err) return res.status(500).json({ ok: false, message: 'Error al guardar la compra' });
    const purchaseId = this.lastID;
    // decrement stock for each item (if products exist)
    try{
      const it = Array.isArray(items) ? items : [];
      it.forEach(itm => {
        const pid = parseInt(itm.id, 10);
        const qty = parseInt(itm.qty || itm.quantity || itm.qty || 1, 10) || 1;
        if (!isNaN(pid)) {
          db.run('UPDATE products SET stock = CASE WHEN stock - ? >= 0 THEN stock - ? ELSE 0 END WHERE id = ?', [qty, qty, pid], function(upErr){ if(upErr) console.warn('Stock update error', upErr); });
        }
      });
    }catch(e){ console.warn('Error decrementing stock', e); }
    res.json({ ok: true, id: purchaseId, created_at: (new Date()).toISOString() });
  });
});

// Admin: list all purchases with user info
app.get('/api/purchases', (req, res) => {
  if (!req.session || !req.session.user) return res.status(401).json({ ok: false, message: 'No autorizado' });
  if (!req.session.user.isAdmin) return res.status(403).json({ ok: false, message: 'Requiere permisos de administrador' });
  const sql = `SELECT p.id, p.user_id, p.created_at, p.description, p.total, p.items, p.delivered, p.delivered_at, u.name AS user_name, u.email AS user_email, u.phone AS user_phone
    FROM purchases p LEFT JOIN users u ON u.id = p.user_id WHERE (p.hidden IS NULL OR p.hidden = 0) ORDER BY p.id DESC`;
  db.all(sql, [], (err, rows) => {
    if (err) return res.status(500).json({ ok: false, message: 'Error de base de datos' });
    const purchases = (rows || []).map(r => ({ id: r.id, user_id: r.user_id, date: r.created_at, description: r.description, total: r.total, items: r.items ? JSON.parse(r.items) : [], delivered: !!r.delivered, delivered_at: r.delivered_at, user: { name: r.user_name, email: r.user_email, phone: r.user_phone } }));
    res.json({ ok: true, purchases });
  });
});

// Admin: mark purchase delivered (or not)
app.post('/api/purchases/:id/delivered', (req, res) => {
  if (!req.session || !req.session.user) return res.status(401).json({ ok: false, message: 'No autorizado' });
  if (!req.session.user.isAdmin) return res.status(403).json({ ok: false, message: 'Requiere permisos de administrador' });
  const id = parseInt(req.params.id, 10);
  if (!id) return res.status(400).json({ ok: false, message: 'ID inválido' });
  const want = !!req.body.delivered;
  const now = want ? new Date().toISOString() : null;
  db.run('UPDATE purchases SET delivered = ?, delivered_at = ? WHERE id = ?', [want ? 1 : 0, now, id], function(err){
    if (err) return res.status(500).json({ ok: false, message: 'Error de base de datos' });
    res.json({ ok: true, id, delivered: want, delivered_at: now });
  });
});

// Admin: get single purchase by id with user info
app.get('/api/purchases/:id', (req, res) => {
  if (!req.session || !req.session.user) return res.status(401).json({ ok: false, message: 'No autorizado' });
  if (!req.session.user.isAdmin) return res.status(403).json({ ok: false, message: 'Requiere permisos de administrador' });
  const id = parseInt(req.params.id, 10);
  if (!id) return res.status(400).json({ ok: false, message: 'ID inválido' });
  const sql = `SELECT p.id, p.user_id, p.created_at, p.description, p.total, p.items, u.name AS user_name, u.email AS user_email, u.phone AS user_phone
    FROM purchases p LEFT JOIN users u ON u.id = p.user_id WHERE p.id = ? LIMIT 1`;
  db.get(sql, [id], (err, row) => {
    if (err) return res.status(500).json({ ok: false, message: 'Error de base de datos' });
    if (!row) return res.status(404).json({ ok: false, message: 'Pedido no encontrado' });
    const purchase = { id: row.id, user_id: row.user_id, date: row.created_at, description: row.description, total: row.total, items: row.items ? JSON.parse(row.items) : [], user: { name: row.user_name, email: row.user_email, phone: row.user_phone } };
    res.json({ ok: true, purchase });
  });
});

// Admin: delete a purchase
app.delete('/api/purchases/:id', (req, res) => {
  if (!req.session || !req.session.user) return res.status(401).json({ ok: false, message: 'No autorizado' });
  if (!req.session.user.isAdmin) return res.status(403).json({ ok: false, message: 'Requiere permisos de administrador' });
  const id = parseInt(req.params.id, 10);
  if (!id) return res.status(400).json({ ok: false, message: 'ID inválido' });
  // Soft-delete: mark as hidden so the user still sees their purchase history
  db.run('UPDATE purchases SET hidden = 1 WHERE id = ?', [id], function(err) {
    if (err) return res.status(500).json({ ok: false, message: 'Error de base de datos' });
    res.json({ ok: true, hidden: this.changes || 0 });
  });
});

// Stripe Checkout: create a checkout session
app.post('/api/create-checkout-session', async (req, res) => {
  if (!stripe) return res.status(500).json({ ok: false, message: 'Stripe no configurado' });
  if (!req.session || !req.session.user) return res.status(401).json({ ok: false, message: 'No autorizado' });
  try{
    const origin = req.headers.origin || (req.protocol + '://' + req.get('host')) || ('http://localhost:' + PORT);
    const { items, total, description } = req.body || {};
    const line_items = (items || []).map(i => ({
      price_data: {
        currency: 'eur',
        product_data: { name: String(i.name || 'Item') },
        unit_amount: Math.round((Number(i.price) || 0) * 100)
      },
      quantity: Number(i.qty || 1)
    }));
    const session = await stripe.checkout.sessions.create({
      payment_method_types: ['card'],
      mode: 'payment',
      line_items,
      success_url: origin + '/cart.html?checkout_success=1&session_id={CHECKOUT_SESSION_ID}',
      cancel_url: origin + '/cart.html?checkout_canceled=1',
      metadata: { user_id: String(req.session.user.id), items: JSON.stringify(items || []), description: description || '' }
    });
    res.json({ ok: true, url: session.url });
  }catch(err){ console.error('create-checkout-session error', err); res.status(500).json({ ok: false, message: 'Error creando sesión', detail: err && err.message }); }
});

// PayPal: helper to get base URL and token
function getPayPalBase() {
  // allow explicit override via PAYPAL_API_URL (e.g. https://api-m.sandbox.paypal.com)
  if (process.env.PAYPAL_API_URL) return process.env.PAYPAL_API_URL.replace(/\/$/, '');
  const mode = (process.env.PAYPAL_MODE || 'sandbox').toLowerCase();
  if (mode === 'live') return 'https://api-m.paypal.com';
  return 'https://api-m.sandbox.paypal.com';
}

async function getPayPalAccessToken() {
  const client = process.env.PAYPAL_CLIENT_ID || process.env.PAYPAL_CLIENT || '';
  // support both PAYPAL_SECRET and PAYPAL_CLIENT_SECRET names
  const secret = process.env.PAYPAL_SECRET || process.env.PAYPAL_CLIENT_SECRET || '';
  if (!client || !secret) throw new Error('PayPal credentials not configured');
  const tokenUrl = getPayPalBase() + '/v1/oauth2/token';
  const params = new URLSearchParams(); params.append('grant_type', 'client_credentials');
  const auth = Buffer.from(client + ':' + secret).toString('base64');
  const resp = await fetch(tokenUrl, { method: 'POST', headers: { Authorization: 'Basic ' + auth, 'Content-Type': 'application/x-www-form-urlencoded' }, body: params });
  if (!resp.ok) {
    const txt = await resp.text().catch(()=>null);
    throw new Error('PayPal token error: ' + (txt || resp.status));
  }
  const j = await resp.json();
  return j.access_token;
}

// Create PayPal order and return approval URL
app.post('/api/create-paypal-order', async (req, res) => {
  try{
    if (!req.session || !req.session.user) return res.status(401).json({ ok: false, message: 'No autorizado' });
    const { items, total, description } = req.body || {};
    const grand = Number(total) || ((items || []).reduce((s,i)=>s + ((Number(i.price)||0) * (Number(i.qty)||1)), 0));
    const accessToken = await getPayPalAccessToken();
    const base = getPayPalBase();
    const origin = req.headers.origin || (req.protocol + '://' + req.get('host')) || ('http://localhost:' + PORT);
    const orderBody = {
      intent: 'CAPTURE',
      purchase_units: [{ amount: { currency_code: 'EUR', value: grand.toFixed(2) }, description: description || 'Compra desde web' }],
      application_context: {
        return_url: origin + '/payment-complete.html',
        cancel_url: origin + '/cart.html?paypal_canceled=1'
      }
    };
    // attach a short custom_id containing items (truncated) so webhook can reconstruct items if possible
    try{
      const ci = JSON.stringify({ items: (items || []).map(i=>({ id: i.id, name: i.name, qty: i.qty || i.quantity || 1, price: Number(i.price)||0 })) });
      // keep short to avoid PayPal limits; truncate to 250 chars
      orderBody.purchase_units[0].custom_id = ci.length > 250 ? ci.slice(0,250) : ci;
    }catch(e){ /* ignore */ }
    const createResp = await fetch(base + '/v2/checkout/orders', { method: 'POST', headers: { Authorization: 'Bearer ' + accessToken, 'Content-Type': 'application/json' }, body: JSON.stringify(orderBody) });
    if (!createResp.ok) {
      const txt = await createResp.text().catch(()=>null);
      console.error('PayPal create order failed', createResp.status, txt);
      return res.status(500).json({ ok: false, message: 'Error creando orden PayPal', detail: txt });
    }
    const order = await createResp.json();
    const approve = (order.links || []).find(l => l.rel === 'approve');
    res.json({ ok: true, approveUrl: approve ? approve.href : null, orderId: order.id });
  }catch(err){ console.error('create-paypal-order error', err); res.status(500).json({ ok: false, message: 'Error creando orden PayPal', detail: err && err.message }); }
});

// Capture PayPal order after user approval
app.post('/api/capture-paypal-order', async (req, res) => {
  try{
    if (!req.session || !req.session.user) return res.status(401).json({ ok: false, message: 'No autorizado' });
    const { orderId } = req.body || {};
    if (!orderId) return res.status(400).json({ ok: false, message: 'orderId requerido' });
    const accessToken = await getPayPalAccessToken();
    const base = getPayPalBase();
    const capResp = await fetch(base + `/v2/checkout/orders/${encodeURIComponent(orderId)}/capture`, { method: 'POST', headers: { Authorization: 'Bearer ' + accessToken, 'Content-Type': 'application/json' } });
    if (!capResp.ok) {
      const txt = await capResp.text().catch(()=>null);
      console.error('PayPal capture failed', capResp.status, txt);
      return res.status(500).json({ ok: false, message: 'Error capturando orden PayPal', detail: txt });
    }
    const capture = await capResp.json();
    // get captured amount and items (best-effort)
    let total = 0;
    try{
      const pu = (capture.purchase_units || [])[0] || {};
      const payments = pu.payments || {};
      const captures = payments.captures || [];
      if (captures.length) {
        total = Number(captures[0].amount && captures[0].amount.value) || 0;
      }
    }catch(e){ }
    const description = 'Compra desde PayPal';
    // save purchase in DB
    db.run('INSERT INTO purchases (user_id, description, total, items) VALUES (?,?,?,?)', [req.session.user.id, description, total, JSON.stringify([])], function(err){
      if (err) { console.error('Error saving purchase after paypal capture', err); return res.status(500).json({ ok: false, message: 'Error guardando compra' }); }
      const purchaseId = this.lastID;
      res.json({ ok: true, id: purchaseId, paid: true, order: { id: orderId, total } });
    });
  }catch(err){ console.error('capture-paypal-order error', err); res.status(500).json({ ok: false, message: 'Error capturando orden PayPal', detail: err && err.message }); }
});

// PayPal webhook receiver: verifies signature then processes events
app.post('/api/paypal-webhook', async (req, res) => {
  try{
    const webhookId = process.env.PAYPAL_WEBHOOK_ID || req.headers['paypal-webhook-id'] || req.body && req.body.id;
    if (!webhookId) {
      console.warn('PayPal webhook request missing webhook id');
    }
    const transmissionId = req.headers['paypal-transmission-id'] || req.headers['paypal_transmission_id'];
    const transmissionTime = req.headers['paypal-transmission-time'] || req.headers['paypal_transmission_time'];
    const certUrl = req.headers['paypal-cert-url'] || req.headers['paypal_cert_url'];
    const authAlgo = req.headers['paypal-auth-algo'] || req.headers['paypal_auth_algo'];
    const transmissionSig = req.headers['paypal-transmission-sig'] || req.headers['paypal_transmission_sig'] || req.headers['paypal-transmission-signature'];

    // build verify payload
    const verifyBody = {
      transmission_id: transmissionId || '',
      transmission_time: transmissionTime || '',
      cert_url: certUrl || '',
      auth_algo: authAlgo || '',
      transmission_sig: transmissionSig || '',
      webhook_id: webhookId || '',
      webhook_event: req.body || {}
    };

    let verified = false;
    try{
      const token = await getPayPalAccessToken();
      const vres = await fetch(getPayPalBase() + '/v1/notifications/verify-webhook-signature', { method: 'POST', headers: { Authorization: 'Bearer ' + token, 'Content-Type': 'application/json' }, body: JSON.stringify(verifyBody) });
      const vj = await vres.json().catch(()=>null);
      if (vj && (vj.verification_status === 'SUCCESS' || vj.verification_status === 'SUCCESS')) verified = true;
      else {
        console.warn('PayPal webhook verification failed', vj);
      }
    }catch(e){ console.error('Error verifying PayPal webhook', e); }

    if (!verified) {
      // still respond 200 to avoid retries? PayPal retries on non-2xx; we return 200 only if we decide not to process
      console.warn('Unverified PayPal webhook received');
      return res.status(400).json({ ok: false, message: 'Webhook not verified' });
    }

    const event = req.body || {};
    const eventType = (event.event_type || event.eventType || '').toUpperCase();
    console.log('PayPal webhook event:', eventType);

    // Handle capture completed events to record purchases (idempotent by external_id)
    if (eventType === 'PAYMENT.CAPTURE.COMPLETED' || eventType === 'PAYMENT.CAPTURE.DENIED') {
      const resource = event.resource || {};
      const extId = resource.id || (resource.parent_payment) || null;
      const amount = (resource.amount && (resource.amount.value || resource.amount.total)) ? Number(resource.amount.value || resource.amount.total) : 0;
      const payerEmail = (resource.payer && (resource.payer.email_address || resource.payer.email)) || (event.resource && event.resource.payer && (event.resource.payer.email_address || event.resource.payer.email)) || null;
      // try to extract items from purchase_units custom_id if available
      let itemsParsed = [];
      try{
        const pus = event.resource && event.resource.purchase_units ? event.resource.purchase_units : (event.purchase_units || null);
        const pu0 = (Array.isArray(pus) && pus.length) ? pus[0] : null;
        const custom = pu0 && pu0.custom_id ? pu0.custom_id : null;
        if (custom) {
          try { const parsed = JSON.parse(custom); if (parsed && parsed.items) itemsParsed = parsed.items; }
          catch(e){ /* maybe truncated JSON, attempt a loose parse */
            try{ const maybe = custom.replace(/\"/g,'"'); const p2 = JSON.parse(maybe); if (p2 && p2.items) itemsParsed = p2.items; }catch(e2){}
          }
        }
      }catch(e){ /* ignore */ }
      // idempotency: check existing purchase by external_id
      if (extId) {
        db.get('SELECT id FROM purchases WHERE external_id = ? LIMIT 1', [extId], (err, row) => {
          if (err) { console.error('DB error checking external_id', err); return res.json({ ok: false }); }
          if (row) { console.log('Purchase already recorded for external_id', extId); return res.json({ ok: true }); }
          // try to find user by email
          const createPurchase = (userId) => {
            db.run('INSERT INTO purchases (user_id, description, total, items, external_id) VALUES (?,?,?,?,?)', [userId || null, 'Compra desde PayPal (webhook)', amount || 0, JSON.stringify(itemsParsed || []), extId], function(err2){
              if (err2) { console.error('Error saving purchase from webhook', err2); return res.status(500).json({ ok: false }); }
              console.log('Saved purchase from PayPal webhook id=', this.lastID, 'external_id=', extId);
              return res.json({ ok: true, id: this.lastID });
            });
          };
          if (payerEmail) {
            db.get('SELECT id FROM users WHERE email = ? LIMIT 1', [payerEmail], (e2, urow) => {
              if (e2) { console.error('DB error finding user by email', e2); createPurchase(null); }
              else if (urow && urow.id) createPurchase(urow.id);
              else createPurchase(null);
            });
          } else {
            createPurchase(null);
          }
        });
        return; // response will be sent from callback
      } else {
        console.warn('No external id in PayPal capture resource');
      }
    }

    // For other event types, simply acknowledge
    res.json({ ok: true });
  }catch(e){ console.error('PayPal webhook handler error', e); res.status(500).json({ ok: false, message: 'Server error' }); }
});

// After redirect from Stripe Checkout, verify session and create purchase record
app.post('/api/checkout-complete', async (req, res) => {
  if (!stripe) return res.status(500).json({ ok: false, message: 'Stripe no configurado' });
  if (!req.session || !req.session.user) return res.status(401).json({ ok: false, message: 'No autorizado' });
  const { sessionId } = req.body || {};
  if (!sessionId) return res.status(400).json({ ok: false, message: 'sessionId requerido' });
  try{
    const session = await stripe.checkout.sessions.retrieve(sessionId, { expand: ['line_items'] });
    if (!session) return res.status(404).json({ ok: false, message: 'Sesión no encontrada' });
    const paid = session.payment_status === 'paid';
    if (!paid) return res.json({ ok: false, paid: false, message: 'Pago no completado' });
    let items = [];
    try{ items = session.metadata && session.metadata.items ? JSON.parse(session.metadata.items) : []; }catch(e){ items = []; }
    const total = (session.amount_total || 0) / 100;
    const description = (session.metadata && session.metadata.description) ? session.metadata.description : 'Compra desde Stripe';
    db.run('INSERT INTO purchases (user_id, description, total, items) VALUES (?,?,?,?)', [req.session.user.id, description, total, JSON.stringify(items)], function(err){
      if (err) { console.error('Error saving purchase after stripe', err); return res.status(500).json({ ok: false, message: 'Error guardando compra' }); }
      res.json({ ok: true, id: this.lastID, paid: true });
    });
  }catch(err){ console.error('checkout-complete error', err); res.status(500).json({ ok: false, message: 'Error verificando sesión', detail: err && err.message }); }
});

// Contact form endpoint: store submission and optionally email site admin
app.post('/api/contact', async (req, res) => {
  try {
    const { name, email, phone, service, message } = req.body || {};
    if (!name || !email) return res.json({ ok: false, message: 'Nombre y email requeridos' });
    const emailTrim = String(email).trim();
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(emailTrim)) return res.json({ ok: false, message: 'Email inválido' });

    // Optional reCAPTCHA verification when configured
    const recaptchaSecret = process.env.RECAPTCHA_SECRET;
    if (recaptchaSecret) {
      const recResp = req.body.recaptcha || req.body['g-recaptcha-response'] || req.body.gRecaptcha || '';
      if (!recResp) return res.json({ ok: false, message: 'Captcha requerido' });
      try {
        const params = new URLSearchParams();
        params.append('secret', recaptchaSecret);
        params.append('response', String(recResp));
        params.append('remoteip', req.ip || '');
        const v = await fetch('https://www.google.com/recaptcha/api/siteverify', { method: 'POST', body: params });
        const j = await v.json();
        if (!j || !j.success) {
          console.warn('reCAPTCHA failed', j);
          return res.json({ ok: false, message: 'Captcha inválido' });
        }
      } catch (e) { console.error('reCAPTCHA verify error', e); return res.status(500).json({ ok: false, message: 'Error verificando captcha' }); }
    }

    const svc = service || '';
    const msg = message || '';
    db.run('INSERT INTO contacts (name,email,phone,service,message) VALUES (?,?,?,?,?)', [name, emailTrim, phone||'', svc, msg], function(err){
      if (err) {
        console.error('Error inserting contact', err);
        return res.status(500).json({ ok: false, message: 'Error guardando la solicitud' });
      }
      const contactId = this.lastID;
      // attempt to notify via SMTP if configured
      const notifyTo = process.env.CONTACT_TO || process.env.FROM_EMAIL;
      if (notifyTo && process.env.SMTP_HOST) {
        try{
          const transporter = nodemailer.createTransport({
            host: process.env.SMTP_HOST,
            port: Number(process.env.SMTP_PORT||587),
            secure: process.env.SMTP_SECURE === '1' || process.env.SMTP_SECURE === 'true',
            auth: process.env.SMTP_USER ? { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS } : undefined,
            tls: { rejectUnauthorized: process.env.SMTP_REJECT_UNAUTHORIZED !== 'false' }
          });
          const from = process.env.FROM_EMAIL || ('no-reply@' + (req.hostname || 'localhost'));
          const bodyText = `Nuevo contacto:\nNombre: ${name}\nEmail: ${emailTrim}\nTeléfono: ${phone||''}\nServicio: ${svc}\n\nMensaje:\n${msg}`;
          transporter.sendMail({ from, to: notifyTo, subject: 'Nuevo contacto desde web', text: bodyText }, (mailErr) => {
            if (mailErr) console.error('Contact notify mail error', mailErr);
          });
        }catch(e){ console.error('Contact notify error', e); }
      } else {
        // in development, log contact details
        if ((process.env.SHOW_CONTACT_LOG === '1') || (process.env.NODE_ENV !== 'production')) {
          console.log('Contact received:', { id: contactId, name, email: emailTrim, phone, service: svc, message: msg });
        }
      }
      res.json({ ok: true, id: contactId });
    });
  } catch (e) {
    console.error('Contact handler error', e);
    res.status(500).json({ ok: false, message: 'Error en servidor' });
  }
});

// Admin stats: total sales
app.get('/api/stats', (req, res) => {
  if (!req.session || !req.session.user) return res.status(401).json({ ok: false, message: 'No autorizado' });
  if (!req.session.user.isAdmin) return res.status(403).json({ ok: false, message: 'Requiere permisos de administrador' });
  db.get('SELECT COALESCE(SUM(total),0) AS totalSales, COUNT(*) AS purchasesCount FROM purchases WHERE (hidden IS NULL OR hidden = 0)', [], (err, row) => {
    if (err) return res.status(500).json({ ok: false, message: 'Error de base de datos' });
    res.json({ ok: true, totalSales: row.totalSales || 0, purchasesCount: row.purchasesCount || 0 });
  });
});

// Admin stats: delivered sales (sum and count)
app.get('/api/stats/delivered', (req, res) => {
  if (!req.session || !req.session.user) return res.status(401).json({ ok: false, message: 'No autorizado' });
  if (!req.session.user.isAdmin) return res.status(403).json({ ok: false, message: 'Requiere permisos de administrador' });
  db.get('SELECT COALESCE(SUM(total),0) AS deliveredSales, COUNT(*) AS deliveredCount FROM purchases WHERE delivered = 1 AND (hidden IS NULL OR hidden = 0)', [], (err, row) => {
    if (err) return res.status(500).json({ ok: false, message: 'Error de base de datos' });
    res.json({ ok: true, deliveredSales: row.deliveredSales || 0, deliveredCount: row.deliveredCount || 0 });
  });
});

// Admin: reset delivered sales (mark all purchases as not delivered)
app.post('/api/stats/delivered/reset', (req, res) => {
  if (!req.session || !req.session.user) return res.status(401).json({ ok: false, message: 'No autorizado' });
  if (!req.session.user.isAdmin) return res.status(403).json({ ok: false, message: 'Requiere permisos de administrador' });
  db.run('UPDATE purchases SET delivered = 0, delivered_at = NULL WHERE delivered = 1', [], function(err){
    if (err) return res.status(500).json({ ok: false, message: 'Error de base de datos' });
    res.json({ ok: true, reset: this.changes || 0 });
  });
});

// Admin stats: pending orders count
app.get('/api/stats/pending', (req, res) => {
  if (!req.session || !req.session.user) return res.status(401).json({ ok: false, message: 'No autorizado' });
  if (!req.session.user.isAdmin) return res.status(403).json({ ok: false, message: 'Requiere permisos de administrador' });
  db.get('SELECT COUNT(*) AS pendingCount FROM purchases WHERE delivered = 0 AND (hidden IS NULL OR hidden = 0)', [], (err, row) => {
    if (err) return res.status(500).json({ ok: false, message: 'Error de base de datos' });
    res.json({ ok: true, pendingCount: row.pendingCount || 0 });
  });
});

// Admin: reset total sales (delete purchases)
app.post('/api/stats/reset', (req, res) => {
  if (!req.session || !req.session.user) return res.status(401).json({ ok: false, message: 'No autorizado' });
  if (!req.session.user.isAdmin) return res.status(403).json({ ok: false, message: 'Requiere permisos de administrador' });
  // Soft-reset: mark all purchases as hidden so user history remains intact
  db.run('UPDATE purchases SET hidden = 1', [], function(err) {
    if (err) return res.status(500).json({ ok: false, message: 'Error de base de datos' });
    res.json({ ok: true, hidden: this.changes || 0 });
  });
});

app.get('/logout', (req, res) => {
  req.session.destroy(() => res.redirect('/'));
});

// Public config endpoint for frontend (e.g. reCAPTCHA site key)
app.get('/api/config', (req, res) => {
  res.json({ ok: true, recaptchaSiteKey: process.env.RECAPTCHA_SITE_KEY || null });
});

// generic error handler to return JSON
app.use((err, req, res, next) => {
  console.error('Unhandled error', err);
  if (req.path && req.path.startsWith('/api')) return res.status(500).json({ ok: false, message: 'Server error' });
  next(err);
});

// ensure API routes return JSON 404 instead of HTML (placed after API routes)
app.use('/api', (req, res, next) => {
  res.status(404).json({ ok: false, message: 'API endpoint not found' });
});

async function initDb() {
  try {
    await pool.query(`
      CREATE TABLE IF NOT EXISTS users (
        id SERIAL PRIMARY KEY,
        email VARCHAR(255) UNIQUE NOT NULL,
        password VARCHAR(255) NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);
    console.log("¡Tablas creadas o verificadas exitosamente!");
  } catch (err) {
    console.error("Error al crear las tablas:", err);
  }
}
initDb();
function startServer(port){
  const server = app.listen(port)
    .on('listening', () => console.log(`Server listening on http://localhost:${port}`))
    .on('error', (err) => {
      if (err && err.code === 'EADDRINUSE'){
        console.warn(`Port ${port} in use, trying ${port + 1}...`);
        setTimeout(() => startServer(port + 1), 200);
      } else {
        console.error('Server error:', err);
        process.exit(1);
      }
    });
  return server;
}

startServer(Number(process.env.PORT) || PORT);
