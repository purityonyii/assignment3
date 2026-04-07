/************************************************************************
* WEB322 – Assignment 03
*
* I declare that this assignment is my own work and I did not copy from
* anyone or use unauthorized help, in line with Seneca’s Academic Integrity Policy.
*
* Name: Onyinyechi Rita Ngaokere
************************************************************************/

// here i load environment variables from .env
require("dotenv").config();

// here i import all required modules
const express = require("express");
const path = require("path");
const mongoose = require("mongoose");
const bcrypt = require("bcryptjs");
const clientSessions = require("client-sessions");
const expressLayouts = require("express-ejs-layouts");

// here i import my models
const User = require("./models/user");
const { Task, sequelize } = require("./models/task");

// here i create my express app
const app = express();
const HTTP_PORT = process.env.PORT || 8080;

// here i set up my view engine (EJS)
app.set("view engine", "ejs");
app.set("views", path.join(__dirname, "views"));
app.use(expressLayouts);
app.set("layout", "layouts/main");

// here i set middleware for forms and static files
app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, "public")));

// here i set up session handling
app.use(
  clientSessions({
    cookieName: "session",
    secret: process.env.SESSION_SECRET || "someSecretValue",
    duration: 30 * 60 * 1000,
    activeDuration: 10 * 60 * 1000,
    httpOnly: true
  })
);

// here i make session available in all views
app.use((req, res, next) => {
  res.locals.session = req.session;
  next();
});

// helper to check if user is logged in
function ensureLogin(req, res, next) {
  if (!req.session.user) {
    return res.redirect("/login");
  }
  next();
}

// helper to validate email format
function validEmail(email) {
  const regex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return regex.test(email);
}

// ================= HOME =================
// here i redirect user based on login state
app.get("/", (req, res) => {
  if (req.session.user) {
    return res.redirect("/dashboard");
  }
  res.redirect("/login");
});

// ================= LOGIN =================
// here i show login page
app.get("/login", (req, res) => {
  if (req.session.user) {
    return res.redirect("/dashboard");
  }

  res.render("login", {
    title: "Login",
    errorMessage: null,
    successMessage: null,
    formData: {}
  });
});

// here i handle login logic
app.post("/login", async (req, res) => {

  // here i get user input
  const { username, password } = req.body;

  try {

    // here i check if fields are empty
    if (!username || !password) {
      return res.render("login", {
        title: "Login",
        errorMessage: "Username and password are required.",
        successMessage: null,
        formData: req.body
      });
    }

    // here i clean input
    const loginValue = username.trim();

    // here i search user by username OR email
    const user = await User.findOne({
      $or: [
        { username: loginValue },
        { email: loginValue.toLowerCase() }
      ]
    });

    // if user not found
    if (!user) {
      return res.render("login", {
        title: "Login",
        errorMessage: "User not found.",
        successMessage: null,
        formData: req.body
      });
    }

    // here i compare password with hashed one
    const checkPassword = await bcrypt.compare(password, user.password);

    // if password incorrect
    if (!checkPassword) {
      return res.render("login", {
        title: "Login",
        errorMessage: "Invalid password.",
        successMessage: null,
        formData: req.body
      });
    }

    // here i store user in session
    req.session.user = {
      _id: user._id,
      username: user.username,
      email: user.email
    };

    // here i redirect to dashboard
    res.redirect("/dashboard");

  } catch (err) {
    console.log("LOGIN ERROR:", err);

    res.render("login", {
      title: "Login",
      errorMessage: "Login failed.",
      successMessage: null,
      formData: req.body
    });
  }
});

// ================= REGISTER =================
// here i show register page
app.get("/register", (req, res) => {
  res.render("register", {
    title: "Register",
    errorMessage: null,
    successMessage: null,
    formData: {}
  });
});

// here i handle user registration
app.post("/register", async (req, res) => {

  const { username, email, password, confirmPassword } = req.body;

  try {

    // here i validate all fields
    if (!username || !email || !password || !confirmPassword) {
      return res.render("register", {
        title: "Register",
        errorMessage: "All fields are required.",
        successMessage: null,
        formData: req.body
      });
    }

    if (!validEmail(email)) {
      return res.render("register", {
        title: "Register",
        errorMessage: "Invalid email.",
        successMessage: null,
        formData: req.body
      });
    }

    if (password.length < 6) {
      return res.render("register", {
        title: "Register",
        errorMessage: "Password too short.",
        successMessage: null,
        formData: req.body
      });
    }

    if (password !== confirmPassword) {
      return res.render("register", {
        title: "Register",
        errorMessage: "Passwords do not match.",
        successMessage: null,
        formData: req.body
      });
    }

    // here i check if username or email exists
    const userExists = await User.findOne({ username: username.trim() });
    if (userExists) {
      return res.render("register", {
        title: "Register",
        errorMessage: "Username exists.",
        successMessage: null,
        formData: req.body
      });
    }

    const emailExists = await User.findOne({ email: email.toLowerCase() });
    if (emailExists) {
      return res.render("register", {
        title: "Register",
        errorMessage: "Email exists.",
        successMessage: null,
        formData: req.body
      });
    }

    // here i hash password before saving
    const hash = await bcrypt.hash(password, 10);

    // here i create user
    await User.create({
      username: username.trim(),
      email: email.toLowerCase(),
      password: hash
    });

    // after register i send user to login
    res.render("login", {
      title: "Login",
      successMessage: "Registration successful.",
      errorMessage: null,
      formData: {}
    });

  } catch (err) {
    console.log("REGISTER ERROR:", err);
  }
});

// ================= DASHBOARD =================
// here i load user tasks
app.get("/dashboard", ensureLogin, async (req, res) => {
  const tasks = await Task.findAll({
    where: { userId: String(req.session.user._id) }
  });

  res.render("dashboard", { title: "Dashboard", tasks });
});

// ================= LOGOUT =================
// here i clear session
app.get("/logout", (req, res) => {
  req.session.reset();
  res.redirect("/login");
});

// ================= START =================
// here i connect both databases and start server
async function startServer() {
  await mongoose.connect(process.env.MONGODB_URI);
  await sequelize.authenticate();
  await sequelize.sync();

  app.listen(HTTP_PORT, () => {
    console.log("Server running");
  });
}

startServer();