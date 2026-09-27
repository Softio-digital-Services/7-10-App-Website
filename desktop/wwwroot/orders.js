function ordTr(k) { return shopBind().tr(k); }
function ordMoney(n) { return shopBind().money(n); }
function ordEscape(s) { return shopBind().escapeHtml(s); }
function ordDate(d) { return shopBind().formatDate(d); }
function orderProducts() { return shopBind().products || []; }
function orderCustomers() { return shopBind().customers || []; }
function orderUser() { return shopBind().currentUser; }

var shopOrders = [];
var activeOrder = null;
var orderViewStep = 'details';
var orderDraftLines = [];
var orderRating = 0;

function setShopOrders(list) { shopOrders = list || []; }

function orderActor() {
    const user = orderUser();
    return (user && (user.fullName || user.username)) || 'Staff';
}

function orderStageLabel(stage) {
    const map = {
        New: 'ord_stage_new',
        Preparing: 'ord_stage_preparing',
        Ready: 'ord_stage_ready',
        OutForDelivery: 'ord_stage_out',
        ReadyForPickup: 'ord_stage_pickup',
        AwaitingFeedback: 'ord_stage_feedback',
        Completed: 'ord_stage_done',
        Cancelled: 'ord_stage_cancelled'
    };
    return ordTr(map[stage] || 'ord_stage_new');
}

function orderStepKey(stage) {
    if (stage === 'New') return 'details';
    if (stage === 'Preparing') return 'prepare';
    if (stage === 'Ready') return 'send';
    if (stage === 'OutForDelivery' || stage === 'ReadyForPickup') return 'track';
    return 'feedback';
}

function orderStepRank(key) {
    return ['details', 'prepare', 'send', 'track', 'feedback'].indexOf(key);
}

function orderColumn(stage) {
    if (stage === 'New') return 'new';
    if (stage === 'Preparing') return 'preparing';
    if (stage === 'Ready' || stage === 'OutForDelivery' || stage === 'ReadyForPickup') return 'tracking';
    return 'finalize';
}

function orderEventText(ev) {
    if (ev.type === 'created') return ordTr('ord_ev_created');
    if (ev.type === 'stage') return ordTr('ord_ev_stage').replace('{0}', orderStageLabel(ev.detail));
    if (ev.type === 'packed') return ordTr('ord_ev_packed');
    if (ev.type === 'feedback') return ordTr('ord_ev_feedback').replace('{0}', ev.detail || '');
    if (ev.type === 'cancel') return ordTr('ord_ev_cancel');
    return ev.message || '';
}

function showOrdersBoard() {
    const board = document.getElementById('orders-board');
    const detail = document.getElementById('order-detail');
    const editor = document.getElementById('order-editor');
    if (board) board.hidden = false;
    if (detail) detail.hidden = true;
    if (editor) editor.hidden = true;
    activeOrder = null;
    renderShopOrders();
}

function renderShopOrders() {
    const board = document.getElementById('order-board');
    if (!board) return;
    const q = (document.getElementById('order-search')?.value || '').trim().toLowerCase();
    const method = document.getElementById('order-filter-method')?.value || 'all';
    const rows = shopOrders.filter(o => {
        if (method !== 'all' && o.type !== method) return false;
        if (!q) return true;
        const blob = `${o.id} ${o.customer} ${(o.items || []).map(i => i.name).join(' ')}`.toLowerCase();
        return blob.includes(q);
    });
    const columns = [
        ['new', 'ord_col_new'],
        ['preparing', 'ord_col_preparing'],
        ['tracking', 'ord_col_tracking'],
        ['finalize', 'ord_col_finalize']
    ];
    board.innerHTML = columns.map(([key, label]) => {
        const cards = rows.filter(o => orderColumn(o.stage) === key);
        return `<section class="ob-col">
            <h3><span>${ordEscape(ordTr(label))}</span><b class="ob-count">${cards.length}</b></h3>
            ${cards.length ? cards.map(orderCardHtml).join('') : `<p class="ob-empty">${ordEscape(ordTr('ord_empty'))}</p>`}
        </section>`;
    }).join('');
}

