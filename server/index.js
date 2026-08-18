const express = require('express');
const helmet = require('helmet');
const cors = require('cors');
const rateLimit = require('express-rate-limit');
const Database = require('better-sqlite3');
const { v4: uuidv4 } = require('uuid');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;
const DB_PATH = process.env.DB_PATH || path.join(__dirname, 'rifa.db');

app.use(helmet());
app.use(cors());
app.use(express.json({ limit: '1mb' }));

// Basic rate limiting
const limiter = rateLimit({ windowMs: 15 * 60 * 1000, max: 200 });
app.use(limiter);

// Serve static client if present
app.use(express.static(path.join(__dirname, '..')));

// Open DB
const db = new Database(DB_PATH);
// Init schema
db.prepare(`CREATE TABLE IF NOT EXISTS raffles (
  id TEXT PRIMARY KEY,
  name TEXT,
  config TEXT,
  numbers TEXT,
  winner TEXT,
  created_at TEXT
)`).run();

// Helpers
function getRaffles() {
  const rows = db.prepare('SELECT * FROM raffles ORDER BY created_at DESC').all();
  return rows.map(r => ({ ...r, config: JSON.parse(r.config || '{}'), numbers: JSON.parse(r.numbers || '[]'), winner: r.winner ? JSON.parse(r.winner) : null }));
}

function getRaffle(id) {
  const row = db.prepare('SELECT * FROM raffles WHERE id = ?').get(id);
  if (!row) return null;
  return { ...row, config: JSON.parse(row.config || '{}'), numbers: JSON.parse(row.numbers || '[]'), winner: row.winner ? JSON.parse(row.winner) : null };
}

// Routes
app.get('/api/health', (req, res) => res.json({ ok: true }));

app.get('/api/raffles', (req, res) => {
  res.json(getRaffles());
});

app.post('/api/raffles', (req, res) => {
  const { name, config, numbers } = req.body;
  const id = uuidv4();
  const created_at = new Date().toISOString();
  db.prepare('INSERT INTO raffles (id,name,config,numbers,created_at) VALUES (?,?,?,?,?)').run(id, name, JSON.stringify(config || {}), JSON.stringify(numbers || []), created_at);
  res.status(201).json({ id });
});

app.get('/api/raffles/:id', (req, res) => {
  const r = getRaffle(req.params.id);
  if (!r) return res.status(404).json({ error: 'Not found' });
  res.json(r);
});

app.put('/api/raffles/:id', (req, res) => {
  const id = req.params.id;
  const r = getRaffle(id);
  if (!r) return res.status(404).json({ error: 'Not found' });
  const { name, config, numbers, winner } = req.body;
  db.prepare('UPDATE raffles SET name=?, config=?, numbers=?, winner=? WHERE id=?').run(name || r.name, JSON.stringify(config || r.config || {}), JSON.stringify(numbers || r.numbers || []), winner ? JSON.stringify(winner) : null, id);
  res.json({ ok: true });
});

// Endpoint to run secure draw on server side
app.post('/api/raffles/:id/draw', (req, res) => {
  const id = req.params.id;
  const r = getRaffle(id);
  if (!r) return res.status(404).json({ error: 'Not found' });
  // choose only from paid numbers
  const paid = (r.numbers || []).filter(n => n.status === 'paid');
  if (!paid.length) return res.status(400).json({ error: 'No paid numbers' });
  // Use server-side crypto for randomness
  const crypto = require('crypto');
  const idx = crypto.randomInt(0, paid.length);
  const winner = paid[idx];
  const winnerRec = { number: winner.number, name: winner.name || '', phone: winner.phone || '', date: new Date().toISOString() };
  db.prepare('UPDATE raffles SET winner=? WHERE id=?').run(JSON.stringify(winnerRec), id);
  res.json({ winner: winnerRec });
});

// Simple restore health
app.use((req, res) => res.status(404).json({ error: 'Not found' }));

app.listen(PORT, () => console.log(`Rifa server listening on ${PORT}`));
