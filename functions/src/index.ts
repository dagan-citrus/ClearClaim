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

// Define the email request interface
interface SendEmailRequest {
  to: string;
  subject: string;
  htmlContent: string;
  textContent?: string;
  claimId: string;
  userId: string;
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
      const { to, subject, htmlContent, textContent, claimId } = req.body as SendEmailRequest;

      // Validate required fields
      if (!to || !subject || !htmlContent) {
        res.status(400).json({
          error: 'Missing required fields: to, subject, htmlContent',
        });
        return;
      }

      // Get SendGrid API key from environment
      const sendgridApiKey = process.env.SENDGRID_API_KEY;
      if (!sendgridApiKey) {
        console.error('SENDGRID_API_KEY environment variable not set');
        res.status(500).json({ error: 'Email service not configured' });
        return;
      }

      // Get sender email from environment
      const senderEmail = process.env.SENDGRID_SENDER_EMAIL || 'noreply@clearclaim.app';

      // Configure SendGrid
      sgMail.setApiKey(sendgridApiKey);

      // Prepare email message
      const msg = {
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

      // Send email
      await sgMail.send(msg);

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

  return {
    senderEmail: process.env.SENDGRID_SENDER_EMAIL || 'noreply@clearclaim.app',
  };
});
