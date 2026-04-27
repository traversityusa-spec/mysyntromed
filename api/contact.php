<?php
header('Content-Type: application/json');

// Rate limiting - simple file-based implementation
$rateLimitFile = sys_get_temp_dir() . '/mysyntromed_contact_rate_' . md5($_SERVER['REMOTE_ADDR'] ?? 'unknown');
$rateLimitWindow = 15 * 60; // 15 minutes
$rateLimitMax = 5;

if (file_exists($rateLimitFile)) {
    $data = json_decode(file_get_contents($rateLimitFile), true);
    if ($data && (time() - $data['time']) < $rateLimitWindow) {
        if ($data['count'] >= $rateLimitMax) {
            http_response_code(429);
            echo json_encode(['error' => 'Too many requests. Please try again later.']);
            exit;
        }
        $data['count']++;
    } else {
        $data = ['time' => time(), 'count' => 1];
    }
} else {
    $data = ['time' => time(), 'count' => 1];
}
file_put_contents($rateLimitFile, json_encode($data));

// CORS - restrict to your domain
$allowedOrigins = [
    'https://mysyntromed.com',
    'https://www.mysyntromed.com',
    'http://localhost:3000'  // for development
];
$origin = $_SERVER['HTTP_ORIGIN'] ?? '';
if (in_array($origin, $allowedOrigins)) {
    header('Access-Control-Allow-Origin: ' . $origin);
}
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

// API Key validation
$validApiKey = 'mysyntromed-secure-contact-api-key-2024';
$providedKey = $_SERVER['HTTP_X_API_KEY'] ?? '';
if (!hash_equals($validApiKey, $providedKey)) {
    http_response_code(401);
    echo json_encode(['error' => 'Unauthorized']);
    exit;
}

// Get JSON input
$input = json_decode(file_get_contents('php://input'), true);

// Validate required fields
$required = ['fullName', 'email', 'practiceName'];
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

// Sanitize and validate input
$fullName = filter_var(trim(strip_tags($input['fullName'])), FILTER_SANITIZE_SPECIAL_CHARS);
$practiceName = filter_var(trim(strip_tags($input['practiceName'])), FILTER_SANITIZE_SPECIAL_CHARS);
$email = filter_var(trim($input['email']), FILTER_VALIDATE_EMAIL);
$phone = filter_var(trim(strip_tags($input['phone'] ?? '')), FILTER_SANITIZE_SPECIAL_CHARS);
$serviceInterest = filter_var(trim(strip_tags($input['serviceInterest'] ?? '')), FILTER_SANITIZE_SPECIAL_CHARS);
$message = filter_var(trim(strip_tags($input['message'] ?? '')), FILTER_SANITIZE_SPECIAL_CHARS);

// Length validation
if (strlen($fullName) > 100 || strlen($practiceName) > 200 || strlen($message) > 5000) {
    http_response_code(400);
    echo json_encode(['error' => 'Input too long']);
    exit;
}

if (!$email) {
    http_response_code(400);
    echo json_encode(['error' => 'Invalid email address']);
    exit;
}

// Email configuration
$companyEmail = 'info@mysyntromed.com';
$companyName = 'MySyntroMed';
$companyPhone = '+1 (303) 532-0497';

// Email to company
$subject = "New Inquiry from {$fullName} - {$practiceName}";

