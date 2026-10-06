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
    <link rel="stylesheet" href="assets/tv-display.css?v=20261003">
    <script defer src="assets/tv-display.js?v=20261003"></script>
</head>
<body>
    <div class="tv-shell">
        <header class="tv-header">
            <div class="brand-lockup">
                <img class="brand-mark" src="assets/circular_logo.png" alt="iPawcus">
                <div>
                    <p class="brand-eyebrow"><span aria-hidden="true"></span> Live clinic status</p>
                    <h1>Patient Status Board</h1>
                    <p class="brand-clinic">iPawcus &middot; Vetfocus Animal Care Clinic</p>
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
            <section class="location-bar" aria-label="Selected clinic location">
                <div class="location-copy">
                    <span class="location-icon" aria-hidden="true">&#9679;</span>
                    <div>
                        <strong id="branchName">VFC Pharmacy / Main Clinic</strong>
                        <span id="branchAddress">Vetfocus Animal Care Clinic</span>
                    </div>
                </div>
                <div class="connection-state">
                    <span aria-hidden="true"></span>
                    Live &middot; automatic refresh
                </div>
            </section>

            <div id="errorBanner" class="error-banner" hidden>
                <strong>Live update interrupted.</strong>
                <span id="errorMessage">Existing status remains visible while reconnecting.</span>
            </div>

            <section id="loadingPanel" class="loading-panel">
                <div class="loading-pulse" aria-hidden="true"></div>
                <p>Preparing the patient board</p>
                <span>Connecting to today&apos;s clinic activity</span>
            </section>

            <div id="statusContent" class="status-content" hidden>
                <section class="summary-grid" aria-label="Today at a glance">
                    <article class="summary-card summary-waiting">
                        <span class="summary-icon" aria-hidden="true">&hellip;</span>
                        <div><strong id="summaryWaiting">0</strong><span>Waiting</span><small>Walk-ins and scheduled</small></div>
                    </article>
                    <article class="summary-card summary-serving">
                        <span class="summary-icon" aria-hidden="true">+</span>
                        <div><strong id="summaryServing">0</strong><span>In care</span><small>Currently with the team</small></div>
                    </article>
                    <article class="summary-card summary-payment">
                        <span class="summary-icon" aria-hidden="true">&#8369;</span>
                        <div><strong id="summaryPayment">0</strong><span>For payment</span><small>Please proceed to cashier</small></div>
                    </article>
                    <article class="summary-card summary-complete">
                        <span class="summary-icon" aria-hidden="true">&#10003;</span>
                        <div><strong id="summaryCompleted">0</strong><span>Completed</span><small>Finished today</small></div>
                    </article>
                </section>

                <section id="statusGrid" class="status-grid" aria-live="polite">
                    <section class="status-column serving-column" aria-labelledby="nowServingTitle">
                        <div class="section-heading">
                            <span class="heading-icon serving-icon" aria-hidden="true">+</span>
                            <div><span class="section-kicker">Currently in care</span><h2 id="nowServingTitle">Now Serving</h2></div>
                            <strong id="nowServingCount">0</strong>
                        </div>
                        <div id="nowServingList" class="status-list serving-list"></div>
                    </section>

                    <section class="status-column waiting-column" aria-labelledby="waitingTitle">
                        <div class="section-heading">
                            <span class="heading-icon waiting-icon" aria-hidden="true">&hellip;</span>
                            <div><span class="section-kicker">Queue order</span><h2 id="waitingTitle">Waiting &amp; Scheduled</h2></div>
                            <strong id="waitingCount">0</strong>
                        </div>
                        <div id="waitingList" class="status-list waiting-list"></div>
                    </section>

                    <section class="status-column payment-column" aria-labelledby="paymentTitle">
                        <div class="section-heading">
                            <span class="heading-icon payment-icon" aria-hidden="true">&#8369;</span>
                            <div><span class="section-kicker">Next step</span><h2 id="paymentTitle">For Payment</h2></div>
                            <strong id="paymentCount">0</strong>
                        </div>
                        <div id="paymentList" class="status-list payment-list"></div>
                    </section>
                </section>
            </div>
        </main>

        <footer class="tv-footer">
            <p class="footer-guidance"><span aria-hidden="true"></span>Please wait for your pet&apos;s name or reference number to be called.</p>
            <p id="lastUpdated">Waiting for update</p>
        </footer>
    </div>
</body>
</html>
