const { Sequelize, DataTypes } = require("sequelize");
const pg = require("pg");

const sequelize = new Sequelize(process.env.DATABASE_URL, {
  dialect: "postgres",
  protocol: "postgres",
  dialectModule: pg,
  logging: false,
  dialectOptions: {
    ssl: {
      require: true,
      rejectUnauthorized: false
    }
  }
});

const Task = sequelize.define("Task", {
  id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true
  },
  title: {
    type: DataTypes.STRING,
    allowNull: false
  },
  description: {
    type: DataTypes.TEXT
  },
  dueDate: {
    type: DataTypes.DATEONLY
  },
  status: {
    type: DataTypes.STRING,
    defaultValue: "pending"
  },
  userId: {
    type: DataTypes.STRING,
    allowNull: false
  }
});

module.exports = { Task, sequelize };