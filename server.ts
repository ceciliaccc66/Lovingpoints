import express from "express";
import { createServer } from "http";
import { WebSocketServer, WebSocket } from "ws";
import { createServer as createViteServer } from "vite";
import Database from "better-sqlite3";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const db = new Database("points.db");
db.pragma('foreign_keys = ON');

// Initialize Database
db.exec(`
  CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    username TEXT UNIQUE NOT NULL,
    password TEXT NOT NULL,
    pair_id TEXT,
    points INTEGER DEFAULT 0,
    total_points INTEGER DEFAULT 0
  );

  CREATE TABLE IF NOT EXISTS applications (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    from_user_id INTEGER NOT NULL,
    to_user_id INTEGER NOT NULL,
    title TEXT NOT NULL,
    points INTEGER NOT NULL,
    description TEXT,
    status TEXT DEFAULT 'pending', -- pending, approved, rejected, modified
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY(from_user_id) REFERENCES users(id),
    FOREIGN KEY(to_user_id) REFERENCES users(id)
  );

  CREATE TABLE IF NOT EXISTS rewards (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    creator_id INTEGER NOT NULL,
    pair_id TEXT NOT NULL,
    title TEXT NOT NULL,
    points_required INTEGER NOT NULL,
    description TEXT,
    expected_date TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY(creator_id) REFERENCES users(id)
  );

  CREATE TABLE IF NOT EXISTS redemptions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    reward_id INTEGER NOT NULL,
    points_spent INTEGER NOT NULL,
    status TEXT DEFAULT 'pending', -- pending, approved, rejected
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY(user_id) REFERENCES users(id),
    FOREIGN KEY(reward_id) REFERENCES rewards(id) ON DELETE CASCADE
  );

  CREATE TABLE IF NOT EXISTS point_projects (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    creator_id INTEGER NOT NULL,
    pair_id TEXT NOT NULL,
    title TEXT NOT NULL,
    default_points INTEGER NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY(creator_id) REFERENCES users(id)
  );

  CREATE TABLE IF NOT EXISTS wishlist (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    creator_id INTEGER NOT NULL,
    pair_id TEXT NOT NULL,
    title TEXT NOT NULL,
    description TEXT,
    is_completed INTEGER DEFAULT 0,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY(creator_id) REFERENCES users(id)
  );
`);

// Migration: Add expected_date to rewards if it doesn't exist
try {
  db.prepare("ALTER TABLE rewards ADD COLUMN expected_date TEXT").run();
} catch (e) {
  // Column already exists or table doesn't exist yet
}

const app = express();
app.use(express.json());
const server = createServer(app);
const wss = new WebSocketServer({ server });

// WebSocket connection handling
const clients = new Map<number, WebSocket>();

wss.on("connection", (ws, req) => {
  let userId: number | null = null;

  ws.on("message", (message) => {
    const data = JSON.parse(message.toString());
    if (data.type === "auth") {
      userId = data.userId;
      if (userId) clients.set(userId, ws);
    }
  });

  ws.on("close", () => {
    if (userId) clients.delete(userId);
  });
});

function broadcastToUser(userId: number, data: any) {
  const client = clients.get(userId);
  if (client && client.readyState === WebSocket.OPEN) {
    client.send(JSON.stringify(data));
  }
}

function broadcastToPair(userId: number, data: any) {
  const user = db.prepare("SELECT pair_id FROM users WHERE id = ?").get(userId) as any;
  if (user?.pair_id) {
    const pairUsers = db.prepare("SELECT id FROM users WHERE pair_id = ?").all(user.pair_id) as any[];
    pairUsers.forEach(u => broadcastToUser(u.id, data));
  }
}

// Auth Routes
app.post("/api/register", (req, res) => {
  const { username, password } = req.body;
  try {
    const result = db.prepare("INSERT INTO users (username, password) VALUES (?, ?)").run(username, password);
    res.json({ id: result.lastInsertRowid, username });
  } catch (e) {
    res.status(400).json({ error: "用户名已存在" });
  }
});

app.post("/api/login", (req, res) => {
  const { username, password } = req.body;
  const user = db.prepare("SELECT id, username, pair_id, points, total_points FROM users WHERE username = ? AND password = ?").get(username, password) as any;
  if (user) {
    res.json(user);
  } else {
    res.status(401).json({ error: "凭据无效" });
  }
});

