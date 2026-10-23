import { v2 as cloudinary } from "cloudinary";

export function isPostImageUrl(value) {
  if (typeof value !== "string" || value.length > 2048) return false;
  try {
    const url = new URL(value);
    const cloud = process.env.CLOUDINARY_CLOUD_NAME;
    return Boolean(cloud) && url.protocol === "https:" && url.hostname === "res.cloudinary.com"
      && !url.username && !url.password && !url.port && !url.search && !url.hash
      && url.pathname.startsWith(`/${cloud}/image/upload/`);
  } catch { return false; }
}

export function uploadImage(buffer, accountId) {
  const { CLOUDINARY_CLOUD_NAME: cloud_name, CLOUDINARY_API_KEY: api_key, CLOUDINARY_API_SECRET: api_secret } = process.env;
  if (!cloud_name || !api_key || !api_secret) {
    throw Object.assign(new Error("Cloudinary is not configured."), { status: 503 });
  }
  cloudinary.config({ cloud_name, api_key, api_secret, secure: true });
  return new Promise((resolve, reject) => {
    const stream = cloudinary.uploader.upload_stream({
      resource_type: "image", folder: `broncocircle/posts/${accountId}`,
      allowed_formats: ["jpg", "jpeg", "png", "webp"],
      timeout: 30000,
    }, (error, result) => {
      if (error) return reject(error);
      if (!isPostImageUrl(result?.secure_url)) return reject(new Error("Invalid upload response."));
      resolve(result.secure_url);
    });
    stream.on("error", reject);
    stream.end(buffer);
  });
}
