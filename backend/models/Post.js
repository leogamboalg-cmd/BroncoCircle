import { Schema } from "mongoose";
import { modelConnection, schemaOptions } from "./connection.js";
import { isPostImageUrl } from "../services/imageService.js";

const commentSchema = new Schema({
  author: { type: Schema.Types.ObjectId, ref: "Profile", required: true },
  text: { type: String, required: true, trim: true },
  createdAt: { type: Date, default: Date.now, required: true },
});

const eventSchema = new Schema({
  title: { type: String, required: true, trim: true },
  location: { type: String, required: true, trim: true },
  dateTime: { type: Date, required: true },
  endTime: { type: Date, validate: {
    validator: function (value) { return value == null || value > this.dateTime; },
    message: "Event endTime must be after dateTime.",
  } },
  capacity: { type: Number, default: null, min: 1,
    validate: { validator: value => value == null || Number.isSafeInteger(value), message: "Capacity must be a positive integer." } },
  attendees: [{ type: Schema.Types.ObjectId, ref: "Profile" }],
  category: { type: String, trim: true, maxlength: 80 },
  hostNote: { type: String, trim: true, maxlength: 500 },
  image: { type: String, enum: ["bowling", "billiards", "indoorsoccer", "hike", "coffee", "pool", "art", "basketball", "guitar", "photography", "picnic"] },
  imageAlt: { type: String, trim: true, maxlength: 200 },
  cost: { type: String, trim: true, maxlength: 200 },
}, { _id: false });

const postSchema = new Schema({
  imageUrl: { type: String, validate: { validator: value => value == null || isPostImageUrl(value), message: "Use the secure URL returned by image upload." } },
  author: { type: Schema.Types.ObjectId, ref: "Profile", required: true },
  text: { type: String, required: true, trim: true },
  createdAt: { type: Date, default: Date.now, required: true },
  likes: [{ type: Schema.Types.ObjectId, ref: "Profile", required: true }],
  comments: [commentSchema],
  event: { type: eventSchema, default: undefined },
}, schemaOptions);

export default modelConnection.model("Post", postSchema, "posts");
