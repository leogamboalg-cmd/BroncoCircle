import { Schema } from "mongoose";
import { modelConnection, schemaOptions } from "./connection.js";

const postSchema = new Schema({
  author: { type: Schema.Types.ObjectId, ref: "Profile", required: true },
  text: { type: String, required: true, trim: true },
  createdAt: { type: Date, default: Date.now, required: true },
}, schemaOptions);

export default modelConnection.model("Post", postSchema, "posts");
