<?php
// 1. Force CORS headers immediately (Essential for local testing)
header("Access-Control-Allow-Origin: *");
header("Access-Control-Allow-Methods: GET, POST, OPTIONS, PUT, DELETE, PATCH");
header("Access-Control-Allow-Headers: Content-Type, Authorization, X-Requested-With, X-Client-Public-IP");

// 2. Handle OPTIONS preflight request immediately
if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(200);
    exit;
}

// 3. Error Reporting
error_reporting(E_ALL);
ini_set('display_errors', 1);

// 4. Load Logic
require_once __DIR__ . '/config.php';

// Simple path extraction
$requestUri = $_SERVER['REQUEST_URI'];
$scriptName = $_SERVER['SCRIPT_NAME'];

// Remove script name from URI if present (e.g., /php/index.php/api/login -> /api/login)
$path = str_replace($scriptName, '', $requestUri);

// Also handle cases where it's rewritten (e.g., /api/login)
if ($path === $requestUri) {
    // If we're here, maybe it's /php/api/login. Let's try to find 'php/'
    $path = preg_replace('/^.*\/php\//', '/', $path);
}

// Strip query string
$path = parse_url($path, PHP_URL_PATH);

// Remove /api prefix if present
$path = preg_replace('/^\/api/', '', $path);
$path = rtrim($path, '/');

header('Content-Type: application/json');

