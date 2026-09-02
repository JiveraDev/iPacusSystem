import { useRef } from 'react';
import PropTypes from 'prop-types';
import { gsap } from 'gsap';
import { useGSAP } from '@gsap/react';

gsap.registerPlugin(useGSAP);

const SURFACE_SELECTOR = [
    '[data-slot="card"]',
    '[data-motion="card"]',
    'main article',
    'main section[class*="rounded-"]',
    'main div[class*="rounded-xl"][class*="border"]',
    'main div[class*="rounded-2xl"][class*="border"]',
    'main div[class*="rounded-lg"][class*="shadow"]',
    'main div[class*="rounded-xl"][class*="bg-white"]',
    'main div[class*="rounded-2xl"][class*="bg-white"]',
    'main div[class*="rounded-lg"][class*="bg-white"]',
    ':is([data-motion-page="login"], [data-motion-page="register"], [data-motion-page="registerProfile"], [data-motion-page="verifyEmail"], [data-motion-page="forgotPassword"]) div[class*="rounded-"][class*="bg-white"]',
    ':is([data-motion-page="login"], [data-motion-page="register"], [data-motion-page="registerProfile"], [data-motion-page="verifyEmail"], [data-motion-page="forgotPassword"]) [data-slot="card"]',
].join(',');

const OVERLAY_SELECTOR = [
    '[data-slot="dialog-content"]',
    '[role="dialog"][aria-modal="true"]:not([data-slot="sheet-content"])',
].join(',');

const FLOATING_SELECTOR = [
    '[data-slot="popover-content"]',
    '[data-slot="select-content"]',
    '[role="menu"]',
    '[role="listbox"]',
    '[data-motion="popover"]',
].join(',');

const CONTROL_SELECTOR = 'button:not([disabled]), a[href], [role="button"]:not([aria-disabled="true"])';
const NAV_SELECTOR = 'nav a[href], nav button:not([disabled]), aside a[href], aside button:not([disabled])';
const ROW_SELECTOR = 'tbody > tr, [data-motion="list-item"]';
const DASHBOARD_FIELD_SELECTOR = [
    'input:not([type="hidden"]):not([type="checkbox"]):not([type="radio"])',
    'textarea',
    'select',
    '[data-slot="select-trigger"]',
].join(',');

function collectElements(nodes, selector) {
    const results = new Set();

    nodes.forEach((node) => {
        if (!(node instanceof Element)) return;
        if (node.matches(selector)) results.add(node);
        node.querySelectorAll(selector).forEach((element) => results.add(element));
    });

    return Array.from(results);
}

function isMotionExcluded(element) {
    return !element?.isConnected
        || element.closest('[data-motion="off"]')
        || element.closest('[data-motion-scope="self"]');
}

function topLevelElements(elements) {
    const elementSet = new Set(elements);

    return elements.filter((element) => {
        let parent = element.parentElement;
        while (parent) {
            if (elementSet.has(parent)) return false;
            parent = parent.parentElement;
        }
        return true;
    });
}

function setAnimating(elements, active) {
    elements.forEach((element) => element.classList.toggle('is-motion-entering', active));
}

function getPageRoot(root) {
    const dashboardContent = root.querySelector('[data-dashboard-content]');
    if (dashboardContent) return dashboardContent;

    return root.querySelector('[data-motion-page]') || root;
}

