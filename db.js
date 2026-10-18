const path = require('path');
const fs = require('fs');
const bcrypt = require('bcryptjs');

const DATA_DIR = path.join(__dirname, 'data');
const DB_PATH = path.join(DATA_DIR, 'portfolio.db');

fs.mkdirSync(DATA_DIR, { recursive: true });

const Database = require('better-sqlite3');
const db = new Database(DB_PATH);

db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

db.exec(`
  CREATE TABLE IF NOT EXISTS projects (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    title TEXT NOT NULL,
    description TEXT DEFAULT '',
    category TEXT DEFAULT '',
    project_url TEXT DEFAULT '',
    project_date TEXT DEFAULT '',
    published INTEGER DEFAULT 0,
    sort_order INTEGER DEFAULT 0,
    created_at TEXT DEFAULT CURRENT_TIMESTAMP,
    updated_at TEXT DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS project_images (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    project_id INTEGER NOT NULL,
    filename TEXT NOT NULL,
    original_name TEXT DEFAULT '',
    sort_order INTEGER DEFAULT 0,
    created_at TEXT DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE
  );

  CREATE TABLE IF NOT EXISTS admin_users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    username TEXT UNIQUE NOT NULL,
    password_hash TEXT NOT NULL
  );
`);

function getAdminByUsername(username) {
  return db.prepare('SELECT * FROM admin_users WHERE username = ?').get(username);
}

function seedAdmin() {
  const username = process.env.ADMIN_USERNAME || 'admin';
  const password = process.env.ADMIN_PASSWORD || 'changeme123';
  const existing = getAdminByUsername(username);

  if (!existing) {
    const hash = bcrypt.hashSync(password, 12);
    db.prepare('INSERT INTO admin_users (username, password_hash) VALUES (?, ?)').run(username, hash);
    console.log(`Admin account created (username: ${username}). Change the password in .env before deploying.`);
  }
}

function seedProjects() {
  const count = db.prepare('SELECT COUNT(*) AS c FROM projects').get().c;
  if (count > 0) return;

  const projects = [
    {
      title: 'Personal Portfolio Website',
      description: 'A responsive developer portfolio built to showcase web development and design work.',
      category: 'Web Development',
      project_url: '',
      project_date: '2025',
      published: 1,
    },
    {
      title: 'DataVault',
      description: 'A concept web platform for buying and managing mobile data bundles quickly and reliably.',
      category: 'Web Development',
      project_url: '',
      project_date: '2025',
      published: 1,
    },
    {
      title: 'SERPENT — Arcade Game',
      description: 'A browser-based Snake-style arcade game with score tracking and increasing difficulty.',
      category: 'Game Development',
      project_url: '',
      project_date: '2024',
      published: 1,
    },
  ];

  const insert = db.prepare(`
    INSERT INTO projects (title, description, category, project_url, project_date, published, sort_order)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `);

  projects.forEach((p, i) => {
    insert.run(p.title, p.description, p.category, p.project_url, p.project_date, p.published, i + 1);
  });
}

seedAdmin();
seedProjects();

module.exports = db;
module.exports.getAdminByUsername = getAdminByUsername;
