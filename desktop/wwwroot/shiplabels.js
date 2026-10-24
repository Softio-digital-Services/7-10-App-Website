// Shipping labels for shop orders: the "Shipping labels" category in Barcodes
// and the label button in order preparation share the same preview and print path.

var barcodeCategory = 'items';
var shipLabelSelected = new Set();
var shipLabelOrders = [];
var shipCompany = null;
var shipPrintCleanup = null;

const SHIP_LABEL_SIZES = {
    '4x6': { w: 101.6, h: 152.4 },
    '100x150': { w: 100, h: 150 },
    a6: { w: 105, h: 148 },
    a5: { w: 148, h: 210 },
    a4: { w: 210, h: 297 }
};

function isShipLabelCategory() { return barcodeCategory === 'shipping'; }

function shipLabelCode(order) {
    const tracking = String(order.trackingNumber || '').trim();
    return tracking || 'ORD-' + String(order.id).padStart(6, '0');
}

function shipLabelPaid(order) {
    return String(order.paymentStatus || '').toLowerCase() === 'paid';
}

function shipLabelAddress(order) {
    return order.address || order.customer?.address || '';
}

function shipLabelCustomer(order) {
    if (order.customer && typeof order.customer === 'object') return order.customer.name || '';
    return order.customer || '';
}

function shipLabelPhone(order) {
    return order.phone || order.customer?.phone || '';
}

async function loadShipCompany() {
    if (shipCompany) return shipCompany;
    try {
        const cfg = await api('/api/config');
        shipCompany = { name: cfg.companyName || '7-10', info: cfg.companyInfo || '' };
    } catch {
        shipCompany = { name: '7-10', info: '' };
    }
    return shipCompany;
}

/* ---------- Barcodes tab: shipping category ---------- */

function shippableOrders() {
    return (typeof shopOrders !== 'undefined' ? shopOrders : []).filter(o => o.stage !== 'Cancelled' && !o.labelRemoved);
}

function filteredShipOrders() {
    const q = (document.getElementById('bar-search')?.value || '').toLowerCase();
    return shippableOrders().filter(o => !q || [
        String(o.id), shipLabelCode(o), shipLabelCustomer(o), shipLabelPhone(o), shipLabelAddress(o), o.carrier
    ].some(x => String(x || '').toLowerCase().includes(q)));
}

function setBarcodeCategory(cat) {
    barcodeCategory = cat === 'shipping' ? 'shipping' : 'items';
    document.querySelectorAll('[data-bar-cat]').forEach(btn => {
        const on = btn.dataset.barCat === barcodeCategory;
        btn.classList.toggle('active', on);
        btn.setAttribute('aria-selected', on ? 'true' : 'false');
    });
    document.getElementById('barcodes-grid').hidden = isShipLabelCategory();
    document.getElementById('shiplabels-grid').hidden = !isShipLabelCategory();
    document.getElementById('btn-remove-shiplabels').hidden = !isShipLabelCategory();
    renderBarcodes();
}

