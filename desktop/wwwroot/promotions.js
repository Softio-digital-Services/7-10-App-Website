// Promotions page: create, edit, pause and remove sales. Prices apply in the POS / order screen through
// promoPrices (app.js) and on the website through cloud sync.
let promoList = [];
let promoEditingId = null;
let promoReady = false;

function prTr(key) { return shopBind().tr(key); }
function prMoney(n) { return shopBind().money(Number(n) || 0); }
function prEsc(value) { return shopBind().escapeHtml(value == null ? '' : String(value)); }

function promoDay(d) {
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

async function loadPromotions() {
    setupPromotionsUi();
    try { promoList = await api('/api/promotions'); }
    catch (e) { promoList = []; toast(e.message, 'error'); }
    renderPromotions();
}

function promoDiscountText(p) {
    return p.kind === 'price' ? prMoney(p.value) : `−${Number(p.value)}%`;
}

function promoScopeText(p) {
    if (p.scope === 'category') return `${prTr('col_category')}: ${p.scopeValue}`;
    if (p.scope === 'collection') return `${prTr('col_collection')}: ${p.scopeValue}`;
    if (p.scope === 'products') return prTr('promo_n_products').replace('{0}', p.itemCount);
    return prTr('promo_scope_all');
}

function promoWhereText(p) {
    return prTr(p.channel === 'shop' ? 'promo_where_shop' : p.channel === 'web' ? 'promo_where_web' : 'promo_where_both');
}

function renderPromotions() {
    const body = document.getElementById('promo-body');
    if (!body) return;
    if (!promoList.length) {
        body.innerHTML = `<tr><td colspan="7" class="empty-state">${prEsc(prTr('promo_empty'))}</td></tr>`;
        return;
    }
    body.innerHTML = promoList.map(p => {
        const dates = `${toInputDate(p.dateFrom)} → ${toInputDate(p.dateTo)}`;
        const warn = p.belowCost > 0
            ? `<span class="cost-missing-tag" title="${prEsc(prTr('promo_below_cost_hint'))}">${prEsc(prTr('promo_below_cost').replace('{0}', p.belowCost))}</span>`
            : '';
        const pauseIcon = p.active ? 'pause' : 'play_arrow';
        return `<tr>
            <td><strong>${prEsc(p.name)}</strong>${warn}</td>
            <td>${prEsc(promoDiscountText(p))}</td>
            <td>${prEsc(promoScopeText(p))}<small class="report-promo-dates">${prEsc(prTr('promo_n_items').replace('{0}', p.itemCount))}</small></td>
            <td>${prEsc(dates)}</td>
            <td>${prEsc(promoWhereText(p))}</td>
            <td><span class="promo-status is-${prEsc(p.status)}">${prEsc(prTr('promo_status_' + p.status))}</span></td>
            <td><div class="table-actions">
                <button type="button" class="icon-btn" data-promo-edit="${p.id}" title="${prEsc(prTr('edit'))}"><span class="material-symbols-rounded">edit</span></button>
                <button type="button" class="icon-btn" data-promo-toggle="${p.id}" title="${prEsc(prTr(p.active ? 'promo_pause' : 'promo_resume'))}"><span class="material-symbols-rounded">${pauseIcon}</span></button>
                <button type="button" class="icon-btn btn-icon-danger" data-promo-delete="${p.id}" title="${prEsc(prTr('delete'))}"><span class="material-symbols-rounded">delete</span></button>
            </div></td>
        </tr>`;
    }).join('');
}

// ---------------------------------------------------------------- editor

function setPromoRange(kind) {
    const now = new Date();
    let from = now, to = now;
    if (kind === 'week') to = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 6);
    if (kind === 'month') { from = new Date(now.getFullYear(), now.getMonth(), 1); to = new Date(now.getFullYear(), now.getMonth() + 1, 0); }
    if (kind === 'next-month') { from = new Date(now.getFullYear(), now.getMonth() + 1, 1); to = new Date(now.getFullYear(), now.getMonth() + 2, 0); }
    document.getElementById('promo-from').value = promoDay(from);
    document.getElementById('promo-to').value = promoDay(to);
}

