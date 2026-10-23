(() => {
  const $ = id => document.getElementById(id);
  const id = new URLSearchParams(location.search).get("id");
  const validId = /^[a-f0-9]{24}$/i.test(id || "");
  let current;
  let busy = false;
  const status = message => { $("event-status").textContent = message; };
  const formatTime = value => new Date(value).toLocaleString("en-US", {
    timeZone: "America/Los_Angeles", weekday: "short", month: "short", day: "numeric", year: "numeric",
    hour: "numeric", minute: "2-digit", timeZoneName: "short",
  });
  $("event-login").href = validId ? `/?event=${id}` : "/";

  function controls() {
    $("event-refresh").disabled = busy || !validId;
    $("event-rsvp").disabled = busy || !current || (!current.isGoing && current.spotsRemaining === 0);
  }

  async function request(method = "GET") {
    const token = sessionStorage.getItem("broncocircle-token");
    if (!token) throw Object.assign(new Error("Log in to view this event."), { status: 401 });
    const response = await fetch(`/api/posts/${id}${method === "GET" ? "" : "/rsvp"}`, {
      method, headers: { Authorization: `Bearer ${token}` }, signal: AbortSignal.timeout(20000),
    });
    const post = await response.json();
    if (!response.ok) throw Object.assign(new Error(post.error || "Could not load this event."), { status: response.status });
    return post;
  }

  function render(post) {
    if (!post.event) throw new Error("This post is not an event. Return to the feed to view it.");
    current = post;
    const event = post.event;
    document.title = `${event.title} · BroncoCircle`;
    $("event-title").textContent = event.title;
    $("event-host").textContent = `Hosted by ${post.author?.name || "a student"}`;
    $("event-category").textContent = event.category || "";
    $("event-category").hidden = !event.category;
    $("event-time").textContent = `${formatTime(event.dateTime)}${event.endTime ? ` – ${formatTime(event.endTime)}` : ""}`;
    $("event-location").textContent = event.location;
    $("event-description").textContent = post.text;
    $("event-note").textContent = event.hostNote || "";
    $("event-note").hidden = !event.hostNote;
    $("event-attendance").textContent = event.capacity == null
      ? `${post.attendeeCount} going · Open attendance`
      : `${post.attendeeCount} of ${event.capacity} spots filled · ${post.spotsRemaining} spots left`;
    $("event-cover").hidden = !post.imageUrl;
    if (post.imageUrl) { $("event-cover").src = post.imageUrl; $("event-cover").alt = event.title; }
    else $("event-cover").removeAttribute("src");
    $("event-attendees").replaceChildren();
    for (const profile of event.attendees || []) {
      const item = document.createElement("li");
      if (profile.avatarUrl) {
        const image = document.createElement("img"); image.src = profile.avatarUrl; image.alt = ""; item.append(image);
      }
      item.append(document.createTextNode(profile.name || "Student"));
      $("event-attendees").append(item);
    }
    if (!event.attendees?.length) {
      const empty = document.createElement("li"); empty.textContent = "Be the first to join."; $("event-attendees").append(empty);
    }
    $("event-rsvp").textContent = post.isGoing ? "You're going · Cancel RSVP" : post.spotsRemaining === 0 ? "Event is full" : "RSVP";
    $("event-login").hidden = true;
    $("event-detail").hidden = false;
    controls();
  }

  function showError(error) {
    status(error.message || "Request failed. Please try again.");
    if ([401, 403].includes(error.status)) {
      current = undefined; $("event-detail").hidden = true; $("event-login").hidden = false;
    }
  }

  async function load() {
    if (!validId) { status("This event link is invalid. Open an event from the feed."); controls(); return; }
    if (busy) return;
    busy = true; controls(); status("Loading event…");
    try { render(await request()); status(current.isGoing ? "You're on the list." : "Event details are up to date."); }
    catch (error) { current = undefined; $("event-detail").hidden = true; showError(error); }
    finally { busy = false; controls(); }
  }

  $("event-rsvp").onclick = async () => {
    if (busy || !current) return;
    const cancelling = current.isGoing;
    busy = true; controls(); status(cancelling ? "Cancelling RSVP…" : "Saving RSVP…");
    try { render(await request(cancelling ? "DELETE" : "PUT")); status(cancelling ? "RSVP cancelled." : "You're on the list!"); }
    catch (error) {
      if (error.status === 409) {
        try { render(await request()); } catch (refreshError) { showError(refreshError); }
      }
      showError(error);
    } finally { busy = false; controls(); }
  };
  $("event-refresh").onclick = load;
  load();
})();
