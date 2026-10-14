<?php
// PHP's development server ignores .htaccess. Expose only the API controller.
$path = (string)(parse_url($_SERVER['REQUEST_URI'] ?? '/', PHP_URL_PATH) ?: '/');
if (preg_match('#^/php/index\.php(?:/|$)#', $path)) {
    return false;
}
http_response_code(404);
header('Content-Type: application/json');
echo json_encode(['message' => 'API route was not found.', 'code' => 'api_route_not_found']);