function renderShipLabelCards() {
    const itemsCount = document.getElementById('bar-count-items');
    if (itemsCount) itemsCount.textContent = String((typeof barcodeItems !== 'undefined' ? barcodeItems : []).length);
    const shipCount = document.getElementById('bar-count-shipping');
    if (shipCount) shipCount.textContent = String(shippableOrders().length);

    const grid = document.getElementById('shiplabels-grid');
    if (!grid || !isShipLabelCategory()) return;
    const list = filteredShipOrders();
    [...shipLabelSelected].forEach(id => {
        if (!list.some(o => String(o.id) === id)) shipLabelSelected.delete(id);
    });

    grid.innerHTML = list.length ? list.map(o => {
        const id = String(o.id);
        const checked = shipLabelSelected.has(id) ? 'checked' : '';
        const pickup = o.type === 'Pickup';
        const place = pickup ? tr('ord_pickup') : (shipLabelAddress(o) || '—');
        return `<label class="barcode-card ship-card${checked ? ' selected' : ''}">
            <input type="checkbox" class="bc-check" data-ship-id="${id}" ${checked}>
            <div class="ship-card-head">
                <b>#${o.id}</b>
                <span class="badge ${pickup ? 'pickup' : 'delivery'}">${escapeHtml(pickup ? tr('ord_pickup') : tr('ord_delivery'))}</span>
            </div>
            <div class="bc-wrap"><svg class="bc-svg" data-code="${escapeHtml(shipLabelCode(o))}"></svg></div>
            <h3 title="${escapeHtml(shipLabelCustomer(o))}">${escapeHtml(shipLabelCustomer(o) || '—')}</h3>
            <p title="${escapeHtml(place)}">${escapeHtml(place)}</p>
            <p>${escapeHtml(shipLabelPhone(o) || '—')}</p>
            <div class="ship-card-foot">
                <span>${escapeHtml(typeof orderStageLabel === 'function' ? orderStageLabel(o.stage) : o.stage)}</span>
                <span class="price">${money(o.total)}</span>
                <button type="button" class="btn-icon ship-card-del ship-card-view" data-ship-view="${id}" title="${escapeHtml(tr('preview'))}"><span class="material-symbols-rounded">visibility</span></button>
                <button type="button" class="btn-icon btn-icon-delete ship-card-del" data-ship-del="${id}" title="${escapeHtml(tr('delete'))}"><span class="material-symbols-rounded">delete</span></button>
            </div>
        </label>`;
    }).join('') : `<div class="empty-state"><span class="material-symbols-rounded">local_shipping</span><p>${tr('sl_empty')}</p></div>`;

    grid.querySelectorAll('.bc-svg').forEach(svg => {
        drawJsBarcode(svg, svg.dataset.code || '', { width: 1.5, height: 42, fontSize: 11, margin: 2, background: 'transparent' });
        svg.removeAttribute('width');
        svg.removeAttribute('height');
        svg.setAttribute('preserveAspectRatio', 'xMidYMid meet');
        svg.style.width = '100%';
        svg.style.height = '100%';
    });

    grid.querySelectorAll('[data-ship-view]').forEach(btn => {
        btn.addEventListener('click', async e => {
            e.preventDefault();
            e.stopPropagation();
            try {
                openShipLabelPreview([await api('/api/shop-orders/' + btn.dataset.shipView)]);
            } catch (err) {
                toast(err.message || tr('print_failed'), 'error');
            }
        });
    });

    grid.querySelectorAll('[data-ship-del]').forEach(btn => {
        btn.addEventListener('click', e => {
            // The card is a <label>; keep the click from toggling its checkbox.
            e.preventDefault();
            e.stopPropagation();
            removeShipLabels([btn.dataset.shipDel]);
        });
    });

    grid.querySelectorAll('[data-ship-id]').forEach(cb => {
        cb.addEventListener('change', () => {
            if (cb.checked) shipLabelSelected.add(cb.dataset.shipId);
            else shipLabelSelected.delete(cb.dataset.shipId);
            cb.closest('.ship-card')?.classList.toggle('selected', cb.checked);
            syncShipSelectAll();
        });
    });
    syncShipSelectAll();
}

function syncShipSelectAll() {
    const selAll = document.getElementById('bar-select-all');
    if (!selAll || !isShipLabelCategory()) return;
    const ids = filteredShipOrders().map(o => String(o.id));
    const allOn = ids.length > 0 && ids.every(id => shipLabelSelected.has(id));
    selAll.checked = allOn;
    selAll.indeterminate = !allOn && ids.some(id => shipLabelSelected.has(id));
}

function toggleAllShipLabels(on) {
    filteredShipOrders().forEach(o => {
        if (on) shipLabelSelected.add(String(o.id));
        else shipLabelSelected.delete(String(o.id));
    });
    renderShipLabelCards();
}