switch ($path) {
    case '/login':
        require_once __DIR__ . '/login.php';
        break;
    case '/register':
    case '/users': // Fallback for old calls
        require_once __DIR__ . '/register.php';
        break;
    case '/pet_information':
        // Handle both GET (list) and POST (add)
        if ($_SERVER['REQUEST_METHOD'] === 'POST') {
            require_once __DIR__ . '/add_pet.php';
        } else {
            require_once __DIR__ . '/get_pets.php';
        }
        break;
    case '/pet_ownership/link':
        require_once __DIR__ . '/link_pet.php';
        break;
    case '/upload':
        require_once __DIR__ . '/upload.php';
        break;
    case '/upload/delete':
        require_once __DIR__ . '/delete_upload.php';
        break;
    case '/bookings':
        if ($_SERVER['REQUEST_METHOD'] === 'POST') {
            require_once __DIR__ . '/add_booking.php';
        } else {
            require_once __DIR__ . '/get_bookings.php';
        }
        break;
    case '/online-consultations':
        require_once __DIR__ . '/online_consultations.php';
        break;
    case '/special_services':
        require_once __DIR__ . '/special_services.php';
        break;
    case '/service-catalog':
        require_once __DIR__ . '/service_catalog.php';
        break;
    case '/visits':
        require_once __DIR__ . '/visit_billing.php';
        break;
    case '/rooms/availability':
        require_once __DIR__ . '/get_room_availability.php';
        break;
    case '/boarding/rooms':
        $_GET['action'] = 'rooms';
        require_once __DIR__ . '/boarding_management.php';
        break;
    case '/boarding/direct-check-in':
        $_GET['action'] = 'direct-check-in';
        require_once __DIR__ . '/boarding_management.php';
        break;
    case '/boarding/monitoring':
        $_GET['action'] = 'monitoring';
        require_once __DIR__ . '/boarding_management.php';
        break;
    case '/boarding/observations':
        $_GET['action'] = 'observation';
        require_once __DIR__ . '/boarding_management.php';
        break;
    case '/boarding/tasks':
        $_GET['action'] = 'task';
        require_once __DIR__ . '/boarding_management.php';
        break;
    case '/boarding/documents':
        $_GET['action'] = 'documents';
        require_once __DIR__ . '/boarding_management.php';
        break;
    case '/inventory':
        $_GET['action'] = 'list';
        require_once __DIR__ . '/inventory.php';
        break;
    case '/inventory/meta':
        $_GET['action'] = 'meta';
        require_once __DIR__ . '/inventory.php';
        break;
    case '/inventory/items':
        $_GET['action'] = $_SERVER['REQUEST_METHOD'] === 'PATCH' ? 'update-item' : 'create-item';
        require_once __DIR__ . '/inventory.php';
        break;
    case '/inventory/stock-in':
        $_GET['action'] = 'stock-in';
        require_once __DIR__ . '/inventory.php';
        break;
    case '/inventory/stock-out':
        $_GET['action'] = 'stock-out';
        require_once __DIR__ . '/inventory.php';
        break;
    case '/accounts':
        require_once __DIR__ . '/get_accounts.php';
        break;
    case '/accounts/create':
        if ($_SERVER['REQUEST_METHOD'] === 'POST') {
            require_once __DIR__ . '/create_account.php';
        } else {
            http_response_code(405);
        }
        break;
    case '/consent_files':
        if ($_SERVER['REQUEST_METHOD'] === 'POST') {
            require_once __DIR__ . '/add_consent_file.php';
        } else {
            require_once __DIR__ . '/get_consent_files.php';
        }
        break;
    case '/queues/debug':
        require_once __DIR__ . '/debug_queues.php';
        break;
    case '/queues':
        if ($_SERVER['REQUEST_METHOD'] === 'POST') {
            require_once __DIR__ . '/add_to_queue.php';
        } else {
            require_once __DIR__ . '/get_queues.php';
        }
        break;
    case '/queues/pets':
        require_once __DIR__ . '/get_pets_for_queue.php';
        break;
    case '/queues/status':
        require_once __DIR__ . '/update_queue_status.php';
        break;
    case '/queues/receive':
        require_once __DIR__ . '/receive_queue.php';
        break;
    case '/queues/assign':
        require_once __DIR__ . '/assign_queue_vet.php';
        break;
    case '/queues/return':
        require_once __DIR__ . '/return_queue.php';
        break;
    case '/queues/reenter':
        require_once __DIR__ . '/reenter_queue.php';
        break;
    case '/vet-diagnoses':
        require_once __DIR__ . '/vet_diagnoses.php';
        break;
    case '/self-service/access':
        require_once __DIR__ . '/check_self_service_access.php';
        break;
    case '/vet_schedules':
        if ($_SERVER['REQUEST_METHOD'] === 'POST') {
            require_once __DIR__ . '/update_vet_schedule.php';
        } else {
            require_once __DIR__ . '/get_vet_schedules.php';
        }
        break;
    case '/profile':
        if ($_SERVER['REQUEST_METHOD'] === 'PATCH') {
            require_once __DIR__ . '/update_user_profile.php';
        } else {
            require_once __DIR__ . '/get_user_profile.php';
        }
        break;
    case '/health':
        echo json_encode(['ok' => true, 'message' => 'PHP API is healthy']);
        break;
    default:
        // Handle routes with parameters like /users/{id}/pets or /pet_information/{id}
        if (preg_match('/^\/users\/(\d+)\/pets$/', $path, $matches)) {
            $_GET['userId'] = $matches[1];
            require_once __DIR__ . '/get_user_pets.php';
        } elseif (preg_match('/^\/users\/(\d+)\/bookings$/', $path, $matches)) {
            $_GET['userId'] = $matches[1];
            require_once __DIR__ . '/get_bookings.php';
        } elseif (preg_match('/^\/pets\/([^\/]+)\/queues$/', $path, $matches)) {
            $_GET['petId'] = $matches[1];
            require_once __DIR__ . '/get_pet_queues.php';
        } elseif (preg_match('/^\/pets\/([^\/]+)\/bookings$/', $path, $matches)) {
            $_GET['petId'] = $matches[1];
            require_once __DIR__ . '/get_pet_bookings.php';
        } elseif (preg_match('/^\/pets\/([^\/]+)\/medical$/', $path, $matches)) {
            $_GET['petId'] = $matches[1];
            require_once __DIR__ . '/pet_medical_records.php';
        } elseif (preg_match('/^\/vet-diagnoses\/(\d+)$/', $path, $matches)) {
            $_GET['diagnosisId'] = $matches[1];
            require_once __DIR__ . '/vet_diagnoses.php';
        } elseif (preg_match('/^\/users\/(\d+)\/password$/', $path, $matches)) {
            $_GET['userId'] = $matches[1];
            if ($_SERVER['REQUEST_METHOD'] === 'PATCH' || $_SERVER['REQUEST_METHOD'] === 'POST') {
                require_once __DIR__ . '/update_password.php';
            } else {
                http_response_code(405);
                echo json_encode(['message' => 'Method not allowed.']);
            }
        } elseif (preg_match('/^\/users\/(\d+)$/', $path, $matches)) {
            $_GET['userId'] = $matches[1];
            if ($_SERVER['REQUEST_METHOD'] === 'PATCH') {
                require_once __DIR__ . '/update_user.php';
            } else {
                require_once __DIR__ . '/get_user.php';
            }
        } elseif (preg_match('/^\/accounts\/(\d+)\/status$/', $path, $matches)) {
            $_GET['userId'] = $matches[1];
            if ($_SERVER['REQUEST_METHOD'] === 'PATCH') {
                require_once __DIR__ . '/update_account_status.php';
            } else {
                http_response_code(405);
                echo json_encode(['message' => 'Method not allowed.']);
            }
        } elseif (preg_match('/^\/bookings\/(\d+)\/status$/', $path, $matches)) {
            $_GET['bookingId'] = $matches[1];
            require_once __DIR__ . '/update_booking_status.php';
        } elseif (preg_match('/^\/bookings\/(\d+)\/receive$/', $path, $matches)) {
            $_GET['bookingId'] = $matches[1];
            require_once __DIR__ . '/receive_booking.php';
        } elseif (preg_match('/^\/bookings\/(\d+)\/schedule$/', $path, $matches)) {
            $_GET['bookingId'] = $matches[1];
            require_once __DIR__ . '/update_booking_schedule.php';
        } elseif (preg_match('/^\/boarding\/bookings\/(\d+)\/assign-room$/', $path, $matches)) {
            $_GET['bookingId'] = $matches[1];
            $_GET['action'] = 'assign-room';
            require_once __DIR__ . '/boarding_management.php';
        } elseif (preg_match('/^\/boarding\/bookings\/(\d+)\/check-in$/', $path, $matches)) {
            $_GET['bookingId'] = $matches[1];
            $_GET['action'] = 'check-in';
            require_once __DIR__ . '/boarding_management.php';
        } elseif (preg_match('/^\/boarding\/bookings\/(\d+)\/check-out$/', $path, $matches)) {
            $_GET['bookingId'] = $matches[1];
            $_GET['action'] = 'check-out';
            require_once __DIR__ . '/boarding_management.php';
        } elseif (preg_match('/^\/boarding\/bookings\/(\d+)\/desired-check-out$/', $path, $matches)) {
            $_GET['bookingId'] = $matches[1];
            $_GET['action'] = 'desired-check-out';
            require_once __DIR__ . '/boarding_management.php';
        } elseif (preg_match('/^\/boarding\/bookings\/(\d+)\/documents$/', $path, $matches)) {
            $_GET['bookingId'] = $matches[1];
            $_GET['action'] = 'documents';
            require_once __DIR__ . '/boarding_management.php';
        } elseif (preg_match('/^\/boarding\/tasks\/(\d+)\/complete$/', $path, $matches)) {
            $_GET['taskId'] = $matches[1];
            $_GET['action'] = 'task-complete';
            require_once __DIR__ . '/boarding_management.php';
        } elseif (preg_match('/^\/service-catalog\/(\d+)\/materials$/', $path, $matches)) {
            $_GET['serviceId'] = $matches[1];
            $_GET['action'] = 'materials';
            require_once __DIR__ . '/service_catalog.php';
        } elseif (preg_match('/^\/service-catalog\/(\d+)$/', $path, $matches)) {
            $_GET['serviceId'] = $matches[1];
            require_once __DIR__ . '/service_catalog.php';
        } elseif (preg_match('/^\/visits\/(\d+)\/charges$/', $path, $matches)) {
            $_GET['visitId'] = $matches[1];
            $_GET['action'] = 'charges';
            require_once __DIR__ . '/visit_billing.php';
        } elseif (preg_match('/^\/visits\/(\d+)\/payments$/', $path, $matches)) {
            $_GET['visitId'] = $matches[1];
            $_GET['action'] = 'payments';
            require_once __DIR__ . '/visit_billing.php';
        } elseif (preg_match('/^\/visits\/(\d+)$/', $path, $matches)) {
            $_GET['visitId'] = $matches[1];
            require_once __DIR__ . '/visit_billing.php';
        } elseif (preg_match('/^\/special_services\/(\d+)$/', $path, $matches)) {
            $_GET['specialServiceId'] = $matches[1];
            if ($_SERVER['REQUEST_METHOD'] === 'PATCH') {
                require_once __DIR__ . '/special_services.php';
            } else {
                http_response_code(405);
                echo json_encode(['message' => 'Method not allowed.']);
            }
        } elseif (preg_match('/^\/online-consultations\/(\d+)$/', $path, $matches)) {
            $_GET['onlineConsultationId'] = $matches[1];
            require_once __DIR__ . '/online_consultations.php';
        } elseif (preg_match('/^\/online-consultations\/(\d+)\/(start|join|end|diagnosis)$/', $path, $matches)) {
            $_GET['onlineConsultationId'] = $matches[1];
            $_GET['action'] = $matches[2];
            require_once __DIR__ . '/online_consultations.php';
        } elseif (preg_match('/^\/consent_files\/(\d+)$/', $path, $matches)) {
            $_GET['fileId'] = $matches[1];
            if ($_SERVER['REQUEST_METHOD'] === 'PATCH') {
                require_once __DIR__ . '/update_consent_file.php';
            } elseif ($_SERVER['REQUEST_METHOD'] === 'DELETE') {
                require_once __DIR__ . '/delete_consent_file.php';
            }
        } elseif (preg_match('/^\/pet_information\/([^\/]+)\/status$/', $path, $matches)) {
            $_GET['petId'] = $matches[1];
            require_once __DIR__ . '/update_pet_status.php';
        } elseif (preg_match('/^\/pet_information\/([^\/]+)$/', $path, $matches)) {
            $_GET['petId'] = $matches[1];
            if ($_SERVER['REQUEST_METHOD'] === 'PATCH') {
                require_once __DIR__ . '/update_pet.php';
            } else {
                require_once __DIR__ . '/get_pet.php';
            }
        } else {
            http_response_code(404);
            echo json_encode(['message' => 'Route not found: ' . $path, 'uri' => $requestUri]);
        }
        break;
}
