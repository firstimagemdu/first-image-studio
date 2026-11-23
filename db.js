const path = require("path");
const fs = require("fs");

const DATA_DIR = process.env.DATA_DIR || path.join(__dirname, "data");
if (!fs.existsSync(DATA_DIR)) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
}

const DB_PATH = path.join(DATA_DIR, "first_image_studio.sqlite");
const JSON_FALLBACK_PATH = path.join(DATA_DIR, "first_image_studio_db.json");

let sqliteDb = null;
let useSqlite = false;

try {
  const { DatabaseSync } = require("node:sqlite");
  sqliteDb = new DatabaseSync(DB_PATH);
  useSqlite = true;
} catch (err) {
  useSqlite = false;
}

const defaultUsers = [
  {
    username: "admin",
    password: "admin123",
    name: "Studio Admin",
    role: "admin",
    permissions: [
      "dashboard", "bookings", "flex_frames", "customers",
      "todos", "delivery", "attendance", "sms", "recently_deleted", "settings"
    ]
  },
  {
    username: "staff",
    password: "staff123",
    name: "Studio Staff",
    role: "staff",
    permissions: ["dashboard", "todos", "attendance"]
  }
];

function createDefaultState(usersList) {
  return {
    appearance: {
      themeId: "royal_gold",
      effect3D: "wireframe_cubes",
      cardTilt: true,
      customLogo: "",
      wallpaper: "",
      customBgColor: "",
      doorLeftPhoto: "",
      doorRightPhoto: ""
    },
    billShop: {
      phone: "9092119057",
      address: "Thiruparankunram, Madurai, Tamil Nadu",
      logo: ""
    },
    users: usersList,
    bookings: [],
    todos: [],
    rateFixer: [],
    flexFrameOrders: [],
    invoices: [],
    deliveries: [],
    attendance: [],
    deletedItems: []
  };
}

function loadJsonStore() {
  if (!fs.existsSync(JSON_FALLBACK_PATH)) {
    const initial = {
      recoveryPin: "1999",
      adminWhatsApp: "9092119057",
      webhookUrl: "",
      users: defaultUsers,
      otps: [],
      state: createDefaultState(defaultUsers),
      updatedAt: new Date().toISOString()
    };
    fs.writeFileSync(JSON_FALLBACK_PATH, JSON.stringify(initial, null, 2), "utf8");
    return initial;
  }
  return JSON.parse(fs.readFileSync(JSON_FALLBACK_PATH, "utf8"));
}

function saveJsonStore(storeObj) {
  fs.writeFileSync(JSON_FALLBACK_PATH, JSON.stringify(storeObj, null, 2), "utf8");
}

function safeJsonParse(str, fallback) {
  try {
    return JSON.parse(str);
  } catch (e) {
    return fallback;
  }
}

function initDatabase() {
  const nowIso = new Date().toISOString();
  if (useSqlite && sqliteDb) {
    sqliteDb.exec(`
      CREATE TABLE IF NOT EXISTS studio_settings (
        id INTEGER PRIMARY KEY CHECK (id = 1),
        recovery_pin TEXT NOT NULL DEFAULT '1999',
        admin_whatsapp TEXT NOT NULL DEFAULT '9092119057',
        webhook_url TEXT NOT NULL DEFAULT '',
        state_json TEXT NOT NULL,
        updated_at TEXT NOT NULL
      );

      CREATE TABLE IF NOT EXISTS users (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        username TEXT NOT NULL UNIQUE,
        password TEXT NOT NULL,
        name TEXT NOT NULL,
        role TEXT NOT NULL DEFAULT 'staff',
        permissions_json TEXT NOT NULL DEFAULT '[]',
        created_at TEXT NOT NULL
      );

      CREATE TABLE IF NOT EXISTS otp_verifications (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        username TEXT NOT NULL,
        whatsapp_number TEXT NOT NULL,
        otp_code TEXT NOT NULL,
        expires_at INTEGER NOT NULL,
        verified INTEGER NOT NULL DEFAULT 0,
        created_at TEXT NOT NULL
      );
    `);

    const countRow = sqliteDb.prepare("SELECT COUNT(*) AS cnt FROM users").get();
    if (!countRow || Number(countRow.cnt) === 0) {
      const ins = sqliteDb.prepare(`
        INSERT INTO users (username, password, name, role, permissions_json, created_at)
        VALUES (?, ?, ?, ?, ?, ?)
      `);
      for (const u of defaultUsers) {
        ins.run(u.username, u.password, u.name, u.role, JSON.stringify(u.permissions), nowIso);
      }
    }

    const sRow = sqliteDb.prepare("SELECT id FROM studio_settings WHERE id = 1").get();
    if (!sRow) {
      const initState = createDefaultState(getAllUsers());
      sqliteDb.prepare(`
        INSERT INTO studio_settings (id, recovery_pin, admin_whatsapp, webhook_url, state_json, updated_at)
        VALUES (1, '1999', '9092119057', '', ?, ?)
      `).run(JSON.stringify(initState), nowIso);
    }
  } else {
    loadJsonStore();
  }
}

