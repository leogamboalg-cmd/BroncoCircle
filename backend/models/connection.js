import mongoose from "mongoose";
import { db } from "../db.js";

// Share db.js's client instead of opening another database connection.
const clientConnection = mongoose.createConnection();
export const modelConnection = clientConnection.useDb("MiniHacks");

export function connectModels() {
  if (db && clientConnection.readyState === 0) {
    clientConnection.setClient(db.client);
  }
}

// Models validate data without creating collections or indexes on startup.
export const schemaOptions = {
  autoCreate: false,
  autoIndex: false,
  bufferCommands: false,
};
