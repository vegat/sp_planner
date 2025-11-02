<?php
header('Content-Type: application/json; charset=utf-8');

$id = isset($_GET['id']) ? preg_replace('/[^a-zA-Z0-9_-]/', '', $_GET['id']) : null;
if (!$id) {
    http_response_code(400);
    echo json_encode(['error' => 'Brak identyfikatora planu']);
    exit;
}

$filePath = __DIR__ . DIRECTORY_SEPARATOR . 'plans' . DIRECTORY_SEPARATOR . 'plan_' . $id . '.json';
if (!is_file($filePath)) {
    http_response_code(404);
    echo json_encode(['error' => 'Nie znaleziono planu']);
    exit;
}

$contents = file_get_contents($filePath);
if ($contents === false) {
    http_response_code(500);
    echo json_encode(['error' => 'Nie udało się odczytać planu']);
    exit;
}

echo $contents;
