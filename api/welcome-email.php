<?php
header('Content-Type: application/json');
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: POST, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type');

// Handle preflight requests
if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(200);
    exit;
}

// Only allow POST requests
if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    http_response_code(405);
    echo json_encode(['error' => 'Method not allowed']);
    exit;
}

// Get JSON input
$input = json_decode(file_get_contents('php://input'), true);

// Validate required fields
$required = ['email', 'displayName', 'password', 'role'];
$missing = [];
foreach ($required as $field) {
    if (empty($input[$field])) {
        $missing[] = $field;
    }
}

if (!empty($missing)) {
    http_response_code(400);
    echo json_encode(['error' => 'Missing required fields: ' . implode(', ', $missing)]);
    exit;
}

// Sanitize data
$email = filter_var(trim($input['email']), FILTER_VALIDATE_EMAIL);
$displayName = trim(htmlspecialchars($input['displayName']));
$password = trim($input['password']);
$role = trim($input['role']);
$loginUrl = trim($input['loginUrl'] ?? 'https://mysyntromed.com');

if (!$email) {
    http_response_code(400);
    echo json_encode(['error' => 'Invalid email address']);
    exit;
}

if (!in_array($role, ['client', 'specialist'])) {
    $role = 'client';
}

$roleLabel = $role === 'specialist' ? 'Specialist' : 'Healthcare Professional';
$portalUrl = $role === 'specialist' ? $loginUrl . '/specialist' : $loginUrl . '/portal';

