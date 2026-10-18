const path = require('path');
const fs = require('fs');
const crypto = require('crypto');
require('dotenv').config();

const express = require('express');
const helmet = require('helmet');
const cookieParser = require('cookie-parser');
const rateLimit = require('express-rate-limit');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const multer = require('multer');
const sharp = require('sharp');
const { v4: uuidv4 } = require('uuid');

const db = require('./db');

const app = express();
const PORT = process.env.PORT || 3000;
const JWT_SECRET = process.env.JWT_SECRET || crypto.randomBytes(32).toString('hex');
const MAX_UPLOAD_BYTES = parseInt(process.env.MAX_UPLOAD_BYTES || '10485760', 10);

const UPLOAD_DIR = path.join(__dirname, 'uploads', 'projects');
fs.mkdirSync(UPLOAD_DIR, { recursive: true });

const ALLOWED_MIME = new Set(['image/jpeg', 'image/png', 'image/webp', 'image/gif']);

app.use(helmet({
  contentSecurityPolicy: false,
  crossOriginEmbedderPolicy: false,
}));
app.use(express.json({ limit: '1mb' }));
app.use(cookieParser());

const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 20,
  message: { error: 'Too many login attempts. Please try again later.' },
});
const uploadLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 30,
  message: { error: 'Upload rate limit exceeded. Please wait a moment.' },
});

function signToken(payload) {
  return jwt.sign(payload, JWT_SECRET, { expiresIn: '8h' });
}

function requireAuth(req, res, next) {
  const token = req.cookies?.admin_token;
  if (!token) {
    return res.status(401).json({ error: 'Authentication required.' });
  }
  try {
    req.admin = jwt.verify(token, JWT_SECRET);
    next();
  } catch {
    res.clearCookie('admin_token', { httpOnly: true, sameSite: 'strict' });
    return res.status(401).json({ error: 'Session expired. Please log in again.' });
  }
}

function mapProject(row, images) {
  return {
    id: row.id,
    title: row.title,
    description: row.description,
    category: row.category,
    projectUrl: row.project_url,
    projectDate: row.project_date,
    published: !!row.published,
    sortOrder: row.sort_order,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    images: images.map(img => ({
      id: img.id,
      url: `/uploads/projects/${img.filename}`,
      sortOrder: img.sort_order,
    })),
  };
}

function getProjectImages(projectId) {
  return db.prepare(
    'SELECT * FROM project_images WHERE project_id = ? ORDER BY sort_order ASC, id ASC'
  ).all(projectId);
}

function getProjectById(id) {
  const row = db.prepare('SELECT * FROM projects WHERE id = ?').get(id);
  if (!row) return null;
  return mapProject(row, getProjectImages(id));
}

const storage = multer.memoryStorage();
const upload = multer({
  storage,
  limits: { fileSize: MAX_UPLOAD_BYTES, files: 10 },
  fileFilter(req, file, cb) {
    if (!ALLOWED_MIME.has(file.mimetype)) {
      return cb(new Error('Only JPEG, PNG, WebP, and GIF images are allowed.'));
    }
    cb(null, true);
  },
});

async function saveOptimizedImage(buffer, mimetype) {
  const id = uuidv4();
  const filename = `${id}.webp`;
  const filepath = path.join(UPLOAD_DIR, filename);

  let pipeline = sharp(buffer, { failOn: 'none' }).rotate();

  if (mimetype === 'image/gif') {
    const meta = await sharp(buffer, { animated: true }).metadata();
    if (meta.pages && meta.pages > 1) {
      await sharp(buffer, { animated: true })
        .resize({ width: 1600, height: 1600, fit: 'inside', withoutEnlargement: true })
        .webp({ quality: 80 })
        .toFile(filepath);
      return filename;
    }
  }

  await pipeline
    .resize({ width: 1600, height: 1600, fit: 'inside', withoutEnlargement: true })
    .webp({ quality: 82 })
    .toFile(filepath);

  return filename;
}

function deleteImageFile(filename) {
  if (!filename) return;
  const safe = path.basename(filename);
  const filepath = path.join(UPLOAD_DIR, safe);
  if (fs.existsSync(filepath)) {
    fs.unlinkSync(filepath);
  }
}

function handleStorageError(err, res) {
  if (err.code === 'ENOSPC') {
    return res.status(507).json({
      error: 'Storage is full. Remove old project images or increase disk space, then try again.',
    });
  }
  console.error(err);
  return res.status(500).json({ error: 'An unexpected server error occurred.' });
}