function orderCardHtml(o) {
    const lines = (o.items || []).map(i => {
        const bits = [i.size, i.color].filter(Boolean).join(' · ');
        return `<li><strong>${ordEscape(i.name)}</strong> ×${i.quantity}${bits ? `<small>${ordEscape(bits)}</small>` : ''}</li>`;
    }).join('');
    const progress = o.checksTotal ? `<span class="ob-progress">${o.checksDone}/${o.checksTotal}</span>` : '';
    return `<button type="button" class="ob-card" data-open-order="${o.id}">
        <div class="ob-card-top"><strong>#${o.id}</strong><span class="badge ${o.type === 'Pickup' ? 'pickup' : 'delivery'}">${ordEscape(o.type === 'Pickup' ? ordTr('ord_pickup') : ordTr('ord_delivery'))}</span></div>
        <div class="ob-customer">${ordEscape(o.customer || '')}</div>
        <ul class="ob-items">${lines}</ul>
        <div class="ob-card-foot"><span>${ordEscape(orderStageLabel(o.stage))}${progress}</span><b>${ordMoney(o.total)}</b></div>
    </button>`;
}

async function openShopOrder(id) {
    const order = await api('/api/shop-orders/' + id);
    orderRating = order.rating || 0;
    orderViewStep = order.stage === 'Cancelled' ? 'details' : orderStepKey(order.stage);
    activeOrder = order;
    paintOrderDetail();
}

function paintOrderDetail() {
    const order = activeOrder;
    const pane = document.getElementById('order-detail');
    if (!order || !pane) return;
    document.getElementById('orders-board').hidden = true;
    document.getElementById('order-editor').hidden = true;
    pane.hidden = false;
    const cancelled = order.stage === 'Cancelled';
    const currentRank = cancelled ? 0 : orderStepRank(orderStepKey(order.stage));
    const viewing = orderViewStep || orderStepKey(order.stage);
    const steps = [
        ['details', 'ord_step_details'],
        ['prepare', 'ord_step_prepare'],
        ['send', 'ord_step_send'],
        ['track', 'ord_step_track'],
        ['feedback', 'ord_step_feedback']
    ];
    const canCancel = order.stage === 'New' || order.stage === 'Preparing' || order.stage === 'Ready';
    pane.innerHTML = `
        <div class="page-header">
            <button type="button" class="text-back" data-order-action="board"><span class="material-symbols-rounded">arrow_back</span><span>${ordEscape(ordTr('ord_back'))}</span></button>
            <div class="page-actions">
                ${canCancel ? `<button type="button" class="btn btn-secondary" data-order-action="cancel">${ordEscape(ordTr('ord_cancel'))}</button>` : ''}
            </div>
        </div>
        <div class="order-title-row">
            <h2>#${order.id}</h2>
            <span class="badge ${order.type === 'Pickup' ? 'pickup' : 'delivery'}">${ordEscape(order.type === 'Pickup' ? ordTr('ord_pickup') : ordTr('ord_delivery'))}</span>
            <span class="badge ${order.stage === 'Cancelled' ? 'cancelled' : 'pending'}">${ordEscape(orderStageLabel(order.stage))}</span>
        </div>
        <div class="order-steps">
            ${steps.map(([key, label], index) => {
                const locked = index > currentRank;
                const cls = key === viewing ? 'is-on' : (index < currentRank ? 'is-done' : '');
                return `<button type="button" class="order-step ${cls}" data-order-step="${key}" ${locked ? 'disabled' : ''}>
                    <span>${index + 1}</span>${ordEscape(ordTr(label))}
                </button>`;
            }).join('')}
        </div>
        <div class="order-work">
            <div class="card order-step-body">${orderStepHtml(order, viewing)}</div>
            ${orderSideHtml(order)}
        </div>`;
}

