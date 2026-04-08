/************************************************************************
* WEB322 – Assignment 03
*
* I declare that this assignment is my own work and I did not copy from
* anyone or use unauthorized help.
*
* Name: Onyinyechi Rita Ngaokere
************************************************************************/

// here i load environment variables
require("dotenv").config();

// here i import modules i need
const express = require("express");
const path = require("path");
const mongoose = require("mongoose");
const bcrypt = require("bcryptjs");
const clientSessions = require("client-sessions");
const expressLayouts = require("express-ejs-layouts");

// here i import my models
const User = require("./models/user");
const { Task, sequelize } = require("./models/task");

// here i create my app
const app = express();
const HTTP_PORT = process.env.PORT || 8080;

// here i setup my views
app.set("view engine", "ejs");
app.set("views", path.join(__dirname, "views"));
app.use(expressLayouts);
app.set("layout", "layouts/main");

// here i handle form input and static files
app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, "public")));

// here i setup session
app.use(
  clientSessions({
    cookieName: "session",
    secret: process.env.SESSION_SECRET || "mysecret",
    duration: 30 * 60 * 1000,
    activeDuration: 10 * 60 * 1000,
    httpOnly: true
  })
);

// here i make session available in all pages
app.use((req, res, next) => {
  res.locals.session = req.session;
  next();
});

// here i check login
function ensureLogin(req, res, next) {
  if (!req.session.user) {
    return res.redirect("/login");
  }
  next();
}

// here i validate email
function validEmail(email) {
  const regex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return regex.test(email);
}

// ================= DATABASE CONNECTION =================

// here i keep track if db is connected
let pgReady = false;

// here i connect both databases
async function connectDB() {
  try {
    // here i connect mongodb if not connected yet
    if (mongoose.connection.readyState !== 1) {
      await mongoose.connect(process.env.MONGODB_URI);
      console.log("MongoDB connected");
    }

    // here i connect postgres only once
    if (!pgReady) {
      await sequelize.authenticate();
      await sequelize.sync();
      pgReady = true;
      console.log("Postgres connected");
    }

  } catch (err) {
    console.log("DB ERROR:", err);
    throw err;
  }
}

// here i make sure db is connected before any request runs
app.use(async (req, res, next) => {
  try {
    await connectDB();
    next();
  } catch (err) {
    res.status(500).send("Database connection failed");
  }
});

// ================= HOME =================
app.get("/", (req, res) => {
  if (req.session.user) {
    return res.redirect("/dashboard");
  }
  res.redirect("/login");
});

// ================= LOGIN =================
app.get("/login", (req, res) => {
  if (req.session.user) return res.redirect("/dashboard");

  res.render("login", {
    title: "Login",
    errorMessage: null,
    successMessage: null,
    formData: {}
  });
});

// here i handle login
app.post("/login", async (req, res) => {
  const { username, password } = req.body;

  try {
    // here i check empty fields
    if (!username || !password) {
      return res.render("login", {
        title: "Login",
        errorMessage: "Username and password required",
        successMessage: null,
        formData: req.body
      });
    }

    // here i trim input
    const loginValue = username.trim();

    // here i search user by username or email
    const user = await User.findOne({
      $or: [
        { username: loginValue },
        { email: loginValue.toLowerCase() }
      ]
    });

    if (!user) {
      return res.render("login", {
        title: "Login",
        errorMessage: "User not found",
        successMessage: null,
        formData: req.body
      });
    }

    // here i compare password
    const check = await bcrypt.compare(password, user.password);

    if (!check) {
      return res.render("login", {
        title: "Login",
        errorMessage: "Wrong password",
        successMessage: null,
        formData: req.body
      });
    }

    // here i save session
    req.session.user = {
      _id: user._id,
      username: user.username,
      email: user.email
    };

    res.redirect("/dashboard");

  } catch (err) {
    console.log("LOGIN ERROR:", err);
    res.render("login", {
      title: "Login",
      errorMessage: "Login failed",
      successMessage: null,
      formData: req.body
    });
  }
});

