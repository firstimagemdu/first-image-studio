const http = require("http");
const fs = require("fs");
const path = require("path");
const crypto = require("crypto");

const PORT = process.env.PORT || 3000;
const DEFAULT_PERSISTENT_DIR = fs.existsSync("/data")
    ? "/data/first-image-studio-erp"
    : (fs.existsSync("/opt/render/project/src/data")
        ? "/opt/render/project/src/data"
        : path.join(__dirname, "data"));

const DATA_DIR = process.env.DATA_DIR || DEFAULT_PERSISTENT_DIR;
const BACKUP_DIR = path.join(DATA_DIR, "backups");
const STATE_FILE = path.join(DATA_DIR, "studio_state.json");
const LATEST_BACKUP_FILE = path.join(DATA_DIR, "latest_auto_backup.json");
const PUBLIC_DIR = path.join(__dirname, "public");
const ROOT_HTML = path.join(__dirname, "First_Image_Studio_ERP_v70.html");
const MAX_BACKUPS = Number(process.env.MAX_BACKUPS || 30);

for (const dir of [DATA_DIR, BACKUP_DIR]) {
    if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
    }
}

const otpStore = new Map();

function readStateFromDisk() {
    try {
        if (fs.existsSync(STATE_FILE)) {
            const raw = fs.readFileSync(STATE_FILE, "utf8");
            return JSON.parse(raw);
        }
    } catch (err) {
        console.error("Error reading studio_state.json:", err);
    }
    return null;
}

function pruneOldBackups() {
    try {
        const files = fs.readdirSync(BACKUP_DIR)
            .filter(f => f.startsWith("studio_backup_") && f.endsWith(".json"))
            .sort();
        while (files.length > MAX_BACKUPS) {
            const oldest = files.shift();
            if (oldest) {
                fs.unlinkSync(path.join(BACKUP_DIR, oldest));
            }
        }
    } catch (err) {
        console.warn("Backup rotation warning:", err.message);
    }
}

function writeSnapshotBackup(stateObj, reason = "auto") {
    if (!stateObj) return null;
    const nowIso = new Date().toISOString();
    const safeStamp = nowIso.replace(/[:.]/g, "-");
    const snapshotPayload = {
        reason,
        savedAt: nowIso,
        dataPath: DATA_DIR,
        state: stateObj
    };
    const serialized = JSON.stringify(snapshotPayload, null, 2);
    fs.writeFileSync(LATEST_BACKUP_FILE, serialized, "utf8");
    const snapPath = path.join(BACKUP_DIR, `studio_backup_${safeStamp}.json`);
    fs.writeFileSync(snapPath, serialized, "utf8");
    pruneOldBackups();
    return snapPath;
}

function writeStateToDisk(stateObj, reason = "sync") {
    const payload = {
        dataPath: DATA_DIR,
        updatedAt: new Date().toISOString(),
        state: stateObj
    };
    fs.writeFileSync(STATE_FILE, JSON.stringify(payload, null, 2), "utf8");
    writeSnapshotBackup(stateObj, reason);
    return payload;
}

setInterval(() => {
    const current = readStateFromDisk();
    if (current && current.state) {
        writeSnapshotBackup(current.state, "scheduled-15m");
    }
}, 15 * 60 * 1000);

function sendJson(res, statusCode, obj) {
    res.writeHead(statusCode, {
        "Content-Type": "application/json; charset=utf-8",
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
        "Access-Control-Allow-Headers": "Content-Type"
    });
    res.end(JSON.stringify(obj));
}

function parseBody(req) {
    return new Promise((resolve, reject) => {
        let body = "";
        req.on("data", chunk => {
            body += chunk.toString("utf8");
            if (body.length > 25 * 1024 * 1024) {
                reject(new Error("Payload too large"));
            }
        });
        req.on("end", () => {
            try {
                resolve(body ? JSON.parse(body) : {});
            } catch (e) {
                reject(e);
            }
        });
        req.on("error", reject);
    });
}

const MIME_TYPES = {
    ".html": "text/html; charset=utf-8",
    ".js": "application/javascript; charset=utf-8",
    ".css": "text/css; charset=utf-8",
    ".json": "application/json; charset=utf-8",
    ".png": "image/png",
    ".jpg": "image/jpeg",
    ".jpeg": "image/jpeg",
    ".webp": "image/webp",
    ".svg": "image/svg+xml",
    ".ico": "image/x-icon"
};

function serveStaticFile(res, filePath) {
    if (!fs.existsSync(filePath) || fs.statSync(filePath).isDirectory()) {
        return false;
    }
    const ext = path.extname(filePath).toLowerCase();
    const contentType = MIME_TYPES[ext] || "application/octet-stream";
    res.writeHead(200, { "Content-Type": contentType });
    fs.createReadStream(filePath).pipe(res);
    return true;
}