app.put("/api/user/:id", (req, res) => {
  const { username, password } = req.body;
  const userId = req.params.id;
  try {
    if (password) {
      db.prepare("UPDATE users SET username = ?, password = ? WHERE id = ?").run(username, password, userId);
    } else {
      db.prepare("UPDATE users SET username = ? WHERE id = ?").run(username, userId);
    }
    res.json({ success: true, username });
  } catch (e) {
    res.status(400).json({ error: "用户名已存在" });
  }
});

// Pairing Routes
app.post("/api/pair/create", (req, res) => {
  const { userId } = req.body;
  const pairId = Math.random().toString(36).substring(2, 10).toUpperCase();
  db.prepare("UPDATE users SET pair_id = ? WHERE id = ?").run(pairId, userId);
  res.json({ pairId });
});

app.post("/api/pair/join", (req, res) => {
  const { userId, pairId } = req.body;
  const existingUsers = db.prepare("SELECT id FROM users WHERE pair_id = ?").all(pairId);
  if (existingUsers.length >= 2) {
    return res.status(400).json({ error: "配对已满" });
  }
  db.prepare("UPDATE users SET pair_id = ? WHERE id = ?").run(pairId, userId);
  broadcastToPair(userId, { type: "pair_update" });
  res.json({ success: true });
});

// Points Routes
app.get("/api/user/:id", (req, res) => {
  const user = db.prepare("SELECT id, username, pair_id, points, total_points FROM users WHERE id = ?").get(req.params.id) as any;
  if (user?.pair_id) {
    const partner = db.prepare("SELECT id, username, points, total_points FROM users WHERE pair_id = ? AND id != ?").get(user.pair_id, user.id) as any;
    res.json({ ...user, partner });
  } else {
    res.json(user);
  }
});

app.post("/api/applications", (req, res) => {
  const { fromUserId, toUserId, title, points, description } = req.body;
  const result = db.prepare("INSERT INTO applications (from_user_id, to_user_id, title, points, description) VALUES (?, ?, ?, ?, ?)")
    .run(fromUserId, toUserId, title, points, description);
  broadcastToUser(toUserId, { type: "new_application" });
  res.json({ id: result.lastInsertRowid });
});

app.get("/api/applications/:userId", (req, res) => {
  const apps = db.prepare(`
    SELECT a.*, u.username as from_username 
    FROM applications a 
    JOIN users u ON a.from_user_id = u.id 
    WHERE a.to_user_id = ? AND a.status = 'pending'
    ORDER BY a.created_at DESC
  `).all(req.params.userId);
  res.json(apps);
});

app.delete("/api/applications/:id", (req, res) => {
  db.prepare("DELETE FROM applications WHERE id = ?").run(req.params.id);
  res.json({ success: true });
});

app.post("/api/applications/:id/respond", (req, res) => {
  const { status, points } = req.body; // status: approved, rejected
  const app_id = req.params.id;
  
  const application = db.prepare("SELECT * FROM applications WHERE id = ?").get(app_id) as any;
  if (!application || application.status !== 'pending') {
    return res.status(400).json({ error: "申请无效" });
  }

  const finalPoints = points !== undefined ? points : application.points;
  
  db.prepare("UPDATE applications SET status = ?, points = ? WHERE id = ?").run(status, finalPoints, app_id);

  if (status === 'approved') {
    // Update points for the person who the application was FOR
    db.prepare("UPDATE users SET points = points + ?, total_points = total_points + ? WHERE id = ?")
      .run(finalPoints, finalPoints > 0 ? finalPoints : 0, application.to_user_id);
  }

  broadcastToUser(application.from_user_id, { type: "application_responded", status });
  broadcastToUser(application.to_user_id, { type: "points_updated" });
  res.json({ success: true });
});

// Rewards Routes
app.post("/api/rewards", (req, res) => {
  const { creatorId, pairId, title, pointsRequired, description, expectedDate } = req.body;
  db.prepare("INSERT INTO rewards (creator_id, pair_id, title, points_required, description, expected_date) VALUES (?, ?, ?, ?, ?, ?)")
    .run(creatorId, pairId, title, pointsRequired, description, expectedDate);
  broadcastToPair(creatorId, { type: "rewards_updated" });
  res.json({ success: true });
});

