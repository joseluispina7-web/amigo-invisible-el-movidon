const api = location.hostname.endsWith('.github.io')
  ? 'https://amigoinvisiblemovidon.cabledlute2.chatgpt.site/api'
  : '/api';
const byId = id => document.getElementById(id);

async function request(path, options) {
  const response = await fetch(api + path, options);
  const data = await response.json();
  if (!response.ok) throw new Error(data.error || 'No se pudo completar la operación.');
  return data;
}

const signup = byId('signup');

async function loadRoster() {
  try {
    const { names, closed } = await request('/participants');
    byId('count').textContent = names.length;
    byId('roster').replaceChildren(...names.map(name => {
      const item = document.createElement('li');
      item.textContent = name;
      return item;
    }));
    byId('roster-status').textContent = names.length ? '' : 'Todavía no hay participantes.';
    byId('refresh').hidden = true;
    signup.hidden = closed;
    if (closed) byId('signup-status').textContent = 'Las inscripciones están cerradas. El resultado se enviará por correo.';
  } catch {
    byId('roster-status').textContent = 'La lista no está disponible en este momento.';
    byId('refresh').hidden = false;
  }
}

byId('refresh').addEventListener('click', loadRoster);
signup.addEventListener('submit', async event => {
  event.preventDefault();
  const button = signup.querySelector('button');
  const status = byId('signup-status');
  button.disabled = true;
  status.textContent = 'Guardando tu inscripción…';
  try {
    await request('/participants', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(Object.fromEntries(new FormData(signup)))
    });
    signup.reset();
    status.textContent = '¡Ya estás en la lista!';
    await loadRoster();
  } catch (error) {
    status.textContent = error.message;
  } finally {
    button.disabled = false;
  }
});

let organizerKey = '';
const organizerStatus = byId('organizer-status');

function openPanel({ count, matches }) {
  byId('panel').hidden = false;
  byId('summary').textContent = count + (count === 1 ? ' persona inscrita.' : ' personas inscritas.');
  byId('draw').hidden = Boolean(matches);
  byId('draw').disabled = count < 2;
  if (!matches) return;
  organizerStatus.textContent = 'Abre un borrador por participante y confirma cada envío en tu aplicación de correo.';
  byId('messages').replaceChildren(...matches.map(person => {
    const item = document.createElement('div');
    item.className = 'message';
    const name = document.createElement('strong');
    name.textContent = person.name;
    const link = document.createElement('a');
    link.className = 'mail';
    link.textContent = 'Abrir correo';
    link.setAttribute('aria-label', 'Abrir correo para ' + person.name);
    const body = [
      '¡Hola, ' + person.name + '!', '',
      'En el amigo invisible «El Movidón» te ha tocado regalar a ' + person.recipient + '.',
      'El intercambio será el 26 de diciembre de 2026.',
      '', '¡Guárdate la sorpresa!'
    ].join('\r\n');
    link.href = 'mailto:' + encodeURIComponent(person.email).replace('%40', '@') +
      '?subject=' + encodeURIComponent('Tu amigo invisible · El Movidón') +
      '&body=' + encodeURIComponent(body);
    item.append(name, link);
    return item;
  }));
}

byId('login').addEventListener('submit', async event => {
  event.preventDefault();
  const input = byId('key');
  const submittedKey = input.value.trim();
  organizerStatus.textContent = '';
  try {
    const data = await request('/organizer', { headers: { Authorization: 'Bearer ' + submittedKey } });
    organizerKey = submittedKey;
    input.value = '';
    byId('login').hidden = true;
    openPanel(data);
  } catch (error) {
    organizerStatus.textContent = error.message;
  }
});

byId('draw').addEventListener('click', async event => {
  if (!confirm('Se cerrarán las inscripciones y se guardará el resultado. ¿Hacer el sorteo?')) return;
  const button = event.currentTarget;
  button.disabled = true;
  try {
    openPanel(await request('/organizer', { method: 'POST', headers: { Authorization: 'Bearer ' + organizerKey } }));
  } catch (error) {
    organizerStatus.textContent = error.message;
    button.disabled = false;
  }
});

if (new URLSearchParams(location.search).has('organizar')) {
  byId('public').hidden = true;
  byId('organizer').hidden = false;
  byId('panel-link').href = './';
  byId('panel-link').textContent = 'Volver a la inscripción';
} else {
  loadRoster();
}

const video = byId('christmas-video');
const videoToggle = byId('video-toggle');
const music = byId('christmas-music');
const musicToggle = byId('music-toggle');
const reduceMotion = matchMedia('(prefers-reduced-motion: reduce)');

function syncVideoControl() {
  videoToggle.setAttribute('aria-label', video.paused ? 'Reproducir vídeo' : 'Pausar vídeo');
  videoToggle.firstElementChild.textContent = video.paused ? '▶' : 'Ⅱ';
}

function playVideo() {
  video.play().catch(syncVideoControl);
}

videoToggle.hidden = false;
video.addEventListener('play', syncVideoControl);
video.addEventListener('pause', syncVideoControl);
videoToggle.addEventListener('click', () => {
  if (video.paused) playVideo();
  else video.pause();
});
if (!reduceMotion.matches) playVideo();
reduceMotion.addEventListener('change', event => {
  if (event.matches) video.pause();
});

function syncMusicControl() {
  musicToggle.setAttribute('aria-pressed', String(!music.paused));
  byId('music-label').textContent = music.paused ? 'Activar música' : 'Pausar música';
}

music.addEventListener('play', syncMusicControl);
music.addEventListener('pause', syncMusicControl);
musicToggle.addEventListener('click', async () => {
  if (!music.paused) {
    music.pause();
    return;
  }
  try {
    await music.play();
  } catch (error) {
    if (error.name !== 'AbortError') byId('music-label').textContent = 'Reintentar música';
  }
});
