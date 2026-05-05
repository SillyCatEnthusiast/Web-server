require('./telemetry');
const express = require("express");
const path = require("path");
const exphbs = require("express-handlebars");

const app = express();
const PORT = process.env.PORT || 3001;

app.set("trust proxy", 1);

app.use((req, res, next) => {
  const start = process.hrtime.bigint();

  res.on("finish", () => {
    const end = process.hrtime.bigint();
    const ms = Number(end - start) / 1e6;

    const log = {
      time: new Date().toISOString(),
      // IP handling: prefer XFF (first IP) then fallback
      remote_addr: (req.headers["x-forwarded-for"] || "").split(",")[0].trim() || req.socket.remoteAddress,
      xff: req.headers["x-forwarded-for"] || "",
      method: req.method,
      path: req.originalUrl?.split("?")[0] || req.url,
      status: res.statusCode,
      referer: req.headers["referer"] || "",
      ua: req.headers["user-agent"] || "",
      accept: req.headers["accept"] || "",
      accept_lang: req.headers["accept-language"] || "",
      accept_enc: req.headers["accept-encoding"] || "",
      sec_ch_ua: req.headers["sec-ch-ua"] || "",
      sec_fetch_site: req.headers["sec-fetch-site"] || "",
      sec_fetch_mode: req.headers["sec-fetch-mode"] || "",
      sec_fetch_dest: req.headers["sec-fetch-dest"] || "",
      cookie: req.headers["cookie"] || "",
      req_time_ms: Math.round(ms * 1000) / 1000
    };

    // stdout as a single JSON line
    process.stdout.write(JSON.stringify(log) + "\n");
  });

  next();
});

app.use(express.json());
app.use(require('./routes/clientTelemetry'));

// Static files
app.use(express.static(path.join(__dirname, "public")));

// Handlebars setup
app.engine(
  "hbs",
  exphbs.engine({
    extname: "hbs",
    defaultLayout: "main",
    layoutsDir: path.join(__dirname, "views/layouts"),
    partialsDir: path.join(__dirname, "views/partials"),
    helpers: {
      year: () => new Date().getFullYear(),
    },
  })
);

app.set("view engine", "hbs");
app.set("views", path.join(__dirname, "views"));

app.get("/", (req, res) => {
  res.render("pages/home", {
    site: {
      name: "William Felkay",
      tagline: "Developer • Home Labber • Cyber Security Enthusiast",
      email: "wfelkay@outlook.com",
      github: "https://github.com/SillyCatEnthusiast",
    },

    education: [
      {
        title: "University of Maine — B.S. Computer Science",
        desc: "Expected 2028",
      },
      {
        title: "Southern New Hampshire University — B.S. Computer Science",
        desc: "2023-2024",
      },
    ],

    coursework: [
      { title: "Server Side Web Design", desc: "Back end design, Databases, Password security, Domain routing" },
    ],

    skills: [
      { title: "JavaScript/TypeScript", desc: "Node.js, Express, React", level: "Advanced" },
      { title: "Java", desc: "Object oriented programming", level: "Beginner" },
      { title: "Python", desc: "Automation, scripting", level: "Proficient" },
      { title: "C", desc: "Memory management, Pointer security, Compilation Debugging", level: "Advanced" },
      { title: "Docker", desc: "Containerization, Deployment, Networking", level: "Advanced" },
      { title: "Linux", desc: "Server administration, File system use, Command line usage", level: "Advanced" },
      { title: "Windows", desc: "Basic powershell usage", level: "Beginner" }
    ],

    projects: [
      { title: "Home lab", desc: "Fully dockerized linux home lab currently running a DNS filter through Adguard with a vpn through Wireguard." },
      { title: "This website", desc: "Dockerized Javascript web server using Node.js, Express, Handlebars, and Nginx for HTTPS. Backend of OpenTelemetry, Prometheus, Jaeger, Loki, and Grafana for telemetry" },
    ],

    certificates: [
      { title: "CCNA", desc: "WIP" },
    ],

    leadership: [
      { title: "VP / University of Maine Cyber Security Team", desc: "Organized multiple Cyber Security related learning labs and Specialist panels as well as initiating inter-club collaboration." },
      { title: "Officer / Computing Club", desc: "" },
      { title: "Participant / Bangor Beer Sec (Sep 25th 2025, Jan 14th 2026)", desc: "Participated in multiple Bangor area Cyber Security meetups" },
      
    ],

    awards: [
      { title: "Southern New Hampshire University Dean's list", desc: "2023/4" },
      { title: "Hivestorm 2024", desc: "Competed in hivestorm 2024 as part of UMCST" },
      { title: "NCL 2025", desc: "Placed top 10% in the individual game and team game" },
      { title: "NECCDL 2026", desc: "Competed in NECCDL 2026 as part of UMCST" },
      { title: "NCL 2026", desc: "Placed top 10% in the individual game and team game again" },

    ],
  });
});

app.listen(PORT, "0.0.0.0", () => {
  console.log(`Server running on port ${PORT}`);
});