function syncPromoForm() {
    const kind = document.querySelector('input[name="promo-kind"]:checked')?.value || 'percent';
    const label = document.getElementById('promo-value-label');
    if (label) label.textContent = prTr(kind === 'price' ? 'promo_value_price' : 'promo_value_percent');
    const value = document.getElementById('promo-value');
    if (value) value.max = kind === 'price' ? '' : '99';
    const scope = document.getElementById('promo-scope')?.value || 'all';
    document.getElementById('promo-category-wrap').hidden = scope !== 'category';
    document.getElementById('promo-collection-wrap').hidden = scope !== 'collection';
    document.getElementById('promo-products-wrap').hidden = scope !== 'products';
}

/** Product picker: one checkbox per product, covering all its sizes / colours. */
function renderPromoProducts(selected) {
    const list = document.getElementById('promo-product-list');
    if (!list) return;
    const q = (document.getElementById('promo-product-search')?.value || '').trim().toLowerCase();
    const chosen = selected || new Set(promoChosenIds());
    const families = productFamilies().filter(f => !q || f.name.toLowerCase().includes(q));
    list.innerHTML = families.map(f => {
        const checked = f.ids.every(id => chosen.has(id));
        const variants = f.ids.length > 1 ? ` <small>(${f.ids.length} ${prEsc(prTr('rep_scope_variants'))})</small>` : '';
        return `<label class="promo-product"><input type="checkbox" data-promo-ids="${f.ids.join(',')}" ${checked ? 'checked' : ''}>
            <span>${prEsc(f.name)}${variants}</span></label>`;
    }).join('') || `<div class="empty-state">${prEsc(prTr('empty_list'))}</div>`;
    // Selections hidden by the search filter are kept in the dataset
    list.dataset.chosen = [...chosen].join(',');
    updatePromoProductCount();
}

function promoChosenIds() {
    const list = document.getElementById('promo-product-list');
    const ids = new Set((list?.dataset.chosen || '').split(',').filter(Boolean).map(Number));
    list?.querySelectorAll('[data-promo-ids]').forEach(box => {
        box.dataset.promoIds.split(',').map(Number).forEach(id => { if (box.checked) ids.add(id); else ids.delete(id); });
    });
    return [...ids];
}

function updatePromoProductCount() {
    const el = document.getElementById('promo-product-count');
    if (el) el.textContent = prTr('promo_n_items').replace('{0}', promoChosenIds().length);
}

function openPromoModal(promo = null) {
    promoEditingId = promo ? promo.id : null;
    const title = document.getElementById('promo-modal-title');
    if (title) title.textContent = prTr(promo ? 'promo_edit' : 'promo_new');
    const opt = (v, l) => `<option value="${prEsc(v)}">${prEsc(l)}</option>`;
    document.getElementById('promo-category').innerHTML = (categories || []).map(c => opt(c, c)).join('');
    document.getElementById('promo-collection').innerHTML = knownCollections().map(c => opt(c, c)).join('');

    document.getElementById('promo-name').value = promo?.name || '';
    const kind = promo?.kind === 'price' ? 'price' : 'percent';
    document.querySelectorAll('input[name="promo-kind"]').forEach(r => { r.checked = r.value === kind; });
    document.getElementById('promo-value').value = promo ? promo.value : '';
    document.getElementById('promo-scope').value = promo?.scope || 'all';
    if (promo?.scope === 'category') document.getElementById('promo-category').value = promo.scopeValue;
    if (promo?.scope === 'collection') document.getElementById('promo-collection').value = promo.scopeValue;
    document.getElementById('promo-channel').value = promo?.channel || 'both';
    document.getElementById('promo-active').checked = promo ? !!promo.active : true;
    document.getElementById('promo-product-search').value = '';
    if (promo) {
        document.getElementById('promo-from').value = toInputDate(promo.dateFrom);
        document.getElementById('promo-to').value = toInputDate(promo.dateTo);
    } else {
        setPromoRange('month');
    }
    const list = document.getElementById('promo-product-list');
    if (list) list.dataset.chosen = '';
    renderPromoProducts(new Set(promo?.partIds || []));
    const err = document.getElementById('promo-error');
    if (err) { err.hidden = true; err.textContent = ''; }
    syncPromoForm();
    openModal('promo-modal');
    setTimeout(() => document.getElementById('promo-name')?.focus(), 50);
}

