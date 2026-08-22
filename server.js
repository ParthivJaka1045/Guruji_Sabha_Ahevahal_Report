const express = require("express");
const cors = require("cors");
const cookieParser = require("cookie-parser");
const Database = require("better-sqlite3");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const path = require("path");
const fs = require("fs");

const app = express();
const PORT = process.env.PORT || 3000;
const JWT_SECRET = process.env.JWT_SECRET || "smvs_secret_key_2026_super_secure";

app.use(cors());
app.use(express.json({ limit: "50mb" }));
app.use(express.urlencoded({ extended: true, limit: "50mb" }));
app.use(cookieParser());
app.use(express.static(path.join(__dirname, "public")));

const DB_PATH = process.env.DB_PATH || path.join(__dirname, "smvs.sqlite");
const dbDir = path.dirname(DB_PATH);
if (!fs.existsSync(dbDir)) {
  fs.mkdirSync(dbDir, { recursive: true });
}
const db = new Database(DB_PATH);
db.pragma("journal_mode = DELETE");
db.pragma("foreign_keys = ON");

// Helper: JWT Auth
function authenticate(req, res, next) {
  const authHeader = req.headers.authorization || "";
  const token = req.cookies?.auth_token || (authHeader.startsWith("Bearer ") ? authHeader.slice(7).trim() : authHeader) || req.query.token;
  if (!token) return res.status(401).json({ ok: false, error: "Authentication required" });

  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    req.user = decoded;
    next();
  } catch (err) {
    return res.status(401).json({ ok: false, error: "Invalid or expired token" });
  }
}

function requireAdmin(req, res, next) {
  authenticate(req, res, () => {
    if (req.user?.role !== "admin") {
      return res.status(403).json({ ok: false, error: "Admin permission required" });
    }
    next();
  });
}

