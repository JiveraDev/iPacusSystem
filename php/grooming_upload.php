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
if (!in_array($category, ['reference', 'before', 'after', 'concern'], true)) ipawcus_guard_error(422, 'Choose reference, before, after, or concern for this photo.');
if (strlen($caption) > 300) ipawcus_guard_error(422, 'Keep the photo caption under 300 characters.');
if (($file['error'] ?? UPLOAD_ERR_NO_FILE) !== UPLOAD_ERR_OK) ipawcus_guard_error(422, 'The photo did not finish uploading. Select it again and retry.');
if (($file['size'] ?? 0) <= 0 || $file['size'] > 8 * 1024 * 1024) ipawcus_guard_error(422, 'Choose a photo smaller than 8 MB.');
$mime = (new finfo(FILEINFO_MIME_TYPE))->file($file['tmp_name']);
$extensions = ['image/jpeg' => 'jpg', 'image/png' => 'png', 'image/webp' => 'webp'];
if (!isset($extensions[$mime]) || !@getimagesize($file['tmp_name'])) ipawcus_guard_error(422, 'Choose a JPG, PNG, or WebP photo.');
$target = null;
try {
    $pdo->beginTransaction();
    $booking = grooming_booking($pdo, $id, $currentUser, true);
    $job = grooming_ensure_job($pdo, $booking, ipawcus_guard_user_id($currentUser));
    if (in_array($job['status'], ['released', 'cancelled', 'no_show'], true) || $job['published_at']) throw new InvalidArgumentException('Photos are locked after the summary is shared or the job closes.');
    $count = $pdo->prepare('SELECT COUNT(*) FROM grooming_photos WHERE booking_id = ?');
    $count->execute([$id]);
    if ((int)$count->fetchColumn() >= 20) throw new InvalidArgumentException('This job already has 20 photos. Keep further documentation in the clinic record.');
    $filename = bin2hex(random_bytes(20)) . '.' . $extensions[$mime];
    $path = 'grooming_photos/' . $filename;
    $target = grooming_photo_directory(true) . DIRECTORY_SEPARATOR . $filename;
    if (!move_uploaded_file($file['tmp_name'], $target)) throw new RuntimeException('Photo storage failed.');
    $share = $category !== 'concern' && ($_POST['share_with_owner'] ?? '0') === '1';
    $insert = $pdo->prepare('INSERT INTO grooming_photos (booking_id, category, caption, file_path, share_with_owner, uploaded_by) VALUES (?, ?, ?, ?, ?, ?)');
    $insert->execute([$id, $category, $caption, $path, (int)$share, ipawcus_guard_user_id($currentUser)]);
    grooming_event($pdo, $id, ipawcus_guard_user_id($currentUser), 'photo_added', ['photoId' => (int)$pdo->lastInsertId(), 'category' => $category, 'shared' => $share]);
    // Photo changes participate in the same optimistic locking as record edits.
    $pdo->prepare('UPDATE grooming_jobs SET version = version + 1, updated_by = ? WHERE booking_id = ?')->execute([ipawcus_guard_user_id($currentUser), $id]);
    $pdo->commit();
    echo json_encode(['success' => true, 'relative_url' => $path]);
} catch (Throwable $error) {
    if ($pdo->inTransaction()) $pdo->rollBack();
    if ($target && is_file($target)) @unlink($target);
    if ($error instanceof InvalidArgumentException) ipawcus_guard_error(422, $error->getMessage());
    error_log('Grooming upload failed: ' . $error->getMessage());
    ipawcus_guard_error(500, 'The photo could not be saved. Please try again.');
}
