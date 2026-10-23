import express from "express";
import profiles from "./routes/profiles.js";
import posts from "./routes/posts.js";
import ai from "./routes/ai.js";
import auth from "./routes/auth.js";
import circles from "./routes/circles.js";
import meetups from "./routes/meetups.js";
import uploads from "./routes/uploads.js";
import { fileURLToPath } from "node:url";
import { connectDB } from "./db.js";
import { connectModels } from "./models/index.js";

const app = express();
app.use(express.json());
app.use(express.static(fileURLToPath(new URL("../frontend/", import.meta.url))));

// Connect each URL to its route file.
app.get("/", (req, res) => {
  res.json({ message: "BroncoCircle API is running" });
});
app.get("/api/health", (req, res) => res.json({ status: "ok" }));
app.use("/api/profiles", profiles);
app.use("/api/posts", posts);
app.use("/api/ai", ai);
app.use("/api/auth", auth);
app.use("/api/circles", circles);
app.use("/api/meetups", meetups);
app.use("/api/uploads", uploads);

const port = process.env.PORT || 3000;
try {
  await connectDB();
  connectModels();
} catch {
  console.error("MongoDB connection failed. Check MONGODB_URI and database access.");
  process.exit(1);
}

app.listen(port, (error) => {
  if (error) {
    console.error(
      error.code === "EADDRINUSE"
        ? `Port ${port} is already in use. Stop the other server with Ctrl+C, then try again.`
        : `Server failed to start: ${error.message}`,
    );
    process.exit(1);
  }
  console.log(`Server running at http://localhost:${port}`);
});