// Build HTML email for company
$htmlEmail = "
<!DOCTYPE html>
<html lang='en'>
<head>
    <meta charset='UTF-8'>
    <meta name='viewport' content='width=device-width, initial-scale=1.0'>
    <title>New Contact Form Submission</title>
    <style>
        body { font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; line-height: 1.6; color: #1e293b; margin: 0; padding: 0; background-color: #f8fafc; }
        .container { max-width: 600px; margin: 0 auto; padding: 20px; }
        .card { background: #ffffff; border-radius: 12px; box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1); padding: 32px; margin: 20px 0; }
        .header { background: linear-gradient(135deg, #0d9488 0%, #14b8a6 100%); color: white; padding: 24px; border-radius: 12px 12px 0 0; margin: -32px -32px 24px -32px; }
        .header h1 { margin: 0; font-size: 20px; }
        .header p { margin: 8px 0 0 0; opacity: 0.9; font-size: 14px; }
        .field { margin-bottom: 16px; padding-bottom: 16px; border-bottom: 1px solid #e2e8f0; }
        .field:last-child { border-bottom: none; margin-bottom: 0; padding-bottom: 0; }
        .field-label { font-size: 11px; text-transform: uppercase; letter-spacing: 0.5px; color: #64748b; font-weight: 600; margin-bottom: 4px; }
        .field-value { font-size: 15px; color: #0f172a; font-weight: 500; }
        .message-box { background: #f8fafc; border-radius: 8px; padding: 16px; margin-top: 8px; }
        .message-box p { margin: 0; white-space: pre-wrap; }
        .footer { text-align: center; margin-top: 24px; padding-top: 16px; border-top: 1px solid #e2e8f0; color: #64748b; font-size: 12px; }
        .badge { display: inline-block; background: #f0fdfa; color: #0d9488; padding: 4px 12px; border-radius: 9999px; font-size: 12px; font-weight: 600; }
        .cta-button { display: inline-block; background: #0d9488; color: #ffffff; text-decoration: none; padding: 12px 24px; border-radius: 8px; font-weight: 600; margin-top: 16px; }
        a { color: #0d9488; }
    </style>
</head>
<body>
    <div class='container'>
        <div class='card'>
            <div class='header'>
                <h1>New Contact Form Submission</h1>
                <p>Someone is interested in MySyntroMed services</p>
            </div>
            
            <div class='field'>
                <span class='badge'>Contact Inquiry</span>
            </div>

            <div class='field'>
                <div class='field-label'>Full Name</div>
                <div class='field-value'>" . htmlspecialchars($fullName) . "</div>
            </div>

            <div class='field'>
                <div class='field-label'>Practice / Organization</div>
                <div class='field-value'>" . htmlspecialchars($practiceName) . "</div>
            </div>

            <div class='field'>
                <div class='field-label'>Email Address</div>
                <div class='field-value'><a href='mailto:" . htmlspecialchars($email) . "'>" . htmlspecialchars($email) . "</a></div>
            </div>";

if (!empty($phone)) {
    $htmlEmail .= "
            <div class='field'>
                <div class='field-label'>Phone Number</div>
                <div class='field-value'><a href='tel:" . htmlspecialchars($phone) . "'>" . htmlspecialchars($phone) . "</a></div>
            </div>";
}

if (!empty($serviceInterest)) {
    $htmlEmail .= "
            <div class='field'>
                <div class='field-label'>Service Interested In</div>
                <div class='field-value'>" . htmlspecialchars($serviceInterest) . "</div>
            </div>";
}

if (!empty($message)) {
    $htmlEmail .= "
            <div class='field'>
                <div class='field-label'>Message</div>
                <div class='message-box'>
                    <p>" . htmlspecialchars($message) . "</p>
                </div>
            </div>";
}

$htmlEmail .= "
            <div style='text-align: center;'>
                <a href='mailto:" . htmlspecialchars($email) . "?subject=Re: MySyntroMed Inquiry - " . urlencode($practiceName) . "' class='cta-button'>
                    Reply to " . htmlspecialchars($fullName) . "
                </a>
            </div>

            <div class='footer'>
                <p>This email was sent from the MySyntroMed website contact form.</p>
                <p>Submitted: " . date('l, F j, Y \a\t g:i A') . "</p>
            </div>
        </div>
    </div>
</body>
</html>
";

// Email headers
$headers = [
    'From: "MySyntroMed Website" <noreply@mysyntromed.com>',
    'Reply-To: ' . $email,
    'X-Mailer: PHP/' . phpversion(),
    'MIME-Version: 1.0',
    'Content-Type: text/html; charset=UTF-8'
];
$headersStr = implode("\r\n", $headers);

// Send email to company
$mailToCompany = @mail(
    $companyEmail,
    $subject,
    $htmlEmail,
    $headersStr
);

// Return response
if ($mailToCompany) {
    echo json_encode([
        'success' => true,
        'message' => 'Your message has been sent. We will contact you shortly.'
    ]);
} else {
    http_response_code(500);
    echo json_encode([
        'error' => 'Failed to send email. Please try again or contact us directly.'
    ]);
}