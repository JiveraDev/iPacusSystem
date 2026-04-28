<?php
// 1. Force CORS headers immediately (Essential for local testing)
header("Access-Control-Allow-Origin: *");
header("Access-Control-Allow-Methods: GET, POST, OPTIONS, PUT, DELETE, PATCH");
header("Access-Control-Allow-Headers: Content-Type, Authorization, X-Requested-With");

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
    case '/health':
        echo json_encode(['ok' => true, 'message' => 'PHP API is healthy']);
        break;
    default:
        // Handle routes with parameters like /users/{id}/pets or /pet_information/{id}
        if (preg_match('/^\/users\/(\d+)\/pets$/', $path, $matches)) {
            $_GET['userId'] = $matches[1];
            require_once __DIR__ . '/get_user_pets.php';
        } elseif (preg_match('/^\/users\/(\d+)$/', $path, $matches)) {
            $_GET['userId'] = $matches[1];
            if ($_SERVER['REQUEST_METHOD'] === 'PATCH') {
                require_once __DIR__ . '/update_user.php';
            } else {
                require_once __DIR__ . '/get_user.php';
            }
        } elseif (preg_match('/^\/pet_information\/([^\/]+)\/status$/', $path, $matches)) {
            $_GET['petId'] = $matches[1];
            require_once __DIR__ . '/update_pet_status.php';
        } elseif (preg_match('/^\/pet_information\/([^\/]+)$/', $path, $matches)) {
            $_GET['petId'] = $matches[1];
            require_once __DIR__ . '/get_pet.php';
        } else {
            http_response_code(404);
            echo json_encode(['message' => 'Route not found: ' . $path, 'uri' => $requestUri]);
        }
        break;
}
