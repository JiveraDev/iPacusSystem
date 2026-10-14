<?php
if (PHP_SAPI !== 'cli' || getenv('IPAWCUS_SANDBOX') !== '1') exit(1);
require_once __DIR__ . '/../../php/db.php';
if (getenv('DB_NAME') !== 'ipawcus_sandbox' || getenv('DB_PORT') !== '33308') throw new RuntimeException('Sandbox database required.');
foreach ([[5,1],[6,2]] as [$vet,$branch]) {
    $stmt=$pdo->prepare('INSERT IGNORE INTO veterinarian_booking_clinics (veterinarian_user_id,branch_id,accepts_bookings) VALUES (?,?,1)');
    $stmt->execute([$vet,$branch]);
    for ($day=1;$day<=6;$day++) {
        $stmt=$pdo->prepare('SELECT COUNT(*) FROM veterinarian_working_hours WHERE veterinarian_user_id=? AND branch_id=? AND day_of_week=?');
        $stmt->execute([$vet,$branch,$day]);
        if ((int)$stmt->fetchColumn()===0) {
            $stmt=$pdo->prepare("INSERT INTO veterinarian_working_hours (veterinarian_user_id,branch_id,day_of_week,starts_at,ends_at) VALUES (?, ?, ?, '08:00:00', '18:00:00')");
            $stmt->execute([$vet,$branch,$day]);
        }
    }
}
