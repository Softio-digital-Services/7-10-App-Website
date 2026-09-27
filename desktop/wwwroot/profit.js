let psData = null;
let psEditingCollection = 0;
let psPreferCollection = 0;
let psReady = false;

function psTr(key) { return shopBind().tr(key); }
function psMoney(n) { return shopBind().money(Number(n) || 0); }
function psEsc(value) { return shopBind().escapeHtml(value == null ? '' : String(value)); }

function setupProfitUi() {
    if (psReady) return;
    psReady = true;
    const year = document.getElementById('ps-year');
    const month = document.getElementById('ps-month');
    const now = new Date();
    if (year && !year.options.length) {
        for (let y = now.getFullYear() + 1; y >= now.getFullYear() - 5; y--) {
            const option = document.createElement('option');
            option.value = String(y);
            option.textContent = String(y);
            year.appendChild(option);
        }
        year.value = String(now.getFullYear());
    }
    fillProfitMonths(now);
    document.getElementById('ps-mode')?.addEventListener('change', () => { syncProfitFilters(); loadProfitShares(); });
    document.getElementById('ps-year')?.addEventListener('change', () => loadProfitShares());
    document.getElementById('ps-month')?.addEventListener('change', () => loadProfitShares());
    document.getElementById('ps-collection')?.addEventListener('change', () => loadProfitShares());
    document.getElementById('ps-add-party')?.addEventListener('click', addProfitParty);
    document.getElementById('ps-new-name')?.addEventListener('keydown', (e) => { if (e.key === 'Enter') addProfitParty(); });
    document.getElementById('ps-new-percent')?.addEventListener('keydown', (e) => { if (e.key === 'Enter') addProfitParty(); });
    document.getElementById('ps-col-add')?.addEventListener('click', () => openCollectionForm(null));
    document.getElementById('ps-col-edit')?.addEventListener('click', () => {
        const id = Number(document.getElementById('ps-collection')?.value || 0);
        const col = (psData?.collections || []).find(c => Number(c.id) === id);
        if (col) openCollectionForm(col);
    });
    document.getElementById('ps-col-cancel')?.addEventListener('click', closeCollectionForm);
    document.getElementById('ps-col-save')?.addEventListener('click', saveCollection);
    document.getElementById('ps-col-delete')?.addEventListener('click', deleteCollection);
    document.getElementById('ps-party-rows')?.addEventListener('change', onPartyChange);
    document.getElementById('ps-party-rows')?.addEventListener('input', paintProfitLive);
    document.getElementById('ps-party-rows')?.addEventListener('click', onPartyClick);
    syncProfitFilters();
}

function fillProfitMonths(now) {
    const month = document.getElementById('ps-month');
    if (!month) return;
    const lang = shopBind().lang === 'ar' ? 'ar' : 'en';
    if (month.dataset.lang === lang && month.options.length) return;
    const current = month.value || String((now || new Date()).getMonth() + 1);
    month.innerHTML = '';
    for (let m = 1; m <= 12; m++) {
        const option = document.createElement('option');
        option.value = String(m);
        option.textContent = new Date(2026, m - 1, 1).toLocaleString(lang, { month: 'long' });
        month.appendChild(option);
    }
    month.value = current;
    month.dataset.lang = lang;
}

function syncProfitFilters() {
    const mode = document.getElementById('ps-mode')?.value || 'year';
    const year = document.getElementById('ps-year');
    const month = document.getElementById('ps-month');
    const col = document.getElementById('ps-collection');
    const add = document.getElementById('ps-col-add');
    const edit = document.getElementById('ps-col-edit');
    if (year) year.hidden = mode === 'collection';
    if (month) month.hidden = mode !== 'month';
    if (col) col.hidden = mode !== 'collection';
    if (add) add.hidden = mode !== 'collection';
    if (edit) edit.hidden = mode !== 'collection' || !col?.value;
    if (mode !== 'collection') closeCollectionForm();
}

async function loadProfitShares(depth) {
    setupProfitUi();
    fillProfitMonths();
    if ((depth || 0) > 2) {
        renderProfitShares();
        return;
    }
    const mode = document.getElementById('ps-mode')?.value || 'year';
    const year = document.getElementById('ps-year')?.value || '';
    const month = document.getElementById('ps-month')?.value || '';
    const collectionId = document.getElementById('ps-collection')?.value || '';
    const query = new URLSearchParams({ mode, year });
    if (mode === 'month' && month) query.set('month', month);
    if (mode === 'collection' && collectionId) query.set('collectionId', collectionId);
    try {
        psData = await api('/api/profit-shares?' + query.toString());
    } catch (err) {
        toast(err.message || 'Could not load profit shares', 'error');
        return;
    }
    fillCollections();
    const selectedCollection = document.getElementById('ps-collection')?.value || '';
    if (mode === 'collection' && selectedCollection && selectedCollection !== collectionId) {
        await loadProfitShares((depth || 0) + 1);
        return;
    }
    renderProfitShares();
}

