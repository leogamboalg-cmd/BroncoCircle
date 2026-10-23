import { Schema } from "mongoose";
import { availabilitySchema } from "./Profile.js";
import { modelConnection, schemaOptions } from "./connection.js";

const circleSchema = new Schema({
  candidateMembers: [{ type: Schema.Types.ObjectId, ref: "Profile" }],
  matchKey: { type: String },
  name: { type: String, required: true, trim: true },
  members: [{ type: Schema.Types.ObjectId, ref: "Profile", required: true }],
  sharedInterests: [{ type: String, trim: true, required: true }],
  sharedAvailability: [availabilitySchema],
}, schemaOptions);

circleSchema.index({ matchKey: 1 }, { unique: true, partialFilterExpression: { matchKey: { $type: "string" } } });
export default modelConnection.model("Circle", circleSchema, "circles");