// Build HTML email
$htmlEmail = "
<!DOCTYPE html>
<html lang='en'>
<head>
    <meta charset='UTF-8'>
    <meta name='viewport' content='width=device-width, initial-scale=1.0'>
    <title>Welcome to MySyntroMed</title>
    <style>
        body { font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; line-height: 1.6; color: #1e293b; margin: 0; padding: 0; background-color: #f8fafc; }
        .container { max-width: 600px; margin: 0 auto; padding: 20px; }
        .card { background: #ffffff; border-radius: 12px; box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1); padding: 40px; margin: 20px 0; }
        .header { text-align: center; margin-bottom: 30px; }
        .logo { font-size: 28px; font-weight: 700; color: #0d9488; margin-bottom: 8px; }
        .tagline { color: #64748b; font-size: 14px; }
        h1 { color: #0f172a; font-size: 24px; margin-bottom: 20px; }
        p { margin-bottom: 16px; color: #475569; }
        .credentials { background: #f0fdfa; border: 2px dashed #14b8a6; border-radius: 8px; padding: 20px; margin: 24px 0; }
        .credentials h3 { margin: 0 0 12px 0; color: #0f172a; font-size: 14px; text-transform: uppercase; letter-spacing: 0.5px; }
        .credential-item { display: flex; justify-content: space-between; padding: 8px 0; border-bottom: 1px solid #ccfbf1; }
        .credential-item:last-child { border-bottom: none; }
        .credential-label { color: #64748b; font-size: 13px; }
        .credential-value { font-weight: 600; color: #0f172a; font-family: monospace; background: #ffffff; padding: 2px 8px; border-radius: 4px; }
        .cta-button { display: inline-block; background: #0d9488; color: #ffffff; text-decoration: none; padding: 14px 28px; border-radius: 8px; font-weight: 600; margin: 20px 0; }
        .warning { background: #fef3c7; border-left: 4px solid #f59e0b; padding: 16px; border-radius: 0 8px 8px 0; margin: 20px 0; }
        .warning-title { font-weight: 600; color: #92400e; margin-bottom: 8px; }
        .warning-text { color: #92400e; font-size: 14px; margin: 0; }
        .features { list-style: none; padding: 0; margin: 20px 0; }
        .features li { padding: 8px 0; padding-left: 28px; position: relative; color: #475569; }
        .features li::before { content: '✓'; position: absolute; left: 0; color: #14b8a6; font-weight: bold; }
        .footer { text-align: center; margin-top: 30px; padding-top: 20px; border-top: 1px solid #e2e8f0; color: #64748b; font-size: 12px; }
        a { color: #0d9488; }
    </style>
</head>
<body>
    <div class='container'>
        <div class='card'>
            <div class='header'>
                <div class='logo'>MySyntroMed</div>
                <div class='tagline'>Virtual Medical Assistant & Healthcare Support</div>
            </div>

            <h1>Welcome Aboard, {$displayName}!</h1>
            
            <p>We're thrilled to have you join the MySyntroMed family as a <strong>{$roleLabel}</strong>. Your account has been successfully created and you're all set to get started.</p>

            <div class='credentials'>
                <h3>Your Login Credentials</h3>
                <div class='credential-item'>
                    <span class='credential-label'>Email</span>
                    <span class='credential-value'>{$email}</span>
                </div>
                <div class='credential-item'>
                    <span class='credential-label'>Temporary Password</span>
                    <span class='credential-value'>{$password}</span>
                </div>
                <div class='credential-item'>
                    <span class='credential-label'>Login URL</span>
                    <span class='credential-value'>" . substr($portalUrl, 0, 30) . "...</span>
                </div>
            </div>

            <div style='text-align: center;'>
                <a href='{$portalUrl}' class='cta-button'>Access Your Dashboard</a>
            </div>

            <div class='warning'>
                <div class='warning-title'>⚠️ Important Security Notice</div>
                <p class='warning-text'>For your security, you will be required to change your temporary password upon first login. Please choose a strong, unique password that you don't use elsewhere.</p>
            </div>

            <h2 style='font-size: 18px; margin-top: 30px;'>What's Next?</h2>
            <ul class='features'>";

if ($role === 'client') {
    $htmlEmail .= "
                <li>Complete your profile with clinic information</li>
                <li>Submit support requests for assistance</li>
                <li>Message your assigned specialist directly</li>
                <li>Schedule consultation calls</li>";
} else {
    $htmlEmail .= "
                <li>Complete your specialist profile</li>
                <li>Review assigned client requests</li>
                <li>Coordinate with clients through secure messaging</li>
                <li>Access training resources</li>";
}

$htmlEmail .= "
            </ul>

            <p>If you have any questions or need assistance getting started, don't hesitate to reach out to our support team.</p>

            <div class='footer'>
                <p>© " . date('Y') . " MySyntroMed. All rights reserved.</p>
                <p>This email was sent because an admin created your account.</p>
                <p style='margin-top: 12px;'>
                    <a href='https://mysyntromed.com'>Visit Website</a> · 
                    <a href='mailto:support@mysyntromed.com'>Contact Support</a>
                </p>
            </div>
        </div>
    </div>
</body>
</html>
";

// Plain text version
$textEmail = "Welcome to MySyntroMed, {$displayName}!

We're thrilled to have you join the MySyntroMed family as a {$roleLabel}. Your account has been successfully created and you're all set to get started.

YOUR LOGIN CREDENTIALS
======================
Email:              {$email}
Temporary Password:  {$password}
Login URL:          {$portalUrl}
======================

IMPORTANT: For your security, you will be required to change your temporary password upon first login.

NEXT STEPS
";

if ($role === 'client') {
    $textEmail .= "
• Complete your profile with clinic information
• Submit support requests for assistance
• Message your assigned specialist directly
• Schedule consultation calls";
} else {
    $textEmail .= "
• Complete your specialist profile
• Review assigned client requests
• Coordinate with clients through secure messaging
• Access training resources";
}

$textEmail .= "

If you have any questions or need assistance getting started, don't hesitate to reach out to our support team.

© " . date('Y') . " MySyntroMed. All rights reserved.
This email was sent because an admin created your account.
";

// Email headers
$subject = "Welcome to MySyntroMed - Your Account is Ready" . ($role === 'specialist' ? ', Specialist!' : '!');
$headers = [
    'From: "MySyntroMed" <noreply@mysyntromed.com>',
    'X-Mailer: PHP/' . phpversion(),
    'MIME-Version: 1.0',
    'Content-Type: text/html; charset=UTF-8'
];
$headersStr = implode("\r\n", $headers);

// Send email
$sent = mail($email, $subject, $htmlEmail, $headersStr);

// Log the attempt
$logEntry = date('Y-m-d H:i:s') . " - Welcome Email To: {$email}, Name: {$displayName}, Role: {$role}, Status: " . ($sent ? 'SENT' : 'FAILED') . "\n";
file_put_contents('welcome_email_log.txt', $logEntry, FILE_APPEND);

// Return response
if ($sent) {
    echo json_encode([
        'success' => true,
        'message' => 'Welcome email sent successfully'
    ]);
} else {
    http_response_code(500);
    echo json_encode([
        'error' => 'Failed to send welcome email'
    ]);
}