function orderStepHtml(order, step) {
    if (order.stage === 'Cancelled' && step !== 'details') return `<p class="ob-empty">${ordEscape(ordTr('ord_stage_cancelled'))}</p>`;
    if (step === 'details') return orderDetailsHtml(order);
    if (step === 'prepare') return orderPrepareHtml(order);
    if (step === 'send') return orderSendHtml(order);
    if (step === 'track') return orderTrackHtml(order);
    return orderFeedbackHtml(order);
}

function orderDetailsHtml(order) {
    const rows = (order.items || []).map(item => `<tr>
        <td><div class="prod-name">${typeof productThumb === 'function' ? productThumb(item) : ''}<span>${ordEscape(item.name)}</span></div></td>
        <td>${ordEscape(item.sku || '—')}</td>
        <td>${ordEscape(item.size || '—')}</td>
        <td>${ordEscape(item.color || '—')}</td>
        <td>${item.quantity}</td>
        <td>${ordMoney(item.total)}</td>
    </tr>`).join('');
    const place = order.type === 'Pickup'
        ? `<p><strong>${ordEscape(ordTr('ord_pickup_note'))}</strong><br>${ordEscape(order.pickupNote || '—')}</p>`
        : `<p><strong>${ordEscape(ordTr('ord_address'))}</strong><br>${ordEscape(order.address || '—')}</p>`;
    return `
        <h3>${ordEscape(ordTr('ord_step_details'))}</h3>
        <div class="order-facts">
            <div><span>${ordEscape(ordTr('col_date'))}</span><strong>${ordEscape(ordDate(order.date))}</strong></div>
            <div><span>${ordEscape(ordTr('ord_est_date'))}</span><strong>${ordEscape(order.deliveryDate ? shortDate(order.deliveryDate) : '—')}</strong></div>
            <div><span>${ordEscape(ordTr('ord_pay_method'))}</span><strong>${ordEscape(order.paymentMethod || '—')}</strong></div>
            <div><span>${ordEscape(ordTr('ord_payment'))}</span><strong>${ordEscape(order.paymentStatus || '')}</strong></div>
        </div>
        ${place}
        ${order.notes ? `<p><strong>${ordEscape(ordTr('ord_notes'))}</strong><br>${ordEscape(order.notes)}</p>` : ''}
        <div class="table-wrapper"><table class="catalog-table"><thead><tr>
            <th>${ordEscape(ordTr('col_product'))}</th><th>${ordEscape(ordTr('col_sku'))}</th>
            <th>${ordEscape(ordTr('col_size'))}</th><th>${ordEscape(ordTr('col_color'))}</th>
            <th>${ordEscape(ordTr('col_qty'))}</th><th>${ordEscape(ordTr('total'))}</th>
        </tr></thead><tbody>${rows || ''}</tbody></table></div>
        ${order.stage === 'New' ? `<div class="order-actions"><button type="button" class="btn btn-primary" data-order-action="start">${ordEscape(ordTr('ord_start'))}</button></div>` : ''}`;
}

function orderPrepareHtml(order) {
    const editable = order.stage === 'Preparing';
    const blocks = (order.items || []).map(item => {
        const checks = (order.checks || []).filter(c => c.itemId === item.id);
        const boxes = checks.map(c => `<label class="pack-check">
            <input type="checkbox" data-check="${c.id}" ${c.done ? 'checked' : ''} ${editable ? '' : 'disabled'}>
            <span>${ordEscape(ordTr('ord_check_' + c.key))}</span>
        </label>`).join('');
        const meta = [item.sku, item.size, item.color].filter(Boolean).join(' · ');
        return `<article class="pack-block">
            <div class="prod-name">${typeof productThumb === 'function' ? productThumb(item) : ''}<span><strong>${ordEscape(item.name)}</strong><small>${ordEscape(meta)} · ×${item.quantity}</small></span></div>
            ${boxes}
        </article>`;
    }).join('');
    const done = (order.checks || []).filter(c => c.done).length;
    const total = (order.checks || []).length;
    const left = Math.max(0, total - done);
    let action = '';
    if (order.stage === 'New') action = `<button type="button" class="btn btn-primary" data-order-action="start">${ordEscape(ordTr('ord_start'))}</button>`;
    else if (editable) action = `<button type="button" class="btn btn-primary" data-order-action="pack" ${left ? 'disabled' : ''}>${ordEscape(ordTr('ord_pack_done'))}</button>`;
    return `<h3>${ordEscape(ordTr('ord_packing'))}</h3>
        <p class="editor-sub">${ordEscape(ordTr('ord_packing_hint'))} ${total ? ordEscape(ordTr('ord_checks_left').replace('{0}', left)) : ''}</p>
        ${blocks}
        <div class="order-actions">${action}</div>`;
}

