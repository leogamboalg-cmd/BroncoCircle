import { Schema } from "mongoose";
import { modelConnection, schemaOptions } from "./connection.js";
import { isPostImageUrl } from "../services/imageService.js";

// Times are campus-local strings such as "12:00" and "13:00".
export const availabilitySchema = new Schema({
  day: { type: String, required: true, trim: true,
    set: value => typeof value === "string" ? value.trim().slice(0, 1).toUpperCase() + value.trim().slice(1).toLowerCase() : value,
    enum: ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"] },
  start: { type: String, required: true, trim: true, match: /^([01]\d|2[0-3]):[0-5]\d$/ },
  end: { type: String, required: true, trim: true, match: /^([01]\d|2[0-3]):[0-5]\d$/,
    validate: { validator: function (value) { return value > this.start; }, message: "End must be after start on the same day." } },
}, { _id: false });

const profileSchema = new Schema({
  avatarUrl: { type: String, validate: value => value == null || isPostImageUrl(value) },
  matchingEnabled: { type: Boolean, default: false },
  account: { type: Schema.Types.ObjectId, ref: "Account", required: true },
  name: { type: String, required: true, trim: true },
  handle: { type: String, trim: true, maxlength: 30, match: /^[A-Za-z0-9_.]+$/ },
  bio: { type: String, trim: true, maxlength: 180, default: "" },
  pronouns: { type: String, trim: true, maxlength: 50, default: "" },
  savedPosts: [{ type: Schema.Types.ObjectId, ref: "Post" }],
  // Legacy field name retained for existing data: this is a one-way following list.
  friends: [{ type: Schema.Types.ObjectId, ref: "Profile" }],
  major: { type: String, required: true, trim: true },
  interests: [{ type: String, trim: true, required: true }],
  availability: { type: [availabilitySchema], validate: values => values.length <= 21 },
}, schemaOptions);

// Keep unlinked seed profiles while enforcing one profile per account.
profileSchema.index({ account: 1 }, { unique: true, partialFilterExpression: { account: { $type: "objectId" } } });
profileSchema.index({ friends: 1 });
export default modelConnection.model("Profile", profileSchema, "profiles");