async function removeShipLabels(ids) {
    ids = (ids || []).filter(Boolean);
    if (!ids.length) {
        toast(tr('sl_select_first'), 'error');
        return;
    }
    const msg = ids.length === 1 ? tr('sl_remove_one') : tr('sl_remove_many').replace('{0}', String(ids.length));
    if (!await confirmDialog(msg, { confirmText: tr('delete') })) return;
    try {
        await api('/api/shop-orders/labels/remove', {
            method: 'POST',
            body: JSON.stringify({ ids: ids.map(Number) })
        });
        shopOrders.forEach(o => { if (ids.includes(String(o.id))) o.labelRemoved = true; });
        ids.forEach(id => shipLabelSelected.delete(id));
        renderShipLabelCards();
        toast(tr('sl_removed'), 'success');
    } catch (e) {
        toast(e.message, 'error');
    }
}

async function printSelectedShipLabels() {
    const ids = shippableOrders().map(o => String(o.id)).filter(id => shipLabelSelected.has(id));
    if (!ids.length) {
        toast(tr('sl_select_first'), 'error');
        return;
    }
    try {
        // The board list only carries a preview of the lines, so load the full orders.
        const orders = await Promise.all(ids.map(id => api('/api/shop-orders/' + id)));
        openShipLabelPreview(orders);
    } catch (e) {
        toast(e.message || tr('print_failed'), 'error');
    }
}

/* ---------- Label rendering ---------- */

function shipLabelOptions() {
    const size = SHIP_LABEL_SIZES[document.getElementById('slp-size')?.value] || SHIP_LABEL_SIZES['4x6'];
    return {
        size,
        showItems: document.getElementById('slp-show-items')?.checked !== false,
        showCod: document.getElementById('slp-show-cod')?.checked !== false,
        showNotes: document.getElementById('slp-show-notes')?.checked !== false,
        copies: Math.max(1, Math.min(99, parseInt(document.getElementById('slp-copies')?.value, 10) || 1)),
        color: document.getElementById('slp-color')?.value === 'color',
        printerName: document.getElementById('slp-printer')?.value || ''
    };
}

