
/* LNZ MUSIC GUARD - trascrizione online privata.
   Richiede un Cloudflare Worker configurato.
   Non inserire API key in questo file. */

(() => {
  'use strict';

  if (document.getElementById('lnz-online-asr')) return;

  const $ = id => document.getElementById(id);
  const fileInput = $('file');
  const report = $('technicalReport');

  if (!fileInput || !report) return;

  const style = document.createElement('style');

  style.textContent = `
    #lnz-online-asr {
      background:linear-gradient(145deg,#132b47,#1e293b);
      border:1px solid #38bdf8;
      border-radius:16px;
      padding:20px;
      margin:18px 0;
    }

    #lnz-online-asr h2 {
      color:#7dd3fc;
      margin:0 0 12px;
    }

    #lnz-online-asr label {
      display:block;
      margin:14px 0 5px;
      color:#e2e8f0;
    }

    #lnz-online-asr input:not([type=checkbox]),
    #lnz-online-asr select {
      width:100%;
      padding:12px;
      background:#0b1527;
      border:1px solid #536c84;
      border-radius:8px;
      color:white;
      font-size:16px;
    }

    #lnz-online-asr .lnz-consent {
      display:flex;
      align-items:flex-start;
      gap:10px;
      font-size:14px;
    }

    #lnz-online-asr .lnz-consent input {
      width:21px;
      height:21px;
      flex:0 0 21px;
      margin-top:3px;
    }

    #lnz-online-asr button {
      width:100%;
      padding:14px;
      background:#0284c7;
      border:0;
      border-radius:10px;
      color:white;
      font-weight:bold;
    }

    #lnz-online-asr button:disabled {
      opacity:.5;
    }

    #lnz-online-message {
      color:#b8e8ff;
      white-space:pre-wrap;
      overflow-wrap:anywhere;
    }
  `;

  document.head.appendChild(style);

  const panel = document.createElement('section');
  panel.id = 'lnz-online-asr';

  panel.innerHTML = `
    <h2>🎤 Trascrizione online avanzata</h2>

    <p class="muted">
      Prova con un modello vocale più potente di
      Whisper Tiny. Le parole cantate possono
      comunque essere sbagliate: verifica sempre
      il testo originale.
    </p>

    <label for="lnz-asr-url">
      Indirizzo del nostro server Cloudflare
    </label>

    <input
      id="lnz-asr-url"
      type="url"
      placeholder="https://nome.account.workers.dev"
      autocomplete="url"
      spellcheck="false"
    >

    <label for="lnz-asr-code">
      Codice privato di accesso
    </label>

    <input
      id="lnz-asr-code"
      type="password"
      placeholder="Non inserire qui la chiave OpenAI"
      autocomplete="off"
    >

    <label for="lnz-asr-range">
      Parte della canzone
    </label>

    <select id="lnz-asr-range">
      <option value="30" selected>
        Dal secondo 30 al 60
      </option>

      <option value="0">
        Primi 30 secondi
      </option>

      <option value="full">
        Brano intero, massimo 10 minuti
      </option>
    </select>

    <label class="lnz-consent">
      <input
        id="lnz-asr-consent"
        type="checkbox"
      >

      <span>
        Autorizzo l'invio dell'estratto audio
        al server e al servizio di trascrizione
        online. Potrebbero esserci costi API.
      </span>
    </label>

    <button id="lnz-asr-send" type="button">
      Trascrivi online
    </button>

    <p
      id="lnz-online-message"
      role="status"
      aria-live="polite"
    >
      Server non collegato.
      Prima occorre configurare il backend privato.
    </p>

    <p class="muted">
      <small>
        Il codice privato non viene salvato.
        Nessuna registrazione parte automaticamente.
        Il testo ricevuto non certifica
        voce umana o AI.
      </small>
    </p>
  `;

  report.insertAdjacentElement('afterend', panel);

  const message = $('lnz-online-message');
  const send = $('lnz-asr-send');
  const consent = $('lnz-asr-consent');
  const access = $('lnz-asr-code');

  let busy = false;
  let fileVersion = 0;

  fileInput.addEventListener('change', () => {
    fileVersion++;
    consent.checked = false;

    message.textContent =
      'Nuovo brano selezionato. Nessun audio inviato.';
  });

  function wavBlob(data) {
    const out = new ArrayBuffer(44 + data.length * 2);
    const v = new DataView(out);

    const label = (at, str) => {
      for (let i = 0; i < str.length; i++) {
        v.setUint8(at + i, str.charCodeAt(i));
      }
    };

    label(0, 'RIFF');
    v.setUint32(4, out.byteLength - 8, true);

    label(8, 'WAVE');
    label(12, 'fmt ');
    v.setUint32(16, 16, true);

    v.setUint16(20, 1, true);
    v.setUint16(22, 1, true);

    v.setUint32(24, 16000, true);
    v.setUint32(28, 32000, true);

    v.setUint16(32, 2, true);
    v.setUint16(34, 16, true);

    label(36, 'data');
    v.setUint32(40, data.length * 2, true);

    for (let i = 0; i < data.length; i++) {
      const x = Math.max(-1, Math.min(1, data[i]));

      v.setInt16(
        44 + i * 2,
        x < 0
          ? Math.round(x * 32768)
          : Math.round(x * 32767),
        true
      );
    }

    return new Blob([out], {
      type: 'audio/wav'
    });
  }

  async function prepareAudio(file, mode) {
    const Context =
      window.AudioContext ||
      window.webkitAudioContext;

    const Offline =
      window.OfflineAudioContext ||
      window.webkitOfflineAudioContext;

    if (!Context || !Offline) {
      throw Error(
        'Il dispositivo non supporta la conversione audio.'
      );
    }

    const ctx = new Context();
    let audio;

    try {
      audio = await ctx.decodeAudioData(
        await file.arrayBuffer()
      );
    } finally {
      await ctx.close().catch(() => {});
    }

    if (mode === 'full' && audio.duration > 600) {
      throw Error('Brano oltre 10 minuti.');
    }

    const start =
      mode === '30' && audio.duration > 30
        ? 30
        : 0;

    const duration =
      mode === 'full'
        ? audio.duration
        : Math.min(30, audio.duration - start);

    if (duration < 0.5) {
      throw Error('La canzone è troppo corta.');
    }

    const offline = new Offline(
      1,
      Math.ceil(duration * 16000),
      16000
    );

    const source = offline.createBufferSource();
    source.buffer = audio;
    source.connect(offline.destination);

    source.start(0, start, duration);

    const rendered = await offline.startRendering();

    return {
      blob: wavBlob(rendered.getChannelData(0)),
      start,
      duration
    };
  }

  send.addEventListener('click', async () => {
    if (busy) return;

    const file = fileInput.files?.[0];

    if (!file) {
      message.textContent =
        'Prima carica una canzone nella sezione iniziale.';
      return;
    }

    if (!consent.checked) {
      message.textContent =
        "Spunta l'autorizzazione per inviare l'audio.";
      return;
    }

    const url = $('lnz-asr-url')
      .value.trim()
      .replace(/\/+$/, '');

    if (!/^https:\/\/[a-z0-9.-]+\.workers\.dev$/i.test(url)) {
      message.textContent =
        'Manca l’indirizzo HTTPS del nostro Cloudflare Worker.';
      return;
    }

    if (!access.value.trim()) {
      message.textContent =
        'Inserisci il codice privato del server, non la chiave OpenAI.';
      return;
    }

    busy = true;
    send.disabled = true;

    const current = fileVersion;

    message.textContent =
      'Preparo la porzione di audio sul telefono...';

    try {
      const audio = await prepareAudio(
        file,
        $('lnz-asr-range').value
      );

      if (current !== fileVersion) {
        throw Error('È cambiata la canzone: riprova.');
      }

      if (audio.blob.size > 24 * 1024 * 1024) {
        throw Error('Audio troppo grande per il server.');
      }

      const form = new FormData();

      form.append(
        'audio',
        audio.blob,
        'lnz-audio.wav'
      );

      form.append(
        'language',
        $('lang')?.value || 'italian'
      );

      message.textContent =
        'Invio autorizzato e trascrizione online in corso...';

      const controller = new AbortController();

      const timeout = setTimeout(
        () => controller.abort(),
        115000
      );

      let response;

      try {
        response = await fetch(url + '/transcribe', {
          method: 'POST',

          headers: {
            'X-LNZ-Access-Code': access.value.trim()
          },

          body: form,
          signal: controller.signal
        });
      } finally {
        clearTimeout(timeout);
      }

      const result = await response.json()
        .catch(() => ({}));

      if (!response.ok) {
        throw Error(
          result.error ||
          'Errore server HTTP ' + response.status
        );
      }

      if (current !== fileVersion) {
        throw Error('È cambiata la canzone.');
      }

      const text = String(result.text || '').trim();

      if (!text) {
        throw Error(
          'Il modello non ha riconosciuto parole utilizzabili.'
        );
      }

      $('lyrics').value = text;
      $('lyricsPanel').hidden = false;

      $('lyricsStatus').textContent =
        'Testo ONLINE sperimentale: ' +
        Math.round(audio.start) +
        '–' +
        Math.round(audio.start + audio.duration) +
        ' secondi. NON VERIFICATO: confronta ogni parola con la canzone.';

      message.textContent =
        'Testo ricevuto e inserito nella sezione 3.';

      consent.checked = false;

      $('lyricsPanel').scrollIntoView({
        behavior: 'smooth'
      });

    } catch (e) {
      message.textContent =
        'Non completato: ' +
        String(e?.message || e);

    } finally {
      busy = false;
      send.disabled = false;
    }
  });

})();
