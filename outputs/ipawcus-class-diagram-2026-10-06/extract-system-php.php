<?php
// Token-based static inspection: source files are read, never included/run.
$input = json_decode(stream_get_contents(STDIN), true, 512, JSON_THROW_ON_ERROR);
$knownTables = array_fill_keys($input['tables'], true);
$modules = [];
foreach ($input['files'] as $source) {
    $code = file_get_contents($input['root'] . DIRECTORY_SEPARATOR . $source);
    $tokens = token_get_all($code);
    $functions = [];
    $queries = [];
    foreach ($tokens as $index => $token) {
        if (!is_array($token)) continue;
        if ($token[0] === T_FUNCTION) {
            for ($next = $index + 1; $next < count($tokens); $next++) {
                $candidate = $tokens[$next];
                if (is_array($candidate) && $candidate[0] === T_WHITESPACE) continue;
                if ($candidate === '&' || (is_array($candidate) && in_array($candidate[0], [T_AMPERSAND_NOT_FOLLOWED_BY_VAR_OR_VARARG, T_AMPERSAND_FOLLOWED_BY_VAR_OR_VARARG], true))) continue;
                if (is_array($candidate) && $candidate[0] === T_STRING) {
                    $functions[] = ['name' => $candidate[1], 'parameters' => [], 'line' => $token[2]];
                }
                break;
            }
        }
        if (!in_array($token[0], [T_CONSTANT_ENCAPSED_STRING, T_ENCAPSED_AND_WHITESPACE], true)) continue;
        preg_match_all('/\b(FROM|JOIN|UPDATE|INTO|TABLE(?:\s+IF\s+(?:NOT\s+)?EXISTS)?)\s+`?([a-z_][a-z0-9_]*)`?/i', $token[1], $matches, PREG_SET_ORDER | PREG_OFFSET_CAPTURE);
        foreach ($matches as $match) {
            $table = $match[2][0];
            if (!isset($knownTables[$table])) continue;
            $queries[] = ['table' => $table, 'clause' => strtoupper($match[1][0]), 'line' => $token[2] + substr_count(substr($token[1], 0, $match[0][1]), "\n")];
        }
    }
    $modules[$source] = ['operations' => $functions, 'queries' => $queries];
}
echo json_encode($modules, JSON_THROW_ON_ERROR);