// ================= REGISTER =================
app.get("/register", (req, res) => {
  res.render("register", {
    title: "Register",
    errorMessage: null,
    successMessage: null,
    formData: {}
  });
});

// here i handle register
app.post("/register", async (req, res) => {
  const { username, email, password, confirmPassword } = req.body;

  try {
    // here i check empty fields
    if (!username || !email || !password || !confirmPassword) {
      return res.render("register", {
        title: "Register",
        errorMessage: "All fields required",
        successMessage: null,
        formData: req.body
      });
    }

    const cleanUsername = username.trim();
    const cleanEmail = email.trim().toLowerCase();

    // here i validate email
    if (!validEmail(cleanEmail)) {
      return res.render("register", {
        title: "Register",
        errorMessage: "Invalid email",
        successMessage: null,
        formData: req.body
      });
    }

    // here i check password
    if (password.length < 6) {
      return res.render("register", {
        title: "Register",
        errorMessage: "Password too short",
        successMessage: null,
        formData: req.body
      });
    }

    if (password !== confirmPassword) {
      return res.render("register", {
        title: "Register",
        errorMessage: "Passwords do not match",
        successMessage: null,
        formData: req.body
      });
    }

    // here i check if username exists
    const userExists = await User.findOne({ username: cleanUsername });
    if (userExists) {
      return res.render("register", {
        title: "Register",
        errorMessage: "Username exists",
        successMessage: null,
        formData: req.body
      });
    }

    // here i check if email exists
    const emailExists = await User.findOne({ email: cleanEmail });
    if (emailExists) {
      return res.render("register", {
        title: "Register",
        errorMessage: "Email exists",
        successMessage: null,
        formData: req.body
      });
    }

    // here i hash password
    const hash = await bcrypt.hash(password, 10);

    // here i create user
    await User.create({
      username: cleanUsername,
      email: cleanEmail,
      password: hash
    });

    res.render("login", {
      title: "Login",
      successMessage: "Registration successful",
      errorMessage: null,
      formData: {}
    });

  } catch (err) {
    console.log("REGISTER ERROR:", err);
    res.render("register", {
      title: "Register",
      errorMessage: "Registration failed",
      successMessage: null,
      formData: req.body
    });
  }
});

// ================= DASHBOARD =================
app.get("/dashboard", ensureLogin, async (req, res) => {
  try {
    const tasks = await Task.findAll({
      where: { userId: String(req.session.user._id) },
      order: [["id", "DESC"]]
    });

    res.render("dashboard", {
      title: "Dashboard",
      tasks: tasks || []
    });

  } catch (err) {
    console.log("DASHBOARD ERROR:", err);
    res.send("Error loading dashboard");
  }
});

// ================= TASK ADD =================
app.post("/tasks/add", ensureLogin, async (req, res) => {
  const { title, description, dueDate, status } = req.body;

  try {
    if (!title) return res.redirect("/dashboard");

    await Task.create({
      title: title.trim(),
      description: description || "",
      dueDate: dueDate || null,
      status: status || "pending",
      userId: String(req.session.user._id)
    });

    res.redirect("/dashboard");

  } catch (err) {
    console.log("ADD ERROR:", err);
    res.redirect("/dashboard");
  }
});

// ================= DELETE =================
app.post("/tasks/delete/:id", ensureLogin, async (req, res) => {
  try {
    await Task.destroy({
      where: {
        id: req.params.id,
        userId: String(req.session.user._id)
      }
    });

    res.redirect("/dashboard");

  } catch (err) {
    console.log("DELETE ERROR:", err);
    res.redirect("/dashboard");
  }
});

// ================= LOGOUT =================
app.get("/logout", (req, res) => {
  req.session.reset();
  res.redirect("/login");
});

// ================= START LOCAL =================
if (require.main === module) {
  connectDB().then(() => {
    app.listen(HTTP_PORT, () => {
      console.log("Server running");
    });
  });
}

// export for vercel
module.exports = app;