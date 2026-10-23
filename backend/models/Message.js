import { Schema } from "mongoose";
import { modelConnection, schemaOptions } from "./connection.js";

const messageSchema = new Schema({
  circle: { type: Schema.Types.ObjectId, ref: "Circle", required: true },
  author: { type: Schema.Types.ObjectId, ref: "Profile", required: true },
  text: { type: String, required: true, trim: true },
  createdAt: { type: Date, default: Date.now, required: true },
}, schemaOptions);

export default modelConnection.model("Message", messageSchema, "messages");