/* ---- Auth ---- */
app.post('/api/admin/login', authLimiter, (req, res) => {
  const { username, password } = req.body || {};
  if (!username || !password) {
    return res.status(400).json({ error: 'Username and password are required.' });
  }

  const admin = db.getAdminByUsername(username.trim());
  if (!admin || !bcrypt.compareSync(password, admin.password_hash)) {
    return res.status(401).json({ error: 'Invalid username or password.' });
  }

  const token = signToken({ id: admin.id, username: admin.username });
  res.cookie('admin_token', token, {
    httpOnly: true,
    sameSite: 'strict',
    secure: process.env.NODE_ENV === 'production',
    maxAge: 8 * 60 * 60 * 1000,
  });
  res.json({ ok: true, username: admin.username });
});

app.post('/api/admin/logout', (req, res) => {
  res.clearCookie('admin_token', { httpOnly: true, sameSite: 'strict' });
  res.json({ ok: true });
});

app.get('/api/admin/me', requireAuth, (req, res) => {
  res.json({ ok: true, username: req.admin.username });
});

/* ---- Public projects ---- */
app.get('/api/projects', (req, res) => {
  const rows = db.prepare(
    'SELECT * FROM projects WHERE published = 1 ORDER BY sort_order ASC, created_at DESC'
  ).all();
  const projects = rows.map(row => mapProject(row, getProjectImages(row.id)));
  res.json(projects);
});

/* ---- Admin projects ---- */
app.get('/api/admin/projects', requireAuth, (req, res) => {
  const rows = db.prepare(
    'SELECT * FROM projects ORDER BY sort_order ASC, created_at DESC'
  ).all();
  const projects = rows.map(row => mapProject(row, getProjectImages(row.id)));
  res.json(projects);
});

app.get('/api/admin/projects/:id', requireAuth, (req, res) => {
  const project = getProjectById(parseInt(req.params.id, 10));
  if (!project) return res.status(404).json({ error: 'Project not found.' });
  res.json(project);
});

app.post('/api/admin/projects', requireAuth, async (req, res) => {
  try {
    const { title, description, category, projectUrl, projectDate, published } = req.body || {};
    if (!title || !String(title).trim()) {
      return res.status(400).json({ error: 'Project title is required.' });
    }

    const maxOrder = db.prepare('SELECT COALESCE(MAX(sort_order), 0) AS m FROM projects').get();
    const result = db.prepare(`
      INSERT INTO projects (title, description, category, project_url, project_date, published, sort_order)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `).run(
      String(title).trim(),
      description ? String(description).trim() : '',
      category ? String(category).trim() : '',
      projectUrl ? String(projectUrl).trim() : '',
      projectDate ? String(projectDate).trim() : '',
      published ? 1 : 0,
      (maxOrder.m || 0) + 1
    );

    res.status(201).json(getProjectById(result.lastInsertRowid));
  } catch (err) {
    handleStorageError(err, res);
  }
});

app.put('/api/admin/projects/:id', requireAuth, (req, res) => {
  const id = parseInt(req.params.id, 10);
  const existing = db.prepare('SELECT * FROM projects WHERE id = ?').get(id);
  if (!existing) return res.status(404).json({ error: 'Project not found.' });

  const { title, description, category, projectUrl, projectDate, published, sortOrder } = req.body || {};
  if (title !== undefined && !String(title).trim()) {
    return res.status(400).json({ error: 'Project title cannot be empty.' });
  }

  db.prepare(`
    UPDATE projects SET
      title = COALESCE(?, title),
      description = COALESCE(?, description),
      category = COALESCE(?, category),
      project_url = COALESCE(?, project_url),
      project_date = COALESCE(?, project_date),
      published = COALESCE(?, published),
      sort_order = COALESCE(?, sort_order),
      updated_at = CURRENT_TIMESTAMP
    WHERE id = ?
  `).run(
    title !== undefined ? String(title).trim() : null,
    description !== undefined ? String(description).trim() : null,
    category !== undefined ? String(category).trim() : null,
    projectUrl !== undefined ? String(projectUrl).trim() : null,
    projectDate !== undefined ? String(projectDate).trim() : null,
    published !== undefined ? (published ? 1 : 0) : null,
    sortOrder !== undefined ? sortOrder : null,
    id
  );

  res.json(getProjectById(id));
});

app.delete('/api/admin/projects/:id', requireAuth, (req, res) => {
  const id = parseInt(req.params.id, 10);
  const existing = db.prepare('SELECT * FROM projects WHERE id = ?').get(id);
  if (!existing) return res.status(404).json({ error: 'Project not found.' });

  const images = getProjectImages(id);
  images.forEach(img => deleteImageFile(img.filename));
  db.prepare('DELETE FROM projects WHERE id = ?').run(id);
  res.json({ ok: true });
});

