const express = require('express');
const session = require("express-session");
const path = require("path");
const exphbs = require("express-handlebars");
const db = require("./database");
const argon2 = require("argon2");
const app = express();
const PORT = process.env.PORT || 3000;

const MAX_FAILED = 5;
const LOCK_MINUTES = 15;
// const users = [];
// const comments = [];
function requireLogin(req, res, next) {
  if (!req.session.loggedIn || !req.session.userId) {
    return res.status(401).render("pages/login", { error: "Login required" });
  }
  next();
}

app.use(express.urlencoded({ extended: true }));

app.use(express.static(path.join(__dirname, "public")));

app.use(
  session({
    secret: "insecure-secret",
    resave: false,
    saveUninitialized: true,
  })
); //create a session cookie

app.engine(
  "hbs",
  exphbs.engine({
    extname: "hbs",
    defaultLayout: "main",
    layoutsDir: path.join(__dirname, "views/layouts"),
    partialsDir: path.join(__dirname, "views/partials"),
  })
); // load the views

app.set("view engine", "hbs");
app.set("views", path.join(__dirname, "views"));



app.listen(PORT, '0.0.0.0', () => {
  console.log(`Server is running on port ${PORT}`);
}); //run the server

// comments.push({
//   author: "test",
//   text: "test",
//   createdAt: new Date()
// });
app.use((req, res, next) => {
  res.locals.user =
    req.session.displayName ||
    req.session.username ||
    null;
  next();
});


app.get("/", (req, res) => {
  res.render("pages/home");
});

app.get("/register", (req, res) => {
  res.render("pages/register");
});

app.post("/register", async (req, res) => {
  const { username, password, email, displayName } = req.body;

  // required checks
  if (!username || !password || !email || !displayName) {
    return res.status(400).render("pages/register", { error: "All fields are required" });
  }

  // email format
  const emailOk = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
  if (!emailOk) {
    return res.status(400).render("pages/register", { error: "Invalid email format" });
  }

  // display name must differ from username
  if (displayName === username) {
    return res.status(400).render("pages/register", { error: "Display name must be different from username" });
  }

  // uniqueness checks
  const existingUser = db.prepare("SELECT id FROM users WHERE username = ?").get(username);
  if (existingUser) {
    return res.status(400).render("pages/register", { error: "Username already taken" });
  }

  const existingEmail = db.prepare("SELECT id FROM users WHERE email = ?").get(email);
  if (existingEmail) {
    return res.status(400).render("pages/register", { error: "Email already in use" });
  }

  // hash password
  const password_hash = await argon2.hash(password);

  //insert
  db.prepare(`
    INSERT INTO users (username, password_hash, email, display_name)
    VALUES (?, ?, ?, ?)
  `).run(username, password_hash, email, displayName);

  res.redirect("/login");
});
 //create an account and hash the pw


app.get("/login", (req, res) => {
  res.render("pages/login");
});

app.post("/login", async (req, res) => {
  const { username, password } = req.body;

  // Get IP (works behind proxies too)
  const ip =
    (req.headers["x-forwarded-for"] || "").split(",")[0].trim() ||
    req.socket.remoteAddress ||
    "unknown";

  // Look up user by username
  const user = db
    .prepare("SELECT id, username, password_hash, failed_attempts, locked_until FROM users WHERE username = ?")
    .get(username);

  // If user doesn't exist, still log the attempt
  if (!user) {
    db.prepare(
      "INSERT INTO login_attempts (username, ip, success) VALUES (?, ?, ?)"
    ).run(username || "", ip, 0);

    return res.status(401).render("pages/login", { error: "Invalid username or password" });
  }

  // Check lockout
  if (user.locked_until) {
    const lockedUntilMs = Date.parse(user.locked_until + "Z"); // treat as UTCish
    const nowMs = Date.now();

    if (!Number.isNaN(lockedUntilMs) && lockedUntilMs > nowMs) {
      // Log locked attempt as failure
      db.prepare(
        "INSERT INTO login_attempts (username, ip, success) VALUES (?, ?, ?)"
      ).run(username, ip, 0);

      return res.status(403).render("pages/login", {
        error: `Account locked. Try again later.`,
      });
    }
  }

  // verify password
  const ok = await argon2.verify(user.password_hash, password);

  if (!ok) {
    // log failure
    db.prepare(
      "INSERT INTO login_attempts (username, ip, success) VALUES (?, ?, ?)"
    ).run(username, ip, 0);

    const newFails = (user.failed_attempts || 0) + 1;

    if (newFails >= MAX_FAILED) {
      // lock the account for 15 minutes and reset failed counter
      db.prepare(`
        UPDATE users
        SET failed_attempts = 0,
            locked_until = datetime('now', ?)
        WHERE id = ?
      `).run(`+${LOCK_MINUTES} minutes`, user.id);

      return res.status(403).render("pages/login", {
        error: `Account locked. Try again later.`,
      });
    } else {
      // increment failed_attempts
      db.prepare("UPDATE users SET failed_attempts = ? WHERE id = ?").run(newFails, user.id);

      return res.status(401).render("pages/login", {
        error: "Invalid username or password",
      });
    }
  }

  //log success, clear lockout counters
  db.prepare(
    "INSERT INTO login_attempts (username, ip, success) VALUES (?, ?, ?)"
  ).run(username, ip, 1);

  db.prepare("UPDATE users SET failed_attempts = 0, locked_until = NULL WHERE id = ?")
    .run(user.id);

  req.session.loggedIn = true;
  req.session.username = user.username;
  req.session.userId = user.id;

  return res.redirect("/comments");
});

 //verify the login, and the argon hashed pw and redirect to the comments