function shipLabelHtml(order, opts) {
    const company = shipCompany || { name: '7-10', info: '' };
    const pickup = order.type === 'Pickup';
    const items = order.items || [];
    const pieces = items.reduce((sum, i) => sum + (Number(i.quantity) || 0), 0);
    const code = shipLabelCode(order);
    const dateText = order.date ? shortDate(order.date) : '—';

    const facts = [
        [tr('sl_order'), '#' + order.id],
        [tr('col_date'), dateText],
        [tr('sl_pieces'), String(pieces || order.itemCount || 0)],
        [pickup ? tr('ord_pickup') : tr('ord_carrier'), pickup ? '—' : (order.carrier || '—')]
    ].map(([k, v]) => `<div><span>${escapeHtml(k)}</span><b>${escapeHtml(v)}</b></div>`).join('');

    const cod = opts.showCod && !shipLabelPaid(order) && Number(order.total) > 0
        ? `<div class="sl-cod"><span>${escapeHtml(tr('sl_collect'))}</span><b>${money(order.total)}</b></div>`
        : (opts.showCod && shipLabelPaid(order) ? `<div class="sl-cod is-paid"><span>${escapeHtml(tr('sl_prepaid'))}</span></div>` : '');

    const maxLines = opts.size.h > 200 ? 18 : 6;
    const lines = items.slice(0, maxLines).map(i => {
        const meta = [i.size, i.color].filter(Boolean).join(' / ');
        return `<li><b>${Number(i.quantity) || 1}×</b> ${escapeHtml(i.name || '')}${meta ? ` <small>${escapeHtml(meta)}</small>` : ''}</li>`;
    }).join('');
    const more = items.length > maxLines ? `<li class="sl-more">+${items.length - maxLines}</li>` : '';
    const contents = opts.showItems && items.length
        ? `<div class="sl-contents"><span class="sl-cap">${escapeHtml(tr('sl_contents'))}</span><ul>${lines}${more}</ul></div>`
        : '';
    const notes = opts.showNotes && order.notes
        ? `<div class="sl-notes"><span class="sl-cap">${escapeHtml(tr('ord_notes'))}</span><p>${escapeHtml(order.notes)}</p></div>`
        : '';

    return `<div class="sl-label">
        <div class="sl-head">
            <div class="sl-brand-wrap">
                <img class="sl-logo" src="/Assets/logo-mark.png" alt="">
                <div class="sl-brand">${escapeHtml(company.name)}</div>
            </div>
            <div class="sl-type">${escapeHtml(pickup ? tr('ord_pickup') : tr('ord_delivery'))}</div>
        </div>
        <div class="sl-block sl-from">
            <span class="sl-cap">${escapeHtml(tr('sl_from'))}</span>
            <strong>${escapeHtml(company.name)}</strong>
            ${company.info ? `<p>${escapeHtml(company.info)}</p>` : ''}
        </div>
        <div class="sl-block sl-to">
            <span class="sl-cap">${escapeHtml(pickup ? tr('sl_pickup_for') : tr('sl_ship_to'))}</span>
            <strong class="sl-name">${escapeHtml(shipLabelCustomer(order) || '—')}</strong>
            ${pickup ? '' : `<p class="sl-addr">${escapeHtml(shipLabelAddress(order) || '—')}</p>`}
            ${shipLabelPhone(order) ? `<p class="sl-phone">${escapeHtml(shipLabelPhone(order))}</p>` : ''}
        </div>
        <div class="sl-barcode">
            <svg class="sl-svg" data-code="${escapeHtml(code)}"></svg>
            <div class="sl-code">${escapeHtml(code)}</div>
        </div>
        <div class="sl-facts">${facts}</div>
        ${cod}
        ${contents}
        ${notes}
    </div>`;
}

function drawShipLabelBarcodes(container) {
    container.querySelectorAll('.sl-svg').forEach(svg => {
        const ok = drawJsBarcode(svg, svg.dataset.code || '', {
            width: 2.2, height: 70, displayValue: false, margin: 0, background: '#ffffff'
        });
        if (!ok) return;
        svg.removeAttribute('width');
        svg.removeAttribute('height');
        svg.setAttribute('preserveAspectRatio', 'none');
    });
}

function paintShipLabelPreview() {
    const box = document.getElementById('slp-preview');
    if (!box) return;
    const opts = shipLabelOptions();
    box.style.setProperty('--sl-w', opts.size.w + 'mm');
    box.style.setProperty('--sl-h', opts.size.h + 'mm');
    box.innerHTML = shipLabelOrders.map(o => shipLabelHtml(o, opts)).join('');
    drawShipLabelBarcodes(box);

    // Fit large page sizes into the preview pane (1mm ≈ 3.78px on screen).
    const pane = box.parentElement;
    const avail = Math.max(200, (pane?.clientWidth || 600) - 56);
    box.style.zoom = String(Math.min(1, avail / (opts.size.w * 3.78)));

    const count = document.getElementById('slp-count');
    if (count) count.textContent = tr('sl_count').replace('{0}', String(shipLabelOrders.length));
}

async function openShipLabelPreview(orders) {
    shipLabelOrders = (orders || []).filter(Boolean);
    if (!shipLabelOrders.length) {
        toast(tr('sl_select_first'), 'error');
        return;
    }
    if (!window.JsBarcode) {
        toast('Barcode library not loaded', 'error');
        return;
    }
    await loadShipCompany();
    const sizeSel = document.getElementById('slp-size');
    if (sizeSel) {
        try { sizeSel.value = localStorage.getItem('ship_label_size') || '4x6'; } catch { /* storage blocked */ }
        if (!sizeSel.value) sizeSel.value = '4x6';
    }
    openModal('shiplabel-modal');
    requestHostPrinters();
    // Paint after the modal is laid out so the preview can measure its width.
    setTimeout(paintShipLabelPreview, 40);
}

