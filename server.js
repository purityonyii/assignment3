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

// here i set up my view engine
app.set("view engine", "ejs");
app.set("views", path.join(__dirname, "views"));
app.use(expressLayouts);
app.set("layout", "layouts/main");

// here i set middleware for form data and static files
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

// here i make session available in all ejs pages
app.use((req, res, next) => {
  res.locals.session = req.session;
  next();
});

// here i check if user is logged in
function ensureLogin(req, res, next) {
  if (!req.session.user) {
    return res.redirect("/login");
  }
  next();
}

// here i check if email format is valid
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
  // here i collect what user typed
  const { username, password } = req.body;

  try {
    // here i make sure both fields are filled
    if (!username || !password) {
      return res.render("login", {
        title: "Login",
        errorMessage: "Username and password are required.",
        successMessage: null,
        formData: req.body
      });
    }

    // here i remove extra spaces
    const loginValue = username.trim();

    // here i allow login with username or email
    const user = await User.findOne({
      $or: [
        { username: loginValue },
        { email: loginValue.toLowerCase() }
      ]
    });

    // here i check if user exists
    if (!user) {
      return res.render("login", {
        title: "Login",
        errorMessage: "User not found.",
        successMessage: null,
        formData: req.body
      });
    }

    // here i compare entered password with hashed one
    const checkPassword = await bcrypt.compare(password, user.password);

    // here i stop login if password is wrong
    if (!checkPassword) {
      return res.render("login", {
        title: "Login",
        errorMessage: "Invalid password.",
        successMessage: null,
        formData: req.body
      });
    }

    // here i save logged in user into session
    req.session.user = {
      _id: user._id,
      username: user.username,
      email: user.email
    };

    // here i send user to dashboard after login
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
    // here i make sure all fields are filled
    if (!username || !email || !password || !confirmPassword) {
      return res.render("register", {
        title: "Register",
        errorMessage: "All fields are required.",
        successMessage: null,
        formData: req.body
      });
    }

    // here i clean input a little
    const cleanUsername = username.trim();
    const cleanEmail = email.trim().toLowerCase();

    // here i check email format
    if (!validEmail(cleanEmail)) {
      return res.render("register", {
        title: "Register",
        errorMessage: "Invalid email.",
        successMessage: null,
        formData: req.body
      });
    }

    // here i make sure password is not too short
    if (password.length < 6) {
      return res.render("register", {
        title: "Register",
        errorMessage: "Password too short.",
        successMessage: null,
        formData: req.body
      });
    }

    // here i make sure both passwords match
    if (password !== confirmPassword) {
      return res.render("register", {
        title: "Register",
        errorMessage: "Passwords do not match.",
        successMessage: null,
        formData: req.body
      });
    }

    // here i check if username already exists
    const userExists = await User.findOne({ username: cleanUsername });
    if (userExists) {
      return res.render("register", {
        title: "Register",
        errorMessage: "Username exists.",
        successMessage: null,
        formData: req.body
      });
    }

    // here i check if email already exists
    const emailExists = await User.findOne({ email: cleanEmail });
    if (emailExists) {
      return res.render("register", {
        title: "Register",
        errorMessage: "Email exists.",
        successMessage: null,
        formData: req.body
      });
    }

    // here i hash password before saving it
    const hash = await bcrypt.hash(password, 10);

    // here i create the new user
    await User.create({
      username: cleanUsername,
      email: cleanEmail,
      password: hash
    });

    // after successful registration i show login page
    return res.render("login", {
      title: "Login",
      successMessage: "Registration successful.",
      errorMessage: null,
      formData: {}
    });
  } catch (err) {
    console.log("REGISTER ERROR:", err);

    // here i handle mongodb duplicate error too
    if (err.code === 11000) {
      if (err.keyPattern && err.keyPattern.username) {
        return res.render("register", {
          title: "Register",
          errorMessage: "Username exists.",
          successMessage: null,
          formData: req.body
        });
      }

      if (err.keyPattern && err.keyPattern.email) {
        return res.render("register", {
          title: "Register",
          errorMessage: "Email exists.",
          successMessage: null,
          formData: req.body
        });
      }

      return res.render("register", {
        title: "Register",
        errorMessage: "Username or email already exists.",
        successMessage: null,
        formData: req.body
      });
    }

    return res.render("register", {
      title: "Register",
      errorMessage: err.message || "Registration failed.",
      successMessage: null,
      formData: req.body
    });
  }
});

// ================= DASHBOARD =================
// here i load user tasks after login
app.get("/dashboard", ensureLogin, async (req, res) => {
  try {
    const tasks = await Task.findAll({
      where: { userId: String(req.session.user._id) },
      order: [["id", "DESC"]]
    });

    res.render("dashboard", {
      title: "Dashboard",
      tasks: tasks || [],
      errorMessage: null,
      successMessage: null
    });
  } catch (err) {
    console.log("DASHBOARD ERROR:", err);
    res.status(500).send("Dashboard error: " + err.message);
  }
});

// ================= TASK ADD =================
// here i add a new task for logged in user
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

// ================= TASK DELETE =================
// here i delete a task that belongs to logged in user
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

// ================= LOGOUT =================
// here i clear session and send user back to login
app.get("/logout", (req, res) => {
  req.session.reset();
  res.redirect("/login");
});

// ================= 404 =================
// here i handle pages that do not exist
app.use((req, res) => {
  res.status(404).send("Page not found");
});

// ================= START SERVER =================
// here i connect mongodb and postgres then start the app
async function startServer() {
  try {
    // here i connect mongodb with env variable
    await mongoose.connect(process.env.MONGODB_URI, {
      useNewUrlParser: true,
      useUnifiedTopology: true
    });

    // here i connect postgres
    await sequelize.authenticate();
    await sequelize.sync();

    console.log("Both databases connected successfully");

    // here i only listen locally, not on vercel serverless
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

// here i export app for vercel
module.exports = app;