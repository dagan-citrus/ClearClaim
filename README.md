# AutoClaim Generator

> AI-powered insurance claim automation platform built with React, TypeScript, Firebase, and Gemini AI

[![Version](https://img.shields.io/badge/version-1.3.0-blue.svg)](https://github.com/yourusername/autoclaim-generator)
[![License](https://img.shields.io/badge/license-MIT-green.svg)](LICENSE)

## Overview

AutoClaim Generator automates the submission of personal insurance claims by leveraging AI-powered data extraction from receipts and invoices. The application extracts relevant information, generates professional claim emails, and streamlines the entire submission process.

### Key Features

- **AI-Powered OCR**: Automatic data extraction from receipt images using Gemini 2.0 Flash
- **One-Click Claims**: Eligible claims can be submitted with a single click (configurable thresholds)
- **Multi-Policy Support**: Manage multiple insured persons and insurance policies
- **Subscription Tiers**: Free and Paid plans with usage limits
- **Clean Architecture**: Strict separation of concerns (Core, Infrastructure, Presentation)
- **Type-Safe**: Full TypeScript implementation with comprehensive type definitions
- **Real-time Database**: Firebase Firestore for scalable data storage
- **Modern UI**: React with Tailwind CSS for responsive design

## Architecture

The application follows **Clean Architecture** principles with clear separation between layers:

```
src/
├── core/                    # Business logic (platform-agnostic)
│   ├── types/              # Type definitions, DTOs, entities
│   ├── repositories/       # Data access interfaces
│   ├── services/           # Business services
│   └── utils/              # Utility functions
├── infrastructure/         # External integrations
│   ├── auth/              # Firebase Authentication
│   ├── database/          # Firestore implementation
│   └── llm/               # Gemini AI integration
├── presentation/          # UI layer (React)
│   ├── components/        # Reusable UI components
│   ├── pages/             # Page components
│   └── contexts/          # React contexts
└── config/               # Configuration management
```

### Data Model

**AppUser** → owns multiple **InsuredPerson**s
**InsuredPerson** → has multiple **UserPolicy**s
**UserPolicy** → links to **Insurer** (shared master data)
**Claim** → references one **InsuredPerson** and one **UserPolicy**

See [PRD.md](./PRD.md) for detailed requirements.

## Getting Started

### Prerequisites

- Node.js 18+ and npm/yarn
- Firebase project with Firestore enabled
- Gemini API key (Google AI Studio)

### Installation

1. **Clone the repository**
   ```bash
   git clone https://github.com/yourusername/autoclaim-generator.git
   cd autoclaim-generator
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Configure environment variables**

   Copy `.env.example` to `.env` and fill in your credentials:
   ```bash
   cp .env.example .env
   ```

   Required environment variables:
   ```env
   # Firebase Configuration
   VITE_FIREBASE_API_KEY=your_api_key
   VITE_FIREBASE_AUTH_DOMAIN=your_project.firebaseapp.com
   VITE_FIREBASE_PROJECT_ID=your_project_id
   VITE_FIREBASE_STORAGE_BUCKET=your_project.appspot.com
   VITE_FIREBASE_MESSAGING_SENDER_ID=your_sender_id
   VITE_FIREBASE_APP_ID=your_app_id

   # Gemini API
   VITE_GEMINI_API_KEY=your_gemini_api_key

   # Optional Configuration
   VITE_ONE_CLICK_THRESHOLD=500
   VITE_OCR_CONFIDENCE_THRESHOLD=98
   ```

4. **Set up Firebase**

   - Create a new Firebase project at [console.firebase.google.com](https://console.firebase.google.com)
   - Enable Authentication (Google Sign-In and Email/Password)
   - Enable Firestore Database
   - Copy your Firebase config to `.env`

5. **Get Gemini API Key**

   - Visit [Google AI Studio](https://makersuite.google.com/app/apikey)
   - Create a new API key
   - Add it to `.env` as `VITE_GEMINI_API_KEY`

### Development

```bash
# Start development server
npm run dev

# Run type checking
npm run type-check

# Run linter
npm run lint

# Run tests
npm run test

# Run tests with UI
npm run test:ui
```

The application will be available at `http://localhost:3000`

### Building for Production

```bash
# Build the application
npm run build

# Preview production build
npm run preview
```

## Usage

### First-Time Setup

1. **Sign in** using Google or create an account with email/password
2. **Add an Insured Person** (yourself or a family member)
3. **Add an Insurer** (your insurance company)
4. **Add a Policy** linking the person to the insurer

### Submitting a Claim

1. **Upload a receipt** by clicking the upload area
2. **AI Processing**: The system extracts data automatically
3. **One-Click Eligible?**
   - If confidence > 98% and amount < $500: Approve with one click
   - Otherwise: Review and edit the extracted data
4. **Generate Email**: System creates a professional claim email
5. **Review & Submit**: Review the email and submit to insurer

### Subscription Tiers

#### Free Plan
- 1 insured person
- 3 claims per month
- Basic claim history

#### Paid Plan
- Unlimited insured persons
- Unlimited claims
- Advanced features (coming in V2.0)

## Core Services

### SubscriptionService
Manages subscription tiers and enforces usage limits.

```typescript
// Check subscription status
const status = await subscriptionService.checkSubscription(userId);

// Enforce limits
await subscriptionService.enforceClaimSubmissionLimit(userId);
```

### ClaimProcessorService
Handles receipt processing and claim matching.

```typescript
// Process a receipt
const { claimId, extractedData } = await claimProcessor.processReceipt(userId, {
  imageData: base64Image,
  imageType: 'image/jpeg'
});
```

### ClaimGeneratorService
Generates professional claim emails.

```typescript
// Generate email draft
const emailDraft = await claimGenerator.generateEmailDraft(claimId);

// Submit claim
await claimGenerator.submitClaim({ claimId }, userId);
```

### OneClickClaimService
Orchestrates the One-Click workflow.

```typescript
// Process One-Click claim
const result = await oneClickService.processOneClickClaim(userId, dto);

if (result.isEligible) {
  // User can approve with one click
  await oneClickService.completeOneClickSubmission(claimId, userId);
}
```

## Project Structure

### Type Definitions (`src/core/types/`)
- **common.ts**: Shared types (UUID, enums, Result)
- **entities.ts**: Domain entities (AppUser, Claim, Policy, etc.)
- **dtos.ts**: Data Transfer Objects for API communication
- **errors.ts**: Custom error classes

### Repositories (`src/core/repositories/`)
- **BaseRepository**: Generic CRUD operations
- **UserRepository**: User management
- **InsuredPersonRepository**: Insured person CRUD
- **InsurerRepository**: Insurance company master data
- **PolicyRepository**: Policy management
- **ClaimRepository**: Claim storage and retrieval

### Services (`src/core/services/`)
- **SubscriptionService**: Subscription and limits
- **ClaimProcessorService**: Claim processing logic
- **ClaimGeneratorService**: Email generation
- **OneClickClaimService**: One-Click workflow

### Infrastructure (`src/infrastructure/`)
- **Firebase**: Database and authentication
- **Gemini**: LLM integration for OCR

## Testing

The project uses Vitest for testing. Run tests with:

```bash
npm run test
```

Key testing areas:
- Repository layer (CRUD operations)
- Service layer (business logic)
- Validation utilities
- Date/UUID utilities

## Code Quality

### Standards
- **TypeScript**: Strict mode enabled
- **ESLint**: Configured for React and TypeScript
- **Clean Code**: Single Responsibility Principle
- **Separation of Concerns**: Layered architecture
- **Type Safety**: Comprehensive type definitions

### Design Patterns
- **Repository Pattern**: Data access abstraction
- **Service Pattern**: Business logic encapsulation
- **Dependency Injection**: Service container
- **Context API**: React state management

## Future Roadmap (V2.0)

- [ ] Policy document upload and parsing
- [ ] Coverage verification before submission
- [ ] Advanced claim filtering and reporting
- [ ] Mobile app (React Native)
- [ ] Multi-language support
- [ ] OCR improvements for handwritten receipts

## Contributing

Contributions are welcome! Please follow these guidelines:

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## Support

For issues and questions:
- Open an issue on GitHub
- Check the [documentation](./docs/)
- Review the [PRD](./PRD.md)

## Acknowledgments

- **Firebase**: Backend infrastructure
- **Google Gemini**: AI-powered OCR
- **React**: UI framework
- **Tailwind CSS**: Styling
- **TypeScript**: Type safety

---

**Built with ❤️ for simplifying insurance claims**