async function savePromo(e) {
    e.preventDefault();
    const scope = document.getElementById('promo-scope').value;
    const payload = {
        name: document.getElementById('promo-name').value.trim(),
        kind: document.querySelector('input[name="promo-kind"]:checked')?.value || 'percent',
        value: Number(document.getElementById('promo-value').value) || 0,
        scope,
        scopeValue: scope === 'category' ? document.getElementById('promo-category').value
            : scope === 'collection' ? document.getElementById('promo-collection').value : '',
        partIds: scope === 'products' ? promoChosenIds() : [],
        dateFrom: document.getElementById('promo-from').value,
        dateTo: document.getElementById('promo-to').value,
        channel: document.getElementById('promo-channel').value,
        active: document.getElementById('promo-active').checked
    };
    const err = document.getElementById('promo-error');
    try {
        const url = promoEditingId ? `/api/promotions/${promoEditingId}/update` : '/api/promotions';
        await api(url, { method: 'POST', body: JSON.stringify(payload) });
        closeModal('promo-modal');
        toast(prTr('saved_ok'), 'success');
        await afterPromoChange();
    } catch (ex) {
        if (err) { err.hidden = false; err.textContent = ex.message; }
    }
}

/** Promotion prices changed: refresh the list and the prices the POS / order screen use. */
async function afterPromoChange() {
    await loadPromotions();
    if (typeof loadPromoPrices === 'function') await loadPromoPrices();
    if (typeof renderPOS === 'function') try { renderPOS(); } catch { /* POS not open */ }
}

async function togglePromo(id) {
    const p = promoList.find(x => x.id === id);
    if (!p) return;
    try {
        await api(`/api/promotions/${id}/active`, { method: 'POST', body: JSON.stringify({ active: !p.active }) });
        toast(prTr(p.active ? 'promo_paused_ok' : 'promo_resumed_ok'), 'success');
        await afterPromoChange();
    } catch (e) { toast(e.message, 'error'); }
}

async function deletePromo(id) {
    const p = promoList.find(x => x.id === id);
    if (!p) return;
    if (!await confirmDialog(prTr('promo_confirm_delete').replace('{0}', p.name), { confirmText: prTr('delete') })) return;
    try {
        await api(`/api/promotions/${id}/delete`, { method: 'POST', body: '{}' });
        toast(prTr('deleted_ok'), 'success');
        await afterPromoChange();
    } catch (e) { toast(e.message, 'error'); }
}

function setupPromotionsUi() {
    if (promoReady) return;
    promoReady = true;
    document.getElementById('btn-add-promotion')?.addEventListener('click', () => openPromoModal());
    document.getElementById('promo-form')?.addEventListener('submit', savePromo);
    document.querySelectorAll('input[name="promo-kind"]').forEach(r => r.addEventListener('change', syncPromoForm));
    document.getElementById('promo-scope')?.addEventListener('change', syncPromoForm);
    document.getElementById('promo-product-search')?.addEventListener('input', () => renderPromoProducts());
    document.getElementById('promo-product-list')?.addEventListener('change', updatePromoProductCount);
    document.querySelectorAll('[data-promo-range]').forEach(b => b.addEventListener('click', () => setPromoRange(b.dataset.promoRange)));
    document.getElementById('promo-body')?.addEventListener('click', e => {
        const edit = e.target.closest('[data-promo-edit]');
        const toggle = e.target.closest('[data-promo-toggle]');
        const del = e.target.closest('[data-promo-delete]');
        if (edit) openPromoModal(promoList.find(x => x.id === Number(edit.dataset.promoEdit)));
        else if (toggle) togglePromo(Number(toggle.dataset.promoToggle));
        else if (del) deletePromo(Number(del.dataset.promoDelete));
    });
}
