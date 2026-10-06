(function () {
    'use strict';

    const visibleBranchCodes = new Set(['MAIN', 'ENRIQUEZ']);
    const displayLimits = { serving: 5, waiting: 9, payment: 5 };

    function normalizeBranchCode(value) {
        const normalized = String(value || '').trim().toUpperCase();
        return visibleBranchCodes.has(normalized) ? normalized : 'MAIN';
    }

    const params = new URLSearchParams(window.location.search);
    const baseApiUrl = params.get('api') || new URL('status.php', window.location.href).toString();
    const defaultRefreshMs = 8000;
    let currentBranch = normalizeBranchCode(params.get('branch'));
    let refreshTimer = null;
    let hasLoadedOnce = false;

    const elements = {
        clockTime: document.getElementById('clockTime'),
        clockDate: document.getElementById('clockDate'),
        branchName: document.getElementById('branchName'),
        branchAddress: document.getElementById('branchAddress'),
        branchSelect: document.getElementById('branchSelect'),
        errorBanner: document.getElementById('errorBanner'),
        errorMessage: document.getElementById('errorMessage'),
        loadingPanel: document.getElementById('loadingPanel'),
        statusContent: document.getElementById('statusContent'),
        lastUpdated: document.getElementById('lastUpdated'),
        nowServingCount: document.getElementById('nowServingCount'),
        paymentCount: document.getElementById('paymentCount'),
        waitingCount: document.getElementById('waitingCount'),
        summaryWaiting: document.getElementById('summaryWaiting'),
        summaryServing: document.getElementById('summaryServing'),
        summaryPayment: document.getElementById('summaryPayment'),
        summaryCompleted: document.getElementById('summaryCompleted'),
        nowServingList: document.getElementById('nowServingList'),
        paymentList: document.getElementById('paymentList'),
        waitingList: document.getElementById('waitingList'),
    };

    function list(value) {
        return Array.isArray(value) ? value : [];
    }

    function text(value, fallback) {
        const normalized = String(value || '').trim();
        return normalized || fallback || '';
    }

    function formatClock(value) {
        return new Intl.DateTimeFormat('en-PH', {
            hour: 'numeric',
            minute: '2-digit',
            second: '2-digit',
            hour12: true,
        }).format(value);
    }

    function formatDate(value) {
        return new Intl.DateTimeFormat('en-PH', {
            weekday: 'long',
            month: 'short',
            day: 'numeric',
        }).format(value);
    }

    function formatTime(value) {
        if (!value) return '';

        const date = new Date(String(value).replace(' ', 'T'));
        if (Number.isNaN(date.getTime())) return String(value);

        return new Intl.DateTimeFormat('en-PH', {
            hour: 'numeric',
            minute: '2-digit',
            hour12: true,
        }).format(date);
    }

    function updateClock() {
        const now = new Date();
        elements.clockTime.textContent = formatClock(now);
        elements.clockDate.textContent = formatDate(now);
    }

    function appendText(parent, tagName, className, value) {
        const node = document.createElement(tagName);
        node.className = className;
        node.textContent = value;
        parent.appendChild(node);
        return node;
    }

    function petInitial(name) {
        return text(name, 'P').charAt(0).toUpperCase();
    }

    function createServingCard(item, index, animate) {
        const card = document.createElement('article');
        card.className = `status-card serving-card${animate ? ' enter' : ''}`;
        card.style.setProperty('--row-delay', `${Math.min(index, 5) * 40}ms`);
        appendText(card, 'span', 'pet-initial', petInitial(item.petName));

        const body = document.createElement('div');
        body.className = 'card-body';
        const headline = document.createElement('div');
        headline.className = 'card-headline';
        appendText(headline, 'strong', 'reference', text(item.reference, '-'));
        appendText(headline, 'span', 'stage-pill', text(item.stage, 'In service'));
        body.appendChild(headline);
        appendText(body, 'p', 'pet-name', text(item.petName, 'Pet'));

        const service = text(item.service, 'Clinic service');
        const species = text(item.species);
        appendText(body, 'p', 'service-line', species ? `${service} · ${species}` : service);

        const detail = document.createElement('div');
        detail.className = 'card-detail';
        appendText(detail, 'span', '', text(item.veterinarianName) ? `With ${text(item.veterinarianName)}` : 'Clinic team');
        const time = formatTime(item.time);
        if (time) appendText(detail, 'time', '', time);
        body.appendChild(detail);
        card.appendChild(body);
        return card;
    }

    function createWaitingCard(item, index, animate) {
        const card = document.createElement('article');
        card.className = `status-card waiting-card${animate ? ' enter' : ''}`;
        card.style.setProperty('--row-delay', `${Math.min(index, 8) * 32}ms`);
        appendText(card, 'span', 'queue-position', String(index + 1));

        const body = document.createElement('div');
        body.className = 'card-body';
        const headline = document.createElement('div');
        headline.className = 'card-headline';
        appendText(headline, 'strong', 'reference', text(item.reference, '-'));
        appendText(headline, 'span', 'source-pill', item.type === 'booking' ? 'Scheduled' : 'Walk-in');
        body.appendChild(headline);
        appendText(body, 'p', 'service-line', `${text(item.petName, 'Pet')} · ${text(item.service, 'Clinic service')}`);
        card.appendChild(body);

        const time = formatTime(item.time);
        if (time) appendText(card, 'time', 'row-time', time);
        return card;
    }

    function createPaymentCard(item, index, animate) {
        const card = document.createElement('article');
        card.className = `status-card payment-card${animate ? ' enter' : ''}`;
        card.style.setProperty('--row-delay', `${Math.min(index, 5) * 40}ms`);

        const body = document.createElement('div');
        body.className = 'card-body';
        const headline = document.createElement('div');
        headline.className = 'card-headline';
        appendText(headline, 'strong', 'reference', text(item.reference, '-'));
        appendText(headline, 'span', 'cashier-pill', 'Cashier');
        body.appendChild(headline);
        appendText(body, 'p', 'pet-name', text(item.petName, 'Pet'));
        appendText(body, 'p', 'service-line', text(item.service, 'Clinic service'));

        const time = formatTime(item.time);
        if (time) appendText(body, 'p', 'updated-time', `Updated ${time}`);
        card.appendChild(body);
        return card;
    }

    function renderEmpty(container, title, detail) {
        const empty = document.createElement('div');
        empty.className = 'empty-state';
        appendText(empty, 'strong', '', title);
        appendText(empty, 'span', '', detail);
        container.appendChild(empty);
    }

    function renderMore(container, count) {
        if (count <= 0) return;
        appendText(container, 'div', 'more-row', `${count} more ${count === 1 ? 'patient' : 'patients'} tracked at reception`);
    }

    function renderList(container, items, options) {
        const allItems = list(items);
        const visibleItems = allItems.slice(0, options.limit);
        container.replaceChildren();

        if (visibleItems.length === 0) {
            renderEmpty(container, options.emptyTitle, options.emptyDetail);
            return;
        }

        visibleItems.forEach((item, index) => {
            container.appendChild(options.createCard(item, index, !hasLoadedOnce));
        });
        renderMore(container, Math.max(0, allItems.length - options.limit));
    }

    function setCount(element, value) {
        element.textContent = String(Number(value) || 0);
    }

    function buildStatusUrl() {
        const url = new URL(baseApiUrl, window.location.href);
        url.searchParams.set('branch', currentBranch);
        url.searchParams.set('_', String(Date.now()));
        return url.toString();
    }

    function renderBranchOptions(branches, selectedBranch) {
        const availableBranches = list(branches).filter((branch) => (
            visibleBranchCodes.has(String(branch && branch.code || '').trim().toUpperCase())
        ));
        const selectedCode = normalizeBranchCode(text(selectedBranch && selectedBranch.code, currentBranch));
        const visibleSelectedBranch = availableBranches.find((branch) => (
            normalizeBranchCode(branch.code) === selectedCode
        )) || selectedBranch || availableBranches[0];

        if (availableBranches.length > 0) {
            const options = availableBranches.map((branch) => {
                const option = document.createElement('option');
                option.value = text(branch.code, branch.id);
                option.textContent = text(branch.name, 'Clinic location');
                return option;
            });
            elements.branchSelect.replaceChildren(...options);
        }

        currentBranch = normalizeBranchCode(text(visibleSelectedBranch && visibleSelectedBranch.code, selectedCode));
        elements.branchSelect.value = currentBranch;
        elements.branchName.textContent = text(visibleSelectedBranch && visibleSelectedBranch.name, 'VFC Pharmacy / Main Clinic');
        elements.branchAddress.textContent = text(visibleSelectedBranch && visibleSelectedBranch.address, 'Vetfocus Animal Care Clinic');
    }

    function renderStatus(data) {
        renderBranchOptions(data.branches, data.branch);
        const sections = data.sections || {};
        const queue = list(sections.queue);
        const bookings = list(sections.bookings);
        const billing = list(sections.billing);
        const nowServing = queue.filter((item) => ['In Service', 'Diagnosis Done'].includes(item.stage));
        const waitingQueue = queue.filter((item) => item.stage === 'Waiting');
        const waiting = waitingQueue.concat(bookings);
        const completedToday = Number(data.summary && data.summary.completedToday) || list(sections.completed).length;

        setCount(elements.nowServingCount, nowServing.length);
        setCount(elements.paymentCount, billing.length);
        setCount(elements.waitingCount, waiting.length);
        setCount(elements.summaryWaiting, waiting.length);
        setCount(elements.summaryServing, nowServing.length);
        setCount(elements.summaryPayment, billing.length);
        setCount(elements.summaryCompleted, completedToday);

        renderList(elements.nowServingList, nowServing, {
            limit: displayLimits.serving,
            createCard: createServingCard,
            emptyTitle: 'No patients in service',
            emptyDetail: 'The next patient will appear here.',
        });
        renderList(elements.waitingList, waiting, {
            limit: displayLimits.waiting,
            createCard: createWaitingCard,
            emptyTitle: 'The waiting area is clear',
            emptyDetail: 'New arrivals will appear here.',
        });
        renderList(elements.paymentList, billing, {
            limit: displayLimits.payment,
            createCard: createPaymentCard,
            emptyTitle: 'No payments pending',
            emptyDetail: 'Payment calls will appear here.',
        });

        const generatedAt = data.generatedAt ? formatTime(data.generatedAt) : '';
        elements.lastUpdated.textContent = generatedAt ? `Last updated ${generatedAt}` : 'Waiting for first update';
        elements.loadingPanel.hidden = true;
        elements.statusContent.hidden = false;
        hasLoadedOnce = true;
    }

    function showError(message) {
        elements.errorMessage.textContent = message || 'Existing status remains visible while reconnecting.';
        elements.errorBanner.hidden = false;
        if (!hasLoadedOnce) {
            elements.loadingPanel.hidden = true;
            elements.statusContent.hidden = true;
        }
    }

    function clearError() {
        elements.errorBanner.hidden = true;
    }

    function scheduleNextLoad(refreshSeconds) {
        const refreshMs = Math.max(4000, Number(refreshSeconds || 0) * 1000 || defaultRefreshMs);
        window.clearTimeout(refreshTimer);
        refreshTimer = window.setTimeout(loadStatus, refreshMs);
    }

    async function loadStatus() {
        try {
            const response = await window.fetch(buildStatusUrl(), {
                cache: 'no-store',
                headers: { Accept: 'application/json', 'Cache-Control': 'no-cache' },
            });
            const data = await response.json();

            if (!response.ok || data.success === false) {
                throw new Error(data.message || 'Unable to load TV status display.');
            }

            clearError();
            renderStatus(data);
            scheduleNextLoad(data.refreshSeconds);
        } catch (error) {
            showError(error.message);
            scheduleNextLoad(defaultRefreshMs / 1000);
        }
    }

    updateClock();
    window.setInterval(updateClock, 1000);
    elements.branchSelect.addEventListener('change', () => {
        const nextBranch = normalizeBranchCode(elements.branchSelect.value);
        if (!nextBranch || nextBranch === currentBranch) return;

        currentBranch = nextBranch;
        const nextUrl = new URL(window.location.href);
        nextUrl.searchParams.set('branch', currentBranch);
        window.history.replaceState({}, '', `${nextUrl.pathname}${nextUrl.search}${nextUrl.hash}`);

        window.clearTimeout(refreshTimer);
        hasLoadedOnce = false;
        elements.errorBanner.hidden = true;
        elements.statusContent.hidden = true;
        elements.loadingPanel.hidden = false;
        loadStatus();
    });
    loadStatus();
}());