function orderSendHtml(order) {
    if (order.stage !== 'Ready' && order.stage !== 'OutForDelivery' && order.stage !== 'ReadyForPickup' && order.stage !== 'AwaitingFeedback' && order.stage !== 'Completed') {
        return `<h3>${ordEscape(ordTr('ord_step_send'))}</h3><p class="ob-empty">${ordEscape(ordTr('ord_locked'))}</p>`;
    }
    if (order.stage === 'Ready' && order.type === 'Delivery') {
        return `<h3>${ordEscape(ordTr('ord_send'))}</h3>
            <div class="form-group"><label>${ordEscape(ordTr('ord_carrier'))}</label><input id="order-carrier" class="form-control" data-i18n-ph="ord_carrier"></div>
            <div class="form-group"><label>${ordEscape(ordTr('ord_tracking'))}</label><input id="order-tracking" class="form-control"></div>
            <div class="order-actions"><button type="button" class="btn btn-primary" data-order-action="dispatch">${ordEscape(ordTr('ord_send'))}</button></div>`;
    }
    if (order.stage === 'Ready') {
        return `<h3>${ordEscape(ordTr('ord_ready_pickup'))}</h3>
            <div class="form-group"><label>${ordEscape(ordTr('ord_pickup_note'))}</label><textarea id="order-pickup-note" class="form-control" rows="2">${ordEscape(order.pickupNote || '')}</textarea></div>
            <div class="order-actions"><button type="button" class="btn btn-primary" data-order-action="dispatch">${ordEscape(ordTr('ord_ready_pickup'))}</button></div>`;
    }
    const sent = order.type === 'Delivery'
        ? `<p><strong>${ordEscape(ordTr('ord_carrier'))}</strong><br>${ordEscape(order.carrier || '—')}</p>
           <p><strong>${ordEscape(ordTr('ord_tracking'))}</strong><br>${ordEscape(order.trackingNumber || '—')}</p>`
        : `<p><strong>${ordEscape(ordTr('ord_pickup_note'))}</strong><br>${ordEscape(order.pickupNote || '—')}</p>`;
    return `<h3>${ordEscape(ordTr('ord_step_send'))}</h3>${sent}`;
}

function orderTrackHtml(order) {
    const live = order.stage === 'OutForDelivery' || order.stage === 'ReadyForPickup';
    if (!live && order.stage !== 'AwaitingFeedback' && order.stage !== 'Completed') {
        return `<h3>${ordEscape(ordTr('ord_step_track'))}</h3><p class="ob-empty">${ordEscape(ordTr('ord_locked'))}</p>`;
    }
    const options = order.type === 'Pickup'
        ? [['Waiting', 'ord_waiting'], ['Arrived', 'ord_arrived'], ['Collected', 'ord_collected']]
        : [['LabelCreated', 'ord_label_created'], ['InTransit', 'ord_transit'], ['OutForDelivery', 'ord_out'], ['Delivered', 'ord_delivered']];
    const current = order.trackingStatus || options[0][0];
    const select = `<select id="order-track-status" class="form-control">${options.map(([value, key]) => `<option value="${value}" ${value === current ? 'selected' : ''}>${ordEscape(ordTr(key))}</option>`).join('')}</select>`;
    if (!live) {
        return `<h3>${ordEscape(ordTr('ord_step_track'))}</h3><p><strong>${ordEscape(ordTr('ord_status'))}</strong><br>${ordEscape(trackLabel(order.trackingStatus, order.type))}</p>`;
    }
    return `<h3>${ordEscape(ordTr('ord_step_track'))}</h3>
        <div class="form-group"><label>${ordEscape(ordTr('ord_status'))}</label>${select}</div>
        <div class="form-group"><label>${ordEscape(ordTr('ord_notes'))}</label><input id="order-track-note" class="form-control" placeholder="${ordEscape(ordTr('ord_note_ph'))}"></div>
        <div class="order-actions"><button type="button" class="btn btn-primary" data-order-action="track">${ordEscape(ordTr('ord_mark_update'))}</button></div>`;
}