/* ---------- Printing ---------- */

function cleanupShipLabelPrint() {
    document.body.classList.remove('printing-shiplabels');
    document.getElementById('shiplabel-page-style')?.remove();
    const root = document.getElementById('shiplabel-print-root');
    if (root) root.innerHTML = '';
    shipPrintCleanup = null;
}

function onShipLabelPrintResult() {
    if (shipPrintCleanup) shipPrintCleanup();
}

function waitForImages(container) {
    const pending = [...container.querySelectorAll('img')].filter(img => !img.complete);
    return Promise.all(pending.map(img => new Promise(resolve => {
        img.addEventListener('load', resolve, { once: true });
        img.addEventListener('error', resolve, { once: true });
    })));
}

async function printShipLabels() {
    if (!shipLabelOrders.length) return;
    const opts = shipLabelOptions();

    let root = document.getElementById('shiplabel-print-root');
    if (!root) {
        root = document.createElement('div');
        root.id = 'shiplabel-print-root';
        root.setAttribute('aria-hidden', 'true');
        document.body.appendChild(root);
    }
    root.style.setProperty('--sl-w', opts.size.w + 'mm');
    root.style.setProperty('--sl-h', opts.size.h + 'mm');
    root.innerHTML = shipLabelOrders.map(o => shipLabelHtml(o, opts)).join('');
    drawShipLabelBarcodes(root);
    // The logo must be loaded before the page is handed to the printer.
    await waitForImages(root);

    // Later @page rule wins over the app's default A4 page.
    const pageStyle = document.createElement('style');
    pageStyle.id = 'shiplabel-page-style';
    pageStyle.textContent = `@media print { @page { size: ${opts.size.w}mm ${opts.size.h}mm; margin: 0; } }`;
    document.head.appendChild(pageStyle);
    document.body.classList.add('printing-shiplabels');
    shipPrintCleanup = cleanupShipLabelPrint;
    closeModal('shiplabel-modal');

    if (window.chrome?.webview?.postMessage) {
        try {
            window.chrome.webview.postMessage(JSON.stringify({
                action: 'printPage',
                printerName: opts.printerName,
                copies: opts.copies,
                color: opts.color,
                pageWidthMm: opts.size.w,
                pageHeightMm: opts.size.h
            }));
            // Safety net in case the host never answers.
            setTimeout(() => { if (shipPrintCleanup) shipPrintCleanup(); }, 60000);
            return;
        } catch {
            cleanupShipLabelPrint();
            toast(tr('print_failed'), 'error');
            return;
        }
    }

    // Browser: system print dialog
    const done = () => {
        window.removeEventListener('afterprint', done);
        if (shipPrintCleanup) shipPrintCleanup();
    };
    window.addEventListener('afterprint', done);
    setTimeout(() => window.print(), 120);
}

/* ---------- Wiring ---------- */

document.addEventListener('DOMContentLoaded', () => {
    document.querySelectorAll('[data-bar-cat]').forEach(btn => {
        btn.addEventListener('click', () => setBarcodeCategory(btn.dataset.barCat));
    });
    document.getElementById('btn-shiplabel-print')?.addEventListener('click', () => printShipLabels());
    document.getElementById('btn-remove-shiplabels')?.addEventListener('click', () => {
        removeShipLabels(shippableOrders().map(o => String(o.id)).filter(id => shipLabelSelected.has(id)));
    });
    document.getElementById('slp-size')?.addEventListener('change', e => {
        try { localStorage.setItem('ship_label_size', e.target.value); } catch { /* storage blocked */ }
        paintShipLabelPreview();
    });
    ['slp-show-items', 'slp-show-cod', 'slp-show-notes'].forEach(id => {
        document.getElementById(id)?.addEventListener('change', () => paintShipLabelPreview());
    });
});
