<?php

require_once __DIR__ . '/db.php';

try {
    $stmt = $pdo->query("
        SELECT DISTINCT
            TRIM(pet_species) AS species,
            TRIM(pet_breed) AS breed
        FROM pet_catalog_options
        WHERE TRIM(COALESCE(species, '')) <> ''
          AND TRIM(COALESCE(breed, '')) <> ''
        ORDER BY species ASC, breed ASC
    ");

    $species = [];
    $breedsBySpecies = [];
    $speciesKeys = [];
    $breedKeys = [];

    foreach ($stmt->fetchAll() as $row) {
        $speciesName = trim((string)($row['species'] ?? ''));
        $breedName = trim((string)($row['breed'] ?? ''));
        $speciesKey = function_exists('mb_strtolower') ? mb_strtolower($speciesName, 'UTF-8') : strtolower($speciesName);
        $breedKey = function_exists('mb_strtolower') ? mb_strtolower($breedName, 'UTF-8') : strtolower($breedName);

        if ($speciesName === '' || $breedName === '') {
            continue;
        }

        if (!isset($speciesKeys[$speciesKey])) {
            $speciesKeys[$speciesKey] = $speciesName;
            $species[] = $speciesName;
            $breedsBySpecies[$speciesName] = [];
            $breedKeys[$speciesKey] = [];
        }

        $catalogSpecies = $speciesKeys[$speciesKey];
        if (!isset($breedKeys[$speciesKey][$breedKey])) {
            $breedKeys[$speciesKey][$breedKey] = true;
            $breedsBySpecies[$catalogSpecies][] = $breedName;
        }
    }

    echo json_encode([
        'species' => $species,
        'breedsBySpecies' => $breedsBySpecies,
    ]);
} catch (Throwable $error) {
    error_log('Pet catalog error: ' . $error->getMessage());
    http_response_code(500);
    echo json_encode(['message' => 'The pet autocomplete catalog could not be loaded.']);
}
