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

const editForm = byId('edit-participant');
const participantChoice = byId('participant-choice');
const participantFields = byId('participant-fields');
const participantName = byId('participant-name');
const participantEmail = byId('participant-email');
const editStatus = byId('edit-status');
let participants = [];

function fillParticipant() {
  const person = participants[participantChoice.value];
  participantFields.hidden = !person;
  participantFields.disabled = !person;
  participantName.value = person?.name ?? '';
  participantEmail.value = person?.email ?? '';
}

let automaticMail = false;
let participantCount = 0;
const drawButton = byId('draw');
const sendPending = byId('send-pending');
const gmailTest = byId('gmail-test-button');

function mailAction(action) {
  return request('/mail?action=' + action, {
    method: 'POST', headers: { Authorization: 'Bearer ' + organizerKey }
  });
}

async function sendNotifications() {
  sendPending.disabled = true;
  organizerStatus.textContent = 'Enviando avisos desde Gmail…';
  try {
    const { sent, pending, review } = await mailAction('send');
    organizerStatus.textContent = 'Gmail aceptó ' + sent + ' avisos.' +
      (pending ? ' Pendientes por el límite diario: ' + pending + '.' : '') +
      (review ? ' Envíos sin confirmación para revisar en Enviados de Gmail: ' + review + '.' : '');
    sendPending.hidden = pending === 0;
  } catch (error) {
    organizerStatus.textContent = error.message;
  } finally {
    sendPending.disabled = false;
  }
}

sendPending.addEventListener('click', sendNotifications);
gmailTest.addEventListener('click', async () => {
  gmailTest.disabled = true;
  const status = byId('gmail-test-status');
  status.textContent = 'Enviando prueba…';
  try {
    const { sender } = await mailAction('test');
    status.textContent = 'Gmail aceptó el envío de prueba a ' + sender + '.';
  } catch (error) {
    status.textContent = error.message;
  } finally {
    gmailTest.disabled = false;
  }
});

function openPanel({ count, matches, people, mailConfigured }) {
  automaticMail = Boolean(mailConfigured);
  participantCount = count;
  byId('test-email').hidden = automaticMail;
  byId('test-gmail').hidden = !automaticMail;
  sendPending.hidden = !automaticMail || !matches;
  drawButton.textContent = automaticMail ? 'Hacer sorteo y enviar avisos' : 'Cerrar inscripciones y hacer el sorteo';
  byId('panel').hidden = false;
  byId('summary').textContent = count + (count === 1 ? ' persona inscrita.' : ' personas inscritas.');
  byId('draw').hidden = Boolean(matches);
  byId('draw').disabled = count < 2;
  participants = people ?? [];
  editForm.hidden = Boolean(matches) || !people;
  participantChoice.replaceChildren(new Option('Elige a una persona', ''), ...participants.map(
    (person, index) => new Option(person.name + ' · ' + person.email, index)
  ));
  fillParticipant();
  if (!matches) return;
  if (automaticMail) return;
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
    link.href = assignmentEmail(person);
    item.append(name, link);
    return item;
  }));
}

function assignmentEmail(person, test = false) {
  const subject = (test ? '[PRUEBA] ' : '') + 'Tu amigo invisible · El Movidón';
  const body = [
    ...(test ? ['Este correo es una prueba. La asignación es ficticia.', ''] : []),
    '¡Hola, ' + person.name + '!', '',
    '¡Ya tenemos el resultado de El Movidón! Este año te toca hacerle un regalo a ' + person.recipient + '.',
    'Nos vemos el 26 de diciembre de 2026 para el intercambio.',
    '', '¡Que disfrutes preparando el regalo! 🎁'
  ].join('\r\n');
  return 'mailto:' + encodeURIComponent(person.email).replace('%40', '@') +
    '?subject=' + encodeURIComponent(subject) + '&body=' + encodeURIComponent(body);
}

byId('test-email').addEventListener('submit', event => {
  event.preventDefault();
  const email = byId('test-email-address').value.trim();
  location.href = assignmentEmail({ email, name: 'Participante de prueba', recipient: 'Amigo de prueba' }, true);
});

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

participantChoice.addEventListener('change', () => {
  editStatus.textContent = '';
  fillParticipant();
});

byId('reload-participants').addEventListener('click', async event => {
  const button = event.currentTarget;
  button.disabled = true;
  try {
    openPanel(await request('/organizer', { headers: { Authorization: 'Bearer ' + organizerKey } }));
    editStatus.textContent = 'Lista actualizada.';
  } catch (error) {
    editStatus.textContent = error.message;
  } finally {
    button.disabled = false;
  }
});

