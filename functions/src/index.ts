/**
 * Firebase Cloud Functions for ClearClaim
 * Handles email sending and other backend operations
 */

import * as functions from 'firebase-functions';
import * as admin from 'firebase-admin';
import sgMail from '@sendgrid/mail';
import cors from 'cors';

// Initialize Firebase Admin
admin.initializeApp();

// Initialize CORS
const corsHandler = cors({ origin: true });

// Define the email attachment interface
interface EmailAttachment {
  content: string; // Base64 encoded content
  filename: string;
  type: string; // MIME type
  disposition: string;
}

// Define the email request interface
interface SendEmailRequest {
  to: string;
  subject: string;
  htmlContent: string;
  textContent?: string;
  claimId: string;
  userId: string;
  attachments?: EmailAttachment[];
}

/**
 * HTTP Cloud Function to send claim emails via SendGrid
 * Requires: SENDGRID_API_KEY environment variable
 */
export const sendClaimEmail = functions.https.onRequest((req, res) => {
  corsHandler(req, res, async () => {
    // Only allow POST requests
    if (req.method !== 'POST') {
      res.status(405).send('Method Not Allowed');
      return;
    }

    try {
      // Verify authentication
      const authHeader = req.headers.authorization;
      if (!authHeader?.startsWith('Bearer ')) {
        res.status(401).json({ error: 'Unauthorized' });
        return;
      }

      const token = authHeader.split('Bearer ')[1];
      const decodedToken = await admin.auth().verifyIdToken(token);
      const userId = decodedToken.uid;

      // Get request body
      const { to, subject, htmlContent, textContent, claimId, attachments } = req.body as SendEmailRequest;

      // Validate required fields
      if (!to || !subject || !htmlContent) {
        const missingFields = [];
        if (!to) missingFields.push('recipient email (to)');
        if (!subject) missingFields.push('subject');
        if (!htmlContent) missingFields.push('email content (htmlContent)');

        res.status(400).json({
          error: `Missing required fields: ${missingFields.join(', ')}`,
        });
        return;
      }

      // Get SendGrid API key from config
      const config = functions.config();
      const sendgridApiKey = config.sendgrid?.api_key || process.env.SENDGRID_API_KEY;
      if (!sendgridApiKey) {
        console.error('SENDGRID_API_KEY not configured');
        res.status(500).json({ error: 'Email service not configured' });
        return;
      }

      // Get sender email from config
      const senderEmail = config.sendgrid?.sender_email || process.env.SENDGRID_SENDER_EMAIL || 'noreply@clearclaim.app';

      // Configure SendGrid
      sgMail.setApiKey(sendgridApiKey);

      // Prepare email message
      const msg: any = {
        to,
        from: senderEmail,
        subject,
        html: htmlContent,
        text: textContent,
        headers: {
          'X-Claim-ID': claimId,
          'X-User-ID': userId,
        },
      };

      // Add attachments if provided
      if (attachments && attachments.length > 0) {
        msg.attachments = attachments;
      }

      // Send email
      try {
        await sgMail.send(msg);
      } catch (sendError) {
        console.error('SendGrid error:', sendError);
        const errorMessage = sendError instanceof Error ? sendError.message : 'Unknown error';

        // Check for common SendGrid errors
        if (errorMessage.includes('Invalid email')) {
          res.status(400).json({
            error: `Invalid recipient email address: ${to}. Please verify the insurer's email is correct.`,
          });
          return;
        }

        res.status(500).json({
          error: 'Failed to send email via SendGrid',
          details: errorMessage,
        });
        return;
      }

      // Log the email send (for audit trail)
      await admin.firestore().collection('email_logs').add({
        claimId,
        userId,
        recipientEmail: to,
        subject,
        sentAt: admin.firestore.FieldValue.serverTimestamp(),
        status: 'sent',
      });

      // Return success response
      res.status(200).json({
        success: true,
        message: 'Email sent successfully',
        claimId,
      });
    } catch (error) {
      console.error('Error sending email:', error);

      // Log the error
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      res.status(500).json({
        error: 'Failed to send email',
        details: errorMessage,
      });
    }
  });
});

/**
 * Callable Cloud Function to get email configuration
 * Returns sender email for frontend use
 */
export const getEmailConfig = functions.https.onCall(async (data, context) => {
  if (!context.auth) {
    throw new functions.https.HttpsError('unauthenticated', 'Must be authenticated');
  }

  const config = functions.config();
  return {
    senderEmail: config.sendgrid?.sender_email || process.env.SENDGRID_SENDER_EMAIL || 'noreply@clearclaim.app',
  };
});