app.get("/api/rewards/:pairId", (req, res) => {
  const rewards = db.prepare("SELECT * FROM rewards WHERE pair_id = ? ORDER BY created_at DESC").all(req.params.pairId);
  res.json(rewards);
});

app.delete("/api/rewards/:id", (req, res) => {
  const { userId } = req.body;
  // In a real app, we'd verify the user owns the reward or is in the same pair
  db.prepare("DELETE FROM rewards WHERE id = ?").run(req.params.id);
  broadcastToPair(userId, { type: "rewards_updated" });
  res.json({ success: true });
});

app.post("/api/rewards/:id/redeem", (req, res) => {
  const { userId } = req.body;
  const rewardId = req.params.id;
  
  const user = db.prepare("SELECT points, pair_id FROM users WHERE id = ?").get(userId) as any;
  const reward = db.prepare("SELECT * FROM rewards WHERE id = ?").get(rewardId) as any;
  
  if (!user || !reward || user.points < reward.points_required) {
    return res.status(400).json({ error: "积分不足" });
  }
  
  // Check if there's already a pending redemption for this reward by this user
  const pending = db.prepare("SELECT id FROM redemptions WHERE user_id = ? AND reward_id = ? AND status = 'pending'").get(userId, rewardId);
  if (pending) {
    return res.status(400).json({ error: "已发送申请" });
  }

  db.prepare("INSERT INTO redemptions (user_id, reward_id, points_spent, status) VALUES (?, ?, ?, 'pending')")
    .run(userId, rewardId, reward.points_required);
    
  const partner = db.prepare("SELECT id FROM users WHERE pair_id = ? AND id != ?").get(user.pair_id, userId) as any;
  if (partner) {
    broadcastToUser(partner.id, { type: "new_redemption_request" });
  }
  
  res.json({ success: true });
});

app.get("/api/redemptions/pending/:userId", (req, res) => {
  const requests = db.prepare(`
    SELECT r.*, rw.title, u.username as from_username
    FROM redemptions r
    JOIN rewards rw ON r.reward_id = rw.id
    JOIN users u ON r.user_id = u.id
    WHERE rw.pair_id = (SELECT pair_id FROM users WHERE id = ?) 
    AND r.user_id != ?
    AND r.status = 'pending'
  `).all(req.params.userId, req.params.userId);
  res.json(requests);
});

app.get("/api/redemptions/my-pending/:userId", (req, res) => {
  const requests = db.prepare(`
    SELECT reward_id FROM redemptions 
    WHERE user_id = ? AND status = 'pending'
  `).all(req.params.userId);
  res.json(requests.map((r: any) => r.reward_id));
});

app.delete("/api/redemptions/:id", (req, res) => {
  db.prepare("DELETE FROM redemptions WHERE id = ?").run(req.params.id);
  res.json({ success: true });
});

app.post("/api/redemptions/cancel", (req, res) => {
  const { userId, rewardId } = req.body;
  db.prepare("DELETE FROM redemptions WHERE user_id = ? AND reward_id = ? AND status = 'pending'").run(userId, rewardId);
  broadcastToPair(userId, { type: "rewards_updated" });
  res.json({ success: true });
});

app.post("/api/redemptions/:id/respond", (req, res) => {
  const { status } = req.body; // approved, rejected
  const redemptionId = req.params.id;
  
  const redemption = db.prepare("SELECT * FROM redemptions WHERE id = ?").get(redemptionId) as any;
  if (!redemption || redemption.status !== 'pending') {
    return res.status(400).json({ error: "请求无效" });
  }

  db.prepare("UPDATE redemptions SET status = ? WHERE id = ?").run(status, redemptionId);

  if (status === 'approved') {
    db.prepare("UPDATE users SET points = points - ?, total_points = total_points - ? WHERE id = ?")
      .run(redemption.points_spent, redemption.points_spent, redemption.user_id);
    broadcastToUser(redemption.user_id, { type: "points_updated" });
  }

  broadcastToUser(redemption.user_id, { type: "redemption_responded", status });
  res.json({ success: true });
});

