import { uploadImage } from "../services/imageService.js";

export async function uploadPostImage(req, res) {
  try {
    const imageUrl = await uploadImage(req.file.buffer, req.account._id.toString());
    return res.status(201).json({ imageUrl });
  } catch (error) {
    // Do not expose SDK errors, credentials, or signed request details.
    if (error.status === 503) return res.status(503).json({ error: "Image uploads are not configured." });
    if (error.http_code === 400) return res.status(400).json({ error: "Cloudinary could not decode this image." });
    return res.status(502).json({ error: "Image upload failed. Please try again." });
  }
}
