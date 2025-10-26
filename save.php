<?php
header('Content-Type: application/json; charset=utf-8');

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    http_response_code(405);
    echo json_encode(['error' => 'Metoda niedozwolona']);
    exit;
}

$raw = file_get_contents('php://input');
if (!$raw) {
    http_response_code(400);
    echo json_encode(['error' => 'Brak danych']);
    exit;
}

$data = json_decode($raw, true);
if ($data === null) {
    http_response_code(400);
    echo json_encode(['error' => 'Niepoprawny JSON']);
    exit;
}

$plansDir = __DIR__ . DIRECTORY_SEPARATOR . 'plans';
if (!is_dir($plansDir)) {
    if (!mkdir($plansDir, 0775, true) && !is_dir($plansDir)) {
        http_response_code(500);
        echo json_encode(['error' => 'Nie można utworzyć katalogu planów']);
        exit;
    }
}

$id = bin2hex(random_bytes(6));
$filePath = $plansDir . DIRECTORY_SEPARATOR . 'plan_' . $id . '.json';
if (file_put_contents($filePath, json_encode($data, JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE)) === false) {
    http_response_code(500);
    echo json_encode(['error' => 'Nie udało się zapisać planu']);
    exit;
}

$scheme = (!empty($_SERVER['HTTPS']) && $_SERVER['HTTPS'] !== 'off') ? 'https' : 'http';
$host = $_SERVER['HTTP_HOST'] ?? 'localhost';
$path = rtrim(dirname($_SERVER['SCRIPT_NAME']), '/\\');
$url = $scheme . '://' . $host . $path . '/?id=' . $id;

echo json_encode(['success' => true, 'id' => $id, 'url' => $url]);