function trackLabel(status, type) {
    const map = {
        Waiting: 'ord_waiting', Arrived: 'ord_arrived', Collected: 'ord_collected',
        LabelCreated: 'ord_label_created', InTransit: 'ord_transit', OutForDelivery: 'ord_out', Delivered: 'ord_delivered'
    };
    if (map[status]) return ordTr(map[status]);
    return status || (type === 'Pickup' ? ordTr('ord_waiting') : ordTr('ord_label_created'));
}

function orderFeedbackHtml(order) {
    if (order.stage !== 'AwaitingFeedback' && order.stage !== 'Completed') {
        return `<h3>${ordEscape(ordTr('ord_feedback'))}</h3><p class="ob-empty">${ordEscape(ordTr('ord_locked'))}</p>`;
    }
    const stars = [1, 2, 3, 4, 5].map(n => `<button type="button" class="star ${n <= (order.stage === 'Completed' ? order.rating : orderRating) ? 'is-on' : ''}" data-star="${n}" ${order.stage === 'Completed' ? 'disabled' : ''}>★</button>`).join('');
    if (order.stage === 'Completed') {
        return `<h3>${ordEscape(ordTr('ord_feedback'))}</h3><div class="stars">${stars}</div><p>${ordEscape(order.feedback || '')}</p>`;
    }
    return `<h3>${ordEscape(ordTr('ord_feedback'))}</h3>
        <p class="editor-sub">${ordEscape(ordTr('ord_feedback_hint'))}</p>
        <div class="stars">${stars}</div>
        <div class="form-group"><textarea id="order-feedback" class="form-control" rows="3" placeholder="${ordEscape(ordTr('ord_comment_ph'))}"></textarea></div>
        <div class="order-actions"><button type="button" class="btn btn-primary" data-order-action="complete">${ordEscape(ordTr('ord_complete'))}</button></div>`;
}

function orderSideHtml(order) {
    const c = order.customer || {};
    const events = (order.events || []).map(ev => `<li><strong>${ordEscape(orderEventText(ev))}</strong><small>${ordEscape(ev.actor || '')} · ${ordEscape(ordDate(ev.at))}</small></li>`).join('');
    const paid = String(order.paymentStatus || '').toLowerCase() === 'paid';
    return `<aside class="order-side">
        <div class="card">
            <h3>${ordEscape(ordTr('ord_customer'))}</h3>
            <p><strong>${ordEscape(c.name || '')}</strong></p>
            <p>${ordEscape(c.phone || '')}</p>
            <p>${ordEscape(c.email || '')}</p>
            <p>${ordEscape(c.address || order.address || '')}</p>
        </div>
        <div class="card">
            <h3>${ordEscape(ordTr('ord_payment'))}</h3>
            <div class="rev-row"><span>${ordEscape(ordTr('ord_items_count').replace('{0}', (order.items || []).length))}</span><b>${ordMoney(order.total)}</b></div>
            <div class="rev-row"><span>${ordEscape(ordTr('ord_pay_method'))}</span><b>${ordEscape(order.paymentMethod || '—')}</b></div>
            <div class="rev-row total"><span>${paid ? ordEscape(ordTr('paid')) : ordEscape(ordTr('unpaid'))}</span><b>${ordMoney(order.total)}</b></div>
        </div>
        <div class="card">
            <h3>${ordEscape(ordTr('ord_timeline'))}</h3>
            ${order.stage !== 'Cancelled' && order.stage !== 'Completed' ? `<div class="note-add"><input id="order-note" class="form-control" placeholder="${ordEscape(ordTr('ord_note_ph'))}"><button type="button" class="btn btn-secondary" data-order-action="note">${ordEscape(ordTr('ord_add_note'))}</button></div>` : ''}
            <ul class="timeline">${events || `<li><small>${ordEscape(ordTr('ord_empty'))}</small></li>`}</ul>
        </div>
    </aside>`;
}

