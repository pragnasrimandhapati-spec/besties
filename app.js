/* App logic.
 * Everything the friends create (names, ticked memories, pose photos) lives in sessionStorage,
 * so it is wiped when the browser tab is closed. An optional Firebase backup (js/firebase-sync.js)
 * can copy it to the cloud. */
(function () {
  const $ = (s, r = document) => r.querySelector(s);
  const esc = s => String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

  /* ---------- session storage helpers ---------- */
  const SS = {
    get(k, d) { try { const v = sessionStorage.getItem(k); return v ? JSON.parse(v) : d; } catch (e) { return d; } },
    set(k, v) { try { sessionStorage.setItem(k, JSON.stringify(v)); return true; } catch (e) { return false; } },
    getRaw(k) { try { return sessionStorage.getItem(k); } catch (e) { return null; } },
    setRaw(k, v) { try { sessionStorage.setItem(k, v); return true; } catch (e) { return false; } },
    del(k) { try { sessionStorage.removeItem(k); } catch (e) {} }
  };
  const PHOTO_KEY = id => 'bj:photo:' + id;
  const cloud = () => window.BestiesCloud;

  /* ---------- toasts ---------- */
  function toast(msg, kind = 'dark') {
    const el = document.createElement('div');
    el.className = `toast align-items-center text-bg-${kind} border-0`;
    el.setAttribute('role', 'alert');
    el.innerHTML = `<div class="d-flex"><div class="toast-body">${esc(msg)}</div>
      <button type="button" class="btn-close btn-close-white me-2 m-auto" data-bs-dismiss="toast"></button></div>`;
    $('#toasts').appendChild(el);
    const t = new bootstrap.Toast(el, { delay: 3500 });
    el.addEventListener('hidden.bs.toast', () => el.remove());
    t.show();
  }

  /* ---------- names ---------- */
  const nameA = $('#nameA'), nameB = $('#nameB');
  const names = SS.get('bj:names', { a: 'Friend One', b: 'Friend Two' });
  nameA.textContent = names.a; nameB.textContent = names.b;
  [[nameA, 'a', 'Friend One'], [nameB, 'b', 'Friend Two']].forEach(([el, key, def]) => {
    el.addEventListener('keydown', e => { if (e.key === 'Enter') { e.preventDefault(); el.blur(); } });
    el.addEventListener('blur', () => {
      const t = el.textContent.trim().slice(0, 20) || def;
      el.textContent = t; names[key] = t; SS.set('bj:names', names);
      renderAlbum(); syncProgress();
    });
  });

  /* ---------- memories ---------- */
  const memDone = new Set(SS.get('bj:memDone', []));
  const memGrid = $('#memoryGrid');

  function renderMemories() {
    memGrid.innerHTML = '';
    window.MEMORIES.forEach((m, i) => {
      const col = document.createElement('div');
      col.className = 'col';
      const done = memDone.has(m.id);
      col.innerHTML = `
        <article class="card mem h-100 ${done ? 'done' : ''}">
          <div class="card-body">
            <div class="em">${m.em}</div>
            <h3>${esc(m.title)}</h3>
            <p class="small">${esc(m.text)}</p>
            <button class="btn btn-sm tick">${done ? '💗 We did it!' : '🤍 We did it'}</button>
          </div>
        </article>`;
      const card = $('.mem', col), btn = $('.tick', col);
      btn.addEventListener('click', () => {
        memDone.has(m.id) ? memDone.delete(m.id) : memDone.add(m.id);
        SS.set('bj:memDone', [...memDone]);
        card.classList.toggle('done', memDone.has(m.id));
        btn.textContent = memDone.has(m.id) ? '💗 We did it!' : '🤍 We did it';
        updateMemProgress(); syncProgress();
      });
      card.style.transitionDelay = (i % 3) * 90 + 'ms';
      memGrid.appendChild(col);
    });
    const io = new IntersectionObserver(es => es.forEach(e => {
      if (e.isIntersecting) { e.target.classList.add('in'); io.unobserve(e.target); }
    }), { threshold: .12 });
    memGrid.querySelectorAll('.mem').forEach(c => io.observe(c));
    updateMemProgress();
  }
  function updateMemProgress() {
    const n = memDone.size, t = window.MEMORIES.length;
    $('#memBar').style.width = (n / t * 100) + '%';
    $('#memCount').textContent = `${n} of ${t} memories made` + (n === t ? ' — a perfect friendship! 🎉' : '');
  }

  /* ---------- photos (sessionStorage) ---------- */
  const photos = {};          // poseId -> dataURL (in-memory mirror of sessionStorage)
  window.POSES.forEach(p => { const v = SS.getRaw(PHOTO_KEY(p.id)); if (v) photos[p.id] = v; });

  // Shrink photos so ~20 of them fit inside the ~5 MB sessionStorage quota.
  function resizeImage(file, max, quality) {
    return new Promise((res, rej) => {
      const url = URL.createObjectURL(file), img = new Image();
      img.onload = () => {
        const s = Math.min(1, max / Math.max(img.width, img.height));
        const c = document.createElement('canvas');
        c.width = Math.round(img.width * s); c.height = Math.round(img.height * s);
        c.getContext('2d').drawImage(img, 0, 0, c.width, c.height);
        URL.revokeObjectURL(url);
        res(c.toDataURL('image/jpeg', quality));
      };
      img.onerror = () => { URL.revokeObjectURL(url); rej(new Error('bad image')); };
      img.src = url;
    });
  }

  async function savePhoto(poseId, file) {
    let data;
    try { data = await resizeImage(file, 720, 0.75); }
    catch (e) { toast('That file could not be read as an image.', 'danger'); return false; }

    // try progressively smaller versions if the session quota is nearly full
    if (!SS.setRaw(PHOTO_KEY(poseId), data)) {
      try { data = await resizeImage(file, 480, 0.6); } catch (e) {}
      if (!SS.setRaw(PHOTO_KEY(poseId), data)) {
        toast('Session storage is full. Download some photos and remove them to make room.', 'danger');
        return false;
      }
    }
    photos[poseId] = data;
    if (cloud() && cloud().enabled) cloud().savePhoto(poseId, data).catch(cloudError);
    return true;
  }

  function removePhoto(poseId) {
    delete photos[poseId]; SS.del(PHOTO_KEY(poseId));
    if (cloud() && cloud().enabled) cloud().deletePhoto(poseId).catch(cloudError);
  }

  /* ---------- poses ---------- */
  const poseGrid = $('#poseGrid');
  let filter = 'all';

  function renderPoses() {
    poseGrid.innerHTML = '';
    let shown = 0;
    window.POSES.forEach(p => {
      const has = !!photos[p.id];
      if ((filter === 'done' && !has) || (filter === 'todo' && has)) return;
      shown++;
      const col = document.createElement('div');
      col.className = 'col';
      col.innerHTML = `
        <article class="card pose h-100 ${has ? 'done' : ''}" id="pose-${p.id}">
          <div class="pose-visual">
            <span class="badge rounded-pill">${has ? '✔ Captured' : 'To try'}</span>
            ${has ? `<img src="${photos[p.id]}" alt="Our photo: ${esc(p.title)}">` : `<span class="big">${p.em}</span>`}
          </div>
          <div class="card-body d-flex flex-column gap-2">
            <h3 class="m-0">${esc(p.title)}</h3>
            <p class="small m-0">${esc(p.desc)}</p>
            <div class="tip">💡 ${esc(p.tip)}</div>
            <div class="d-flex gap-2 mt-auto pt-2">
              <label class="btn btn-up btn-sm flex-fill m-0">${has ? '🔄 Replace' : '📷 Upload photo'}
                <input type="file" accept="image/*" hidden>
              </label>
              ${has ? '<button class="btn btn-outline-danger btn-sm rm" title="Remove photo">🗑</button>' : ''}
            </div>
          </div>
        </article>`;

      $('input', col).addEventListener('change', async e => {
        const f = e.target.files[0]; if (!f) return;
        if (await savePhoto(p.id, f)) { renderAll(); flash(p.id); toast(`Saved “${p.title}” 💕`, 'success'); }
      });
      const rm = $('.rm', col);
      if (rm) rm.addEventListener('click', () => {
        if (confirm('Remove this photo from the pose?')) { removePhoto(p.id); renderAll(); }
      });
      const im = $('.pose-visual img', col);
      if (im) im.addEventListener('click', () => openPhoto(p));
      poseGrid.appendChild(col);
    });
    if (!shown) poseGrid.innerHTML = '<p class="small w-100 text-center">Nothing here yet 💕</p>';

    const n = Object.keys(photos).length, t = window.POSES.length;
    $('#poseBar').style.width = (n / t * 100) + '%';
    $('#poseCount').textContent = `${n} of ${t} poses captured`;
  }

  function flash(id) {
    const el = document.getElementById('pose-' + id);
    if (el) { el.classList.add('flash'); setTimeout(() => el.classList.remove('flash'), 1500); }
  }

  $('#filters').addEventListener('click', e => {
    const b = e.target.closest('button'); if (!b) return;
    filter = b.dataset.f;
    document.querySelectorAll('#filters button').forEach(x => x.classList.toggle('active', x === b));
    renderPoses();
  });

  $('#randomPose').addEventListener('click', () => {
    const todo = window.POSES.filter(p => !photos[p.id]);
    const pool = todo.length ? todo : window.POSES;
    const p = pool[(Math.random() * pool.length) | 0];
    if (filter !== 'all') {
      filter = 'all';
      document.querySelectorAll('#filters button').forEach(x => x.classList.toggle('active', x.dataset.f === 'all'));
      renderPoses();
    }
    const el = document.getElementById('pose-' + p.id);
    if (el) { el.scrollIntoView({ behavior: 'smooth', block: 'center' }); flash(p.id); }
  });

  /* ---------- album ---------- */
  function renderAlbum() {
    const box = $('#album'); box.innerHTML = '';
    const list = window.POSES.filter(p => photos[p.id]);
    $('#albumEmpty').hidden = list.length > 0;
    $('#downloadAll').hidden = list.length === 0;
    list.forEach(p => {
      const col = document.createElement('div');
      col.className = 'col album-col';
      col.innerHTML = `<figure class="polaroid m-0"><img src="${photos[p.id]}" alt="${esc(p.title)}"><figcaption>${esc(p.title)}</figcaption></figure>`;
      $('figure', col).addEventListener('click', () => openPhoto(p));
      box.appendChild(col);
    });
  }

  function download(dataUrl, filename) {
    const a = document.createElement('a');
    a.href = dataUrl; a.download = filename;
    document.body.appendChild(a); a.click(); a.remove();
  }
  const fileName = p => `${p.title.toLowerCase().replace(/[^a-z0-9]+/g, '-')}.jpg`;

  $('#downloadAll').addEventListener('click', () => {
    const list = window.POSES.filter(p => photos[p.id]);
    list.forEach((p, i) => setTimeout(() => download(photos[p.id], fileName(p)), i * 400));
    toast(`Downloading ${list.length} photo${list.length > 1 ? 's' : ''}…`);
  });

  /* ---------- lightbox (Bootstrap modal) ---------- */
  const modal = new bootstrap.Modal($('#photoModal'));
  function openPhoto(p) {
    $('#lbImg').src = photos[p.id];
    $('#lbCap').textContent = `${p.title} · ${names.a} & ${names.b}`;
    const dl = $('#lbDownload'); dl.href = photos[p.id]; dl.download = fileName(p);
    modal.show();
  }

  /* ---------- optional Firebase backup ---------- */
  const sw = $('#cloudSwitch'), status = $('#cloudStatus'), restoreBtn = $('#cloudRestore');

  function setStatus(text, kind) {
    status.textContent = text; status.className = `badge text-bg-${kind}`;
  }
  function cloudError(e) {
    console.error(e);
    setStatus('Error', 'danger');
    toast('Firebase: ' + (e && e.message ? e.message : 'something went wrong'), 'danger');
  }
  function syncProgress() {
    if (cloud() && cloud().enabled) cloud().saveProgress({ names, memDone: [...memDone] }).catch(cloudError);
  }

  if (!cloud() || !cloud().configured) {
    sw.disabled = true;
    setStatus('Not set up', 'secondary');
    sw.closest('.form-check').title = 'Add your Firebase keys in js/firebase-config.js to turn this on';
  }

  sw.addEventListener('change', async () => {
    if (!sw.checked) { cloud().disable(); setStatus('Off', 'secondary'); restoreBtn.hidden = true; return; }
    setStatus('Connecting…', 'warning');
    try {
      await cloud().enable();
      setStatus('Backup on', 'success'); restoreBtn.hidden = false;
      // push what we already have
      await cloud().saveProgress({ names, memDone: [...memDone] });
      for (const id of Object.keys(photos)) await cloud().savePhoto(id, photos[id]);
      toast('Firebase backup is on ☁', 'success');
    } catch (e) { sw.checked = false; cloud().disable(); restoreBtn.hidden = true; cloudError(e); }
  });

  restoreBtn.addEventListener('click', async () => {
    try {
      setStatus('Restoring…', 'warning');
      const data = await cloud().loadAll();
      let n = 0;
      for (const [id, url] of Object.entries(data.photos)) {
        if (!window.POSES.some(p => p.id === id)) continue;
        if (SS.setRaw(PHOTO_KEY(id), url)) { photos[id] = url; n++; }
      }
      if (data.memDone) { memDone.clear(); data.memDone.forEach(x => memDone.add(x)); SS.set('bj:memDone', [...memDone]); renderMemories(); }
      if (data.names) {
        Object.assign(names, data.names); SS.set('bj:names', names);
        nameA.textContent = names.a; nameB.textContent = names.b;
      }
      renderAll(); setStatus('Backup on', 'success');
      toast(n ? `Restored ${n} photo${n > 1 ? 's' : ''} ☁` : 'No backup found yet.', n ? 'success' : 'dark');
    } catch (e) { cloudError(e); }
  });

  /* ---------- start ---------- */
  function renderAll() { renderPoses(); renderAlbum(); }
  renderMemories();
  renderAll();
})();