app.post("/logout", (req, res) => {
  req.session.destroy(() => {
    res.clearCookie("connect.sid");
    res.redirect("/");
  });
});
//clear the login cookie
app.get("/profile", requireLogin, (req, res) => {
  const user = db.prepare(`
    SELECT username, email, display_name, bio
    FROM users
    WHERE id = ?
  `).get(req.session.userId);

  res.render("pages/profile", { user });
});
//main profile page
app.post("/profile/email", requireLogin, (req, res) => {
  const email = (req.body.email || "").trim();

  const emailOk = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
  if (!emailOk) {
    return res.status(400).render("pages/profile", { error: "Invalid email", user: { email } });
  }

  const existingEmail = db.prepare("SELECT id FROM users WHERE email = ? AND id != ?")
    .get(email, req.session.userId);

  if (existingEmail) {
    return res.status(400).render("pages/profile", { error: "Email already in use" });
  }

  db.prepare("UPDATE users SET email = ? WHERE id = ?").run(email, req.session.userId);
  res.redirect("/profile");
});
//update email
app.post("/profile/display-name", requireLogin, (req, res) => {
  const displayName = (req.body.displayName || "").trim();

  if (!displayName) {
    return res.status(400).render("pages/profile", { error: "Display name required" });
  }

  if (displayName === req.session.username) {
    return res.status(400).render("pages/profile", { error: "Display name must differ from username" });
  }

  db.prepare("UPDATE users SET display_name = ? WHERE id = ?")
    .run(displayName, req.session.userId);

  res.redirect("/profile");
});
//update display name (not username)
app.post("/profile/bio", requireLogin, (req, res) => {
  const bio = (req.body.bio || "").trim();
  db.prepare("UPDATE users SET bio = ? WHERE id = ?").run(bio, req.session.userId);
  res.redirect("/profile");
});
//update bio
app.post("/profile/password", requireLogin, async (req, res) => {
  const oldPassword = req.body.oldPassword || "";
  const newPassword = req.body.newPassword || "";

  if (!oldPassword || !newPassword) {
    return res.status(400).render("pages/profile", { error: "Both passwords required" });
  }

  const user = db.prepare("SELECT password_hash FROM users WHERE id = ?")
    .get(req.session.userId);

  const ok = await argon2.verify(user.password_hash, oldPassword);
  if (!ok) {
    return res.status(400).render("pages/profile", { error: "Old password is incorrect" });
  }

  const newHash = await argon2.hash(newPassword);
  db.prepare("UPDATE users SET password_hash = ? WHERE id = ?")
    .run(newHash, req.session.userId);

  res.redirect("/profile");
});
//changes old pass
app.get("/comments", (req, res) => {
  const rows = db.prepare(`
    SELECT u.display_name AS author, c.text, c.created_at
    FROM comments c
    JOIN users u ON u.id = c.user_id
    ORDER BY c.id DESC
  `).all();

  res.render("pages/comments", {
    comments: rows.map(c => ({
      author: c.author,
      text: c.text,
      createdAt: new Date(c.created_at).toISOString()
    }))
  });
});
//load the comments
app.get("/comment/new", (req, res) => {
  if (!req.session.loggedIn) {
    return res.render("pages/login", { error: "You must log in to post comments" });
  }
  res.render("pages/new-comment");
});
//post a comment
app.post("/comment", (req, res) => {
  if (!req.session.loggedIn) {
    return res.status(401).render("pages/login", { error: "Login required" });
  }

  const text = req.body.text;
  if (!text) {
    return res.status(400).render("pages/new-comment", { error: "Comment cannot be empty" });
  }

  const stmt = db.prepare(
    "INSERT INTO comments (user_id, text) VALUES (?, ?)"
  );
  // console.log("ABOUT TO INSERT comment:", { user_id: req.session.userId, text });


  stmt.run(req.session.userId, text);

  res.redirect("/comments");
});
