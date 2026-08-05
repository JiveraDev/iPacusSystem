(function () {
    'use strict';

    const params = new URLSearchParams(window.location.search);
    const baseApiUrl = params.get('api') || new URL('status.php', window.location.href).toString();
    let currentBranch = params.get('branch') || 'MAIN';
    const defaultRefreshMs = 8000;
    const maxNowServing = 6;
    const maxPayment = 5;
    const maxWaiting = 12;

    let refreshTimer = null;
    let hasLoadedOnce = false;

    const elements = {
        clockTime: document.getElementById('clockTime'),
        clockDate: document.getElementById('clockDate'),
        branchName: document.getElementById('branchName'),
        branchSelect: document.getElementById('branchSelect'),
        errorBanner: document.getElementById('errorBanner'),
        errorMessage: document.getElementById('errorMessage'),
        loadingPanel: document.getElementById('loadingPanel'),
        statusGrid: document.getElementById('statusGrid'),
        lastUpdated: document.getElementById('lastUpdated'),
        nowServingCount: document.getElementById('nowServingCount'),
        paymentCount: document.getElementById('paymentCount'),
        waitingCount: document.getElementById('waitingCount'),
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
        if (!value) {
            return '';
        }

        const normalized = String(value).replace(' ', 'T');
        const date = new Date(normalized);

        if (Number.isNaN(date.getTime())) {
            return String(value);
        }

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

    function sourceLabel(item) {
        if (item.type === 'booking') {
            return 'Booking';
        }

        if (item.type === 'queue') {
            return 'Queue';
        }

        if (item.type === 'billing') {
            return 'Billing';
        }

        return '';
    }

    function stageClass(item) {
        const stage = text(item.stage).toLowerCase();

        if (stage.includes('payment')) {
            return 'stage-payment';
        }

        if (stage.includes('service') || stage.includes('diagnosis')) {
            return 'stage-service';
        }

        if (stage.includes('complete') || stage.includes('done')) {
            return 'stage-done';
        }

        return '';
    }

    function appendText(parent, tagName, className, value) {
        const node = document.createElement(tagName);
        node.className = className;
        node.textContent = value;
        parent.appendChild(node);
        return node;
    }

    function createCard(item, options) {
        const compact = Boolean(options && options.compact);
        const card = document.createElement('article');
        card.className = ['status-card', compact ? 'compact-card' : '', stageClass(item)].filter(Boolean).join(' ');

        const main = document.createElement('div');
        main.className = 'status-main';

        appendText(main, 'p', 'pet-name', text(item.petName, 'Pet'));

        if (!compact) {
            const species = text(item.species);
            const service = text(item.service, 'Clinic Service');
            appendText(main, 'p', 'meta-line', species ? `${service} / ${species}` : service);

            if (text(item.veterinarianName)) {
                appendText(main, 'p', 'vet-line', text(item.veterinarianName));
            }

            appendText(main, 'p', 'ref-line', `Ref ${text(item.reference, '-')}`);
        }

        const side = document.createElement('div');
        side.className = 'status-side';

        if (compact) {
            const label = sourceLabel(item);
            if (label) {
                appendText(side, 'span', 'source-pill', label);
            }
        } else {
            appendText(side, 'span', 'stage-pill', text(item.stage, 'Waiting'));

            const time = formatTime(item.time);
            if (time) {
                appendText(side, 'span', 'time-text', time);
            }
        }

        card.appendChild(main);
        card.appendChild(side);
        return card;
    }

    function renderEmpty(container, message) {
        const empty = document.createElement('div');
        empty.className = 'empty-state';
        empty.textContent = message;
        container.appendChild(empty);
    }

    function renderList(container, items, options) {
        const visible = list(items).slice(0, options.limit);
        container.replaceChildren();

        if (visible.length === 0) {
            renderEmpty(container, options.emptyLabel);
            return;
        }

        visible.forEach((item) => {
            container.appendChild(createCard(item, options));
        });
    }

    function setCount(element, value) {
        element.textContent = String(Number(value) || 0);
    }

    function buildStatusUrl() {
        const url = new URL(baseApiUrl, window.location.href);
        url.searchParams.set('branch', currentBranch);
        return url.toString();
    }

    function renderBranchOptions(branches, selectedBranch) {
        const availableBranches = list(branches);
        const selectedCode = text(selectedBranch && selectedBranch.code, currentBranch);

        if (availableBranches.length > 0) {
            const options = availableBranches.map((branch) => {
                const option = document.createElement('option');
                option.value = text(branch.code, branch.id);
                option.textContent = text(branch.name, 'Clinic location');
                return option;
            });
            elements.branchSelect.replaceChildren(...options);
        }

        currentBranch = selectedCode;
        elements.branchSelect.value = selectedCode;
        elements.branchName.textContent = text(selectedBranch && selectedBranch.name, 'VFC Pharmacy / Main Clinic');
    }

    function renderStatus(data) {
        renderBranchOptions(data.branches, data.branch);
        const sections = data.sections || {};
        const queue = list(sections.queue);
        const bookings = list(sections.bookings);
        const billing = list(sections.billing);

        const nowServing = queue.filter((item) => ['In Service', 'Diagnosis Done'].includes(item.stage));
        const waitingQueue = queue.filter((item) => !['In Service', 'Diagnosis Done'].includes(item.stage));
        const waiting = waitingQueue.concat(bookings);

        setCount(elements.nowServingCount, nowServing.length);
        setCount(elements.paymentCount, billing.length);
        setCount(elements.waitingCount, waiting.length);

        renderList(elements.nowServingList, nowServing, {
            limit: maxNowServing,
            emptyLabel: 'No pets in service',
        });

        renderList(elements.paymentList, billing, {
            limit: maxPayment,
            emptyLabel: 'No pets for payment',
        });

        renderList(elements.waitingList, waiting, {
            limit: maxWaiting,
            compact: true,
            emptyLabel: 'No waiting pets',
        });

        const generatedAt = data.generatedAt ? formatTime(data.generatedAt) : '';
        elements.lastUpdated.textContent = generatedAt ? `Updated ${generatedAt}` : 'Waiting for update';
        elements.loadingPanel.hidden = true;
        elements.statusGrid.hidden = false;
        hasLoadedOnce = true;
    }

    function showError(message) {
        elements.errorMessage.textContent = message || 'Please check the TV display API connection.';
        elements.errorBanner.hidden = false;

        if (!hasLoadedOnce) {
            elements.loadingPanel.hidden = true;
            elements.statusGrid.hidden = true;
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
                headers: {
                    Accept: 'application/json',
                },
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
        const nextBranch = elements.branchSelect.value;
        if (!nextBranch || nextBranch === currentBranch) {
            return;
        }

        currentBranch = nextBranch;
        const nextUrl = new URL(window.location.href);
        nextUrl.searchParams.set('branch', currentBranch);
        window.history.replaceState({}, '', `${nextUrl.pathname}${nextUrl.search}${nextUrl.hash}`);

        window.clearTimeout(refreshTimer);
        hasLoadedOnce = false;
        elements.errorBanner.hidden = true;
        elements.statusGrid.hidden = true;
        elements.loadingPanel.hidden = false;
        loadStatus();
    });
    loadStatus();
}());
