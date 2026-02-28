import express from "express";
import { createServer as createViteServer } from "vite";
import path from "path";
import { fileURLToPath } from "url";
import Database from "better-sqlite3";
import cookieParser from "cookie-parser";
import { OAuth2Client } from "google-auth-library";
import dotenv from "dotenv";

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const db = new Database("minemods.db");

// Initialize Database
db.exec(`
  CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    google_id TEXT UNIQUE,
    email TEXT UNIQUE,
    name TEXT,
    picture TEXT,
    is_admin INTEGER DEFAULT 0
  );

  CREATE TABLE IF NOT EXISTS mods (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    title TEXT NOT NULL,
    description TEXT,
    icon_url TEXT,
    size TEXT,
    rating REAL DEFAULT 0,
    author_id INTEGER,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (author_id) REFERENCES users(id)
  );

  CREATE TABLE IF NOT EXISTS screenshots (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    mod_id INTEGER,
    url TEXT,
    FOREIGN KEY (mod_id) REFERENCES mods(id) ON DELETE CASCADE
  );

  CREATE TABLE IF NOT EXISTS ratings (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    mod_id INTEGER,
    user_id INTEGER,
    score INTEGER,
    UNIQUE(mod_id, user_id),
    FOREIGN KEY (mod_id) REFERENCES mods(id) ON DELETE CASCADE,
    FOREIGN KEY (user_id) REFERENCES users(id)
  );
`);

const app = express();
const PORT = 3000;

app.use(express.json());
app.use(cookieParser());

const googleClient = new OAuth2Client(
  process.env.GOOGLE_CLIENT_ID,
  process.env.GOOGLE_CLIENT_SECRET
);

// Middleware to check admin status
const isAdmin = (req: any, res: any, next: any) => {
  const adminSession = req.cookies.admin_session;
  if (adminSession === "ANIS2006") {
    return next();
  }
  res.status(403).json({ error: "Unauthorized. Admin password required." });
};

// --- API Routes ---

// Auth Routes
app.get("/api/auth/url", (req, res) => {
  const redirectUri = `${process.env.APP_URL}/auth/callback`;
  const url = `https://accounts.google.com/o/oauth2/v2/auth?` + 
    new URLSearchParams({
      client_id: process.env.GOOGLE_CLIENT_ID || "",
      redirect_uri: redirectUri,
      response_type: "code",
      scope: "openid email profile",
      access_type: "offline",
      prompt: "consent"
    }).toString();
  res.json({ url });
});

app.get("/auth/callback", async (req, res) => {
  const { code } = req.query;
  if (!code) return res.status(400).send("No code provided");

  try {
    const redirectUri = `${process.env.APP_URL}/auth/callback`;
    const { tokens } = await googleClient.getToken({
      code: code as string,
      redirect_uri: redirectUri,
    });

    const ticket = await googleClient.verifyIdToken({
      idToken: tokens.id_token!,
      audience: process.env.GOOGLE_CLIENT_ID,
    });

    const payload = ticket.getPayload();
    if (!payload) throw new Error("No payload");

    const { sub: googleId, email, name, picture } = payload;

    let user = db.prepare("SELECT * FROM users WHERE google_id = ?").get(googleId) as any;

    if (!user) {
      const result = db.prepare(
        "INSERT INTO users (google_id, email, name, picture) VALUES (?, ?, ?, ?)"
      ).run(googleId, email, name, picture);
      user = { id: result.lastInsertRowid, google_id: googleId, email, name, picture, is_admin: 0 };
    }

    res.cookie("user_id", user.id, { httpOnly: true, secure: true, sameSite: "none" });
    res.cookie("user_name", user.name, { httpOnly: false, secure: true, sameSite: "none" });

    res.send(`
      <html>
        <body>
          <script>
            if (window.opener) {
              window.opener.postMessage({ type: 'OAUTH_AUTH_SUCCESS' }, '*');
              window.close();
            } else {
              window.location.href = '/';
            }
          </script>
          <p>Authentication successful. This window should close automatically.</p>
        </body>
      </html>
    `);
  } catch (error) {
    console.error("Auth error:", error);
    res.status(500).send("Authentication failed");
  }
});

app.post("/api/admin/login", (req, res) => {
  const { password } = req.body;
  if (password === "ANIS2006") {
    res.cookie("admin_session", "ANIS2006", { httpOnly: true, secure: true, sameSite: "none" });
    res.json({ success: true });
  } else {
    res.status(401).json({ error: "Invalid password" });
  }
});