function fillCollections() {
    const sel = document.getElementById('ps-collection');
    if (!sel) return;
    const current = psPreferCollection ? String(psPreferCollection) : sel.value;
    psPreferCollection = 0;
    const list = psData?.collections || [];
    sel.innerHTML = '';
    if (!list.length) {
        const option = document.createElement('option');
        option.value = '';
        option.textContent = psTr('ps_no_collection');
        sel.appendChild(option);
    } else {
        list.forEach(c => {
            const option = document.createElement('option');
            option.value = String(c.id);
            option.textContent = c.name;
            sel.appendChild(option);
        });
        if (current && [...sel.options].some(o => o.value === current)) sel.value = current;
    }
    syncProfitFilters();
}

function renderProfitShares() {
    const data = psData || {};
    const kpis = document.getElementById('ps-kpis');
    if (kpis) {
        const items = [
            [psTr('ps_sales'), data.sales],
            [psTr('ps_cost'), data.cost],
            [psTr('ps_expenses'), data.expenses],
            [psTr('ps_profit'), data.profit]
        ];
        kpis.innerHTML = items.map(([label, value], index) =>
            `<div class="inv-kpi${index === 3 ? ' ps-profit-kpi' : ''}"><span>${psEsc(label)}</span><strong class="${Number(value) < 0 ? 'ps-loss' : ''}">${psMoney(value)}</strong></div>`
        ).join('');
    }
    const label = document.getElementById('ps-period-label');
    if (label) label.textContent = data.needsCollection ? psTr('ps_no_collection') : (data.label || '');
    const body = document.getElementById('ps-party-rows');
    if (body) {
        const parties = data.parties || [];
        body.innerHTML = parties.length
            ? parties.map(p => `
                <tr data-id="${p.id}">
                    <td><input class="form-control ps-name" type="text" maxlength="80" value="${psEsc(p.name)}"></td>
                    <td><input class="form-control ps-pct" type="number" min="0" max="100" step="0.01" value="${Number(p.percent)}"></td>
                    <td class="ps-amt ${Number(p.amount) < 0 ? 'ps-loss' : ''}">${psMoney(p.amount)}</td>
                    <td><button type="button" class="oe-remove ps-del" data-id="${p.id}" aria-label="Delete"><span class="material-symbols-rounded">delete</span></button></td>
                </tr>`).join('')
            : `<tr><td colspan="4" class="ps-empty">${psEsc(psTr('ps_empty'))}</td></tr>`;
    }
    paintProfitLive();
}

function partyDraft() {
    const profit = Number(psData?.profit) || 0;
    const rows = [...document.querySelectorAll('#ps-party-rows tr[data-id]')];
    let total = 0;
    const parties = rows.map(row => {
        const percent = Number(row.querySelector('.ps-pct')?.value);
        const safe = Number.isFinite(percent) ? percent : 0;
        total += safe;
        return {
            id: Number(row.dataset.id),
            name: row.querySelector('.ps-name')?.value || '',
            percent: safe,
            amount: profit * safe / 100
        };
    });
    return { parties, total, profit };
}

function paintProfitLive() {
    const { parties, total, profit } = partyDraft();
    parties.forEach(p => {
        const cell = document.querySelector(`#ps-party-rows tr[data-id="${p.id}"] .ps-amt`);
        if (!cell) return;
        cell.textContent = psMoney(p.amount);
        cell.classList.toggle('ps-loss', p.amount < 0);
    });
    const note = document.getElementById('ps-percent-note');
    if (note) {
        const shown = Math.round(total * 100) / 100;
        note.className = 'ps-note';
        if (!parties.length) note.textContent = '';
        else if (Math.abs(shown - 100) < 0.01) {
            note.textContent = psTr('ps_percent_ok');
            note.classList.add('ok');
        } else if (shown < 100) {
            const left = Math.round((100 - shown) * 100) / 100;
            note.textContent = psTr('ps_percent_short').replace('{0}', String(shown)).replace('{1}', String(left));
            note.classList.add('warn');
        } else {
            note.textContent = psTr('ps_percent_over').replace('{0}', String(shown));
            note.classList.add('warn');
        }
    }
    const bars = document.getElementById('ps-bars');
    if (!bars) return;
    if (!parties.length) {
        bars.innerHTML = `<p class="ps-empty">${psEsc(psTr('ps_empty'))}</p>`;
        return;
    }
    const rows = parties.map(p => barRow(p.name, p.percent, p.amount, false));
    const unassigned = 100 - total;
    if (unassigned > 0.01) rows.push(barRow(psTr('ps_unassigned'), unassigned, profit * unassigned / 100, true));
    bars.innerHTML = rows.join('');
}

