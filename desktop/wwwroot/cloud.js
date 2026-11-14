(function () {
    const card = document.getElementById('cloud-card');
    if (!card) return;

    const AR = {
        title: 'ربط الموقع',
        hint: 'ينشر هذا الكمبيوتر الكتالوج على الموقع (المنتجات والأسعار والصور والعروض والتوفر فقط) ويستلم طلبات الموقع. بيانات العمل — المبيعات والتكاليف والمصروفات والموردون والموظفون والزبائن — تبقى على هذا الكمبيوتر فقط.',
        url: 'عنوان الموقع',
        key: 'مفتاح مزامنة المحل',
        name: 'اسم هذا الجهاز',
        check: 'فحص الاتصال',
        website: 'الموقع',
        laptop: 'هذا الجهاز',
        last: 'آخر مزامنة',
        queue: 'بانتظار الإرسال',
        weborders: 'طلبات الموقع',
        activity: 'النشاط الأخير',
        disconnect: 'قطع الربط',
        sync: 'مزامنة الآن'
    };

    const isAr = () => document.documentElement.lang === 'ar' || document.documentElement.dir === 'rtl';
    const t = (en, ar) => (isAr() ? ar : en);
    const el = (id) => document.getElementById(id);
    const note = (msg, type) => (typeof toast === 'function' ? toast(msg, type) : null);

    let lastState = null;
    let pollTimer = null;
    let pendingMode = null;

    function translate() {
        const ar = isAr();
        card.querySelectorAll('[data-cs]').forEach((node) => {
            // Remember the English text from the page, so switching back from Arabic restores it
            if (node.dataset.csEn === undefined) node.dataset.csEn = node.textContent;
            const text = ar ? AR[node.dataset.cs] : node.dataset.csEn;
            if (text) node.textContent = text;
        });
        if (lastState) render(lastState);
    }

    function pill(text, cls) {
        const node = el('cs-pill');
        if (!text) { node.hidden = true; return; }
        node.hidden = false;
        node.className = 'settings-status-pill' + (cls ? ' ' + cls : '');
        node.textContent = text;
    }

    function setBusy(on) {
        ['cs-check', 'cs-connect', 'cs-sync', 'cs-disconnect'].forEach((id) => {
            const btn = el(id);
            if (btn) btn.disabled = on;
        });
    }

    function render(s) {
        lastState = s;
        const linked = !!s.linked;
        el('cs-link').hidden = linked;
        el('cs-linked').hidden = !linked;

        if (!linked) {
            if (!el('cs-name').value) el('cs-name').value = s.deviceName || s.machineName || '';
            pill(t('Not linked', 'غير مربوط'));
            return;
        }

        el('cs-f-url').textContent = s.url || '—';
        el('cs-f-name').textContent = s.deviceName || s.machineName || '—';
        el('cs-f-last').textContent = s.lastSync || t('Never', 'أبداً');
        el('cs-f-pending').textContent = String(s.pending ?? 0);
        el('cs-f-orders').textContent = String(s.webOrders ?? 0);

        if (s.revoked) pill(t('Unlinked on the website', 'أُلغي الربط من الموقع'), 'warn');
        else if (s.busy) pill(s.phase || t('Syncing…', 'جارٍ المزامنة…'), 'syncing');
        else if (s.needsSnapshot) pill(t('Downloading shop data', 'تنزيل بيانات المحل'), 'syncing');
        else if (s.role === 'founder' && !s.founded) pill(t('Uploading shop data', 'رفع بيانات المحل'), 'syncing');
        else pill(t('Linked', 'مربوط'));

        const progress = el('cs-progress');
        const bar = el('cs-progress-bar');
        if (s.busy || s.needsSnapshot || (s.role === 'founder' && !s.founded)) {
            progress.hidden = false;
            const total = s.progressTotal || 0;
            const done = s.progressDone || 0;
            if (total > 0) {
                progress.classList.remove('indeterminate');
                bar.style.width = Math.min(100, Math.round((done / total) * 100)) + '%';
                el('cs-progress-text').textContent = (s.phase || t('Working…', 'جارٍ العمل…')) + ' · ' + done + ' / ' + total;
            } else {
                progress.classList.add('indeterminate');
                bar.style.width = '';
                el('cs-progress-text').textContent = s.phase || t('Working…', 'جارٍ العمل…');
            }
        } else {
            progress.hidden = true;
        }

        const err = el('cs-error');
        if (s.lastError) {
            err.hidden = false;
            err.textContent = s.lastError;
        } else {
            err.hidden = true;
            err.textContent = '';
        }

        const log = el('cs-log');
        log.replaceChildren();
        (s.log || []).forEach((row) => {
            const li = document.createElement('li');
            const time = document.createElement('time');
            time.textContent = row.at || '';
            li.appendChild(time);
            li.appendChild(document.createTextNode(row.message || ''));
            log.appendChild(li);
        });

        if (s.busy || s.needsSnapshot || (s.role === 'founder' && !s.founded)) schedulePoll(2500);
        else stopPoll();
    }

    function schedulePoll(ms) {
        stopPoll();
        pollTimer = setTimeout(() => { load(); }, ms);
    }

    function stopPoll() {
        if (pollTimer) { clearTimeout(pollTimer); pollTimer = null; }
    }

    async function readJson(res) {
        const data = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(data.error || t('Request failed.', 'فشل الطلب.'));
        return data;
    }

    async function load() {
        try {
            const res = await fetch('/api/cloud');
            if (res.ok) render(await res.json());
        } catch { /* card stays as-is */ }
    }

    async function check() {
        const url = el('cs-url').value.trim();
        const shopKey = el('cs-key').value.trim();
        const box = el('cs-check-result');
        const connect = el('cs-connect');
        pendingMode = null;
        connect.hidden = true;
        box.hidden = true;
        if (!url || !shopKey) {
            note(t('Enter the website address and the shop sync key.', 'أدخل عنوان الموقع ومفتاح مزامنة المحل.'), 'error');
            return;
        }
        setBusy(true);
        try {
            const hub = await readJson(await fetch('/api/cloud/check', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ url, shopKey })
            }));
            box.hidden = false;
            box.className = 'form-hint cloud-choice' + (hub.state === 'founding' ? ' warn' : '');
            // This PC is the shop's only data store: it always publishes, it never downloads ("join" is gone)
            pendingMode = 'create';
            box.textContent = hub.state === 'empty'
                ? t('The website is ready. This PC will publish its catalogue (products, prices, photos, promotions, availability) and receive website orders. Business data stays here.',
                    'الموقع جاهز. سينشر هذا الكمبيوتر الكتالوج (المنتجات والأسعار والصور والعروض والتوفر) ويستلم طلبات الموقع. بيانات العمل تبقى هنا.')
                : t('This website was linked before. Publishing replaces the website catalogue with this PC\'s and removes any old shop data stored there. Website accounts and orders are kept.',
                    'هذا الموقع كان مربوطاً من قبل. النشر يستبدل كتالوج الموقع بكتالوج هذا الكمبيوتر ويحذف أي بيانات محل قديمة مخزنة هناك. حسابات وطلبات الموقع تبقى.');
            el('cs-connect-label').textContent = t('Publish to website', 'النشر على الموقع');
            connect.hidden = false;
        } catch (err) {
            box.hidden = false;
            box.className = 'form-hint cloud-error';
            box.textContent = err.message;
        } finally {
            setBusy(false);
        }
    }

    async function connect() {
        if (!pendingMode) return;
        const url = el('cs-url').value.trim();
        const shopKey = el('cs-key').value.trim();
        const name = el('cs-name').value.trim();
        const ok = pendingMode === 'create'
            ? await confirmDialog(t(
                'Publish this PC\'s catalogue to the website and receive its orders here? Sales, costs, expenses, suppliers, staff and customers are never sent.',
                'نشر كتالوج هذا الكمبيوتر على الموقع واستلام طلباته هنا؟ المبيعات والتكاليف والمصروفات والموردون والموظفون والزبائن لا تُرسل أبداً.'
            ), { danger: false, confirmText: t('Publish', 'نشر') })
            // Joining replaces this laptop's data, so it gets the red (danger) button
            : await confirmDialog(t(
                'Join the shop? This laptop\'s current products, stock, customers and staff logins will be replaced with the shop\'s data. A backup is saved first.',
                'الانضمام إلى المحل؟ ستُستبدل منتجات هذا الجهاز ومخزونه وزبائنه وحسابات الموظفين ببيانات المحل. يُحفظ نسخة احتياطية أولاً.'
            ), { danger: true, confirmText: t('Join and replace', 'الانضمام والاستبدال') });
        if (!ok) return;
        setBusy(true);
        try {
            const s = await readJson(await fetch('/api/cloud/connect', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ url, shopKey, name, mode: pendingMode })
            }));
            render(s);
            note(pendingMode === 'create'
                ? t('Shop created. Uploading this laptop\'s data…', 'تم إنشاء المحل. جارٍ رفع بيانات هذا الجهاز…')
                : t('Linked. Downloading the shop\'s data…', 'تم الربط. جارٍ تنزيل بيانات المحل…'));
            schedulePoll(1500);
        } catch (err) {
            note(err.message, 'error');
        } finally {
            setBusy(false);
        }
    }

    async function syncNow() {
        setBusy(true);
        try {
            const s = await readJson(await fetch('/api/cloud/sync', { method: 'POST' }));
            render(s);
            if (s.lastError) note(s.lastError, 'error');
            else note(t('Sync finished.', 'انتهت المزامنة.'));
        } catch (err) {
            note(err.message, 'error');
        } finally {
            setBusy(false);
        }
    }

    async function disconnect() {
        if (!await confirmDialog(t(
            'Disconnect this laptop? Its data stays as it is. You can link it again later.',
            'قطع ربط هذا الجهاز؟ تبقى بياناته كما هي. يمكن ربطه لاحقاً.'
        ), { danger: false, confirmText: t('Disconnect', 'قطع الربط') })) return;
        setBusy(true);
        try {
            render(await readJson(await fetch('/api/cloud/disconnect', { method: 'POST' })));
            el('cs-check-result').hidden = true;
            el('cs-connect').hidden = true;
            pendingMode = null;
            stopPoll();
            note(t('Disconnected.', 'تم قطع الربط.'));
        } catch (err) {
            note(err.message, 'error');
        } finally {
            setBusy(false);
        }
    }

    el('cs-check').addEventListener('click', check);
    el('cs-connect').addEventListener('click', connect);
    el('cs-sync').addEventListener('click', syncNow);
    el('cs-disconnect').addEventListener('click', disconnect);

    const prevI18n = window.applyI18n;
    window.applyI18n = function () {
        if (typeof prevI18n === 'function') prevI18n();
        translate();
    };

    translate();
    load();
})();