async function postShopOrder(path, body, advance) {
    const order = await api(path, { method: 'POST', body: JSON.stringify(Object.assign({ actor: orderActor() }, body || {})) });
    if (advance) orderViewStep = orderStepKey(order.stage);
    if (order.rating) orderRating = order.rating;
    activeOrder = order;
    paintOrderDetail();
    try {
        setShopOrders(await api('/api/shop-orders'));
        renderShopOrders();
    } catch (e) { console.error(e); }
}

function showOrderEditor() {
    document.getElementById('orders-board').hidden = true;
    document.getElementById('order-detail').hidden = true;
    const editor = document.getElementById('order-editor');
    editor.hidden = false;
    document.getElementById('oe-address').value = '';
    document.getElementById('oe-pickup').value = '';
    document.getElementById('oe-notes').value = '';
    document.getElementById('oe-date').value = '';
    document.getElementById('oe-paid').checked = false;
    document.getElementById('oe-pay').value = 'Cash';
    const delivery = document.querySelector('input[name="oe-method"][value="Delivery"]');
    if (delivery) delivery.checked = true;
    syncOrderMethod();
    fillOrderCustomers('');
    orderDraftLines = [{ partId: 0, qty: 1, price: 0 }];
    paintOrderLines();
}

function fillOrderCustomers(selectedId) {
    const select = document.getElementById('oe-customer');
    if (!select) return;
    const keep = selectedId === undefined ? select.value : String(selectedId || '');
    select.innerHTML = `<option value="">${ordEscape(ordTr('ord_select_customer'))}</option>` +
        orderCustomers().map(c => `<option value="${c.id}">${ordEscape(c.name)}</option>`).join('');
    if (keep && [...select.options].some(o => o.value === keep)) select.value = keep;
    const customer = orderCustomers().find(c => String(c.id) === select.value);
    const address = document.getElementById('oe-address');
    if (customer && address && !address.value.trim()) address.value = customer.address || '';
}

function syncOrderMethod() {
    const method = document.querySelector('input[name="oe-method"]:checked')?.value || 'Delivery';
    const address = document.getElementById('oe-address-wrap');
    const pickup = document.getElementById('oe-pickup-wrap');
    if (address) address.hidden = method !== 'Delivery';
    if (pickup) pickup.hidden = method !== 'Pickup';
}

function paintOrderLines() {
    const host = document.getElementById('oe-lines');
    if (!host) return;
    host.innerHTML = orderDraftLines.map((line, index) => `<div class="oe-line" data-line="${index}">
        <label class="oe-field oe-product"><span>${ordEscape(ordTr('col_product'))}</span><select class="form-control" data-field="product">${orderProductOptions(line.partId)}</select></label>
        <label class="oe-field oe-qty"><span>${ordEscape(ordTr('col_qty'))}</span><input class="form-control" data-field="qty" type="number" min="1" value="${line.qty}"></label>
        <label class="oe-field oe-price"><span>${ordEscape(ordTr('col_price'))}</span><input class="form-control" data-field="price" type="number" min="0" step="0.01" value="${Number(line.price || 0).toFixed(2)}"></label>
        <button type="button" class="icon-btn oe-remove" data-order-action="remove-line" data-line="${index}" aria-label="Remove"><span class="material-symbols-rounded">close</span></button>
    </div>`).join('');
    paintOrderTotal();
}

