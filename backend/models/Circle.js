import { Schema } from "mongoose";
import { availabilitySchema } from "./Profile.js";
import { modelConnection, schemaOptions } from "./connection.js";

const circleSchema = new Schema({
  name: { type: String, required: true, trim: true },
  members: [{ type: Schema.Types.ObjectId, ref: "Profile", required: true }],
  sharedInterests: [{ type: String, trim: true, required: true }],
  sharedAvailability: [availabilitySchema],
}, schemaOptions);

export default modelConnection.model("Circle", circleSchema, "circles");
