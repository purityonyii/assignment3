/************************************************************************
* WEB322 – Assignment 03
*
* I declare that this assignment is my own work and I did not copy from
* anyone or use unauthorized help, in line with Seneca’s Academic Integrity Policy.
*
* Name: Onyinyechi Rita Ngaokere
* Student ID: ____173949231________
* Date: ______4/4/2026______
*
* Here I built a full task manager app using Express.
* I used MongoDB for users and PostgreSQL for tasks.
************************************************************************/

require("dotenv").config();

const express = require("express");
const path = require("path");
const mongoose = require("mongoose");
const bcrypt = require("bcryptjs");
const clientSessions = require("client-sessions");
const expressLayouts = require("express-ejs-layouts");

const User = require("./models/user");
const { Task, sequelize } = require("./models/task");

const app = express();
const HTTP_PORT = process.env.PORT || 8080;

// view engine
app.set("view engine", "ejs");
app.set("views", path.join(__dirname, "views"));
app.use(expressLayouts);
app.set("layout", "layouts/main");

// middleware
app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, "public")));

app.use(
  clientSessions({
    cookieName: "session",
    secret: process.env.SESSION_SECRET || "someSecretValue",
    duration: 30 * 60 * 1000,
    activeDuration: 10 * 60 * 1000,
    httpOnly: true
  })
);

app.use((req, res, next) => {
  res.locals.session = req.session;
  next();
});

// helpers
function ensureLogin(req, res, next) {
  if (!req.session.user) {
    return res.redirect("/login");
  }
  next();
}

function validEmail(email) {
  const regex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return regex.test(email);
}

// ================= HOME =================
app.get("/", (req, res) => {
  if (req.session.user) {
    return res.redirect("/dashboard");
  }
  res.redirect("/login");
});

// ================= LOGIN =================
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

app.post("/login", async (req, res) => {
  const { username, password } = req.body;

  try {
    if (!username || !password) {
      return res.render("login", {
        title: "Login",
        errorMessage: "Username and password are required.",
        successMessage: null,
        formData: req.body
      });
    }

    const user = await User.findOne({ username: username.trim() });

    if (!user) {
      return res.render("login", {
        title: "Login",
        errorMessage: "User not found.",
        successMessage: null,
        formData: req.body
      });
    }

    const checkPassword = await bcrypt.compare(password, user.password);

    if (!checkPassword) {
      return res.render("login", {
        title: "Login",
        errorMessage: "Invalid password.",
        successMessage: null,
        formData: req.body
      });
    }

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
      errorMessage: err.message || "Login failed.",
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

app.post("/register", async (req, res) => {
  const { username, email, password, confirmPassword } = req.body;

  try {
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
        errorMessage: "Please enter a valid email address.",
        successMessage: null,
        formData: req.body
      });
    }

    if (password.length < 6) {
      return res.render("register", {
        title: "Register",
        errorMessage: "Password must be at least 6 characters long.",
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

    const existingUserByName = await User.findOne({ username: username.trim() });
    if (existingUserByName) {
      return res.render("register", {
        title: "Register",
        errorMessage: "Username already exists.",
        successMessage: null,
        formData: req.body
      });
    }

    const existingUserByEmail = await User.findOne({ email: email.trim().toLowerCase() });
    if (existingUserByEmail) {
      return res.render("register", {
        title: "Register",
        errorMessage: "Email already exists.",
        successMessage: null,
        formData: req.body
      });
    }

    const hash = await bcrypt.hash(password, 10);

    await User.create({
      username: username.trim(),
      email: email.trim().toLowerCase(),
      password: hash
    });

    res.render("login", {
      title: "Login",
      errorMessage: null,
      successMessage: "Registration successful. Please login.",
      formData: {}
    });
  } catch (err) {
    console.log("REGISTER ERROR:", err);

    res.render("register", {
      title: "Register",
      errorMessage: err.message || "Error creating user",
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
      order: [["createdAt", "DESC"]]
    });

    res.render("dashboard", {
      title: "Dashboard",
      tasks,
      errorMessage: null,
      successMessage: null
    });
  } catch (err) {
    console.log("DASHBOARD ERROR:", err);
    res.render("dashboard", {
      title: "Dashboard",
      tasks: [],
      errorMessage: "Could not load dashboard.",
      successMessage: null
    });
  }
});

// ================= LOGOUT =================
app.get("/logout", (req, res) => {
  req.session.reset();
  res.redirect("/login");
});

// ================= OPTIONAL TASK ROUTES =================
app.post("/tasks/add", ensureLogin, async (req, res) => {
  const { title, description, dueDate, status } = req.body;

  try {
    if (!title) {
      return res.redirect("/dashboard");
    }

    await Task.create({
      title: title.trim(),
      description: description || "",
      dueDate: dueDate || null,
      status: status || "pending",
      userId: String(req.session.user._id)
    });

    res.redirect("/dashboard");
  } catch (err) {
    console.log("ADD TASK ERROR:", err);
    res.redirect("/dashboard");
  }
});

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
    console.log("DELETE TASK ERROR:", err);
    res.redirect("/dashboard");
  }
});

// ================= 404 =================
app.use((req, res) => {
  res.status(404).send("Page not found");
});

// ================= STARTUP =================
async function startServer() {
  try {
    await mongoose.connect(process.env.MONGODB_URI || process.env.MONGO_URI);
    await sequelize.authenticate();
    await sequelize.sync();

    console.log("Both databases connected successfully");

    if (require.main === module) {
      app.listen(HTTP_PORT, () => {
        console.log(`Server running on port ${HTTP_PORT}`);
      });
    }
  } catch (err) {
    console.log("STARTUP ERROR:", err);
  }
}

startServer();

module.exports = app;