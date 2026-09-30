export async function sendPasswordResetEmail(
  toEmail: string,
  resetToken: string,
  baseUrl: string,
  resendApiKey?: string
): Promise<{ success: boolean; resetUrl: string }> {
  const resetUrl = `${baseUrl}/reset-password?token=${resetToken}`;

  if (!resendApiKey) {
    // Development / test environment fallback
    console.log(`[EMAIL DEV MOCK] Password reset email for ${toEmail}: ${resetUrl}`);
    return { success: true, resetUrl };
  }

  try {
    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${resendApiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: 'Student Management System <no-reply@school.com>',
        to: [toEmail],
        subject: 'Reset Your Password - Student Management System',
        html: `<p>Hello,</p>
               <p>You requested a password reset. Click the link below to reset your password. This link will expire in 1 hour:</p>
               <p><a href="${resetUrl}">${resetUrl}</a></p>
               <p>If you did not request this, please ignore this email.</p>`,
      }),
    });

    return { success: res.ok, resetUrl };
  } catch (err) {
    console.error('Failed to send email via Resend:', err);
    return { success: false, resetUrl };
  }
}
