import { Schema } from "mongoose";
import { modelConnection, schemaOptions } from "./connection.js";

// Times are campus-local strings such as "12:00" and "13:00".
export const availabilitySchema = new Schema({
  day: { type: String, required: true, trim: true },
  start: { type: String, required: true, trim: true },
  end: { type: String, required: true, trim: true },
}, { _id: false });

const profileSchema = new Schema({
  name: { type: String, required: true, trim: true },
  major: { type: String, required: true, trim: true },
  interests: [{ type: String, trim: true, required: true }],
  availability: [availabilitySchema],
}, schemaOptions);

export default modelConnection.model("Profile", profileSchema, "profiles");
