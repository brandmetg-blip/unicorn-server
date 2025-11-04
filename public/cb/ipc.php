<?php

$LOG_DIR = __DIR__ . '/logs';    
$DAILY_PREFIX = 'visits-';             
$MAX_PAYLOAD = 32 * 1024;             
$LOG_UNIQUE_PER_DAY = false;  
$UNIQUE_INDEX_TTL_DAYS = 1;


if (!is_dir($LOG_DIR)) {
    @mkdir($LOG_DIR, 0755, true);
}


$raw = '';
$hasBody = false;
if (in_array($_SERVER['REQUEST_METHOD'], ['POST','PUT','PATCH'])) {
    $raw = file_get_contents('php://input');
    $hasBody = ($raw !== false && $raw !== '');
    if ($hasBody && strlen($raw) > $MAX_PAYLOAD) {
        $raw = substr($raw,0,$MAX_PAYLOAD);
    }
}


function get_client_ip() {
    if (!empty($_SERVER['HTTP_CF_CONNECTING_IP'])) return trim($_SERVER['HTTP_CF_CONNECTING_IP']);
    if (!empty($_SERVER['HTTP_X_FORWARDED_FOR'])) {
        $parts = explode(',', $_SERVER['HTTP_X_FORWARDED_FOR']);
        return trim($parts[0]);
    }
    if (!empty($_SERVER['HTTP_X_REAL_IP'])) return trim($_SERVER['HTTP_X_REAL_IP']);
    if (!empty($_SERVER['REMOTE_ADDR'])) return trim($_SERVER['REMOTE_ADDR']);
    return '0.0.0.0';
}

$ip = get_client_ip();
$ua = $_SERVER['HTTP_USER_AGENT'] ?? null;
$ref = $_SERVER['HTTP_REFERER'] ?? null;
$path = $_SERVER['REQUEST_URI'] ?? null;
$host = $_SERVER['HTTP_HOST'] ?? null;
$cf_country = $_SERVER['HTTP_CF_IPCOUNTRY'] ?? null;
$cf_region = $_SERVER['HTTP_CF_REGION'] ?? null;

$record = [
    'ts' => gmdate('c'),         
    'ip' => $ip,
    'host' => $host,
    'path' => $path,
    'ua' => $ua,
    'ref' => $ref,
    'cf_country' => $cf_country,
    'cf_region' => $cf_region,
];

if ($hasBody) {
    $record['body_snippet'] = (strlen($raw) > 512) ? substr($raw,0,512) : $raw;
}

$today = gmdate('Y-m-d');
$logfile = rtrim($LOG_DIR, DIRECTORY_SEPARATOR) . DIRECTORY_SEPARATOR . $DAILY_PREFIX . $today . '.jsonl';

$shouldLog = true;
if ($LOG_UNIQUE_PER_DAY) {
    $indexFile = rtrim($LOG_DIR, DIRECTORY_SEPARATOR) . DIRECTORY_SEPARATOR . 'index-' . $today . '.txt';
    if (file_exists($indexFile)) {
        $idx = @file($indexFile, FILE_IGNORE_NEW_LINES | FILE_SKIP_EMPTY_LINES);
        if ($idx && in_array($ip, $idx, true)) {
            $shouldLog = false; 
        }
    }
}

if ($shouldLog) {
    $line = json_encode($record, JSON_UNESCAPED_SLASHES|JSON_UNESCAPED_UNICODE) . PHP_EOL;
    $fp = @fopen($logfile, 'ab');
    if ($fp) {
        @flock($fp, LOCK_EX);
        @fwrite($fp, $line);
        @fflush($fp);
        @flock($fp, LOCK_UN);
        @fclose($fp);
    }
    if ($LOG_UNIQUE_PER_DAY) {
        $fp2 = @fopen($indexFile, 'a');
        if ($fp2) {
            @flock($fp2, LOCK_EX);
            @fwrite($fp2, $ip . PHP_EOL);
            @fflush($fp2);
            @flock($fp2, LOCK_UN);
            @fclose($fp2);
        }
    }
}

if ($LOG_UNIQUE_PER_DAY) {
    $files = glob(rtrim($LOG_DIR, DIRECTORY_SEPARATOR) . DIRECTORY_SEPARATOR . 'index-*.txt');
    $cutoff = strtotime("-" . intval($UNIQUE_INDEX_TTL_DAYS) . " days");
    if ($files) {
        foreach ($files as $f) {
            if (@filemtime($f) < $cutoff) @unlink($f);
        }
    }
}

return;