function barRow(name, percent, amount, muted) {
    const width = Math.max(0, Math.min(100, Number(percent) || 0));
    const shown = Math.round((Number(percent) || 0) * 100) / 100;
    return `<div class="ps-bar-row${muted ? ' muted' : ''}">
        <div class="ps-bar-top"><strong>${psEsc(name)}</strong><span>${psEsc(String(shown))}%</span></div>
        <div class="ps-track"><i style="width:${width}%"></i></div>
        <b class="${amount < 0 ? 'ps-loss' : ''}">${psMoney(amount)}</b>
    </div>`;
}

async function onPartyChange(e) {
    const row = e.target.closest('tr[data-id]');
    if (!row || !e.target.classList.contains('form-control')) return;
    const name = row.querySelector('.ps-name')?.value.trim();
    const percent = Number(row.querySelector('.ps-pct')?.value);
    if (!name) { toast(psTr('ps_need_name'), 'error'); return; }
    if (!Number.isFinite(percent) || percent < 0 || percent > 100) return;
    try {
        await api('/api/profit-parties/' + row.dataset.id + '/update', {
            method: 'POST',
            body: JSON.stringify({ name, percent })
        });
        await loadProfitShares();
    } catch (err) {
        toast(err.message, 'error');
    }
}

async function onPartyClick(e) {
    const btn = e.target.closest('.ps-del');
    if (!btn) return;
    const ok = await confirmDialog(psTr('ps_delete_party'));
    if (!ok) return;
    try {
        await api('/api/profit-parties/' + btn.dataset.id + '/delete', { method: 'POST' });
        await loadProfitShares();
    } catch (err) {
        toast(err.message, 'error');
    }
}

async function addProfitParty() {
    const nameEl = document.getElementById('ps-new-name');
    const pctEl = document.getElementById('ps-new-percent');
    const name = (nameEl?.value || '').trim();
    const percent = Number(pctEl?.value);
    if (!name) { toast(psTr('ps_need_name'), 'error'); return; }
    if (!Number.isFinite(percent) || percent < 0 || percent > 100) { toast(psTr('ps_percent'), 'error'); return; }
    try {
        await api('/api/profit-parties', { method: 'POST', body: JSON.stringify({ name, percent }) });
        if (nameEl) nameEl.value = '';
        if (pctEl) pctEl.value = '';
        await loadProfitShares();
    } catch (err) {
        toast(err.message, 'error');
    }
}

function openCollectionForm(col) {
    const form = document.getElementById('ps-col-form');
    if (!form) return;
    psEditingCollection = col ? Number(col.id) : 0;
    document.getElementById('ps-col-name').value = col?.name || '';
    document.getElementById('ps-col-from').value = String(col?.from || '').slice(0, 10);
    document.getElementById('ps-col-to').value = String(col?.to || '').slice(0, 10);
    document.getElementById('ps-col-form-title').textContent = psTr(col ? 'ps_edit_collection' : 'ps_add_collection');
    document.getElementById('ps-col-delete').hidden = !col;
    form.hidden = false;
}

function closeCollectionForm() {
    const form = document.getElementById('ps-col-form');
    if (form) form.hidden = true;
    psEditingCollection = 0;
}

async function saveCollection() {
    const name = document.getElementById('ps-col-name')?.value.trim();
    const from = document.getElementById('ps-col-from')?.value;
    const to = document.getElementById('ps-col-to')?.value;
    if (!name) { toast(psTr('ps_need_name'), 'error'); return; }
    if (!from || !to) { toast(psTr('ps_need_dates'), 'error'); return; }
    const path = psEditingCollection
        ? '/api/profit-collections/' + psEditingCollection + '/update'
        : '/api/profit-collections';
    try {
        const res = await api(path, { method: 'POST', body: JSON.stringify({ name, from, to }) });
        psPreferCollection = res?.id || psEditingCollection;
        closeCollectionForm();
        await loadProfitShares();
    } catch (err) {
        toast(err.message, 'error');
    }
}

async function deleteCollection() {
    if (!psEditingCollection) return;
    const ok = await confirmDialog(psTr('ps_delete_collection'));
    if (!ok) return;
    try {
        await api('/api/profit-collections/' + psEditingCollection + '/delete', { method: 'POST' });
        closeCollectionForm();
        const sel = document.getElementById('ps-collection');
        if (sel) sel.value = '';
        await loadProfitShares();
    } catch (err) {
        toast(err.message, 'error');
    }
}

setupProfitUi();
