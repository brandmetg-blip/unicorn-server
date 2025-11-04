<?php
// ipc.php — lightweight IP logger + blacklist / Idaho blocker

// === CONFIG ===
$safeRedirect = "https://getunicornofficial.com/cb/c";   // fallback safe page
$logDir = __DIR__ . "/logs";
$blacklist = ["1.2.3.4", "5.6.7.8"];                     // add any IPs you want to block

// === Ensure log folder exists ===
if (!is_dir($logDir)) mkdir($logDir, 0755, true);

// === Collect visitor info ===
$ip = $_SERVER['HTTP_CF_CONNECTING_IP']
   ?? explode(',', $_SERVER['HTTP_X_FORWARDED_FOR'] ?? '')[0]
   ?? $_SERVER['REMOTE_ADDR']
   ?? '0.0.0.0';

$country = $_SERVER['HTTP_CF_IPCOUNTRY'] ?? '';
$region  = $_SERVER['HTTP_CF_REGION'] ?? '';
$ua      = $_SERVER['HTTP_USER_AGENT'] ?? '';
$path    = $_SERVER['REQUEST_URI'] ?? '';

// === Log the visit ===
$logfile = $logDir . '/visits-' . gmdate('Y-m-d') . '.jsonl';
$fp = fopen($logfile, 'ab');
if ($fp) {
  flock($fp, LOCK_EX);
  fwrite($fp, json_encode([
    'ts' => gmdate('c'),
    'ip' => $ip,
    'country' => $country,
    'region' => $region,
    'path' => $path,
    'ua' => $ua
  ]) . PHP_EOL);
  flock($fp, LOCK_UN);
  fclose($fp);
}

// === Block if blacklisted or Idaho ===
if (in_array($ip, $blacklist) || (strtoupper($country) === 'US' && strtoupper($region) === 'ID')) {
  header("Location: $safeRedirect", true, 302);
  exit;
}

// === Return transparent 1x1 GIF ===
header("Content-Type: image/gif");
echo base64_decode("R0lGODlhAQABAPAAAP///wAAACH5BAAAAAAALAAAAAABAAEAAAICRAEAOw==");
exit;
?>