function getAllUsers() {
  if (useSqlite && sqliteDb) {
    const rows = sqliteDb.prepare("SELECT username, password, name, role, permissions_json FROM users ORDER BY id ASC").all();
    return rows.map((r) => ({
      username: r.username,
      password: r.password,
      name: r.name,
      role: r.role,
      permissions: safeJsonParse(r.permissions_json, [])
    }));
  }
  const st = loadJsonStore();
  return Array.isArray(st.users) ? st.users : defaultUsers;
}

function getSettingsRow() {
  if (useSqlite && sqliteDb) {
    return sqliteDb.prepare("SELECT * FROM studio_settings WHERE id = 1").get();
  }
  const st = loadJsonStore();
  return {
    id: 1,
    recovery_pin: st.recoveryPin || "1999",
    admin_whatsapp: st.adminWhatsApp || "9092119057",
    webhook_url: st.webhookUrl || "",
    state_json: JSON.stringify(st.state || createDefaultState(st.users || defaultUsers)),
    updated_at: st.updatedAt || new Date().toISOString()
  };
}

function findUserForLogin(username, password) {
  if (useSqlite && sqliteDb) {
    const row = sqliteDb.prepare("SELECT * FROM users WHERE LOWER(username) = ? AND password = ?").get(username, password);
    if (!row) return null;
    return {
      username: row.username,
      name: row.name,
      role: row.role,
      permissions: safeJsonParse(row.permissions_json, [])
    };
  }
  const st = loadJsonStore();
  const u = (st.users || []).find((x) => String(x.username).toLowerCase() === username && x.password === password);
  if (!u) return null;
  return { username: u.username, name: u.name, role: u.role, permissions: u.permissions || [] };
}

function getAdminUser() {
  if (useSqlite && sqliteDb) {
    return sqliteDb.prepare("SELECT * FROM users WHERE role = 'admin' ORDER BY id ASC LIMIT 1").get();
  }
  const st = loadJsonStore();
  return (st.users || []).find((x) => x.role === "admin") || null;
}

function createOtpRecord({ username, whatsappNumber, otpCode, expiresAt, createdAt }) {
  if (useSqlite && sqliteDb) {
    sqliteDb.prepare(`
      INSERT INTO otp_verifications (username, whatsapp_number, otp_code, expires_at, verified, created_at)
      VALUES (?, ?, ?, ?, 0, ?)
    `).run(username, whatsappNumber, otpCode, expiresAt, createdAt);
    return;
  }
  const st = loadJsonStore();
  st.otps = st.otps || [];
  st.otps.push({ id: Date.now(), username, whatsapp_number: whatsappNumber, otp_code: otpCode, expires_at: expiresAt, verified: 0, created_at: createdAt });
  saveJsonStore(st);
}

