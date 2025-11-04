<?php
// ipc.php — compact IP logger + blacklist + Idaho block
// Saves minimal JSONL: time, ip, country, region, city, path
// Optional: UNIQUE_PER_DAY to only log first hit per IP per day

// ==== CONFIG ====
$safeRedirect    = "https://getunicornofficial.com/cb/c";
$logDir          = "/home/forge/getunicornofficial.com/public/cb/logs";
$blacklist       = ["1.2.3.4", "5.6.7.8"]; // blocked IPs
$UNIQUE_PER_DAY  = false;                   // set true to log 1 entry per IP per day

// ==== ensure log dir exists ====
if (!is_dir($logDir)) {
    @mkdir($logDir, 0755, true);
}

// ==== helper to get header safely ====
function hdr($name) {
    $n = 'HTTP_' . str_replace('-', '_', strtoupper($name));
    return $_SERVER[$n] ?? null;
}

// ==== collect visitor info (Cloudflare-aware) ====
$ip = $_SERVER['HTTP_CF_CONNECTING_IP']
    ?? (isset($_SERVER['HTTP_X_FORWARDED_FOR']) ? explode(',', $_SERVER['HTTP_X_FORWARDED_FOR'])[0] : null)
    ?? $_SERVER['REMOTE_ADDR']
    ?? '0.0.0.0';

$country = hdr('cf-ipcountry') ?? '';
$region  = hdr('cf-region') ?? '';
$city    = hdr('cf-city') ?? '';
$path    = $_SERVER['REQUEST_URI'] ?? '';
$time    = gmdate('Y-m-d H:i:s');

// ==== prepare filenames ====
$today         = gmdate('Y-m-d');
$logFile       = rtrim($logDir, DIRECTORY_SEPARATOR) . DIRECTORY_SEPARATOR . "visits-{$today}.jsonl";
$indexFile     = rtrim($logDir, DIRECTORY_SEPARATOR) . DIRECTORY_SEPARATOR . "index-{$today}.txt"; // for UNIQUE_PER_DAY

// ==== optional unique-per-day check ====
$shouldLog = true;
if ($UNIQUE_PER_DAY) {
    // If index file exists and contains this IP, skip logging
    if (file_exists($indexFile)) {
        $contents = @file($indexFile, FILE_IGNORE_NEW_LINES | FILE_SKIP_EMPTY_LINES) ?: [];
        if (in_array($ip, $contents, true)) {
            $shouldLog = false;
        }
    }
}

// ==== write log (compact fields) ====
if ($shouldLog) {
    $entry = [
        'time'    => $time,
        'ip'      => $ip,
        'country' => $country ?: 'Unknown',
        'region'  => $region ?: 'Unknown',
        'city'    => $city ?: 'Unknown',
        'path'    => $path
    ];

    // append line atomically with lock
    $fp = @fopen($logFile, 'ab');
    if ($fp) {
        @flock($fp, LOCK_EX);
        @fwrite($fp, json_encode($entry, JSON_UNESCAPED_SLASHES) . PHP_EOL);
        @fflush($fp);
        @flock($fp, LOCK_UN);
        @fclose($fp);
    }

    // update index if using unique-per-day
    if ($UNIQUE_PER_DAY) {
        $fi = @fopen($indexFile, 'a');
        if ($fi) {
            @flock($fi, LOCK_EX);
            @fwrite($fi, $ip . PHP_EOL);
            @fflush($fi);
            @flock($fi, LOCK_UN);
            @fclose($fi);
        }
    }
}

// ==== block if blacklisted or Idaho (ID) ====
if (in_array($ip, $blacklist, true) || (strtoupper($country) === 'US' && strtoupper($region) === 'ID')) {
    header("Location: {$safeRedirect}", true, 302);
    exit;
}

// ==== transparent 1x1 GIF response ====
header("Content-Type: image/gif");
echo base64_decode("R0lGODlhAQABAPAAAP///wAAACH5BAAAAAAALAAAAAABAAEAAAICRAEAOw==");
exit;
?>