function logAudit(action, entityType, entityId, details, user, ip) {
  try {
    db.prepare(`
      INSERT INTO audit_logs (user_id, username, action, entity_type, entity_id, details_json, ip_address, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      String(user?.userId || "system"),
      user?.username || "system",
      action,
      entityType,
      entityId ? String(entityId) : "",
      JSON.stringify(details || {}),
      ip || "",
      new Date().toISOString()
    );
  } catch (e) {
    console.error("Audit log error:", e);
  }
}

// ================= API ROUTES =================

// --- 1. AUTH ROUTES ---
app.post("/api/auth/login", (req, res) => {
  const emailOrUsername = req.body.emailOrUsername || req.body.email || req.body.username;
  const { password } = req.body;
  if (!emailOrUsername || !password) {
    return res.status(400).json({ ok: false, error: "Email/Username and password required" });
  }

  const cleanInput = String(emailOrUsername).toLowerCase().trim();
  const user = db.prepare(`
    SELECT * FROM users WHERE (lower(email) = ? OR lower(username) = ?) AND is_deleted = 0
  `).get(cleanInput, cleanInput);

  if (!user || !user.is_active) {
    return res.status(401).json({ ok: false, error: "Invalid username or password" });
  }

  const isValid = bcrypt.compareSync(password, user.password_hash);
  if (!isValid) {
    return res.status(401).json({ ok: false, error: "Invalid username or password" });
  }

  const token = jwt.sign(
    { userId: user.id, username: user.username, email: user.email, role: user.role, fullName: user.full_name },
    JWT_SECRET,
    { expiresIn: "7d" }
  );

  res.cookie("auth_token", token, {
    httpOnly: true,
    maxAge: 7 * 24 * 60 * 60 * 1000,
    path: "/",
  });

  logAudit("LOGIN", "users", user.id, { username: user.username }, { userId: user.id, username: user.username }, req.ip);

  res.json({
    ok: true,
    token,
    user: { id: user.id, username: user.username, email: user.email, role: user.role, fullName: user.full_name }
  });
});

app.get("/api/auth/me", authenticate, (req, res) => {
  const user = db.prepare(`
    SELECT id, username, email, full_name as fullName, role, is_active as isActive FROM users WHERE id = ? AND is_deleted = 0
  `).get(req.user.userId);

  if (!user) return res.status(404).json({ ok: false, error: "User not found" });
  res.json({ ok: true, user });
});

app.post("/api/auth/logout", (req, res) => {
  res.clearCookie("auth_token");
  res.json({ ok: true, message: "Logged out" });
});

// --- 2. LOCATIONS (Country -> Zone -> Center) ---
app.get("/api/locations/tree", (req, res) => {
  try {
    const countries = db.prepare("SELECT * FROM countries WHERE is_deleted = 0 AND is_active = 1 ORDER BY display_order ASC, name ASC").all();
    const zones = db.prepare("SELECT * FROM zones WHERE is_deleted = 0 AND is_active = 1 ORDER BY display_order ASC, name ASC").all();
    const centers = db.prepare("SELECT * FROM centers WHERE is_deleted = 0 AND is_active = 1 ORDER BY display_order ASC, name ASC").all();

    const tree = countries.map(c => {
      const cZones = zones.filter(z => z.country_id === c.id).map(z => {
        const zCenters = centers.filter(cnt => cnt.zone_id === z.id).map(cnt => ({
          id: cnt.id,
          name: cnt.name
        }));
        return {
          id: z.id,
          name: z.name,
          centers: zCenters
        };
      });
      return {
        id: c.id,
        name: c.name,
        code: c.code,
        zones: cZones
      };
    });

    res.json({ ok: true, tree });
  } catch (err) {
    res.status(500).json({ ok: false, error: err.message });
  }
});

// --- 3. CATEGORIES ---
app.get("/api/categories", (req, res) => {
  try {
    const cats = db.prepare("SELECT * FROM categories WHERE is_deleted = 0 AND is_active = 1 ORDER BY display_order ASC, name ASC").all();
    const subCats = db.prepare("SELECT * FROM sub_categories WHERE is_deleted = 0 AND is_active = 1 ORDER BY display_order ASC, name ASC").all();

    const data = {};
    for (const c of cats) {
      const subs = subCats.filter(s => s.category_id === c.id).map(s => s.name);
      data[c.name] = subs;
    }
    res.json({ ok: true, categories: data });
  } catch (err) {
    res.status(500).json({ ok: false, error: err.message });
  }
});

// Helper to extract category & subcategory IDs
function resolveCategoryAndSubcategoryIds(categoriesObj) {
  const cats = db.prepare("SELECT id, name FROM categories").all();
  const subs = db.prepare("SELECT id, name, category_id FROM sub_categories").all();

  const catMap = new Map(cats.map(c => [c.name.toLowerCase().trim(), c.id]));
  const subMap = new Map(subs.map(s => [s.name.toLowerCase().trim(), s]));

  const catIdSet = new Set();
  const subIdSet = new Set();
  const pairs = [];

  for (const [catName, subNames] of Object.entries(categoriesObj || {})) {
    const cId = catMap.get(catName.toLowerCase().trim());
    if (cId) catIdSet.add(cId);

    if (Array.isArray(subNames)) {
      subNames.forEach(sName => {
        const matched = subMap.get(String(sName).toLowerCase().trim());
        if (matched) {
          catIdSet.add(matched.category_id);
          subIdSet.add(matched.id);
          pairs.push({ categoryId: matched.category_id, subCategoryId: matched.id });
        }
      });
    }
  }

  return {
    categoryIds: Array.from(catIdSet),
    subcategoryIds: Array.from(subIdSet),
    pairs
  };
}

// --- 4. REPORTS CRUD (PURE RELATIONAL) ---
app.get("/api/reports", authenticate, (req, res) => {
  try {
    const limit = parseInt(req.query.limit) || 1000;
    const reports = db.prepare(`
      SELECT 
        id, date, day, start_time as startTime, end_time as endTime, grade, occasion,
        country_id as countryId, country_name as countryName,
        zone_id as zoneId, zone_name as zone,
        center_id as centerId, center_name as center,
        location, divyavani, subject, html_body as htmlBody,
        created_at as createdAt, created_by as createdBy, created_by_name as createdByName,
        updated_at as updatedAt
      FROM reports
      WHERE is_deleted = 0
      ORDER BY date DESC, id DESC
      LIMIT ?
    `).all(limit);

    // Fetch all relational category mappings in one single join query
    const rels = db.prepare(`
      SELECT 
        rc.report_id,
        c.id as category_id,
        c.name as category_name,
        s.id as sub_category_id,
        s.name as sub_category_name
      FROM report_categories rc
      JOIN categories c ON rc.category_id = c.id
      JOIN sub_categories s ON rc.sub_category_id = s.id
      ORDER BY c.display_order ASC, s.display_order ASC
    `).all();

    const reportMap = new Map();
    reports.forEach(r => {
      r.categories = {};
      r.categoryIds = [];
      r.subcategoryIds = [];
      reportMap.set(r.id, r);
    });

    rels.forEach(rel => {
      const rep = reportMap.get(rel.report_id);
      if (rep) {
        if (!rep.categories[rel.category_name]) {
          rep.categories[rel.category_name] = [];
        }
        if (!rep.categories[rel.category_name].includes(rel.sub_category_name)) {
          rep.categories[rel.category_name].push(rel.sub_category_name);
        }
        if (!rep.categoryIds.includes(rel.category_id)) {
          rep.categoryIds.push(rel.category_id);
        }
        if (!rep.subcategoryIds.includes(rel.sub_category_id)) {
          rep.subcategoryIds.push(rel.sub_category_id);
        }
      }
    });

    res.json({ ok: true, reports });
  } catch (err) {
    res.status(500).json({ ok: false, error: err.message });
  }
});

app.post("/api/reports", authenticate, (req, res) => {
  try {
    const d = req.body;
    const now = new Date().toISOString();
    const { pairs } = resolveCategoryAndSubcategoryIds(d.categories);

    const stmt = db.prepare(`
      INSERT INTO reports (
        date, day, start_time, end_time, grade, occasion,
        country_id, country_name, zone_id, zone_name, center_id, center_name,
        location, divyavani, subject, html_body,
        created_at, created_by, created_by_name,
        updated_at, updated_by, updated_by_name,
        is_deleted
      ) VALUES (
        ?, ?, ?, ?, ?, ?,
        ?, ?, ?, ?, ?, ?,
        ?, ?, ?, ?,
        ?, ?, ?,
        ?, ?, ?,
        0
      )
    `);

    const result = stmt.run(
      d.date, d.day, d.startTime, d.endTime, d.grade || "A", d.occasion,
      d.countryId || 100001, d.countryName || "India",
      d.zoneId || null, d.zone || d.zoneName || "",
      d.centerId || null, d.center || d.centerName || "",
      d.location, d.divyavani || "વ્હાલા ગુરુજી", d.subject || "", d.htmlBody || "",
      now, String(req.user.userId), req.user.fullName || req.user.username,
      now, String(req.user.userId), req.user.fullName || req.user.username
    );

    const newId = Number(result.lastInsertRowid);

    // Save relational entries in junction table
    const junctionStmt = db.prepare(`
      INSERT OR IGNORE INTO report_categories (report_id, category_id, sub_category_id, created_at)
      VALUES (?, ?, ?, ?)
    `);
    for (const p of pairs) {
      junctionStmt.run(newId, p.categoryId, p.subCategoryId, now);
    }

    logAudit("CREATE_REPORT", "reports", newId, { date: d.date, location: d.location, occasion: d.occasion }, req.user, req.ip);

    res.json({ ok: true, id: newId });
  } catch (err) {
    res.status(500).json({ ok: false, error: err.message });
  }
});

app.put("/api/reports/:id", authenticate, (req, res) => {
  try {
    const id = parseInt(req.params.id);
    const d = req.body;
    const now = new Date().toISOString();
    const { pairs } = resolveCategoryAndSubcategoryIds(d.categories);

    db.prepare(`
      UPDATE reports SET
        date = ?, day = ?, start_time = ?, end_time = ?, grade = ?, occasion = ?,
        country_id = ?, country_name = ?, zone_id = ?, zone_name = ?, center_id = ?, center_name = ?,
        location = ?, divyavani = ?, subject = ?, html_body = ?,
        updated_at = ?, updated_by = ?, updated_by_name = ?
      WHERE id = ? AND is_deleted = 0
    `).run(
      d.date, d.day, d.startTime, d.endTime, d.grade || "A", d.occasion,
      d.countryId || 100001, d.countryName || "India",
      d.zoneId || null, d.zone || d.zoneName || "",
      d.centerId || null, d.center || d.centerName || "",
      d.location, d.divyavani || "વ્હાલા ગુરુજી", d.subject || "", d.htmlBody || "",
      now, String(req.user.userId), req.user.fullName || req.user.username,
      id
    );

    // Refresh junction table entries
    db.prepare("DELETE FROM report_categories WHERE report_id = ?").run(id);
    const junctionStmt = db.prepare(`
      INSERT OR IGNORE INTO report_categories (report_id, category_id, sub_category_id, created_at)
      VALUES (?, ?, ?, ?)
    `);
    for (const p of pairs) {
      junctionStmt.run(id, p.categoryId, p.subCategoryId, now);
    }

    logAudit("UPDATE_REPORT", "reports", id, { date: d.date, location: d.location }, req.user, req.ip);

    res.json({ ok: true, message: "Report updated" });
  } catch (err) {
    res.status(500).json({ ok: false, error: err.message });
  }
});

app.delete("/api/reports/:id", authenticate, (req, res) => {
  try {
    const id = parseInt(req.params.id);
    const now = new Date().toISOString();

    db.prepare(`
      UPDATE reports SET
        is_deleted = 1,
        deleted_at = ?,
        deleted_by = ?,
        deleted_by_name = ?
      WHERE id = ?
    `).run(now, String(req.user.userId), req.user.fullName || req.user.username, id);

    logAudit("SOFT_DELETE_REPORT", "reports", id, { id }, req.user, req.ip);
    fs.copyFileSync(DB_PATH, path.join(__dirname, "smvs_secure.sqlite"));

    res.json({ ok: true, message: "Report moved to trash" });
  } catch (err) {
    res.status(500).json({ ok: false, error: err.message });
  }
});

// --- 5. ADMIN CONTROL ROUTES ---
app.get("/api/admin/countries", requireAdmin, (req, res) => {
  const data = db.prepare(`
    SELECT c.*, (SELECT COUNT(*) FROM zones z WHERE z.country_id = c.id AND z.is_deleted = 0) as zone_count
    FROM countries c WHERE c.is_deleted = 0 ORDER BY c.display_order ASC, c.name ASC
  `).all();
  res.json({ ok: true, data });
});

app.post("/api/admin/countries", requireAdmin, (req, res) => {
  const { name, code } = req.body;
  const now = new Date().toISOString();
  const r = db.prepare(`
    INSERT INTO countries (name, code, created_at, updated_at) VALUES (?, ?, ?, ?)
  `).run(name.trim(), code?.trim() || "", now, now);
  logAudit("CREATE_COUNTRY", "countries", r.lastInsertRowid, { name, code }, req.user, req.ip);
  res.json({ ok: true, id: r.lastInsertRowid });
});

app.put("/api/admin/countries/:id", requireAdmin, (req, res) => {
  const id = parseInt(req.params.id);
  const { name, code } = req.body;
  const now = new Date().toISOString();
  db.prepare("UPDATE countries SET name = ?, code = ?, updated_at = ? WHERE id = ?").run(name.trim(), code?.trim() || "", now, id);
  logAudit("UPDATE_COUNTRY", "countries", id, { name, code }, req.user, req.ip);
  res.json({ ok: true });
});

app.delete("/api/admin/countries/:id", requireAdmin, (req, res) => {
  const id = parseInt(req.params.id);
  db.prepare("UPDATE countries SET is_deleted = 1, deleted_at = ? WHERE id = ?").run(new Date().toISOString(), id);
  logAudit("DELETE_COUNTRY", "countries", id, {}, req.user, req.ip);
  res.json({ ok: true });
});

app.get("/api/admin/zones", requireAdmin, (req, res) => {
  const data = db.prepare(`
    SELECT z.*, c.name as country_name, (SELECT COUNT(*) FROM centers cnt WHERE cnt.zone_id = z.id AND cnt.is_deleted = 0) as center_count
    FROM zones z JOIN countries c ON z.country_id = c.id
    WHERE z.is_deleted = 0 ORDER BY z.display_order ASC, z.name ASC
  `).all();
  res.json({ ok: true, data });
});

app.post("/api/admin/zones", requireAdmin, (req, res) => {
  const { countryId, name } = req.body;
  const now = new Date().toISOString();
  const r = db.prepare(`
    INSERT INTO zones (country_id, name, created_at, updated_at) VALUES (?, ?, ?, ?)
  `).run(countryId, name.trim(), now, now);
  logAudit("CREATE_ZONE", "zones", r.lastInsertRowid, { countryId, name }, req.user, req.ip);
  res.json({ ok: true, id: r.lastInsertRowid });
});

app.put("/api/admin/zones/:id", requireAdmin, (req, res) => {
  const id = parseInt(req.params.id);
  const { name, countryId } = req.body;
  const now = new Date().toISOString();
  if (countryId) {
    db.prepare("UPDATE zones SET name = ?, country_id = ?, updated_at = ? WHERE id = ?").run(name.trim(), countryId, now, id);
  } else {
    db.prepare("UPDATE zones SET name = ?, updated_at = ? WHERE id = ?").run(name.trim(), now, id);
  }
  logAudit("UPDATE_ZONE", "zones", id, { name, countryId }, req.user, req.ip);
  res.json({ ok: true });
});

app.delete("/api/admin/zones/:id", requireAdmin, (req, res) => {
  const id = parseInt(req.params.id);
  db.prepare("UPDATE zones SET is_deleted = 1, deleted_at = ? WHERE id = ?").run(new Date().toISOString(), id);
  logAudit("DELETE_ZONE", "zones", id, {}, req.user, req.ip);
  res.json({ ok: true });
});

app.get("/api/admin/centers", requireAdmin, (req, res) => {
  const data = db.prepare(`
    SELECT cnt.*, z.name as zone_name
    FROM centers cnt JOIN zones z ON cnt.zone_id = z.id
    WHERE cnt.is_deleted = 0 ORDER BY cnt.display_order ASC, cnt.name ASC
  `).all();
  res.json({ ok: true, data });
});

app.post("/api/admin/centers", requireAdmin, (req, res) => {
  const { zoneId, name } = req.body;
  const now = new Date().toISOString();
  const r = db.prepare(`
    INSERT INTO centers (zone_id, name, created_at, updated_at) VALUES (?, ?, ?, ?)
  `).run(zoneId, name.trim(), now, now);
  logAudit("CREATE_CENTER", "centers", r.lastInsertRowid, { zoneId, name }, req.user, req.ip);
  res.json({ ok: true, id: r.lastInsertRowid });
});

app.put("/api/admin/centers/:id", requireAdmin, (req, res) => {
  const id = parseInt(req.params.id);
  const { name, zoneId } = req.body;
  const now = new Date().toISOString();
  if (zoneId) {
    db.prepare("UPDATE centers SET name = ?, zone_id = ?, updated_at = ? WHERE id = ?").run(name.trim(), zoneId, now, id);
  } else {
    db.prepare("UPDATE centers SET name = ?, updated_at = ? WHERE id = ?").run(name.trim(), now, id);
  }
  logAudit("UPDATE_CENTER", "centers", id, { name, zoneId }, req.user, req.ip);
  res.json({ ok: true });
});

app.delete("/api/admin/centers/:id", requireAdmin, (req, res) => {
  const id = parseInt(req.params.id);
  db.prepare("UPDATE centers SET is_deleted = 1, deleted_at = ? WHERE id = ?").run(new Date().toISOString(), id);
  logAudit("DELETE_CENTER", "centers", id, {}, req.user, req.ip);
  res.json({ ok: true });
});

// Admin Categories CRUD
app.get("/api/admin/categories", requireAdmin, (req, res) => {
  const cats = db.prepare("SELECT * FROM categories WHERE is_deleted = 0 ORDER BY display_order ASC, name ASC").all();
  const subCats = db.prepare("SELECT * FROM sub_categories WHERE is_deleted = 0 ORDER BY display_order ASC, name ASC").all();
  res.json({ ok: true, categories: cats, subCategories: subCats });
});

app.post("/api/admin/categories", requireAdmin, (req, res) => {
  const { name } = req.body;
  const now = new Date().toISOString();
  const r = db.prepare("INSERT INTO categories (name, created_at, updated_at) VALUES (?, ?, ?)").run(name.trim(), now, now);
  logAudit("CREATE_CATEGORY", "categories", r.lastInsertRowid, { name }, req.user, req.ip);
  res.json({ ok: true, id: r.lastInsertRowid });
});

app.put("/api/admin/categories/:id", requireAdmin, (req, res) => {
  const id = parseInt(req.params.id);
  const { name } = req.body;
  const now = new Date().toISOString();
  db.prepare("UPDATE categories SET name = ?, updated_at = ? WHERE id = ?").run(name.trim(), now, id);
  logAudit("UPDATE_CATEGORY", "categories", id, { name }, req.user, req.ip);
  res.json({ ok: true });
});

app.post("/api/admin/subcategories", requireAdmin, (req, res) => {
  const { categoryId, name } = req.body;
  const now = new Date().toISOString();
  const r = db.prepare("INSERT INTO sub_categories (category_id, name, created_at, updated_at) VALUES (?, ?, ?, ?)").run(categoryId, name.trim(), now, now);
  logAudit("CREATE_SUBCATEGORY", "sub_categories", r.lastInsertRowid, { categoryId, name }, req.user, req.ip);
  res.json({ ok: true, id: r.lastInsertRowid });
});

app.put("/api/admin/subcategories/:id", requireAdmin, (req, res) => {
  const id = parseInt(req.params.id);
  const { name, categoryId } = req.body;
  const now = new Date().toISOString();
  if (categoryId) {
    db.prepare("UPDATE sub_categories SET name = ?, category_id = ?, updated_at = ? WHERE id = ?").run(name.trim(), categoryId, now, id);
  } else {
    db.prepare("UPDATE sub_categories SET name = ?, updated_at = ? WHERE id = ?").run(name.trim(), now, id);
  }
  logAudit("UPDATE_SUBCATEGORY", "sub_categories", id, { name, categoryId }, req.user, req.ip);
  res.json({ ok: true });
});

app.delete("/api/admin/categories/:id", requireAdmin, (req, res) => {
  const id = parseInt(req.params.id);
  db.prepare("UPDATE categories SET is_deleted = 1, deleted_at = ? WHERE id = ?").run(new Date().toISOString(), id);
  logAudit("DELETE_CATEGORY", "categories", id, {}, req.user, req.ip);
  res.json({ ok: true });
});

app.delete("/api/admin/subcategories/:id", requireAdmin, (req, res) => {
  const id = parseInt(req.params.id);
  db.prepare("UPDATE sub_categories SET is_deleted = 1, deleted_at = ? WHERE id = ?").run(new Date().toISOString(), id);
  logAudit("DELETE_SUBCATEGORY", "sub_categories", id, {}, req.user, req.ip);
  res.json({ ok: true });
});

// Admin Users CRUD
app.get("/api/admin/users", requireAdmin, (req, res) => {
  const users = db.prepare("SELECT id, username, email, full_name as fullName, role, is_active as isActive, created_at as createdAt FROM users WHERE is_deleted = 0 ORDER BY id ASC").all();
  res.json({ ok: true, users });
});

app.post("/api/admin/users", requireAdmin, (req, res) => {
  const { username, email, password, fullName, role } = req.body;
  const now = new Date().toISOString();
  const hash = bcrypt.hashSync(password, 10);
  const r = db.prepare(`
    INSERT INTO users (username, email, password_hash, full_name, role, is_active, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, 1, ?, ?)
  `).run(username.trim(), email.toLowerCase().trim(), hash, fullName?.trim() || "", role || "user", now, now);
  logAudit("CREATE_USER", "users", r.lastInsertRowid, { username, email, role }, req.user, req.ip);
  res.json({ ok: true, id: r.lastInsertRowid });
});

app.put("/api/admin/users/:id", requireAdmin, (req, res) => {
  const id = parseInt(req.params.id);
  const { username, email, fullName, role, isActive, password } = req.body;
  const now = new Date().toISOString();
  
  if (password && password.trim().length > 0) {
    const hash = bcrypt.hashSync(password.trim(), 10);
    db.prepare(`
      UPDATE users SET username = ?, email = ?, full_name = ?, role = ?, is_active = ?, password_hash = ?, updated_at = ?
      WHERE id = ?
    `).run(username.trim(), email.toLowerCase().trim(), fullName.trim(), role || "user", isActive ? 1 : 0, hash, now, id);
  } else {
    db.prepare(`
      UPDATE users SET username = ?, email = ?, full_name = ?, role = ?, is_active = ?, updated_at = ?
      WHERE id = ?
    `).run(username.trim(), email.toLowerCase().trim(), fullName.trim(), role || "user", isActive ? 1 : 0, now, id);
  }
  logAudit("UPDATE_USER", "users", id, { username, email, role, isActive }, req.user, req.ip);
  res.json({ ok: true });
});

app.delete("/api/admin/users/:id", requireAdmin, (req, res) => {
  const id = parseInt(req.params.id);
  db.prepare("UPDATE users SET is_deleted = 1, deleted_at = ? WHERE id = ?").run(new Date().toISOString(), id);
  logAudit("DELETE_USER", "users", id, {}, req.user, req.ip);
  res.json({ ok: true });
});

// Admin Trash & Restore
app.get("/api/admin/trash", requireAdmin, (req, res) => {
  const trash = db.prepare(`
    SELECT id, date, location, occasion, zone_name as zone, center_name as center, deleted_at as deletedAt, deleted_by_name as deletedByName
    FROM reports WHERE is_deleted = 1 ORDER BY deleted_at DESC
  `).all();
  res.json({ ok: true, trash });
});

app.post("/api/admin/trash/restore/:id", requireAdmin, (req, res) => {
  const id = parseInt(req.params.id);
  db.prepare("UPDATE reports SET is_deleted = 0, deleted_at = NULL, deleted_by = NULL WHERE id = ?").run(id);
  logAudit("RESTORE_REPORT", "reports", id, {}, req.user, req.ip);
  res.json({ ok: true });
});

app.delete("/api/admin/trash/purge/:id", requireAdmin, (req, res) => {
  const id = parseInt(req.params.id);
  db.prepare("DELETE FROM reports WHERE id = ? AND is_deleted = 1").run(id);
  logAudit("PERMANENT_PURGE_REPORT", "reports", id, {}, req.user, req.ip);
  res.json({ ok: true });
});

// Admin Audit Logs
app.get("/api/admin/audit-logs", requireAdmin, (req, res) => {
  const logs = db.prepare("SELECT * FROM audit_logs ORDER BY id DESC LIMIT 150").all();
  const parsed = logs.map(l => {
    let det = {};
    try { det = JSON.parse(l.details_json || "{}"); } catch {}
    return { ...l, details: det };
  });
  res.json({ ok: true, logs: parsed });
});

// Admin Download DB Backup
app.get("/api/admin/backup", requireAdmin, (req, res) => {
  const fileName = `smvs_secure_backup_${new Date().toISOString().slice(0, 10)}.sqlite`;
  res.download(DB_PATH, fileName);
});

// Fallback to index.html
app.use((req, res) => {
  res.sendFile(path.join(__dirname, "public", "index.html"));
});

app.listen(PORT, () => {
  console.log(`SMVS Report Server running on http://localhost:${PORT}`);
});
