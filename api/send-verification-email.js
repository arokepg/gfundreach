/* eslint-env node */
/**
 * Vercel Serverless Function to send verification emails
 * 
 * Setup Instructions:
 * 1. Install required packages: npm install nodemailer
 * 2. Set environment variables in Vercel dashboard:
 *    - EMAIL_HOST (e.g., smtp.gmail.com)
 *    - EMAIL_PORT (e.g., 587)
 *    - EMAIL_USER (your email address)
 *    - EMAIL_PASSWORD (your app password)
 *    - EMAIL_FROM (sender email, e.g., "GFundReach <noreply@gfundreach.com>")
 * 
 * For Gmail:
 * - Use App Password (not your regular password)
 * - Enable 2FA and generate app password at: https://myaccount.google.com/apppasswords
 * 
 * Alternative: Use SendGrid, Mailgun, or AWS SES
 */

import nodemailer from 'nodemailer';
import process from 'node:process';

export default async function handler(req, res) {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
    return res.status(200).json({});
  }

  // Only allow POST
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { email, code, type, appName } = req.body;

    // Validate input
    if (!email || !code || !type) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return res.status(400).json({ error: 'Invalid email format' });
    }

    // Check environment variables
    if (!process.env.EMAIL_HOST || !process.env.EMAIL_USER || !process.env.EMAIL_PASSWORD) {
      console.error('Email configuration missing. Please set EMAIL_HOST, EMAIL_USER, and EMAIL_PASSWORD environment variables.');
      
      // In development, just log and return success
      if (process.env.NODE_ENV !== 'production') {
        console.log(`[DEV] Would send verification email to ${email} with code ${code}`);
        return res.status(200).json({ success: true, message: 'Development mode - check console' });
      }
      
      return res.status(500).json({ error: 'Email service not configured' });
    }

    // Create transporter
    const transporter = nodemailer.createTransport({
      host: process.env.EMAIL_HOST,
      port: parseInt(process.env.EMAIL_PORT || '587'),
      secure: process.env.EMAIL_PORT === '465', // true for 465, false for other ports
      auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASSWORD,
      },
    });

    // Email content
    const subject = type === 'register' 
      ? `Welcome to ${appName || 'GFundReach'}! Verify your email`
      : `Your ${appName || 'GFundReach'} verification code`;

    const htmlContent = `
<!DOCTYPE html>
<html>
<head>
  <style>
    body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
    .container { max-width: 600px; margin: 0 auto; padding: 20px; }
    .header { background: linear-gradient(135deg, #064e3b 0%, #065f46 50%, #047857 100%); color: white; padding: 30px; text-align: center; border-radius: 10px 10px 0 0; }
    .content { background: #ffffff; padding: 30px; border: 1px solid #e5e7eb; border-top: none; }
    .code-box { background: #f3f4f6; border: 2px solid #10b981; border-radius: 8px; padding: 20px; text-align: center; margin: 20px 0; }
    .code { font-size: 32px; font-weight: bold; letter-spacing: 8px; color: #065f46; }
    .footer { text-align: center; padding: 20px; color: #6b7280; font-size: 14px; }
    .warning { background: #fef3c7; border-left: 4px solid #f59e0b; padding: 12px; margin: 20px 0; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>${appName || 'GFundReach'}</h1>
      <p>${type === 'register' ? 'Welcome aboard!' : 'Verification Required'}</p>
    </div>
    <div class="content">
      <h2>Your Verification Code</h2>
      <p>Hello,</p>
      <p>${type === 'register' 
        ? 'Thank you for signing up! Please use the verification code below to complete your registration:' 
        : 'Please use the verification code below to continue:'}</p>
      
      <div class="code-box">
        <div class="code">${code}</div>
      </div>
      
      <p>This code will expire in <strong>10 minutes</strong>.</p>
      
      <div class="warning">
        <strong>⚠️ Security Notice:</strong> Never share this code with anyone. ${appName || 'GFundReach'} will never ask for your verification code.
      </div>
      
      <p>If you didn't request this code, please ignore this email or contact support if you're concerned about your account security.</p>
    </div>
    <div class="footer">
      <p>© ${new Date().getFullYear()} ${appName || 'GFundReach'}. All rights reserved.</p>
      <p>This is an automated message, please do not reply to this email.</p>
    </div>
  </div>
</body>
</html>
    `;

    const textContent = `
${appName || 'GFundReach'} - Verification Code

Your verification code is: ${code}

This code will expire in 10 minutes.

${type === 'register' 
  ? 'Thank you for signing up! Please enter this code to complete your registration.' 
  : 'Please enter this code to continue.'}

Security Notice: Never share this code with anyone. ${appName || 'GFundReach'} will never ask for your verification code.

If you didn't request this code, please ignore this email.

---
© ${new Date().getFullYear()} ${appName || 'GFundReach'}
This is an automated message, please do not reply.
    `;

    // Send email
    await transporter.sendMail({
      from: process.env.EMAIL_FROM || process.env.EMAIL_USER,
      to: email,
      subject,
      text: textContent,
      html: htmlContent,
    });

    console.log(`✅ Verification email sent to ${email}`);
    return res.status(200).json({ success: true, message: 'Email sent successfully' });

  } catch (error) {
    console.error('Email sending error:', error);
    return res.status(500).json({ 
      error: 'Failed to send email',
      details: process.env.NODE_ENV !== 'production' ? error.message : undefined
    });
  }
}
