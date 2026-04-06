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

// here I am loading environment variables from .env
require("dotenv").config();

// here I import all the packages I need
const express = require("express");
const path = require("path");
const mongoose = require("mongoose");
const bcrypt = require("bcryptjs");
const clientSessions = require("client-sessions");
const expressLayouts = require("express-ejs-layouts");

// here I import my models (users = MongoDB, tasks = PostgreSQL)
const User = require("./models/user");
const { Task, sequelize } = require("./models/task");

const app = express();

// here I set the port for my app
const HTTP_PORT = process.env.PORT || 8080;

// here I setup my view engine (EJS)
app.set("view engine", "ejs");
app.set("views", path.join(__dirname, "views"));

// here I use layouts so all pages share same design
app.use(expressLayouts);
app.set("layout", "layouts/main");

// here I allow form data to be read
app.use(express.urlencoded({ extended: true }));

// here I serve static files like CSS
app.use(express.static(path.join(__dirname, "public")));

// here I setup session so user stays logged in
app.use(
  clientSessions({
    cookieName: "session",
    secret: process.env.SESSION_SECRET || "someSecretValue",
    duration: 30 * 60 * 1000,
    activeDuration: 10 * 60 * 1000,
    httpOnly: true
  })
);

// here I make session available in all pages
app.use((req, res, next) => {
  res.locals.session = req.session;
  next();
});

// here I protect routes so only logged-in users can access them
function ensureLogin(req, res, next) {
  if (!req.session.user) {
    return res.redirect("/login");
  }
  next();
}

// here I check if email format is valid
function validEmail(email) {
  const regex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return regex.test(email);
}

// home route (redirect depending on login)
app.get("/", (req, res) => {
  if (req.session.user) {
    return res.redirect("/dashboard");
  }
  res.redirect("/login");
});

// ================= REGISTER =================

// here I show register page
app.get("/register", (req, res) => {
  res.render("register", {
    title: "Register",
    errorMessage: null,
    successMessage: null,
    formData: {}
  });
});

// here I handle register form
app.post("/register", async (req, res) => {
  const { username, email, password, confirmPassword } = req.body;

  try {
    // here I check empty fields
    if (!username || !email || !password || !confirmPassword) {
      return res.render("register", {
        title: "Register",
        errorMessage: "All fields are required.",
        successMessage: null,
        formData: req.body
      });
    }

    // here I validate email
    if (!validEmail(email)) {
      return res.render("register", {
        title: "Register",
        errorMessage: "Please enter a valid email address.",
        successMessage: null,
        formData: req.body
      });
    }

    // here I check password length
    if (password.length < 6) {
      return res.render("register", {
        title: "Register",
        errorMessage: "Password must be at least 6 characters long.",
        successMessage: null,
        formData: req.body
      });
    }

    // here I check if passwords match
    if (password !== confirmPassword) {
      return res.render("register", {
        title: "Register",
        errorMessage: "Passwords do not match.",
        successMessage: null,
        formData: req.body
      });
    }

    // here I check if username already exists
    const existingUserByName = await User.findOne({ username: username.trim() });
    if (existingUserByName) {
      return res.render("register", {
        title: "Register",
        errorMessage: "Username already exists.",
        successMessage: null,
        formData: req.body
      });
    }

    // here I check if email already exists
    const existingUserByEmail = await User.findOne({ email: email.trim().toLowerCase() });
    if (existingUserByEmail) {
      return res.render("register", {
        title: "Register",
        errorMessage: "Email already exists.",
        successMessage: null,
        formData: req.body
      });
    }

    // here I hash password before saving
    const hash = await bcrypt.hash(password, 10);

    // here I save user to MongoDB
    await User.create({
      username: username.trim(),
      email: email.trim().toLowerCase(),
      password: hash
    });

    // after success, I send user to login page
    res.render("login", {
      title: "Login",
      errorMessage: null,
      successMessage: "Registration successful. Please login.",
      formData: {}
    });
  } catch (err) {
    console.log("REGISTER ERROR:", err);

    // here I handle any unexpected error
    res.render("register", {
      title: "Register",
      errorMessage: err.message || "Error creating user",
      successMessage: null,
      formData: req.body
    });
  }
});