editForm.addEventListener('submit', async event => {
  event.preventDefault();
  const previous = participants[participantChoice.value];
  if (!previous) return;
  await saveParticipant('PATCH', { ...Object.fromEntries(new FormData(editForm)), previous });
});

byId('remove-participant').addEventListener('click', async () => {
  const previous = participants[participantChoice.value];
  if (!previous || !confirm('¿Eliminar la inscripción de ' + previous.name + '?')) return;
  await saveParticipant('DELETE', { previous });
});

async function saveParticipant(method, changes) {
  participantChoice.disabled = true;
  participantFields.disabled = true;
  byId('reload-participants').disabled = true;
  byId('draw').disabled = true;
  editStatus.textContent = 'Guardando cambios…';
  try {
    openPanel(await request('/organizer', {
      method,
      headers: { Authorization: 'Bearer ' + organizerKey, 'Content-Type': 'application/json' },
      body: JSON.stringify(changes)
    }));
    editStatus.textContent = method === 'DELETE' ? 'Participante eliminado.' : 'Cambios guardados.';
  } catch (error) {
    editStatus.textContent = error.message;
  } finally {
    participantChoice.disabled = false;
    participantFields.disabled = participantFields.hidden;
    byId('reload-participants').disabled = false;
    byId('draw').disabled = participants.length < 2;
  }
}

byId('draw').addEventListener('click', async event => {
  const prompt = automaticMail
    ? 'Se cerrarán las inscripciones y se enviará un correo privado a cada participante. ¿Hacer el sorteo?'
    : 'Se cerrarán las inscripciones y se guardará el resultado. ¿Hacer el sorteo?';
  if (!confirm(prompt)) return;
  const button = event.currentTarget;
  button.disabled = true;
  try {
    if (automaticMail) {
      const { quota } = await mailAction('status');
      if (quota < participantCount) throw new Error('Gmail no tiene suficiente cuota disponible hoy para enviar todos los avisos.');
    }
    openPanel(await request('/organizer', { method: 'POST', headers: { Authorization: 'Bearer ' + organizerKey } }));
    if (automaticMail) await sendNotifications();
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
let videoStartTimer;
videoToggle.addEventListener('click', () => {
  clearTimeout(videoStartTimer);
  if (video.paused) playVideo();
  else video.pause();
});
if (!reduceMotion.matches) {
  videoStartTimer = setTimeout(playVideo, 3000);
  const intro = byId('festive-intro');
  const ornaments = ['🎁', '❄', '🎄', '🔔', '✦', '🎅', '🍬'];
  for (let index = 0; index < 64; index++) {
    const ornament = document.createElement('span');
    ornament.textContent = ornaments[index % ornaments.length];
    ornament.style.setProperty('--left', (index * 37 % 97) + '%');
    ornament.style.setProperty('--delay', (index * 110) + 'ms');
    ornament.style.setProperty('--duration', (4350 + index * 97 % 1050) + 'ms');
    ornament.style.setProperty('--size', (1.45 + index * 7 % 15 / 10) + 'rem');
    ornament.style.setProperty('--drift', (index * 17 % 69 - 34) + 'px');
    ornament.style.setProperty('--rotation', (120 + index * 31 % 270) + 'deg');
    intro.append(ornament);
  }
  setTimeout(() => intro.remove(), 12500);
}
reduceMotion.addEventListener('change', event => {
  if (event.matches) {
    clearTimeout(videoStartTimer);
    video.pause();
  }
});

function syncMusicControl() {
  musicToggle.setAttribute('aria-pressed', String(!music.paused));
  byId('music-label').textContent = music.paused ? 'Activar música' : 'Pausar música';
}

function retryMusicOnInteraction(event) {
  if (musicToggle.contains(event.target)) return;
  clearMusicRetry();
  startMusic();
}

function clearMusicRetry() {
  document.removeEventListener('click', retryMusicOnInteraction, true);
  document.removeEventListener('keydown', retryMusicOnInteraction, true);
}

async function startMusic(retryOnInteraction = false) {
  try {
    await music.play();
    clearMusicRetry();
  } catch (error) {
    if (error.name === 'NotAllowedError' && retryOnInteraction) {
      document.addEventListener('click', retryMusicOnInteraction, true);
      document.addEventListener('keydown', retryMusicOnInteraction, true);
    } else if (error.name !== 'AbortError') {
      byId('music-label').textContent = 'Reintentar música';
    }
  }
}

music.addEventListener('play', syncMusicControl);
music.addEventListener('pause', syncMusicControl);
syncMusicControl();
musicToggle.addEventListener('click', () => {
  clearMusicRetry();
  if (!music.paused) music.pause();
  else startMusic();
});
startMusic(true);
