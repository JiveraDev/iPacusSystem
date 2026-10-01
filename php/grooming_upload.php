<?php
// Dispatched exclusively through the existing authenticated /upload endpoint.
require_once __DIR__ . '/grooming_helpers.php';
require_once __DIR__ . '/grooming_media.php';
if (!ipawcus_guard_is_admin_role($currentRole)) ipawcus_guard_error(403, 'Only clinic administrators can upload grooming photos.');
if ($currentRole === 'admin' && !(ipawcus_admin_feature_permissions($pdo, ipawcus_guard_user_id($currentUser))['grooming'] ?? true)) ipawcus_guard_error(403, 'Your account does not have Grooming Management access.');
grooming_require_schema($pdo);
$id = (int)($_POST['booking_id'] ?? 0);
$category = $_POST['category'] ?? '';
$caption = trim((string)($_POST['caption'] ?? ''));
if (!in_array($category, ['before', 'after'], true)) ipawcus_guard_error(422, 'Choose the before or after grooming photo. The concern photo comes from the owner booking.');
if (strlen($caption) > 300) ipawcus_guard_error(422, 'Keep the photo caption under 300 characters.');
if (($file['error'] ?? UPLOAD_ERR_NO_FILE) !== UPLOAD_ERR_OK) ipawcus_guard_error(422, 'The photo did not finish uploading. Select it again and retry.');
if (($file['size'] ?? 0) <= 0 || $file['size'] > 8 * 1024 * 1024) ipawcus_guard_error(422, 'Choose a photo smaller than 8 MB.');
$mime = (new finfo(FILEINFO_MIME_TYPE))->file($file['tmp_name']);
$extensions = ['image/jpeg' => 'jpg', 'image/png' => 'png', 'image/webp' => 'webp'];
if (!isset($extensions[$mime]) || !@getimagesize($file['tmp_name'])) ipawcus_guard_error(422, 'Choose a JPG, PNG, or WebP photo.');
$photoDirectory = null;
try {
    $photoDirectory = grooming_photo_directory(true);
} catch (Throwable $error) {
    error_log('Grooming photo storage setup failed: ' . $error->getMessage());
    ipawcus_guard_error(409, 'Photo storage could not be prepared. Check that the server can write to the private grooming media directory.');
}
$target = null;
$replacedPaths = [];
try {
    $pdo->beginTransaction();
    $booking = grooming_booking($pdo, $id, $currentUser, true);
    $job = grooming_ensure_job($pdo, $booking, ipawcus_guard_user_id($currentUser));
    if (in_array($job['status'], ['released', 'cancelled', 'no_show'], true) || $job['published_at']) throw new InvalidArgumentException('Photos are locked after the summary is shared or the job closes.');
    if ($category === 'before' && !in_array($job['status'], ['scheduled', 'checked_in', 'vet_review'], true)) throw new InvalidArgumentException('The before photo belongs to the initial receiving stage.');
    if ($category === 'after' && !in_array($job['status'], ['in_progress', 'ready'], true)) throw new InvalidArgumentException('Start grooming before saving the after photo.');
    $existing = $pdo->prepare('SELECT file_path FROM grooming_photos WHERE booking_id = ? AND category = ? FOR UPDATE');
    $existing->execute([$id, $category]);
    $replacedPaths = array_column($existing->fetchAll(PDO::FETCH_ASSOC), 'file_path');

    $petToken = strtolower(trim((string)($booking['grooming_pet_name'] ?? 'pet')));
    $petToken = trim(preg_replace('/[^a-z0-9]+/', '-', $petToken) ?? '', '-');
    $filename = ($petToken ?: 'pet') . '-' . $category . '-' . date('Ymd-His') . '-' . bin2hex(random_bytes(4)) . '.' . $extensions[$mime];
    $path = 'grooming_photos/' . $filename;
    $target = $photoDirectory . DIRECTORY_SEPARATOR . $filename;
    if (!move_uploaded_file($file['tmp_name'], $target)) throw new RuntimeException('Photo storage failed.');
    if ($replacedPaths) {
        $pdo->prepare('DELETE FROM grooming_photos WHERE booking_id = ? AND category = ?')->execute([$id, $category]);
    }
    $share = ($_POST['share_with_owner'] ?? '0') === '1';
    $insert = $pdo->prepare('INSERT INTO grooming_photos (booking_id, category, caption, file_path, share_with_owner, uploaded_by) VALUES (?, ?, ?, ?, ?, ?)');
    $insert->execute([$id, $category, $caption, $path, (int)$share, ipawcus_guard_user_id($currentUser)]);
    grooming_event($pdo, $id, ipawcus_guard_user_id($currentUser), $replacedPaths ? 'photo_replaced' : 'photo_added', ['photoId' => (int)$pdo->lastInsertId(), 'category' => $category, 'shared' => $share]);
    // Photo changes participate in the same optimistic locking as record edits.
    $pdo->prepare('UPDATE grooming_jobs SET version = version + 1, updated_by = ? WHERE booking_id = ?')->execute([ipawcus_guard_user_id($currentUser), $id]);
    $pdo->commit();
    foreach ($replacedPaths as $replacedPath) {
        $replacedTarget = grooming_photo_directory() . DIRECTORY_SEPARATOR . basename((string)$replacedPath);
        if ($replacedTarget !== $target && is_file($replacedTarget)) @unlink($replacedTarget);
    }
    echo json_encode(['success' => true, 'relative_url' => $path]);
} catch (Throwable $error) {
    if ($pdo->inTransaction()) $pdo->rollBack();
    if ($target && is_file($target)) @unlink($target);
    if ($error instanceof InvalidArgumentException) ipawcus_guard_error(422, $error->getMessage());
    error_log('Grooming upload failed: ' . $error->getMessage());
    ipawcus_guard_error(500, 'The photo could not be saved. Please try again.');
}
