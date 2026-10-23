// Same-origin API only. Matching decisions and account identity stay on the server.
(() => {
  const feed = document.getElementById("feed");
  const section = document.createElement("section");
  section.innerHTML = `
    <h2>Find My Circle</h2>
    <p>Meet students who share your interests and at least 30 minutes of free time. Availability uses campus local time.</p>
    <form id="matching-settings">
      <label>Interests (comma separated)<input name="interests" placeholder="soccer, gaming, studying" maxlength="500"></label>
      <label><input name="enabled" type="checkbox" style="display:inline;width:auto"> Let other students find me through matching</label>
      <p>Your interests, name, major, and shared free time are used in suggestions. Joining a circle is your choice.</p>
      <div id="matching-slots"></div>
      <button type="button" id="matching-add-slot">Add free time</button>
      <button>Save matching preferences</button>
    </form>
    <button id="matching-refresh">Find matches / refresh</button>
    <p id="matching-status" role="status" aria-live="polite"></p>
    <h3>Suggested groups</h3><div id="matching-results"></div>
    <h3>Invitations</h3><div id="matching-invitations"></div>
    <h3>My circles</h3><div id="matching-circles"></div>`;
  feed.prepend(section);
  const find = id => document.getElementById(id);
  const form = find("matching-settings");
  const note = text => { find("matching-status").textContent = text; };
  const days = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];
  async function request(path, method = "GET", body) {
    const token = sessionStorage.getItem("broncocircle-token");
    const response = await fetch(`/api${path}`, {
      method, headers: { Authorization: `Bearer ${token}`, ...(body ? { "Content-Type": "application/json" } : {}) },
      body: body ? JSON.stringify(body) : undefined,
    });
    const data = await response.json();
    if (!response.ok) throw new Error(data.error || "Request failed.");
    return data;
  }
  function addSlot(slot = {}) {
    if (find("matching-slots").children.length >= 21) return note("Use up to 21 time blocks.");
    const row = document.createElement("div");
    const dayLabel = document.createElement("label"); dayLabel.textContent = "Day";
    const day = document.createElement("select"); day.setAttribute("aria-label", "Available day");
    for (const value of days) day.add(new Option(value, value));
    day.value = slot.day || "Monday"; dayLabel.append(day);
    const startLabel = document.createElement("label"); startLabel.textContent = "From";
    const start = document.createElement("input"); start.type = "time"; start.required = true; start.value = slot.start || "12:00";
    startLabel.append(start);
    const endLabel = document.createElement("label"); endLabel.textContent = "Until";
    const end = document.createElement("input"); end.type = "time"; end.required = true; end.value = slot.end || "13:00";
    endLabel.append(end);
    const remove = document.createElement("button"); remove.type = "button"; remove.textContent = "Remove time";
    remove.onclick = () => row.remove();
    row.append(dayLabel, startLabel, endLabel, remove);
    row.getSlot = () => ({ day: day.value, start: start.value, end: end.value });
    find("matching-slots").append(row);
  }
  find("matching-add-slot").onclick = () => addSlot();
  function card(parent, title, text, action, callback) {
    const article = document.createElement("article");
    const heading = document.createElement("strong"); heading.textContent = title;
    const description = document.createElement("p"); description.textContent = text;
    article.append(heading, description);
    if (callback) {
      const button = document.createElement("button"); button.textContent = action;
      button.onclick = async () => {
        button.disabled = true;
        try { await callback(); await refresh(); }
        catch (error) { note(error.message); }
        finally { button.disabled = false; }
      };
      article.append(button);
    }
    parent.append(article);
  }
  async function refresh() {
    note("Finding circles…");
    const profile = await request("/profiles/me");
    const [invitations, circles, matches] = await Promise.all([
      request("/circles/invitations"), request("/circles"),
      profile.matchingEnabled ? request("/circles/suggestions") : Promise.resolve({ suggestions: [], message: "Opt in and save your preferences to find matches." }),
    ]);
    for (const id of ["matching-results", "matching-invitations", "matching-circles"]) find(id).replaceChildren();
    for (const group of matches.suggestions) {
      card(find("matching-results"), group.members.map(p => p.name).join(", "),
        `${group.reason}${group.smallGroup ? " Small group: fewer than 4 students are available." : ""}`,
        "Accept & join", () => request("/circles", "POST", { candidateIds: group.candidateIds }));
    }
    for (const circle of invitations) {
      card(find("matching-invitations"), circle.name, `${circle.members.length} joined. ${circle.sharedInterests.join(", ")}`,
        "Join circle", () => request(`/circles/${circle._id}/join`, "POST"));
    }
    for (const circle of circles) {
      card(find("matching-circles"), circle.name, `Joined: ${circle.members.map(p => p.name).join(", ")}. Circle ID: ${circle._id}`);
    }
    note(matches.message || "Suggestions ready. Only you join when you accept; other students decide for themselves.");
  }
  form.onsubmit = async event => {
    event.preventDefault();
    const availability = [...find("matching-slots").children].map(row => row.getSlot());
    if (availability.some(slot => slot.end <= slot.start)) return note("Each end time must be after its start time.");
    const button = form.querySelector('button:not([type="button"])');
    button.disabled = true;
    try {
      await request("/profiles/me", "PATCH", {
        interests: [...new Set(form.elements.interests.value.split(",").map(s => s.trim()).filter(Boolean))],
        matchingEnabled: form.elements.enabled.checked, availability,
      });
      await refresh();
    } catch (error) { note(error.message); }
    finally { button.disabled = false; }
  };
  find("matching-refresh").onclick = () => refresh().catch(error => note(error.message));
  async function initialize() {
    if (feed.hidden) return;
    try {
      const profile = await request("/profiles/me");
      form.elements.interests.value = profile.interests.join(", ");
      form.elements.enabled.checked = Boolean(profile.matchingEnabled);
      find("matching-slots").replaceChildren();
      for (const slot of profile.availability) addSlot(slot);
      await refresh();
    } catch (error) { note(error.message); }
  }
  new MutationObserver(() => { if (feed.hidden) {
    form.reset(); find("matching-slots").replaceChildren();
    for (const id of ["matching-results", "matching-invitations", "matching-circles"]) find(id).replaceChildren();
    note("");
  } else initialize(); }).observe(feed, { attributes: true, attributeFilter: ["hidden"] });
  initialize();
})();
