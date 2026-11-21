// myshop private writer. Runs entirely in the browser: nothing is sent anywhere, nothing is stored.
(() => {
  'use strict';
  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => [...r.querySelectorAll(s)];
  const form = $('#writer');
  if (!form) return;
  const PHONE = /(?:\+?\d[\d\s().-]{8,}\d)/;
  const LINES = ['aroma', 'acidity', 'sweetness', 'body', 'finish'];
  const PILLARS = ['space', 'service', 'value'];

  // Sliders stay blank (null) until touched; Clear makes them blank again. Blank is "not recorded", never 0.
  $$('.slid').forEach((w) => {
    const r = $('input', w), o = $('output', w);
    const show = () => { o.textContent = w.classList.contains('untouched') ? 'blank' : r.value; };
    r.addEventListener('input', () => { w.classList.remove('untouched'); show(); });
    $('button', w).addEventListener('click', () => { w.classList.add('untouched'); r.value = 0; show(); });
    w._set = (v) => { if (v === null || v === undefined) { w.classList.add('untouched'); r.value = 0; } else { w.classList.remove('untouched'); r.value = v; } show(); };
    w._get = () => (w.classList.contains('untouched') ? null : Number(r.value));
    show();
  });
  const slider = (k) => $(`.slid[data-key="${k}"]`);
  const val = (n) => { const e = form.elements[n]; return e ? e.value.trim() : ''; };
  const num = (n, int) => { const v = val(n); if (v === '') return null; const x = Number(v); return Number.isFinite(x) ? (int ? Math.round(x) : x) : NaN; };
  const txt = (n) => val(n) || null;

  const shopSel = form.elements.shop, newBox = $('#newshop');
  const slug = (s) => s.toLowerCase().normalize('NFKD').replace(/[̀-ͯ]/g, '').replace(/&/g, ' and ').replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
  const isNew = () => shopSel.value === '__new';
  const syncNew = () => { newBox.hidden = !isNew(); };
  shopSel.addEventListener('change', () => { syncNew(); form.elements.paymentSumUp.checked = !isNew() && JSON.parse(shopSel.selectedOptions[0].dataset.shop).paymentSumUp === true; });
  let idTouched = false;
  form.elements.newId.addEventListener('input', () => { idTouched = true; });
  form.elements.newName.addEventListener('input', () => { if (!idTouched) form.elements.newId.value = slug(val('newName')); });
  syncNew();
  if (!isNew()) form.elements.paymentSumUp.checked = JSON.parse(shopSel.selectedOptions[0].dataset.shop).paymentSumUp === true;

  let attachedPhotos = [], photosBusy = false;
  const photoFields = $('#photo-fields'), photoStatus = $('#photo-status');
  function renderPhotoFields() {
    photoFields.replaceChildren();
    attachedPhotos.forEach((p, i) => {
      const box = document.createElement('div'); box.className = 'photo-editor';
      const name = document.createElement('p'); name.textContent = p.name;
      box.append(name);
      for (const [key, title] of [['alt', 'Image description (required)'], ['caption', 'Caption (optional)']]) {
        const label = document.createElement('label'); label.textContent = title;
        const input = document.createElement('input'); input.value = p[key] || '';
        input.addEventListener('input', () => { p[key] = input.value; });
        label.append(input); box.append(label);
      }
      const remove = document.createElement('button'); remove.type = 'button'; remove.textContent = 'Remove photo ' + (i + 1);
      remove.addEventListener('click', () => { attachedPhotos.splice(i, 1); renderPhotoFields(); $('#outputs').hidden = true; });
      box.append(remove); photoFields.append(box);
    });
  }
  $('#photo-files').addEventListener('change', async (event) => {
    photosBusy = true; $('#outputs').hidden = true;
    photoStatus.textContent = 'Cleaning photos locally…';
    try {
      const files = [...event.target.files];
      if (attachedPhotos.length + files.length > 12) throw new Error('Choose no more than 12 photos in total.');
      const added = [];
      for (const file of files) {
        if (!['image/jpeg', 'image/png', 'image/webp', 'image/avif'].includes(file.type) || file.size > 25 * 1024 * 1024) throw new Error('Use JPEG, PNG, WebP or AVIF files up to 25 MB.');
        const image = await createImageBitmap(file);
        try {
          if (image.width * image.height > 60000000) throw new Error('Photo is too large (maximum 60 megapixels).');
          const scale = Math.min(1, 1600 / image.width, 1600 / image.height);
          const canvas = document.createElement('canvas'); canvas.width = Math.max(1, Math.round(image.width * scale)); canvas.height = Math.max(1, Math.round(image.height * scale));
          const ctx = canvas.getContext('2d'); ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, canvas.width, canvas.height); ctx.drawImage(image, 0, 0, canvas.width, canvas.height);
          const blob = await new Promise(resolve => canvas.toBlob(resolve, 'image/jpeg', .9));
          if (!blob) throw new Error('Could not convert photo. Try exporting it as JPEG.');
          const stem = slug(file.name.replace(/\.[^.]+$/, '')).slice(0, 48) || 'photo';
          let name = stem + '.jpg', n = 2;
          while ([...attachedPhotos, ...added].some(p => p.name === name)) name = stem + '-' + n++ + '.jpg';
          added.push({ name, blob, data: canvas.toDataURL('image/jpeg', .9), alt: '', caption: '' });
        } finally { image.close(); }
      }
      attachedPhotos.push(...added); renderPhotoFields();
      photoStatus.textContent = 'Photos cleaned. Add descriptions below. Nothing has been uploaded.';
    } catch (err) { photoStatus.textContent = err.message || 'Unable to read photo. Try JPEG.'; }
    finally { photosBusy = false; event.target.value = ''; }
  });
  function download(blob, name) {
    const url = URL.createObjectURL(blob), a = document.createElement('a'); a.href = url; a.download = name; a.click();
    setTimeout(() => URL.revokeObjectURL(url), 60000);
  }
  $('#download-review').addEventListener('click', () => {
    const { errors, review, shop } = gather();
    if (errors.length) { res.textContent = 'Make the JSON again after fixing the form.'; return; }
    download(new Blob([JSON.stringify({ shop, review }, null, 2) + '\n'], { type: 'application/json' }), review.shopId + '.json');
  });

  function gather() {
    const errors = [];
    if (photosBusy) errors.push('Wait for photo cleaning to finish.');
    const id = isNew() ? val('newId') : shopSel.value;
    if (!id) errors.push('Choose a shop, or add a new one.');
    else if (!/^[a-z0-9]+(-[a-z0-9]+)*$/.test(id)) errors.push('Shop id must be lowercase letters, numbers and hyphens.');
    let shop = isNew() ? null : JSON.parse(shopSel.selectedOptions[0].dataset.shop);
    if (isNew()) {
      if (!val('newName')) errors.push('New shop needs a name.');
      if (!val('newArea')) errors.push('New shop needs an area (town or neighbourhood, not an address).');
      const site = val('newWebsite');
      if (site && !/^https:\/\//.test(site)) errors.push('Website must start with https://');
      shop = { id, name: val('newName'), area: val('newArea') };
      if (site) shop.website = site;
      if (val('newBlurb')) shop.blurb = val('newBlurb');
    }
    if (shop) shop.paymentSumUp = form.elements.paymentSumUp.checked;
    if (!val('date')) errors.push('Visit date is required.');
    const score = (n, label, required) => {
      const v = num(n, true);
      if (Number.isNaN(v) || (v !== null && (v < 0 || v > 100))) errors.push(label + ' must be a whole number from 0 to 100.');
      else if (required && v === null) errors.push(label + ' is required.');
      return v;
    };
    const price = num('price');
    if (Number.isNaN(price) || (price !== null && price < 0)) errors.push('Price must be a number of pounds, e.g. 3.6.');
    const coffee = { score: score('coffee.score', 'Coffee score'), notes: val('coffee.notes') };
    LINES.forEach((l) => { coffee[l] = { quantity: slider(`${l}.quantity`)._get(), quality: slider(`${l}.quality`)._get(), notes: val(`${l}.notes`) }; });
    const review = {
      shopId: id, reviewed: true, date: val('date') || null,
      visit: { drink: txt('drink'), priceGbp: price, when: txt('when'), seat: txt('seat'), milk: txt('milk') },
      coffee,
    };
    PILLARS.forEach((p) => { review[p] = { score: score(p + '.score', p[0].toUpperCase() + p.slice(1) + ' score'), notes: val(p + '.notes') }; });
    review.flavour = val('flavour');
    review.overall = score('overall', 'Overall', true);
    review.notes = val('notes');
    if (!review.notes) errors.push('Overall notes are required.');
    if (attachedPhotos.length) review.photos = attachedPhotos.map(p => ({
      file: p.blob ? 'data/photos/' + id + '/' + p.name : p.file,
      alt: p.alt.trim(), caption: p.caption.trim(), ...(p.data ? { data: p.data } : {})
    }));
    for (const p of review.photos || []) {
      if (!p.alt) errors.push('Every photo needs an image description.');
      if (!p.file.startsWith('data/photos/' + id + '/') || !/^data\/photos\/[a-z0-9-]+\/[a-z0-9][a-z0-9-]*\.(jpg|jpeg|png|webp|avif)$/.test(p.file)) errors.push('Imported photo has an invalid path or belongs to another shop.');
    }
    const all = JSON.stringify([shop, {...review, photos: review.photos?.map(({data, ...p}) => p)}].filter(Boolean));
    if (PHONE.test(all.replace(/\d{4}-\d{2}-\d{2}/g, ''))) errors.push('Something looks like a phone number. Never publish phone numbers or street addresses.');
    return { errors, shop, review };
  }

  const res = $('#result'), outReview = $('#out-review'), outShop = $('#out-shop'), shopWrap = $('#shop-out');
  form.addEventListener('submit', (e) => {
    e.preventDefault();
    const { errors, shop, review } = gather();
    const err = $('#errors');
    err.replaceChildren();
    if (errors.length) {
      errors.forEach((m) => { const li = document.createElement('li'); li.textContent = m; err.appendChild(li); });
      err.hidden = false; res.textContent = 'Fix the items above first.'; err.focus(); return;
    }
    err.hidden = true;
    shopWrap.hidden = !shop;
    outShop.textContent = shop ? JSON.stringify(shop, null, 2) : '';
    outReview.textContent = JSON.stringify(review, null, 2);
    $('#file-hint').textContent = `Save the review as data/reviews/${review.shopId}.json` + (shop ? ' and add the shop entry to data/shops.json.' : '.');
    res.textContent = 'Done. Copy and paste into the repo; nothing has been sent anywhere.';
    $('#file-hint').textContent = 'Download one JSON containing the shop, review and cleaned photos. Send it to Kat to publish.';
    $('#outputs').hidden = false;
    $('#outputs').scrollIntoView({ block: 'nearest' });
  });
  $$('[data-copy]').forEach((b) => b.addEventListener('click', async () => {
    const t = $('#' + b.dataset.copy).textContent;
    try { await navigator.clipboard.writeText(t); res.textContent = 'Copied.'; }
    catch {
      const r = document.createRange(); r.selectNodeContents($('#' + b.dataset.copy));
      const s = getSelection(); s.removeAllRanges(); s.addRange(r);
      res.textContent = 'Selected: press Ctrl/Cmd+C.';
    }
  }));

  // Import a review JSON to prefill (or to revise an earlier visit).
  $('#import-run').addEventListener('click', () => {
    const st = $('#import-status');
    let r;
    try { r = JSON.parse($('#import-json').value); if (r.review) { const bundle = r; r = bundle.review; form.elements.paymentSumUp.checked = bundle.shop?.paymentSumUp === true; } } catch { st.textContent = 'That is not valid JSON.'; return; }
    if (!r || typeof r !== 'object' || !r.coffee || !r.visit) { st.textContent = 'That does not look like a myshop review.'; return; }
    const known = [...shopSel.options].some((o) => o.value === r.shopId);
    if (known) shopSel.value = r.shopId; else { shopSel.value = '__new'; form.elements.newId.value = r.shopId || ''; idTouched = true; }
    syncNew();
    const set = (n, v) => { const e = form.elements[n]; if (e) e.value = v ?? ''; };
    set('date', r.date); set('drink', r.visit.drink); set('price', r.visit.priceGbp); set('when', r.visit.when); set('seat', r.visit.seat); set('milk', r.visit.milk);
    set('coffee.score', r.coffee.score); set('coffee.notes', r.coffee.notes);
    LINES.forEach((l) => { const x = r.coffee[l] || {}; slider(`${l}.quantity`)._set(x.quantity); slider(`${l}.quality`)._set(x.quality); set(l + '.notes', x.notes); });
    PILLARS.forEach((p) => { set(p + '.score', r[p]?.score); set(p + '.notes', r[p]?.notes); });
    set('flavour', r.flavour); set('overall', r.overall); set('notes', r.notes);
    attachedPhotos = Array.isArray(r.photos) ? r.photos.map(p => ({ data: p.data, file: String(p.file || ''), name: String(p.file || '').split('/').at(-1), alt: String(p.alt || ''), caption: String(p.caption || '') })) : [];
    renderPhotoFields(); $('#outputs').hidden = true;
    st.textContent = 'Imported. Check each field, then make the JSON.';
  });
})();
