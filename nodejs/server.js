const express = require('express');
const session = require("express-session");
const path = require("path");
const exphbs = require("express-handlebars");

const app = express();
const PORT = process.env.PORT || 3000;


const users = [];
const comments = [];

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
  res.locals.user = req.session.username || null;
  next();
});

app.get("/", (req, res) => {
  res.render("pages/home");
});

app.get("/register", (req, res) => {
  res.render("pages/register");
});

app.post("/register", (req, res) => {
  const { username, password } = req.body;

  const existing = users.find(u => u.username === username);
  if (existing) {
    return res.status(400).render("pages/register", { error: "Username already taken" });
  }

  users.push({ username, password });
  res.redirect("/login");
}); //create an account


app.get("/login", (req, res) => {
  res.render("pages/login");
});

app.post("/login", (req, res) => {
  const { username, password } = req.body;
  const user = users.find(u => u.username === username && u.password === password);

  if (!user) {
    return res.status(401).render("pages/login", { error: "Invalid username or password" });
  }

  req.session.loggedIn = true;
  req.session.username = username;

  res.redirect("/comments");
});
 //verify the login and redirect to the comments
app.post("/logout", (req, res) => {
  req.session.destroy(() => {
    res.clearCookie("connect.sid");
    res.redirect("/");
  });
});
//clear the login cookie
app.get("/comments", (req, res) => {
  res.render("pages/comments", {
    comments: comments.map(c => ({
      author: c.author,
      text: c.text,
      createdAt: c.createdAt.toISOString()
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

  comments.push({
    author: req.session.username,
    text,
    createdAt: new Date(),
  });

  res.redirect("/comments");
});