app.post("/api/auth/logout", (req, res) => {
  res.clearCookie("user_id");
  res.clearCookie("user_name");
  res.clearCookie("admin_session");
  res.json({ success: true });
});

app.get("/api/me", (req, res) => {
  const userId = req.cookies.user_id;
  const isAdmin = req.cookies.admin_session === "ANIS2006";
  if (!userId) return res.json({ user: null, isAdmin });
  
  const user = db.prepare("SELECT * FROM users WHERE id = ?").get(userId);
  res.json({ user, isAdmin });
});

// Mod Routes
app.get("/api/mods", (req, res) => {
  const mods = db.prepare(`
    SELECT m.*, u.name as author_name 
    FROM mods m 
    LEFT JOIN users u ON m.author_id = u.id
    ORDER BY m.created_at DESC
  `).all();
  
  const modsWithScreenshots = mods.map((mod: any) => {
    const screenshots = db.prepare("SELECT url FROM screenshots WHERE mod_id = ?").all(mod.id);
    return { ...mod, screenshots: screenshots.map((s: any) => s.url) };
  });

  res.json(modsWithScreenshots);
});

app.get("/api/mods/:id", (req, res) => {
  const mod = db.prepare(`
    SELECT m.*, u.name as author_name 
    FROM mods m 
    LEFT JOIN users u ON m.author_id = u.id
    WHERE m.id = ?
  `).get(req.params.id) as any;

  if (!mod) return res.status(404).json({ error: "Mod not found" });

  const screenshots = db.prepare("SELECT url FROM screenshots WHERE mod_id = ?").all(mod.id);
  mod.screenshots = screenshots.map((s: any) => s.url);

  res.json(mod);
});

app.post("/api/mods", isAdmin, (req, res) => {
  const { title, description, icon_url, size, screenshots } = req.body;
  const userId = req.cookies.user_id;

  const result = db.prepare(
    "INSERT INTO mods (title, description, icon_url, size, author_id) VALUES (?, ?, ?, ?, ?)"
  ).run(title, description, icon_url, size, userId);

  const modId = result.lastInsertRowid;

  if (screenshots && Array.isArray(screenshots)) {
    const insertScreenshot = db.prepare("INSERT INTO screenshots (mod_id, url) VALUES (?, ?)");
    for (const url of screenshots) {
      insertScreenshot.run(modId, url);
    }
  }

  res.json({ id: modId });
});

app.put("/api/mods/:id", isAdmin, (req, res) => {
  const { title, description, icon_url, size, screenshots } = req.body;
  const modId = req.params.id;

  db.prepare(
    "UPDATE mods SET title = ?, description = ?, icon_url = ?, size = ? WHERE id = ?"
  ).run(title, description, icon_url, size, modId);

  if (screenshots && Array.isArray(screenshots)) {
    db.prepare("DELETE FROM screenshots WHERE mod_id = ?").run(modId);
    const insertScreenshot = db.prepare("INSERT INTO screenshots (mod_id, url) VALUES (?, ?)");
    for (const url of screenshots) {
      insertScreenshot.run(modId, url);
    }
  }

  res.json({ success: true });
});

app.delete("/api/mods/:id", isAdmin, (req, res) => {
  db.prepare("DELETE FROM mods WHERE id = ?").run(req.params.id);
  res.json({ success: true });
});

app.post("/api/mods/:id/rate", (req, res) => {
  const userId = req.cookies.user_id;
  if (!userId) return res.status(401).json({ error: "Login required to rate" });

  const { score } = req.body;
  const modId = req.params.id;

  try {
    db.prepare(
      "INSERT OR REPLACE INTO ratings (mod_id, user_id, score) VALUES (?, ?, ?)"
    ).run(modId, userId, score);

    // Update average rating
    const avgRating = db.prepare("SELECT AVG(score) as avg FROM ratings WHERE mod_id = ?").get(modId) as any;
    db.prepare("UPDATE mods SET rating = ? WHERE id = ?").run(avgRating.avg || 0, modId);

    res.json({ success: true, newRating: avgRating.avg });
  } catch (error) {
    res.status(500).json({ error: "Failed to rate" });
  }
});

async function startServer() {
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    app.use(express.static(path.join(__dirname, "dist")));
    app.get("*", (req, res) => {
      res.sendFile(path.join(__dirname, "dist", "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