const server = http.createServer(async (req, res) => {
    const reqUrl = new URL(req.url, `http://${req.headers.host || "localhost"}`);
    const pathname = reqUrl.pathname;

    if (req.method === "OPTIONS") {
        res.writeHead(204, {
            "Access-Control-Allow-Origin": "*",
            "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
            "Access-Control-Allow-Headers": "Content-Type"
        });
        return res.end();
    }

    if (pathname === "/api/health") {
        return sendJson(res, 200, {
            ok: true,
            status: "healthy",
            dataDir: DATA_DIR,
            backupDir: BACKUP_DIR,
            autoBackup: true
        });
    }

    if (pathname === "/api/studio-data") {
        if (req.method === "GET") {
            const diskPayload = readStateFromDisk();
            return sendJson(res, 200, diskPayload || { ok: true, state: null, dataPath: DATA_DIR });
        }
        if (req.method === "POST") {
            try {
                const body = await parseBody(req);
                const stateToSave = body && body.state ? body.state : body;
                const saved = writeStateToDisk(stateToSave, "api-write");
                return sendJson(res, 200, { ok: true, savedAt: saved.updatedAt, dataPath: DATA_DIR });
            } catch (err) {
                return sendJson(res, 400, { ok: false, error: err.message });
            }
        }
    }

    if (pathname === "/api/studio-backup") {
        if (req.method === "GET") {
            try {
                const files = fs.readdirSync(BACKUP_DIR)
                    .filter(f => f.startsWith("studio_backup_") && f.endsWith(".json"))
                    .sort()
                    .reverse();
                return sendJson(res, 200, { ok: true, dataDir: DATA_DIR, backupDir: BACKUP_DIR, backups: files });
            } catch (err) {
                return sendJson(res, 500, { ok: false, error: err.message });
            }
        }
        if (req.method === "POST") {
            try {
                const body = await parseBody(req);
                const stateToSave = body && body.state ? body.state : body;
                const reason = (body && body.reason) || "auto-client";
                const snapFile = writeSnapshotBackup(stateToSave, reason);
                return sendJson(res, 200, { ok: true, backupFile: snapFile, dataDir: DATA_DIR });
            } catch (err) {
                return sendJson(res, 400, { ok: false, error: err.message });
            }
        }
    }

    if (pathname === "/api/auth/admin/send-otp" && req.method === "POST") {
        try {
            const body = await parseBody(req);
            const wa = String(body.whatsappNumber || "919092119057").replace(/[^0-9]/g, "");
            const username = String(body.username || "admin").trim().toLowerCase() || "admin";
            const otp = String(crypto.randomInt(100000, 999999));
            const expiresAt = Date.now() + 5 * 60 * 1000;
            otpStore.set(username, { otp, expiresAt, whatsappNumber: wa });

            let deliveryMode = "local-dev";
            const webhookUrl = String(body.webhookUrl || process.env.OTP_WEBHOOK_URL || "").trim();
            if (webhookUrl) {
                try {
                    const whResp = await fetch(webhookUrl, {
                        method: "POST",
                        headers: { "Content-Type": "application/json" },
                        body: JSON.stringify({
                            to: wa,
                            otp,
                            message: `First Image Studio Admin Recovery OTP: ${otp}`
                        })
                    });
                    if (whResp.ok) {
                        deliveryMode = "webhook";
                    }
                } catch (whErr) {
                    console.warn("Webhook dispatch fallback:", whErr.message);
                }
            }

            return sendJson(res, 200, {
                ok: true,
                message: `OTP generated for +${wa}`,
                deliveryMode,
                devOtp: deliveryMode === "webhook" ? undefined : otp
            });
        } catch (err) {
            return sendJson(res, 400, { ok: false, error: err.message });
        }
    }

    if (pathname === "/api/auth/admin/recover-reset" && req.method === "POST") {
        try {
            const body = await parseBody(req);
            const username = String(body.username || "admin").trim().toLowerCase() || "admin";
            const otp = String(body.otp || "").trim();
            const entry = otpStore.get(username);
            if (!entry || Date.now() > entry.expiresAt || entry.otp !== otp) {
                return sendJson(res, 400, { ok: false, error: "Invalid or expired OTP" });
            }
            otpStore.delete(username);
            return sendJson(res, 200, { ok: true, verified: true });
        } catch (err) {
            return sendJson(res, 400, { ok: false, error: err.message });
        }
    }

    const safeRel = path.normalize(pathname).replace(/^(\.\.[/\\])+/, "");
    const pubCandidate = path.join(PUBLIC_DIR, safeRel === "/" ? "index.html" : safeRel);
    if (serveStaticFile(res, pubCandidate)) return;

    if (pathname === "/" || pathname === "/index.html") {
        if (serveStaticFile(res, ROOT_HTML)) return;
    }

    res.writeHead(404, { "Content-Type": "text/plain; charset=utf-8" });
    res.end("Not Found");
});

server.listen(PORT, "0.0.0.0", () => {
    console.log(`First Image Studio ERP Cloud Server running on port ${PORT} with DATA_DIR=${DATA_DIR}`);
});
