import { Schema } from "mongoose";
import { modelConnection, schemaOptions } from "./connection.js";

const accountSchema = new Schema({
  name: { type: String, required: true, trim: true },
  email: { type: String, required: true, trim: true, lowercase: true, unique: true },
  passwordHash: { type: String, required: true, select: false },
  tokenHash: { type: String, select: false },
  tokenExpiresAt: { type: Date, select: false },
  createdAt: { type: Date, default: Date.now },
}, schemaOptions);

export default modelConnection.model("Account", accountSchema, "accounts");
