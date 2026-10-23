/*
SEARCH-ONLY PAGE. Push search.html, search.css, and search.js.
This script does not load app.js and does not change the profile page.

HANDOFF TO THE PROFILE/HOME TEAM:
1. Replace the existing Search button handler with navigation to search.html.
2. Handle index.html?student=<id> to display the selected student.
3. Handle index.html#event=<id> for campus event IDs, using the shared data/API.
4. Optional existing navbar destinations: ?tab=going and ?create=1.
The untouched profile code currently opens only its own known event IDs.
Student and new campus-event destinations require the teammate's routing.
Edit searchPageLinks below if the app uses different URLs.

The data below is a local demo for developing the search UI independently.
Replace the getProfiles/getEvents getters with your shared API when ready.
*/
const searchPageLinks = {
  home: 'index.html',
  ownProfile: 'index.html',
  going: 'index.html?tab=going',
  create: 'index.html?create=1',
  profile: person => person.profileUrl || `index.html?student=${encodeURIComponent(person.id)}`,
  event: event => event.eventUrl || `index.html#event=${encodeURIComponent(event.id)}`
};
const searchPageData = (() => {
  const storageKey = 'broncocircle-profile-v1';
  const defaultProfile = {name:'Johnny Park',handle:'johnnyonthequad',bio:'Collecting good memories, not just units. 🌱\nAlways down for a game, a trail, or one more coffee.'};
  const myHobbies = ['Games','Outdoors','Coffee'];
  const hobbyLabels = {Games:'Game nights',Outdoors:'The outdoors',Coffee:'Coffee runs',Creative:'Creative',Sports:'Sports'};
  const hobbyEmoji = {Games:'🎱',Outdoors:'☀️',Coffee:'☕',Creative:'🎨',Sports:'🏀'};
  const profiles = [
    {id:'alyssa',name:'Alyssa Lee',handle:'alyssa.afterclass',hobbies:['Games','Coffee'],pronouns:'she/her',initials:'AL',isFriend:true,bio:'A good game and an iced coffee.\nUsually somewhere around the BSC.'},
    {id:'marcus',name:'Marcus Kim',handle:'marcusonthetrail',hobbies:['Games','Outdoors'],pronouns:'he/him',initials:'MK',isFriend:true,bio:'Out on a trail or trying to clear the pool table.\nCome hang out after class.'},
    {id:'sofia',name:'Sofia Rivera',handle:'sofia.sips',hobbies:['Coffee','Creative'],pronouns:'she/her',initials:'SR',isFriend:false,bio:'Coffee runs between classes.\nAlways working on a new sketch.'},
    {id:'daniel',name:'Daniel Brooks',handle:'daniel.at.the.bric',hobbies:['Sports'],pronouns:'he/him',initials:'DB',isFriend:false,bio:'One more game before heading home.\nFind me on the basketball court.'}
  ];
  function localTime(date) {
    const parts = Object.fromEntries(new Intl.DateTimeFormat('en-US',{timeZone:'America/Los_Angeles',year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',hourCycle:'h23'}).formatToParts(date).map(part=>[part.type,part.value]));
    return {date:`${parts.year}-${parts.month}-${parts.day}`,time:`${parts.hour}:${parts.minute}`};
  }
  const tomorrow = localTime(new Date(Date.now()+86400000)).date;
  const start = localTime(new Date(Date.now()-30*60000));
  const end = localTime(new Date(Date.now()+60*60000));
  const campusEvents = [
    {id:'campus-bowling',title:'Bowling',hostId:'alyssa',category:'Games',date:tomorrow,start:'18:00',end:'20:00',location:'BSC Games Room',image:'bowling',count:3,capacity:8,description:'A few relaxed rounds of bowling after class. Come meet some new people; beginners are welcome.',note:'Meet by the front desk. Bring your Bronco ID! 🎳',cost:'Bring money for lane and shoe rental'},
    {id:'campus-basketball',title:'Basketball',hostId:'daniel',category:'Sports',date:tomorrow,start:'16:00',end:'18:00',location:'BRIC basketball courts',image:'basketball',count:6,capacity:10,description:'A casual pickup game with teams made when everyone arrives. All experience levels welcome.',note:'Bring your Bronco ID, gym shoes, and water. 🏀',cost:'Check BRIC access requirements'},
    {id:'campus-billiards',title:'Billiards',hostId:'marcus',category:'Games',date:start.date,start:start.time,endDate:end.date,end:end.time,location:'BSC Games Room',image:'pool',count:2,capacity:6,description:'A few relaxed games of pool between classes. Drop by for a round and meet some new people.',note:'We’re by the pool tables. Come say hi! 🎱',cost:'Bring money for table rental'}
  ];
  // Example listings for this page only. These do not replace app.js data.
  const profileEvents = [
  {id:'bowling-night',title:'Strikes & good vibes',category:'Games',date:'2026-10-24',start:'18:00',end:'20:00',location:'BSC Games Room',image:'bowling',imageAlt:'A bowler taking a shot in a colorful neon bowling alley',count:5,capacity:8,description:'A few rounds of bowling, a questionable victory dance, and some new campus friends. Come hang out at the BSC Games Room. No skills required — gutter balls are part of the experience.',note:'Bring your Bronco ID and a little friendly competition. Meet by the front desk! 🎳',cost:'Bring money for lane & shoe rental'},
  {id:'golden-hour-hike',title:'Chasing the golden hour',category:'Outdoors',date:'2026-10-25',start:'16:00',end:'18:00',location:'Campus trailhead',image:'hike',imageAlt:'Hikers on a mountain ridge in warm golden sunset light',count:6,capacity:12,description:'Let’s close the laptop and catch a sunset together. We’ll take a relaxed walk along the campus trails, stop for photos, and enjoy the view. All paces welcome — this is a hangout, not a race.',note:'Meet at the campus trailhead. Bring water, comfy shoes, and a light layer. 🌄',cost:'Free to join'},
  {id:'coffee-and-catchup',title:'Coffee, campus & catch-ups',category:'Coffee',date:'2026-10-26',start:'10:00',end:'11:30',location:'BSC café patio',image:'coffee',imageAlt:'Fresh pour-over coffee being prepared at a café',count:3,capacity:6,description:'Your Monday deserves a soft start. Grab your favorite drink and join us on the café patio for an easy conversation. Come solo, bring a friend, or just take a break between classes.',note:'Look for the green notebook on the table. First-timers especially welcome. ☕',cost:'Buy your own drink'}
];

  function savedState() {
    try {const saved=JSON.parse(localStorage.getItem(storageKey));return saved&&typeof saved==='object'?saved:{};}catch{return {};}
  }
  function myProfile() {
    const saved=savedState().profile;
    return saved&&typeof saved.name==='string'&&typeof saved.handle==='string'&&typeof saved.bio==='string'?saved:defaultProfile;
  }
  function allEvents() {
    const saved=savedState();
    const custom=Array.isArray(saved.custom)?saved.custom.filter(event=>event&&typeof event.id==='string'&&typeof event.title==='string'&&typeof event.date==='string'&&typeof event.start==='string'&&typeof event.end==='string'):[];
    return [...profileEvents,...custom].map(event=>({...event,hostName:myProfile().name})).concat(campusEvents);
  }
  return {storageKey,myHobbies,hobbyLabels,hobbyEmoji,profiles,profileEvents,campusEvents,myProfile,allEvents};
})();

/* Search only: no profile markup, home page, or navbar replacement. */
function createCampusSearch({
  root,
  input,
  getHobbies,
  getProfiles,
  getEvents,
  onProfileSelect,
  onEventSelect,
  onChange = () => {},
  timeZone = 'America/Los_Angeles'
}) {
  const results = root.querySelector('[role="tabpanel"]');
  const status = root.querySelector('[data-search-status]');
  const tabs = [...root.querySelectorAll('[data-search-mode]')];
  const controller = new AbortController();
  const { signal } = controller;
  let mode = 'friends';

  const normalize = value => String(value ?? '').trim().toLowerCase();
  const hobbies = profile => (profile.hobbies || []).map(normalize);
  const initials = name => String(name || '').split(/\s+/).filter(Boolean)
    .slice(0, 2).map(word => word[0]).join('').toUpperCase();

  function node(tag, className, text) {
    const element = document.createElement(tag);
    element.className = className;
    if (text !== undefined) element.textContent = text;
    return element;
  }

  function nowKey() {
    const parts = Object.fromEntries(new Intl.DateTimeFormat('en-US', {
      timeZone, year:'numeric', month:'2-digit', day:'2-digit',
      hour:'2-digit', minute:'2-digit', hourCycle:'h23'
    }).formatToParts(new Date()).map(part => [part.type, part.value]));
    return `${parts.year}-${parts.month}-${parts.day}T${parts.hour}:${parts.minute}`;
  }

  function row(title, avatar, callback) {
    const button = node('button', 'campus-search-row');
    button.type = 'button';
    const copy = node('span', 'campus-search-copy');
    copy.append(node('span', 'campus-search-name', title));
    button.append(node('span', 'campus-search-avatar', avatar), copy);
    button.addEventListener('click', callback, { signal });
    return { button, copy };
  }

  function render() {
    const query = normalize(input.value);
    const mine = new Set(getHobbies().map(normalize));
    const people = getProfiles();
    const peopleById = new Map(people.map(person => [person.id, person]));
    const shared = person => (person.hobbies || []).filter(hobby => mine.has(normalize(hobby)));
    const matches = value => normalize(value).includes(query);
    const fragment = document.createDocumentFragment();
    let visible;

    if (mode === 'friends') {
      visible = people.filter(person => shared(person).length > 0 &&
        matches(`${person.name} ${person.handle} ${hobbies(person).join(' ')}`))
        .sort((a,b) => shared(b).length - shared(a).length || a.name.localeCompare(b.name));

      visible.forEach(person => {
        const { button, copy } = row(`@${String(person.handle).replace(/^@/, '')}`,
          initials(person.name), () => onProfileSelect(person));
        const tags = node('span', 'campus-search-hobbies');
        shared(person).forEach(hobby => tags.append(node('span', 'campus-search-hobby', hobby)));
        copy.append(tags);
        fragment.append(button);
      });
    } else {
      const now = nowKey();
      const host = event => peopleById.get(event.hostId);
      const friend = event => host(event)?.isFriend === true;
      const startKey = event => `${event.date}T${event.start}`;
      const endKey = event => `${event.endDate || event.date}T${event.end}`;

      visible = getEvents().filter(event => endKey(event) >= now &&
        matches(`${event.title} ${event.location} ${event.category || ''} ${host(event)?.name || event.hostName || ''}`))
        .sort((a,b) => Number(friend(b)) - Number(friend(a)) || startKey(a).localeCompare(startKey(b)));

      visible.forEach(event => {
        const person = host(event);
        const name = person?.name || event.hostName || 'Campus student';
        const { button, copy } = row(event.title, initials(event.title), () => onEventSelect(event));
        button.dataset.friend = String(friend(event));
        const live = startKey(event) <= now;
        const time = value => new Date(`2000-01-01T${value}`).toLocaleTimeString('en-US',{hour:'numeric',minute:'2-digit'}).replace(':00','');
        const date = new Date(`${event.date}T12:00:00`).toLocaleDateString('en-US',{weekday:'short',month:'short',day:'numeric'});
        const when = live ? `Happening now · ends ${time(event.end)}` : `${date} · ${time(event.start)}–${time(event.end)}`;
        copy.append(node('span', 'campus-search-meta', `${friend(event) ? 'Friend · ' : ''}${name} · ${event.location}`));
        copy.append(node('span', 'campus-search-meta', when));
        fragment.append(button);
      });
    }

    if (!visible.length) fragment.append(node('p', 'campus-search-empty',
      mode === 'friends' ? 'No matching profiles found.' : 'No current events found.'));
    results.replaceChildren(fragment);
    results.setAttribute('aria-labelledby', tabs.find(tab => tab.dataset.searchMode === mode).id);
    status.textContent = `${visible.length} ${mode === 'friends' ? 'profiles' : 'events'} found.`;
    input.placeholder = `Search ${mode}`;
    input.setAttribute('aria-label', `Search ${mode}`);
    onChange({mode,query:input.value});
  }

  function setTab(next) {
    if (!['friends', 'events'].includes(next)) return;
    mode = next;
    tabs.forEach(tab => {
      const active = tab.dataset.searchMode === mode;
      tab.setAttribute('aria-selected', String(active));
      tab.tabIndex = active ? 0 : -1;
    });
    render();
  }

  input.addEventListener('input', render, { signal });
  tabs.forEach(tab => {
    tab.addEventListener('click', () => setTab(tab.dataset.searchMode), { signal });
    tab.addEventListener('keydown', event => {
      if (!['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key)) return;
      event.preventDefault();
      const next = event.key === 'Home' ? 'friends' : event.key === 'End' ? 'events'
        : mode === 'friends' ? 'events' : 'friends';
      setTab(next);
      tabs.find(item => item.dataset.searchMode === next).focus();
    }, { signal });
  });
  let touchStart;
  root.addEventListener('touchstart', event => {
    touchStart = event.touches.length === 1 ? event.touches[0] : null;
  }, { passive:true, signal });
  root.addEventListener('touchend', event => {
    if (!touchStart) return;
    const dx = event.changedTouches[0].clientX - touchStart.clientX;
    const dy = event.changedTouches[0].clientY - touchStart.clientY;
    touchStart = null;
    if (Math.abs(dx) > 70 && Math.abs(dx) > Math.abs(dy) * 1.5) {
      if (event.cancelable) event.preventDefault();
      setTab(dx < 0 ? 'events' : 'friends');
    }
  }, { passive:false, signal });
  root.addEventListener('touchcancel', () => { touchStart = null; }, { signal });
  render();
  return { render, setTab, destroy: () => controller.abort() };
}

/* Initialize only this standalone search page; links use the handoff URLs above. */
if (document.getElementById('campus-search')) {
  const data = searchPageData;
  const input = document.getElementById('search');
  const options = new URLSearchParams(location.search);
  const initialMode = options.get('mode') === 'events' ? 'events' : 'friends';
  input.value = options.get('q') || '';

  const campusSearch = createCampusSearch({
    root:document.getElementById('campus-search'),
    input,
    getHobbies:()=>data.myHobbies,
    getProfiles:()=>data.profiles,
    getEvents:()=>data.allEvents(),
    onProfileSelect:person=>location.assign(searchPageLinks.profile(person)),
    onEventSelect:event=>location.assign(searchPageLinks.event(event)),
    onChange:({mode,query})=>{
      const params = new URLSearchParams();
      if(mode==='events')params.set('mode','events');
      if(query.trim())params.set('q',query.trim());
      try{history.replaceState(null,'',`${location.pathname}${params.size?'?'+params:''}`);}catch{/* Direct file previews may limit history updates. */}
      document.title=`Find ${mode} · BroncoCircle`;
    }
  });
  campusSearch.setTab(initialMode);
  document.getElementById('nav-search').addEventListener('click',()=>input.focus());
  document.getElementById('nav-create').addEventListener('click',()=>location.assign(searchPageLinks.create));
  document.querySelectorAll('[data-nav]').forEach(button=>button.addEventListener('click',()=>{
    location.assign(button.dataset.nav==='going'?searchPageLinks.going:button.dataset.nav==='explore'?searchPageLinks.home:searchPageLinks.ownProfile);
  }));
  document.addEventListener('keydown',event=>{
    if(event.key==='/'&&!['INPUT','TEXTAREA','SELECT'].includes(document.activeElement.tagName)){
      event.preventDefault();input.focus();
    }
  });
  // Refresh time-sensitive results after returning to this page with Back.
  window.addEventListener('pageshow',event=>{if(event.persisted)campusSearch.render();});
}