function orderProductOptions(selected) {
    const list = orderProducts().filter(p => !p.isInactive);
    return `<option value="">${ordEscape(ordTr('ord_select_product'))}</option>` + list.map(p =>
        `<option value="${p.id}" ${Number(selected) === Number(p.id) ? 'selected' : ''}>${ordEscape(p.name)}${p.sku ? ' · ' + ordEscape(p.sku) : ''}</option>`
    ).join('');
}

function paintOrderTotal() {
    const total = orderDraftLines.reduce((sum, line) => sum + (Number(line.qty) || 0) * (Number(line.price) || 0), 0);
    const el = document.getElementById('oe-total');
    if (el) el.textContent = ordMoney(total);
}

async function saveShopOrder() {
    const customerId = Number(document.getElementById('oe-customer').value);
    const method = document.querySelector('input[name="oe-method"]:checked')?.value || 'Delivery';
    const address = document.getElementById('oe-address').value.trim();
    if (!customerId) { toast(ordTr('ord_need_customer'), 'error'); return; }
    if (method === 'Delivery' && !address) { toast(ordTr('ord_need_address'), 'error'); return; }
    const items = orderDraftLines.filter(line => line.partId > 0 && line.qty > 0).map(line => ({
        partId: Number(line.partId), quantity: Number(line.qty), price: Number(line.price) || 0
    }));
    if (!items.length) { toast(ordTr('ord_need_items'), 'error'); return; }
    const btn = document.getElementById('btn-order-save');
    if (btn) btn.disabled = true;
    try {
        await api('/api/shop-orders', {
            method: 'POST',
            body: JSON.stringify({
                customerId,
                fulfillmentType: method,
                address,
                pickupNote: document.getElementById('oe-pickup').value.trim(),
                deliveryDate: document.getElementById('oe-date').value,
                paymentMethod: document.getElementById('oe-pay').value,
                isPaid: document.getElementById('oe-paid').checked,
                notes: document.getElementById('oe-notes').value.trim(),
                actor: orderActor(),
                items
            })
        });
        toast(ordTr('saved_ok'), 'success');
        await loadData();
        showOrdersBoard();
    } catch (err) {
        toast(err.message, 'error');
    } finally {
        if (btn) btn.disabled = false;
    }
}

function setupOrdersUi() {
    const root = document.getElementById('orders');
    if (!root || root.dataset.wired) return;
    root.dataset.wired = '1';
    root.addEventListener('click', onOrdersClick);
    root.addEventListener('change', onOrdersChange);
    root.addEventListener('input', onOrdersInput);
}

