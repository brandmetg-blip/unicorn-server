<?php
// config
$safePage = 'https://getunicornofficial.com/safe-page';
$blacklist = ['1.2.3.4', '5.6.7.8'];

// get visitor IP
$ip = $_SERVER['HTTP_CF_CONNECTING_IP']
   ?? explode(',', $_SERVER['HTTP_X_FORWARDED_FOR'] ?? '')[0]
   ?? $_SERVER['REMOTE_ADDR'];

// block listed IPs
if (in_array($ip, $blacklist)) {
    header("Location: $safePage", true, 302);
    exit;
}

// block Idaho (CF provides these headers automatically)
$country = $_SERVER['HTTP_CF_IPCOUNTRY'] ?? '';
$region  = $_SERVER['HTTP_CF_REGION'] ?? '';

if (strtoupper($country) === 'US' && strtoupper($region) === 'ID') {
    header("Location: $safePage", true, 302);
    exit;
}
?>