function verifyAndResetAdminPassword({ adminUser, method, otpInput, pinInput, newPassword }) {
  const settings = getSettingsRow();
  if (method === "otp") {
    if (!otpInput) return { ok: false, status: 400, error: "6-digit OTP is required" };
    if (useSqlite && sqliteDb) {
      const latest = sqliteDb.prepare(`
        SELECT * FROM otp_verifications
        WHERE username = ? AND verified = 0
        ORDER BY id DESC LIMIT 1
      `).get(adminUser.username);
      if (!latest || latest.otp_code !== otpInput) return { ok: false, status: 400, error: "Invalid OTP" };
      if (Date.now() > Number(latest.expires_at)) return { ok: false, status: 400, error: "OTP has expired. Please request a new OTP" };
      sqliteDb.prepare("UPDATE otp_verifications SET verified = 1 WHERE id = ?").run(latest.id);
    } else {
      const st = loadJsonStore();
      const list = (st.otps || []).filter((o) => o.username === adminUser.username && o.verified === 0);
      const latest = list[list.length - 1];
      if (!latest || latest.otp_code !== otpInput) return { ok: false, status: 400, error: "Invalid OTP" };
      if (Date.now() > Number(latest.expires_at)) return { ok: false, status: 400, error: "OTP has expired. Please request a new OTP" };
      latest.verified = 1;
      saveJsonStore(st);
    }
  } else {
    const validPin = String(settings.recovery_pin || "1999").trim();
    if (!pinInput || pinInput !== validPin) {
      return { ok: false, status: 400, error: "Invalid Studio Security Recovery PIN" };
    }
  }

  const updatedIso = new Date().toISOString();
  if (useSqlite && sqliteDb) {
    sqliteDb.prepare("UPDATE users SET password = ? WHERE id = ?").run(newPassword, adminUser.id);
    const curState = safeJsonParse(settings.state_json, {});
    curState.users = getAllUsers();
    sqliteDb.prepare("UPDATE studio_settings SET state_json = ?, updated_at = ? WHERE id = 1")
      .run(JSON.stringify(curState), updatedIso);
  } else {
    const st = loadJsonStore();
    st.users = (st.users || []).map((u) => (u.role === "admin" ? Object.assign({}, u, { password: newPassword }) : u));
    st.state = st.state || {};
    st.state.users = st.users;
    st.updatedAt = updatedIso;
    saveJsonStore(st);
  }

  return { ok: true };
}

function saveStudioData({ incomingState, nextPin, nextWa, nextWebhook }) {
  const nowIso = new Date().toISOString();
  if (useSqlite && sqliteDb) {
    const curRow = getSettingsRow();
    if (Array.isArray(incomingState.users) && incomingState.users.length > 0) {
      const upsertUser = sqliteDb.prepare(`
        INSERT INTO users (username, password, name, role, permissions_json, created_at)
        VALUES (?, ?, ?, ?, ?, ?)
        ON CONFLICT(username) DO UPDATE SET
          password = excluded.password,
          name = excluded.name,
          role = excluded.role,
          permissions_json = excluded.permissions_json
      `);
      for (const u of incomingState.users) {
        if (!u || !u.username) continue;
        upsertUser.run(
          String(u.username).trim().toLowerCase(),
          String(u.password || ""),
          String(u.name || u.username),
          u.role === "admin" ? "admin" : "staff",
          JSON.stringify(Array.isArray(u.permissions) ? u.permissions : []),
          nowIso
        );
      }
    }
    const mergedState = Object.assign({}, safeJsonParse(curRow.state_json, {}), incomingState);
    mergedState.users = getAllUsers();
    mergedState.recoveryPin = nextPin;
    mergedState.adminWhatsApp = nextWa;
    mergedState.webhookUrl = nextWebhook;

    sqliteDb.prepare(`
      UPDATE studio_settings
      SET recovery_pin = ?, admin_whatsapp = ?, webhook_url = ?, state_json = ?, updated_at = ?
      WHERE id = 1
    `).run(nextPin, nextWa, nextWebhook, JSON.stringify(mergedState), nowIso);

    return { savedAt: nowIso, dbPath: DB_PATH, state: mergedState };
  }

  const st = loadJsonStore();
  if (Array.isArray(incomingState.users) && incomingState.users.length > 0) {
    st.users = incomingState.users;
  }
  st.recoveryPin = nextPin;
  st.adminWhatsApp = nextWa;
  st.webhookUrl = nextWebhook;
  st.state = Object.assign({}, st.state || {}, incomingState, {
    users: st.users,
    recoveryPin: nextPin,
    adminWhatsApp: nextWa,
    webhookUrl: nextWebhook
  });
  st.updatedAt = nowIso;
  saveJsonStore(st);
  return { savedAt: nowIso, dbPath: JSON_FALLBACK_PATH, state: st.state };
}

module.exports = {
  DB_PATH: useSqlite ? DB_PATH : JSON_FALLBACK_PATH,
  initDatabase,
  getAllUsers,
  getSettingsRow,
  findUserForLogin,
  getAdminUser,
  createOtpRecord,
  verifyAndResetAdminPassword,
  saveStudioData,
  safeJsonParse
};
