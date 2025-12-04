# Firebase Cloud Functions - ClearClaim

Backend Cloud Functions for handling email sending and other server-side operations.

## Setup

### 1. Install Dependencies

```bash
cd functions
npm install
```

### 2. Configure Environment Variables

Create a `.env` file in the `functions` directory:

```bash
cp .env.example .env
```

Edit `.env` and add:
- `SENDGRID_API_KEY` - Your SendGrid API key
- `SENDGRID_SENDER_EMAIL` - Sender email address (must be verified in SendGrid)

### 3. Build TypeScript

```bash
npm run build
```

## Development

### Run Emulator Locally

```bash
npm run serve
```

This will start the Firebase Emulator Suite, allowing you to test Cloud Functions locally.

### View Logs

```bash
npm run logs
```

## Deployment

### Deploy to Firebase

```bash
npm run deploy
```

This will deploy the Cloud Functions to your Firebase project.

**Important:** Environment variables must be set in Firebase before deployment:

```bash
firebase functions:config:set sendgrid.api_key="your_api_key" sendgrid.sender_email="your_email@example.com"
```

Or use the Firebase Console to set environment variables.

## Functions

### `sendClaimEmail`

HTTP Cloud Function for sending claim emails via SendGrid.

**Endpoint:** `https://us-central1-clearclaim2025.cloudfunctions.net/sendClaimEmail`

**Request:**
```json
{
  "to": "insurer@example.com",
  "subject": "Insurance Claim Submission",
  "htmlContent": "<html>...</html>",
  "claimId": "claim-123",
  "textContent": "optional plain text"
}
```

**Headers:**
- `Authorization: Bearer <firebase_id_token>`
- `Content-Type: application/json`

**Response:**
```json
{
  "success": true,
  "message": "Email sent successfully",
  "claimId": "claim-123"
}
```

### `getEmailConfig`

Callable Cloud Function to retrieve email configuration.

## Security

- Email sending requires Firebase authentication
- ID tokens are verified server-side
- SendGrid API key is kept server-side (never exposed to frontend)
- Email logs are stored in Firestore for audit trail

## Troubleshooting

### "SENDGRID_API_KEY environment variable not set"

Set the environment variable in Firebase:

```bash
firebase functions:config:set sendgrid.api_key="your_key_here"
```

### Function not reachable

Make sure the Cloud Function URL matches your Firebase project:
- Current: `us-central1-clearclaim2025.cloudfunctions.net`
- Update if your project ID is different

### Test Email not Sending

1. Verify SendGrid account is active
2. Check that sender email is verified in SendGrid
3. Review Cloud Function logs: `npm run logs`
4. Check Firebase Console → Functions → Logs
