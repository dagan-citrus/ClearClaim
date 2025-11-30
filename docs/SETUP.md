# Setup Guide

This guide will walk you through setting up the AutoClaim Generator application from scratch.

## Prerequisites

Before you begin, ensure you have the following installed:

- **Node.js** (v18 or higher)
- **npm** or **yarn**
- **Git**
- A **Firebase** account
- A **Google AI Studio** account for Gemini API

## Step-by-Step Setup

### 1. Clone the Repository

```bash
git clone https://github.com/yourusername/autoclaim-generator.git
cd autoclaim-generator
```

### 2. Install Dependencies

```bash
npm install
```

This will install all required dependencies including:
- React and React Router
- Firebase SDK
- Gemini AI SDK
- Tailwind CSS
- TypeScript
- Vite

### 3. Firebase Setup

#### Create a Firebase Project

1. Go to [Firebase Console](https://console.firebase.google.com/)
2. Click "Add project"
3. Enter project name: `autoclaim-generator` (or your choice)
4. Disable Google Analytics (optional)
5. Click "Create project"

#### Enable Authentication

1. In Firebase Console, go to **Authentication**
2. Click "Get started"
3. Enable **Google** sign-in provider:
   - Click "Google"
   - Toggle "Enable"
   - Add support email
   - Click "Save"
4. Enable **Email/Password** sign-in provider:
   - Click "Email/Password"
   - Toggle "Enable"
   - Click "Save"

#### Set Up Firestore Database

1. In Firebase Console, go to **Firestore Database**
2. Click "Create database"
3. Select "Start in **test mode**" (we'll add security rules later)
4. Choose a location close to your users
5. Click "Enable"

#### Get Firebase Configuration

1. In Firebase Console, go to **Project Settings** (gear icon)
2. Scroll down to "Your apps"
3. Click the web icon (`</>`) to add a web app
4. Register app with nickname: "AutoClaim Web"
5. Copy the Firebase configuration object

### 4. Gemini API Setup

1. Go to [Google AI Studio](https://makersuite.google.com/app/apikey)
2. Click "Create API Key"
3. Select a project or create new one
4. Copy the API key

### 5. Environment Configuration

1. Copy the example environment file:
   ```bash
   cp .env.example .env
   ```

2. Edit `.env` and add your credentials:

   ```env
   # Firebase Configuration
   VITE_FIREBASE_API_KEY=AIzaSy...
   VITE_FIREBASE_AUTH_DOMAIN=your-project.firebaseapp.com
   VITE_FIREBASE_PROJECT_ID=your-project-id
   VITE_FIREBASE_STORAGE_BUCKET=your-project.appspot.com
   VITE_FIREBASE_MESSAGING_SENDER_ID=123456789
   VITE_FIREBASE_APP_ID=1:123456789:web:abc123

   # Gemini API
   VITE_GEMINI_API_KEY=AIzaSy...

   # Application Settings (optional)
   VITE_APP_ENV=development
   VITE_ONE_CLICK_THRESHOLD=500
   VITE_OCR_CONFIDENCE_THRESHOLD=98
   ```

3. **Important**: Never commit `.env` to version control

### 6. Firestore Security Rules (Production)

For production, add these security rules in Firebase Console → Firestore → Rules:

```javascript
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {

    // Helper functions
    function isAuthenticated() {
      return request.auth != null;
    }

    function isOwner(userId) {
      return isAuthenticated() && request.auth.uid == userId;
    }

    // Users collection
    match /users/{userId} {
      allow read: if isOwner(userId);
      allow create: if isOwner(userId);
      allow update: if isOwner(userId);
    }

    // Insured persons
    match /insured_persons/{personId} {
      allow read: if isAuthenticated() &&
                     resource.data.appUserId == request.auth.uid;
      allow create: if isAuthenticated() &&
                       request.resource.data.appUserId == request.auth.uid;
      allow update, delete: if isAuthenticated() &&
                                resource.data.appUserId == request.auth.uid;
    }

    // Policies
    match /policies/{policyId} {
      allow read: if isAuthenticated();
      allow write: if isAuthenticated();
    }

    // Insurers (shared master data)
    match /insurers/{insurerId} {
      allow read: if isAuthenticated();
      allow create: if isAuthenticated();
    }

    // Claims
    match /claims/{claimId} {
      allow read: if isAuthenticated() &&
                     resource.data.appUserId == request.auth.uid;
      allow create: if isAuthenticated() &&
                       request.resource.data.appUserId == request.auth.uid;
      allow update, delete: if isAuthenticated() &&
                                resource.data.appUserId == request.auth.uid;
    }
  }
}
```

### 7. Start Development Server

```bash
npm run dev
```

The application will be available at `http://localhost:3000`

### 8. First-Time Application Setup

1. **Sign In**: Use Google Sign-In or create an account
2. You'll be on the FREE plan with:
   - 1 insured person limit
   - 3 claims per month limit

### 9. Verify Setup

Check that everything works:

1. ✅ Sign in successful
2. ✅ Dashboard loads
3. ✅ Can upload test receipt image
4. ✅ AI extracts data from receipt
5. ✅ Can view extracted claim

## Troubleshooting

### Firebase Connection Issues

**Error**: "Firebase: Error (auth/configuration-not-found)"
- **Solution**: Double-check your `.env` file has correct Firebase config
- Ensure all `VITE_FIREBASE_*` variables are set

### Gemini API Errors

**Error**: "Invalid API key"
- **Solution**: Verify your `VITE_GEMINI_API_KEY` in `.env`
- Ensure the API key has correct permissions in Google AI Studio

**Error**: "Quota exceeded"
- **Solution**: Check your Gemini API quota limits
- Consider upgrading to a paid tier for higher limits

### Build Errors

**Error**: "Cannot find module '@core/...'"
- **Solution**: The path aliases are not resolving
- Ensure `vite.config.ts` has correct alias configuration
- Try restarting the dev server

### Authentication Issues

**Error**: "auth/popup-blocked"
- **Solution**: Allow popups for localhost in your browser
- Try Email/Password sign-in instead

## Next Steps

After successful setup:

1. **Add Test Data**:
   - Add yourself as an insured person
   - Add your insurance company
   - Create a policy linking the two

2. **Test Claim Workflow**:
   - Upload a sample receipt
   - Review extracted data
   - Generate claim email
   - Submit claim

3. **Customize Configuration**:
   - Adjust One-Click threshold
   - Modify OCR confidence threshold
   - Update subscription limits in `src/config/index.ts`

## Production Deployment

### Build for Production

```bash
npm run build
```

This creates optimized files in the `dist/` directory.

### Deploy to Firebase Hosting

1. Install Firebase CLI:
   ```bash
   npm install -g firebase-tools
   ```

2. Login to Firebase:
   ```bash
   firebase login
   ```

3. Initialize hosting:
   ```bash
   firebase init hosting
   ```
   - Select your project
   - Set public directory to `dist`
   - Configure as single-page app: Yes
   - Don't overwrite `index.html`

4. Deploy:
   ```bash
   firebase deploy --only hosting
   ```

### Deploy to Vercel

1. Install Vercel CLI:
   ```bash
   npm install -g vercel
   ```

2. Deploy:
   ```bash
   vercel
   ```

3. Follow prompts to link project

4. Set environment variables in Vercel dashboard

## Support

If you encounter issues:
- Check the [Architecture Documentation](./ARCHITECTURE.md)
- Review the [PRD](../PRD.md)
- Open an issue on GitHub
