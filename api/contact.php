<?php
header('Content-Type: application/json');
header('Access-Control-Allow-Origin: https://mysyntromed.com');
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

// Sanitize and prepare data
$fullName = trim(htmlspecialchars($input['fullName']));
$practiceName = trim(htmlspecialchars($input['practiceName']));
$email = filter_var(trim($input['email']), FILTER_VALIDATE_EMAIL);
$phone = trim(htmlspecialchars($input['phone'] ?? ''));
$serviceInterest = trim(htmlspecialchars($input['serviceInterest'] ?? ''));
$message = trim(htmlspecialchars($input['message'] ?? ''));

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
                <h1>📬 New Contact Form Submission</h1>
                <p>Someone is interested in MySyntroMed services</p>
            </div>
            
            <div class='field'>
                <span class='badge'>Contact Inquiry</span>
            </div>

            <div class='field'>
                <div class='field-label'>Full Name</div>
                <div class='field-value'>{$fullName}</div>
            </div>

            <div class='field'>
                <div class='field-label'>Practice / Organization</div>
                <div class='field-value'>{$practiceName}</div>
            </div>

            <div class='field'>
                <div class='field-label'>Email Address</div>
                <div class='field-value'><a href='mailto:{$email}'>{$email}</a></div>
            </div>";

if (!empty($phone)) {
    $htmlEmail .= "
            <div class='field'>
                <div class='field-label'>Phone Number</div>
                <div class='field-value'><a href='tel:{$phone}'>{$phone}</a></div>
            </div>";
}

if (!empty($serviceInterest)) {
    $htmlEmail .= "
            <div class='field'>
                <div class='field-label'>Service Interested In</div>
                <div class='field-value'>{$serviceInterest}</div>
            </div>";
}

if (!empty($message)) {
    $htmlEmail .= "
            <div class='field'>
                <div class='field-label'>Message</div>
                <div class='message-box'>
                    <p>{$message}</p>
                </div>
            </div>";
}

$htmlEmail .= "
            <div style='text-align: center;'>
                <a href='mailto:{$email}?subject=Re: MySyntroMed Inquiry - " . urlencode($practiceName) . "' class='cta-button'>
                    Reply to {$fullName}
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

// Plain text version for company
$textEmail = "
NEW CONTACT FORM SUBMISSION
=========================

Contact Inquiry from MySyntroMed Website

CONTACT DETAILS
---------------
Name:         {$fullName}
Practice:     {$practiceName}
Email:        {$email}
Phone:        {$phone}
Service:      {$serviceInterest}

MESSAGE
-------
{$message}

---
Submitted: " . date('l, F j, Y \a\t g:i A') . "
Reply directly to this email or contact them at: {$email}
";

// Auto-reply to user
$autoReplySubject = "Thank you for contacting MySyntroMed, {$fullName}!";
$autoReplyText = "Dear {$fullName},

Thank you for reaching out to MySyntroMed!

We have received your inquiry and our team will review your message. We typically respond within 24 hours during business days.

Here's a summary of your inquiry:
- Service(s) of Interest: {$serviceInterest}
- Practice: {$practiceName}

What to expect next:
1. Our team will review your inquiry and prepare a personalized response
2. You will receive a follow-up email with more information
3. If you'd like a consultation, we'll schedule a time that works for you

In the meantime, feel free to learn more about our services at https://mysyntromed.com

Best regards,
The MySyntroMed Team

---
Phone: {$companyPhone}
Email: {$companyEmail}
Website: https://mysyntromed.com

This is an automated message. Please do not reply directly to this email.
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
$mailToCompany = mail(
    $companyEmail,
    $subject,
    $htmlEmail,
    $headersStr
);

// Send auto-reply to user
$autoReplyHeaders = [
    'From: "MySyntroMed" <noreply@mysyntromed.com>',
    'X-Mailer: PHP/' . phpversion(),
    'MIME-Version: 1.0',
    'Content-Type: text/plain; charset=UTF-8'
];
$autoReplyHeadersStr = implode("\r\n", $autoReplyHeaders);

$mailToUser = mail(
    $email,
    $autoReplySubject,
    $autoReplyText,
    $autoReplyHeadersStr
);

// Log the attempt
$logEntry = date('Y-m-d H:i:s') . " - From: {$email}, Name: {$fullName}, Practice: {$practiceName}, Company Mail: " . ($mailToCompany ? 'OK' : 'FAILED') . ", Auto-Reply: " . ($mailToUser ? 'OK' : 'FAILED') . "\n";
file_put_contents('contact_log.txt', $logEntry, FILE_APPEND);

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
