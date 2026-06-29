const nodemailer = require('nodemailer');

/**
 * Professional Email Service for SaaS Notifications
 */
class EmailService {
  constructor() {
    // In production, these should come from process.env
    this.transporter = nodemailer.createTransport({
      host: process.env.SMTP_HOST || 'smtp.ethereal.email',
      port: process.env.SMTP_PORT || 587,
      secure: process.env.SMTP_SECURE === 'true',
      auth: {
        user: process.env.SMTP_USER || 'demo_user',
        pass: process.env.SMTP_PASS || 'demo_pass',
      },
    });
  }

  /**
   * Send Onboarding Invitation Email
   */
  async sendOnboardingInvite(email, hotelName, token) {
    const onboardingUrl = `http://localhost:5173/onboarding/${token}`;

    const mailOptions = {
      from: '"AutoPilot Onboarding" <onboarding@autopilot.ai>',
      to: email,
      subject: `Welcome to AutoPilot — Onboarding for ${hotelName}`,
      html: `
        <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #eee; border-radius: 10px;">
          <h2 style="color: #6D4AFF;">Welcome to AutoPilot</h2>
          <p>Hello,</p>
          <p>Your onboarding request for <strong>${hotelName}</strong> has been approved! We are excited to help you automate your guest communications.</p>
          <p>To get started, please use the secure link below to submit your Property Management System (PMS) and communication channel credentials.</p>
          <div style="margin: 30px 0; text-align: center;">
            <a href="${onboardingUrl}" style="background-color: #6D4AFF; color: white; padding: 12px 25px; text-decoration: none; border-radius: 5px; font-weight: bold; font-size: 14px;">Complete Your Setup</a>
          </div>
          <p style="font-size: 12px; color: #666;">This link is secure and will expire in 7 days. If you did not request this, please ignore this email.</p>
          <hr style="border: 0; border-top: 1px solid #eee; margin: 20px 0;" />
          <p style="font-size: 10px; color: #999;">&copy; 2026 AutoPilot AI. All rights reserved.</p>
        </div>
      `,
    };

    try {
      // For development/demo purposes, we log the URL if SMTP isn't fully configured
      console.log(`[EMAIL DISPATCH] Invitation sent to ${email}. URL: ${onboardingUrl}`);

      // If we are using Ethereal (default/demo), we can get the test URL
      const info = await this.transporter.sendMail(mailOptions);
      if (this.transporter.options.host.includes('ethereal.email')) {
        console.log(`[ETHEREAL PREVIEW] ${nodemailer.getTestMessageUrl(info)}`);
      }
      return true;
    } catch (error) {
      console.error('Email Dispatch Error:', error);
      return false;
    }
  }

  /**
   * Send Activation Success Email
   */
  async sendActivationSuccess(email, hotelName, credentials) {
    const loginUrl = `http://localhost:5173/login`;

    const mailOptions = {
      from: '"AutoPilot System" <noreply@autopilot.ai>',
      to: email,
      subject: `Workspace Activated: ${hotelName}`,
      html: `
        <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #eee; border-radius: 10px;">
          <h2 style="color: #10B981;">Workspace Live</h2>
          <p>Congratulations!</p>
          <p>The AI Automation environment for <strong>${hotelName}</strong> is now live and operational.</p>
          <p>Your administrative credentials are provided below. Please login and change your password immediately.</p>
          <div style="background-color: #f9fafb; padding: 15px; border-radius: 8px; margin: 20px 0;">
            <p style="margin: 5px 0; font-size: 14px;"><strong>Dashboard URL:</strong> <a href="${loginUrl}">${loginUrl}</a></p>
            <p style="margin: 5px 0; font-size: 14px;"><strong>Admin User:</strong> ${email}</p>
            <p style="margin: 5px 0; font-size: 14px;"><strong>Temporary Password:</strong> <span style="color: #6D4AFF; font-family: monospace;">${credentials.password}</span></p>
          </div>
          <p>Our team is monitoring your integration sync nodes to ensure 100% stability.</p>
          <hr style="border: 0; border-top: 1px solid #eee; margin: 20px 0;" />
          <p style="font-size: 10px; color: #999;">&copy; 2026 AutoPilot AI. All rights reserved.</p>
        </div>
      `,
    };

    try {
      await this.transporter.sendMail(mailOptions);
      return true;
    } catch (error) {
      console.error('Activation Email Error:', error);
      return false;
    }
  }

  async sendGuestEmail(to, subject, htmlBody, references = null, inReplyTo = null, hotelId = null) {
    let activeTransporter = this.transporter;
    let fromEmail = process.env.HOTEL_EMAIL_FROM || '"Hotel Guest Services" <guestservices@autopilot.ai>';
    let isHotelSpecific = false;

    if (hotelId) {
      try {
        const prisma = require('../config/prisma');
        const hotel = await prisma.hotel.findUnique({ where: { id: Number(hotelId) } });
        if (hotel && hotel.smtpHost && hotel.smtpUser && hotel.smtpPass) {
          const { decrypt } = require('../utils/cryptoUtils');
          const decryptedPassword = decrypt(hotel.smtpPass);
          const portNum = Number(hotel.smtpPort) || 465;
          isHotelSpecific = true;
          
          activeTransporter = nodemailer.createTransport({
            pool: false, // Fresh direct connection per email to prevent zombie pooled socket timeouts
            host: hotel.smtpHost,
            port: portNum,
            secure: portNum === 465,
            family: 4, // Force IPv4
            connectionTimeout: 15000,
            greetingTimeout: 15000,
            socketTimeout: 30000,
            auth: {
              user: hotel.smtpUser,
              pass: decryptedPassword,
            },
            tls: {
              rejectUnauthorized: false
            }
          });

          fromEmail = `"${hotel.hotelName || 'Hotel Guest Services'}" <${hotel.smtpUser}>`;
          console.log(`[EMAIL DISPATCH] Dispatching via fresh SMTP connection for Hotel ${hotelId} (${hotel.smtpUser}:${portNum})`);
        } else {
          throw new Error("Incomplete SMTP credentials in database.");
        }
      } catch (err) {
        console.error(`[EMAIL DISPATCH] Failed to initialize hotel-specific SMTP transporter for Hotel ${hotelId}:`, err.message);
        throw new Error(`Cannot send guest email: ${err.message}`);
      }
    }

    const mailOptions = {
      from: fromEmail,
      to,
      subject,
      html: htmlBody
    };

    if (references) {
      mailOptions.headers = {
        'References': references,
        'In-Reply-To': inReplyTo || references
      };
    }

    try {
      const info = await activeTransporter.sendMail(mailOptions);
      console.log(`[EMAIL DISPATCH] Guest email sent successfully to ${to}. Subject: ${subject}`);
      if (isHotelSpecific && activeTransporter.close) {
        activeTransporter.close();
      }
      return info;
    } catch (error) {
      console.error('Guest Email Dispatch Error:', error.message);
      if (isHotelSpecific && activeTransporter.close) {
        activeTransporter.close();
      }
      throw error;
    }
  }
}

module.exports = new EmailService();
