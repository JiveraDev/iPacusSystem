<?php
$pageTitle = 'iPawcus TV Status';

header('Cache-Control: no-store, no-cache, must-revalidate, max-age=0');
header('Pragma: no-cache');
?>
<!doctype html>
<html lang="en">
<head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <meta name="robots" content="noindex,nofollow">
    <title><?php echo htmlspecialchars($pageTitle, ENT_QUOTES, 'UTF-8'); ?></title>
    <link rel="stylesheet" href="assets/tv-display.css?v=20260805">
    <script defer src="assets/tv-display.js?v=20260805"></script>
</head>
<body>
    <div class="tv-shell">
        <header class="tv-header">
            <div class="brand-lockup">
                <img class="brand-mark" src="assets/circular_logo.png" alt="iPawcus">
                <div>
                    <p class="brand-eyebrow"><span aria-hidden="true"></span> Live clinic status</p>
                    <p id="branchName" class="branch-name">VFC Pharmacy / Main Clinic</p>
                    <h1>iPawcus <em>&infin;</em> Vetfocus Animal Care Clinic</h1>
                </div>
            </div>
            <div class="header-controls">
                <label class="location-control" for="branchSelect">
                    <span>Display location</span>
                    <select id="branchSelect" aria-label="Select TV display location">
                        <option value="MAIN">VFC Pharmacy / Main Clinic</option>
                    </select>
                </label>
                <div class="clock-panel" aria-live="polite">
                    <strong id="clockTime">--:--:--</strong>
                    <span id="clockDate">Loading date</span>
                </div>
            </div>
        </header>

        <main class="tv-main">
            <div id="errorBanner" class="error-banner" hidden>
                <strong>Unable to load live status.</strong>
                <span id="errorMessage">Please check the TV display API connection.</span>
            </div>

            <section id="loadingPanel" class="loading-panel">
                <div class="loading-pulse" aria-hidden="true"></div>
                <p>Loading live status</p>
            </section>

            <section id="statusGrid" class="status-grid" hidden>
                <div class="side-stack">
                    <section class="status-column primary-column" aria-labelledby="nowServingTitle">
                        <div class="section-heading">
                            <div>
                                <span class="section-kicker">Clinic floor</span>
                                <h2 id="nowServingTitle">Now Serving</h2>
                            </div>
                            <strong id="nowServingCount">0</strong>
                        </div>
                        <div id="nowServingList" class="status-list"></div>
                    </section>

                    <section class="status-column payment-column" aria-labelledby="paymentTitle">
                        <div class="section-heading">
                            <div>
                                <span class="section-kicker">Cashier</span>
                                <h2 id="paymentTitle">For Payment</h2>
                            </div>
                            <strong id="paymentCount">0</strong>
                        </div>
                        <div id="paymentList" class="status-list"></div>
                    </section>
                </div>

                <section class="status-column waiting-column" aria-labelledby="waitingTitle">
                    <div class="section-heading">
                        <div>
                            <span class="section-kicker">Queue and bookings</span>
                            <h2 id="waitingTitle">Waiting and Scheduled</h2>
                        </div>
                        <strong id="waitingCount">0</strong>
                    </div>
                    <div id="waitingList" class="status-list compact-list"></div>
                </section>
            </section>
        </main>

        <footer class="tv-footer">
            <div class="live-indicator">
                <span aria-hidden="true"></span>
                <strong>Live Status</strong>
            </div>
            <p>No owner contact details displayed</p>
            <p id="lastUpdated">Waiting for update</p>
        </footer>
    </div>
</body>
</html>
