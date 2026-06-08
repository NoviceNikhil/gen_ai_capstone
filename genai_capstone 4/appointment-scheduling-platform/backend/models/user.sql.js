const { DataTypes } = require("sequelize");
const { sequelize } = require("../config/sql");
const validator = require("validator");

const User = sequelize.define(
  "User",
  {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true,
    },
    full_name: {
      type: DataTypes.STRING(150),
      allowNull: false,
      validate: {
        notEmpty: { msg: "Full name cannot be empty" },
        len: { args: [2, 150], msg: "Name must be between 2 and 150 characters" },
      },
    },
    email: {
      type: DataTypes.STRING(255),
      unique: true,
      allowNull: false,
      validate: {
        isValidEmail(value) {
          if (!validator.isEmail(value)) {
            throw new Error("Invalid email format");
          }
        },
      },
    },
    password_hash: {
      type: DataTypes.STRING(255),
      allowNull: false,
    },
    phone: {
      type: DataTypes.STRING(20),
      allowNull: false,
    },
    role: {
      type: DataTypes.ENUM("customer", "provider", "admin"),
      allowNull: false,
      defaultValue: "customer",
    },
    is_active: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: false, // requires OTP verification
    },
    otp_hash: {
      type: DataTypes.STRING,
      allowNull: true,
    },
    otp_expiry: {
      type: DataTypes.DATE,
      allowNull: true,
    },
  },
  {
    tableName: "users",
    timestamps: true,
    underscored: true,
  }
);

module.exports = User;