function AppMotionSystem({ children }) {
    const rootRef = useRef(null);
    const lastPathRef = useRef('');
    const scheduledFrameRef = useRef(0);
    const queuedNodesRef = useRef(new Set());
    const seenElementsRef = useRef(new WeakSet());
    const routeMotionRef = useRef({ timeline: null, targets: [] });
    const pressedControlRef = useRef(null);

    useGSAP((context, contextSafe) => {
        void context;
        const root = rootRef.current;
        if (!root) return undefined;

        const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
        const supportsFinePointer = window.matchMedia('(hover: hover) and (pointer: fine)').matches;

        const killRouteMotion = () => {
            routeMotionRef.current.timeline?.kill();
            if (routeMotionRef.current.targets.length) {
                gsap.killTweensOf(routeMotionRef.current.targets);
                gsap.set(routeMotionRef.current.targets, { clearProps: 'transform,opacity,visibility' });
                setAnimating(routeMotionRef.current.targets, false);
            }
            routeMotionRef.current = { timeline: null, targets: [] };
        };

        const registerControls = (nodes) => {
            collectElements(nodes, CONTROL_SELECTOR)
                .filter((element) => !isMotionExcluded(element))
                .forEach((element) => element.classList.add('ipawcus-motion-control'));

            collectElements(nodes, NAV_SELECTOR)
                .filter((element) => !isMotionExcluded(element))
                .forEach((element) => element.classList.add('ipawcus-motion-nav-item'));
        };

        const decorateDashboard = (nodes) => {
            const dashboardContent = root.querySelector('[data-dashboard-content]');
            if (!dashboardContent) return;

            dashboardContent.classList.add('ipawcus-dashboard-content');
            const screens = Array.from(dashboardContent.children).filter((screen) => screen instanceof Element);
            screens.forEach((screen) => screen.classList.add('ipawcus-dashboard-screen'));

            const scopedNodes = nodes.some((node) => node === root || node.contains?.(dashboardContent))
                ? [dashboardContent]
                : nodes.filter((node) => node === dashboardContent || dashboardContent.contains(node));

            if (!scopedNodes.length) return;

            screens.forEach((screen) => {
                const title = screen.querySelector('[data-slot="dashboard-page-header"] h1, h1, h2');
                if (!title) return;

                title.classList.add('ipawcus-dashboard-title');
                const heading = title.closest('[data-slot="dashboard-page-header"]') || title.parentElement;
                if (heading && dashboardContent.contains(heading)) {
                    heading.classList.add('ipawcus-dashboard-heading');
                    const isExistingSurface = heading.matches('[data-slot="card"], [class*="border"][class*="rounded-"]')
                        || heading.closest('[data-slot="card"]');
                    if (!isExistingSurface && heading !== screen) {
                        heading.classList.add('ipawcus-dashboard-heading--legacy');
                    }
                }
            });

            topLevelElements(collectElements(scopedNodes, SURFACE_SELECTOR)).forEach((surface) => {
                surface.classList.add('ipawcus-dashboard-surface');
            });
            collectElements(scopedNodes, 'table').forEach((table) => table.classList.add('ipawcus-dashboard-table'));
            collectElements(scopedNodes, 'form').forEach((form) => form.classList.add('ipawcus-dashboard-form'));
            collectElements(scopedNodes, DASHBOARD_FIELD_SELECTOR).forEach((field) => field.classList.add('ipawcus-dashboard-field'));
            collectElements(scopedNodes, 'input[type="date"], input[type="datetime-local"]')
                .forEach((field) => field.classList.add('ipawcus-dashboard-date-field'));
        };

        const animateNavigation = (nodes) => {
            const navItems = collectElements(nodes, NAV_SELECTOR)
                .filter((element) => !isMotionExcluded(element) && !seenElementsRef.current.has(element))
                .slice(0, 18);

            if (!navItems.length) return;
            navItems.forEach((element) => seenElementsRef.current.add(element));

            if (reduceMotion) return;
            setAnimating(navItems, true);
            gsap.fromTo(navItems, {
                autoAlpha: 0,
                x: -8,
            }, {
                autoAlpha: 1,
                x: 0,
                duration: 0.24,
                ease: 'power2.out',
                stagger: { amount: 0.22 },
                clearProps: 'transform,opacity,visibility',
                onComplete: () => setAnimating(navItems, false),
            });
        };

        const animateActiveNavigation = () => {
            if (reduceMotion) return;

            const activeItem = root.querySelector(
                'nav [aria-current="page"], nav button[class*="bg-blue-700"], aside button[class*="bg-blue-700"], nav button[class*="bg-[#155dfc]"], aside button[class*="bg-[#155dfc]"]'
            );

            if (!activeItem || isMotionExcluded(activeItem)) return;
            gsap.fromTo(activeItem, {
                scale: 0.975,
            }, {
                scale: 1,
                duration: 0.24,
                ease: 'back.out(1.35)',
                overwrite: 'auto',
                clearProps: 'transform',
            });
        };

        const animateRows = (rows) => {
            const freshRows = rows
                .filter((element) => !isMotionExcluded(element) && !seenElementsRef.current.has(element))
                .slice(0, 12);

            if (!freshRows.length) return;
            freshRows.forEach((element) => seenElementsRef.current.add(element));

            if (reduceMotion) return;
            setAnimating(freshRows, true);
            gsap.fromTo(freshRows, {
                autoAlpha: 0,
                x: -6,
            }, {
                autoAlpha: 1,
                x: 0,
                duration: 0.22,
                ease: 'power2.out',
                stagger: { amount: 0.12 },
                clearProps: 'transform,opacity,visibility',
                onComplete: () => setAnimating(freshRows, false),
            });
        };

        const animateSurfaces = (surfaces) => {
            const freshSurfaces = topLevelElements(surfaces)
                .filter((element) => (
                    !isMotionExcluded(element)
                    && !element.closest('.report-motion-item')
                    && !seenElementsRef.current.has(element)
                ))
                .slice(0, 12);

            if (!freshSurfaces.length) return;

            freshSurfaces.forEach((element) => {
                seenElementsRef.current.add(element);
                element.classList.add('ipawcus-motion-surface');
                if (
                    element.matches('a, button, [role="button"]')
                    || element.classList.contains('cursor-pointer')
                    || element.querySelector(':scope > a, :scope > button')
                ) {
                    element.classList.add('ipawcus-motion-surface--interactive');
                }
            });

            if (reduceMotion) return;
            routeMotionRef.current.targets.push(...freshSurfaces);

            setAnimating(freshSurfaces, true);
            gsap.fromTo(freshSurfaces, {
                autoAlpha: 0,
                y: 12,
                scale: 0.992,
            }, {
                autoAlpha: 1,
                y: 0,
                scale: 1,
                duration: 0.24,
                ease: 'power3.out',
                stagger: { amount: 0.12 },
                clearProps: 'transform,opacity,visibility',
                onComplete: () => setAnimating(freshSurfaces, false),
            });
        };

        const animatePage = () => {
            killRouteMotion();
            const pageRoot = getPageRoot(root);
            if (!pageRoot || pageRoot.closest('[data-motion-scope="self"]')) return;

            const title = pageRoot.querySelector('[data-slot="dashboard-page-header"], [data-motion="page-header"], h1, h2');
            const surfaces = collectElements([pageRoot], SURFACE_SELECTOR)
                .filter((element) => (
                    element !== title
                    && !title?.contains(element)
                    && !element.contains(title)
                ));
            const rows = collectElements([pageRoot], ROW_SELECTOR);

            if (
                !reduceMotion
                && title
                && !isMotionExcluded(title)
                && !title.closest('.report-motion-item')
                && !seenElementsRef.current.has(title)
            ) {
                seenElementsRef.current.add(title);
                setAnimating([title], true);
                const timeline = gsap.timeline({
                    defaults: { ease: 'power3.out' },
                    onComplete: () => setAnimating([title], false),
                });
                timeline.fromTo(title, {
                    autoAlpha: 0,
                    y: 16,
                }, {
                    autoAlpha: 1,
                    y: 0,
                    duration: 0.4,
                    clearProps: 'transform,opacity,visibility',
                });
                routeMotionRef.current.timeline = timeline;
                routeMotionRef.current.targets.push(title);
            }

            animateSurfaces(surfaces);
            animateRows(rows);
            animateActiveNavigation();
        };

        const animateDialog = (dialog) => {
            if (isMotionExcluded(dialog) || seenElementsRef.current.has(dialog)) return;
            seenElementsRef.current.add(dialog);

            if (reduceMotion) return;
            const overlay = dialog.closest('[data-slot="dialog-overlay"]');
            setAnimating([dialog], true);
            const timeline = gsap.timeline({
                defaults: { ease: 'power3.out' },
                onComplete: () => setAnimating([dialog], false),
            });

            if (overlay) {
                timeline.fromTo(overlay, { autoAlpha: 0 }, {
                    autoAlpha: 1,
                    duration: 0.16,
                    clearProps: 'opacity,visibility',
                });
            }
            timeline.fromTo(dialog, {
                autoAlpha: 0,
                y: 18,
                scale: 0.965,
            }, {
                autoAlpha: 1,
                y: 0,
                scale: 1,
                duration: 0.34,
                clearProps: 'transform,opacity,visibility',
            }, overlay ? '<0.04' : 0);

        };

        const animateSheet = (sheet) => {
            if (seenElementsRef.current.has(sheet)) return;
            seenElementsRef.current.add(sheet);
            if (reduceMotion) return;

            const content = Array.from(sheet.querySelectorAll(':scope > div > *')).slice(0, 10);
            if (!content.length) return;
            setAnimating(content, true);
            gsap.fromTo(content, {
                autoAlpha: 0,
                x: 12,
            }, {
                autoAlpha: 1,
                x: 0,
                duration: 0.28,
                ease: 'power3.out',
                stagger: 0.025,
                delay: 0.04,
                clearProps: 'transform,opacity,visibility',
                onComplete: () => setAnimating(content, false),
            });
        };

        const animateFloating = (floatingElement) => {
            if (seenElementsRef.current.has(floatingElement)) return;
            seenElementsRef.current.add(floatingElement);
            if (reduceMotion) return;

            setAnimating([floatingElement], true);
            gsap.fromTo(floatingElement, {
                autoAlpha: 0,
                y: -6,
                scale: 0.98,
                transformOrigin: 'top center',
            }, {
                autoAlpha: 1,
                y: 0,
                scale: 1,
                duration: 0.18,
                ease: 'power2.out',
                clearProps: 'transform,opacity,visibility,transformOrigin',
                onComplete: () => setAnimating([floatingElement], false),
            });
        };

        const animateTabContent = (tabContent) => {
            if (isMotionExcluded(tabContent) || seenElementsRef.current.has(tabContent)) return;
            seenElementsRef.current.add(tabContent);
            if (reduceMotion) return;

            setAnimating([tabContent], true);
            gsap.fromTo(tabContent, {
                autoAlpha: 0,
                x: 8,
            }, {
                autoAlpha: 1,
                x: 0,
                duration: 0.24,
                ease: 'power2.out',
                clearProps: 'transform,opacity,visibility',
                onComplete: () => setAnimating([tabContent], false),
            });
        };

        const processNodes = contextSafe((nodes) => {
            const currentPath = window.location.pathname;
            const routeChanged = currentPath !== lastPathRef.current;
            lastPathRef.current = currentPath;

            decorateDashboard(nodes);
            registerControls(nodes);
            animateNavigation(nodes);

            if (routeChanged) {
                animatePage();
            }

            collectElements(nodes, OVERLAY_SELECTOR).forEach(animateDialog);
            collectElements(nodes, '[data-slot="sheet-content"]').forEach(animateSheet);
            collectElements(nodes, FLOATING_SELECTOR).forEach(animateFloating);
            collectElements(nodes, '[data-slot="tabs-content"]').forEach(animateTabContent);

            // Quiet refreshes must not replay page, card, or row entrances. Dashboard
            // data refreshes frequently, and replaying transforms while the user scrolls
            // creates visible repainting and a slow, scratched-page effect.
        });

        const queueNodes = (nodes) => {
            nodes.forEach((node) => {
                if (node instanceof Element) queuedNodesRef.current.add(node);
            });

            if (scheduledFrameRef.current) return;
            scheduledFrameRef.current = window.requestAnimationFrame(() => {
                scheduledFrameRef.current = 0;
                const queuedNodes = Array.from(queuedNodesRef.current);
                queuedNodesRef.current.clear();
                processNodes(queuedNodes.length ? queuedNodes : [root]);
            });
        };

        const observer = new MutationObserver((mutations) => {
            const addedNodes = mutations.flatMap((mutation) => Array.from(mutation.addedNodes));
            queueNodes(addedNodes);
        });

        const handlePointerDown = contextSafe((event) => {
            if (reduceMotion || !supportsFinePointer || event.button !== 0) return;
            const control = event.target.closest(CONTROL_SELECTOR);
            if (!control || isMotionExcluded(control)) return;
            pressedControlRef.current = control;
            gsap.to(control, {
                scale: 0.975,
                duration: 0.08,
                ease: 'power1.out',
                overwrite: 'auto',
            });
        });

        const releasePressedControl = contextSafe(() => {
            const control = pressedControlRef.current;
            if (!control) return;
            pressedControlRef.current = null;
            gsap.to(control, {
                scale: 1,
                duration: 0.2,
                ease: 'back.out(1.4)',
                overwrite: 'auto',
                clearProps: 'transform',
            });
        });

        const handlePopState = contextSafe(animatePage);

        observer.observe(document.body, { childList: true, subtree: true });
        document.addEventListener('pointerdown', handlePointerDown, true);
        document.addEventListener('pointerup', releasePressedControl, true);
        document.addEventListener('pointercancel', releasePressedControl, true);
        window.addEventListener('popstate', handlePopState);
        queueNodes([root]);

        return () => {
            observer.disconnect();
            document.removeEventListener('pointerdown', handlePointerDown, true);
            document.removeEventListener('pointerup', releasePressedControl, true);
            document.removeEventListener('pointercancel', releasePressedControl, true);
            window.removeEventListener('popstate', handlePopState);
            if (scheduledFrameRef.current) window.cancelAnimationFrame(scheduledFrameRef.current);
            killRouteMotion();
        };
    }, { scope: rootRef });

    return (
        <div ref={rootRef} data-motion-root className="min-h-screen">
            {children}
        </div>
    );
}

AppMotionSystem.propTypes = {
    children: PropTypes.node.isRequired,
};

export default AppMotionSystem;