async function onOrdersClick(e) {
    const open = e.target.closest('[data-open-order]');
    if (open) {
        try { await openShopOrder(Number(open.dataset.openOrder)); }
        catch (err) { toast(err.message, 'error'); }
        return;
    }
    const step = e.target.closest('[data-order-step]');
    if (step && !step.disabled) {
        orderViewStep = step.dataset.orderStep;
        paintOrderDetail();
        return;
    }
    const star = e.target.closest('[data-star]');
    if (star && !star.disabled) {
        const comment = document.getElementById('order-feedback')?.value || '';
        orderRating = Number(star.dataset.star);
        paintOrderDetail();
        const box = document.getElementById('order-feedback');
        if (box) box.value = comment;
        return;
    }
    const action = e.target.closest('[data-order-action]');
    if (!action) return;
    const kind = action.dataset.orderAction;
    try {
        if (kind === 'add-customer') {
            window._orderCustomerPick = true;
            if (typeof openCustomerModal === 'function') openCustomerModal(null);
        } else if (kind === 'board') showOrdersBoard();
        else if (kind === 'new' || action.id === 'btn-new-order') showOrderEditor();
        else if (kind === 'remove-line') {
            orderDraftLines.splice(Number(action.dataset.line), 1);
            if (!orderDraftLines.length) orderDraftLines.push({ partId: 0, qty: 1, price: 0 });
            paintOrderLines();
        } else if (kind === 'start' && activeOrder) await postShopOrder('/api/shop-orders/' + activeOrder.id + '/start', {}, true);
        else if (kind === 'pack' && activeOrder) await postShopOrder('/api/shop-orders/' + activeOrder.id + '/pack', {}, true);
        else if (kind === 'dispatch' && activeOrder) {
            await postShopOrder('/api/shop-orders/' + activeOrder.id + '/dispatch', {
                carrier: document.getElementById('order-carrier')?.value || '',
                trackingNumber: document.getElementById('order-tracking')?.value || '',
                note: document.getElementById('order-pickup-note')?.value || ''
            }, true);
        } else if (kind === 'track' && activeOrder) {
            await postShopOrder('/api/shop-orders/' + activeOrder.id + '/track', {
                status: document.getElementById('order-track-status')?.value || '',
                note: document.getElementById('order-track-note')?.value || ''
            }, true);
        } else if (kind === 'complete' && activeOrder) {
            await postShopOrder('/api/shop-orders/' + activeOrder.id + '/feedback', {
                rating: orderRating,
                comment: document.getElementById('order-feedback')?.value || ''
            }, true);
            toast(ordTr('saved_ok'), 'success');
        } else if (kind === 'note' && activeOrder) {
            await postShopOrder('/api/shop-orders/' + activeOrder.id + '/note', {
                message: document.getElementById('order-note')?.value || ''
            }, false);
        } else if (kind === 'cancel' && activeOrder) {
            const ok = await confirmDialog(ordTr('ord_cancel_ask'), { confirmText: ordTr('ord_cancel'), danger: true });
            if (!ok) return;
            await postShopOrder('/api/shop-orders/' + activeOrder.id + '/cancel', {}, false);
            orderViewStep = 'details';
            await loadData();
            if (activeOrder) paintOrderDetail();
        }
    } catch (err) { toast(err.message, 'error'); }
}

function onOrdersChange(e) {
    if (e.target.id === 'order-filter-method') { renderShopOrders(); return; }
    if (e.target.name === 'oe-method') { syncOrderMethod(); return; }
    if (e.target.id === 'oe-customer') {
        const customer = orderCustomers().find(c => Number(c.id) === Number(e.target.value));
        const address = document.getElementById('oe-address');
        if (customer && address && !address.value.trim()) address.value = customer.address || '';
        return;
    }
    if (e.target.dataset.check && activeOrder) {
        const box = e.target;
        postShopOrder('/api/shop-orders/' + activeOrder.id + '/checks', {
            checkId: Number(box.dataset.check),
            checked: box.checked
        }, false).catch(err => { box.checked = !box.checked; toast(err.message, 'error'); });
        return;
    }
    const line = e.target.closest('[data-line]');
    if (!line || e.target.dataset.field !== 'product') return;
    const draft = orderDraftLines[Number(line.dataset.line)];
    if (!draft) return;
    const product = orderProducts().find(p => Number(p.id) === Number(e.target.value));
    draft.partId = product ? Number(product.id) : 0;
    draft.price = product ? Number(product.price) || 0 : 0;
    const price = line.querySelector('[data-field="price"]');
    if (price) price.value = draft.price.toFixed(2);
    paintOrderTotal();
}

function onOrdersInput(e) {
    if (e.target.id === 'order-search') { renderShopOrders(); return; }
    const line = e.target.closest('[data-line]');
    if (!line) return;
    const draft = orderDraftLines[Number(line.dataset.line)];
    if (!draft) return;
    if (e.target.dataset.field === 'qty') draft.qty = Number(e.target.value);
    if (e.target.dataset.field === 'price') draft.price = Number(e.target.value);
    paintOrderTotal();
}

setupOrdersUi();
document.getElementById('btn-new-order')?.addEventListener('click', showOrderEditor);
document.getElementById('btn-order-editor-back')?.addEventListener('click', showOrdersBoard);
document.getElementById('btn-order-editor-cancel')?.addEventListener('click', showOrdersBoard);
document.getElementById('btn-order-save')?.addEventListener('click', saveShopOrder);
document.getElementById('btn-oe-add')?.addEventListener('click', () => {
    orderDraftLines.push({ partId: 0, qty: 1, price: 0 });
    paintOrderLines();
});
