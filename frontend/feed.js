const $ = id => document.getElementById(id);
let token = sessionStorage.getItem("broncocircle-token") || "";
let previewUrl;
let uploadedUrl;
const status = message => { $("status").textContent = message; };

async function api(path, options = {}) {
  const headers = { ...(token ? { Authorization: `Bearer ${token}` } : {}) };
  if (options.body && !(options.body instanceof FormData)) {
    headers["Content-Type"] = "application/json";
    options.body = JSON.stringify(options.body);
  }
  const response = await fetch(`/api${path}`, { ...options, headers });
  const data = await response.json();
  if (!response.ok) throw Object.assign(new Error(data.error || "Request failed."), { status: response.status });
  return data;
}

function clearImage() {
  if (previewUrl) URL.revokeObjectURL(previewUrl);
  previewUrl = undefined;
  uploadedUrl = undefined;
  $("image").value = "";
  $("preview").removeAttribute("src");
  $("preview").hidden = $("remove-image").hidden = true;
}

$("image").addEventListener("change", () => {
  if (previewUrl) URL.revokeObjectURL(previewUrl);
  uploadedUrl = undefined;
  const file = $("image").files[0];
  if (!file) return clearImage();
  if (!["image/jpeg", "image/png", "image/webp"].includes(file.type) || file.size > 5 * 1024 * 1024) {
    clearImage(); return status("Choose a JPEG, PNG, or WebP image of 5 MB or smaller.");
  }
  previewUrl = URL.createObjectURL(file);
  $("preview").src = previewUrl;
  $("preview").hidden = $("remove-image").hidden = false;
});
$("remove-image").onclick = clearImage;

async function loadFeed() {
  const posts = await api("/posts");
  $("posts").replaceChildren();
  if (!posts.length) $("posts").textContent = "No posts yet. Start the conversation!";
  for (const post of posts) {
    const card = document.createElement("article");
    const author = document.createElement("strong");
    author.textContent = post.author?.name || "Student";
    const time = document.createElement("time");
    time.dateTime = post.createdAt;
    time.textContent = new Date(post.createdAt).toLocaleString();
    const text = document.createElement("p");
    text.textContent = post.text;
    card.append(author, time, text);
    if (post.imageUrl) {
      const image = document.createElement("img");
      image.src = post.imageUrl;
      image.alt = `Photo shared by ${post.author?.name || "a student"}`;
      image.loading = "lazy";
      card.append(image);
    }
    $("posts").append(card);
  }
}

async function openSession() {
  const { account } = await api("/auth/me");
  $("auth").hidden = true;
  $("logout").hidden = false;
  try {
    await api("/profiles/me");
    $("setup").hidden = true;
    $("feed").hidden = false;
    await loadFeed();
    status(`Logged in as ${account.name}.`);
  } catch (error) {
    if (error.status !== 404) throw error;
    $("setup").hidden = false;
    $("profile-form").elements.name.value = account.name;
    status("Create your profile to start posting.");
  }
}

$("account-form").onsubmit = async event => {
  event.preventDefault();
  const form = event.currentTarget;
  const buttons = [...form.querySelectorAll("button")];
  buttons.forEach(button => { button.disabled = true; });
  try {
    const data = Object.fromEntries(new FormData(form));
    const session = await api(`/auth/${event.submitter.value}`, { method: "POST", body: data });
    token = session.token;
    sessionStorage.setItem("broncocircle-token", token);
    form.reset();
    await openSession();
  } catch (error) { status(error.message); }
  finally { buttons.forEach(button => { button.disabled = false; }); }
};
$("profile-form").onsubmit = async event => {
  event.preventDefault();
  try {
    await api("/profiles", { method: "POST", body: Object.fromEntries(new FormData(event.currentTarget)) });
    await openSession();
  } catch (error) { status(error.message); }
};
$("post-form").onsubmit = async event => {
  event.preventDefault();
  const text = event.currentTarget.elements.text.value.trim();
  if (!text) return status("Please write some text for your post.");
  const controls = [...event.currentTarget.elements];
  controls.forEach(control => { control.disabled = true; });
  try {
    const file = $("image").files[0];
    if (file && !uploadedUrl) {
      status("Uploading photo…");
      const body = new FormData();
      body.append("image", file);
      uploadedUrl = (await api("/uploads/image", { method: "POST", body })).imageUrl;
    }
    await api("/posts", { method: "POST", body: { text, ...(uploadedUrl ? { imageUrl: uploadedUrl } : {}) } });
    $("post-form").reset();
    clearImage();
    status("Post published.");
    await loadFeed();
  } catch (error) { status(error.message); }
  finally { controls.forEach(control => { control.disabled = false; }); }
};
$("refresh").onclick = () => loadFeed().catch(error => status(error.message));
$("logout").onclick = () => {
  token = "";
  sessionStorage.removeItem("broncocircle-token");
  clearImage();
  $("posts").replaceChildren();
  $("post-form").reset();
  $("auth").hidden = false;
  $("feed").hidden = $("setup").hidden = $("logout").hidden = true;
  status("Logged out on this device.");
};
if (token) openSession().catch(error => {
  if (error.status === 401) { token = ""; sessionStorage.removeItem("broncocircle-token"); }
  status(error.message);
});
