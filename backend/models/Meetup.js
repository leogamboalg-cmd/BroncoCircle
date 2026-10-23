import { Schema } from "mongoose";
import { modelConnection, schemaOptions } from "./connection.js";

// Each vote records a profile and the proposed time they chose.
const voteSchema = new Schema({
  profile: { type: Schema.Types.ObjectId, ref: "Profile", required: true },
  time: { type: Date, required: true },
}, { _id: false });

const meetupSchema = new Schema({
  circle: { type: Schema.Types.ObjectId, ref: "Circle", required: true },
  location: { type: String, required: true, trim: true },
  proposedTimes: {
    type: [{ type: Date, required: true }],
    validate: { validator: (times) => times.length > 0, message: "Propose at least one time." },
  },
  votes: [voteSchema],
}, schemaOptions);

export default modelConnection.model("Meetup", meetupSchema, "meetups");