app.post("/api/rewards/:id/remind", (req, res) => {
  const { userId } = req.body;
  const rewardId = req.params.id;
  
  const user = db.prepare("SELECT username, pair_id FROM users WHERE id = ?").get(userId) as any;
  const reward = db.prepare("SELECT title, points_required FROM rewards WHERE id = ?").get(rewardId) as any;
  const partner = db.prepare("SELECT id FROM users WHERE pair_id = ? AND id != ?").get(user.pair_id, userId) as any;

  if (partner) {
    broadcastToUser(partner.id, { 
      type: "redemption_reminder", 
      from: user.username, 
      reward: reward.title,
      points: reward.points_required
    });
  }
  res.json({ success: true });
});

// Point Projects Routes
app.post("/api/point-projects", (req, res) => {
  const { creatorId, pairId, title, defaultPoints } = req.body;
  db.prepare("INSERT INTO point_projects (creator_id, pair_id, title, default_points) VALUES (?, ?, ?, ?)")
    .run(creatorId, pairId, title, defaultPoints);
  broadcastToPair(creatorId, { type: "projects_updated" });
  res.json({ success: true });
});

app.get("/api/point-projects/:pairId", (req, res) => {
  const projects = db.prepare("SELECT * FROM point_projects WHERE pair_id = ? ORDER BY created_at DESC").all(req.params.pairId);
  res.json(projects);
});

app.delete("/api/point-projects/:id", (req, res) => {
  const { userId } = req.body;
  // Basic security: check if user is in the same pair (omitted for brevity in this demo but good practice)
  db.prepare("DELETE FROM point_projects WHERE id = ?").run(req.params.id);
  broadcastToPair(userId, { type: "projects_updated" });
  res.json({ success: true });
});

// Wishlist Routes
app.post("/api/wishlist", (req, res) => {
  const { creatorId, pairId, title, description } = req.body;
  db.prepare("INSERT INTO wishlist (creator_id, pair_id, title, description) VALUES (?, ?, ?, ?)")
    .run(creatorId, pairId, title, description);
  broadcastToPair(creatorId, { type: "wishlist_updated" });
  res.json({ success: true });
});

app.get("/api/wishlist/:pairId", (req, res) => {
  const items = db.prepare("SELECT w.*, u.username as creator_name FROM wishlist w JOIN users u ON w.creator_id = u.id WHERE w.pair_id = ? ORDER BY w.created_at DESC").all(req.params.pairId);
  res.json(items);
});

app.patch("/api/wishlist/:id/toggle", (req, res) => {
  const { userId } = req.body;
  db.prepare("UPDATE wishlist SET is_completed = 1 - is_completed WHERE id = ?").run(req.params.id);
  broadcastToPair(userId, { type: "wishlist_updated" });
  res.json({ success: true });
});

app.delete("/api/wishlist/:id", (req, res) => {
  const { userId } = req.body;
  db.prepare("DELETE FROM wishlist WHERE id = ?").run(req.params.id);
  broadcastToPair(userId, { type: "wishlist_updated" });
  res.json({ success: true });
});

// History Routes
app.get("/api/history/:userId", (req, res) => {
  const userId = req.params.userId;
  const user = db.prepare("SELECT pair_id FROM users WHERE id = ?").get(userId) as any;
  if (!user?.pair_id) return res.json([]);

  const history = db.prepare(`
    SELECT 'application' as type, a.id, a.title, a.points, a.status, a.created_at, u.username as from_user, t.username as to_user
    FROM applications a
    JOIN users u ON a.from_user_id = u.id
    JOIN users t ON a.to_user_id = t.id
    WHERE (a.from_user_id = ? OR a.to_user_id = ?) AND a.status != 'pending'
    UNION ALL
    SELECT 'redemption' as type, red.id, r.title, red.points_spent as points, red.status as status, red.created_at, u.username as from_user, NULL as to_user
    FROM redemptions red
    JOIN rewards r ON red.reward_id = r.id
    JOIN users u ON red.user_id = u.id
    WHERE (red.user_id = ? OR red.user_id IN (SELECT id FROM users WHERE pair_id = ? AND id != ?)) AND red.status != 'pending'
    ORDER BY created_at DESC
  `).all(userId, userId, userId, user.pair_id, userId);
  
  res.json(history);
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

  const PORT = 3000;
  server.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