app.post('/api/admin/projects/:id/images', requireAuth, uploadLimiter, upload.array('images', 10), async (req, res) => {
  const id = parseInt(req.params.id, 10);
  const existing = db.prepare('SELECT * FROM projects WHERE id = ?').get(id);
  if (!existing) return res.status(404).json({ error: 'Project not found.' });

  if (!req.files || req.files.length === 0) {
    return res.status(400).json({ error: 'No image files provided.' });
  }

  try {
    const maxOrder = db.prepare(
      'SELECT COALESCE(MAX(sort_order), 0) AS m FROM project_images WHERE project_id = ?'
    ).get(id);

    let order = maxOrder.m || 0;
    const insert = db.prepare(`
      INSERT INTO project_images (project_id, filename, original_name, sort_order)
      VALUES (?, ?, ?, ?)
    `);

    for (const file of req.files) {
      const filename = await saveOptimizedImage(file.buffer, file.mimetype);
      order += 1;
      insert.run(id, filename, file.originalname, order);
    }

    db.prepare('UPDATE projects SET updated_at = CURRENT_TIMESTAMP WHERE id = ?').run(id);
    res.status(201).json(getProjectById(id));
  } catch (err) {
    if (err.message && err.message.includes('allowed')) {
      return res.status(400).json({ error: err.message });
    }
    handleStorageError(err, res);
  }
});

app.delete('/api/admin/projects/:projectId/images/:imageId', requireAuth, (req, res) => {
  const projectId = parseInt(req.params.projectId, 10);
  const imageId = parseInt(req.params.imageId, 10);
  const image = db.prepare(
    'SELECT * FROM project_images WHERE id = ? AND project_id = ?'
  ).get(imageId, projectId);

  if (!image) return res.status(404).json({ error: 'Image not found.' });

  deleteImageFile(image.filename);
  db.prepare('DELETE FROM project_images WHERE id = ?').run(imageId);
  db.prepare('UPDATE projects SET updated_at = CURRENT_TIMESTAMP WHERE id = ?').run(projectId);
  res.json(getProjectById(projectId));
});

app.put('/api/admin/projects/:projectId/images/:imageId/replace', requireAuth, uploadLimiter, upload.single('image'), async (req, res) => {
  const projectId = parseInt(req.params.projectId, 10);
  const imageId = parseInt(req.params.imageId, 10);
  const image = db.prepare(
    'SELECT * FROM project_images WHERE id = ? AND project_id = ?'
  ).get(imageId, projectId);

  if (!image) return res.status(404).json({ error: 'Image not found.' });
  if (!req.file) return res.status(400).json({ error: 'No image file provided.' });

  try {
    const newFilename = await saveOptimizedImage(req.file.buffer, req.file.mimetype);
    deleteImageFile(image.filename);
    db.prepare('UPDATE project_images SET filename = ?, original_name = ? WHERE id = ?').run(
      newFilename,
      req.file.originalname,
      imageId
    );
    db.prepare('UPDATE projects SET updated_at = CURRENT_TIMESTAMP WHERE id = ?').run(projectId);
    res.json(getProjectById(projectId));
  } catch (err) {
    if (err.message && err.message.includes('allowed')) {
      return res.status(400).json({ error: err.message });
    }
    handleStorageError(err, res);
  }
});

app.use('/uploads', express.static(path.join(__dirname, 'uploads'), {
  maxAge: process.env.NODE_ENV === 'production' ? '7d' : 0,
}));

app.use(express.static(path.join(__dirname, 'public'), {
  maxAge: process.env.NODE_ENV === 'production' ? '1h' : 0,
}));

const PAGE_MAPPING = {
  '/': 'index.html',
  '/index.html': 'index.html',
  '/about': 'about.html',
  '/about.html': 'about.html',
  '/skills': 'skills.html',
  '/skills.html': 'skills.html',
  '/projects': 'projects.html',
  '/projects.html': 'projects.html',
  '/services': 'services.html',
  '/services.html': 'services.html',
  '/contact': 'contact.html',
  '/contact.html': 'contact.html',
};

Object.entries(PAGE_MAPPING).forEach(([route, file]) => {
  app.get(route, (req, res) => {
    res.sendFile(path.join(__dirname, 'public', file));
  });
});

app.get('/robots.txt', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'robots.txt'));
});

app.get('/sitemap.xml', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'sitemap.xml'));
});

app.get('/admin', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'admin.html'));
});

app.use((err, req, res, next) => {
  if (err instanceof multer.MulterError) {
    if (err.code === 'LIMIT_FILE_SIZE') {
      return res.status(413).json({
        error: `File too large. Maximum size is ${Math.round(MAX_UPLOAD_BYTES / 1048576)}MB per image.`,
      });
    }
    return res.status(400).json({ error: err.message });
  }
  if (err.message && err.message.includes('allowed')) {
    return res.status(400).json({ error: err.message });
  }
  console.error(err);
  res.status(500).json({ error: 'An unexpected server error occurred.' });
});

app.listen(PORT, () => {
  console.log(`Portfolio server running at http://localhost:${PORT}`);
  console.log(`Admin panel: http://localhost:${PORT}/admin`);
});
