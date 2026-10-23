import multer from "multer";

const parser = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024, files: 1, fields: 0, parts: 1 },
  fileFilter(req, file, callback) {
    if (!["image/jpeg", "image/png", "image/webp"].includes(file.mimetype)) {
      return callback(new Error("Choose a JPEG, PNG, or WebP image."));
    }
    callback(null, true);
  },
}).single("image");

export function imageUpload(req, res, next) {
  parser(req, res, error => {
    if (error) return res.status(error.code === "LIMIT_FILE_SIZE" ? 413 : 400)
      .json({ error: error.code === "LIMIT_FILE_SIZE" ? "Image must be 5 MB or smaller." : "Send one JPEG, PNG, or WebP file in the image field." });
    if (!req.file) return res.status(400).json({ error: "An image file is required." });
    const b = req.file.buffer;
    // Inspect bytes as well as MIME; Cloudinary then decodes/validates the image.
    const jpeg = b.length >= 3 && b[0] === 255 && b[1] === 216 && b[2] === 255;
    const png = b.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]));
    const webp = b.length >= 12 && b.toString("ascii", 0, 4) === "RIFF" && b.toString("ascii", 8, 12) === "WEBP";
    if (!jpeg && !png && !webp) return res.status(400).json({ error: "File is not a supported image." });
    return next();
  });
}
