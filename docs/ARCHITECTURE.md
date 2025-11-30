# Architecture Documentation

## Overview

AutoClaim Generator follows **Clean Architecture** principles, ensuring clear separation between business logic, infrastructure, and presentation layers.

## Core Principles

### 1. Separation of Concerns

The application is organized into three main layers:

#### Core Layer (`src/core/`)
- **Purpose**: Platform-agnostic business logic
- **Dependencies**: None (except utilities)
- **Contents**:
  - Domain entities and types
  - Business services
  - Repository interfaces
  - Validation logic

#### Infrastructure Layer (`src/infrastructure/`)
- **Purpose**: External integrations and implementations
- **Dependencies**: Core layer, external SDKs
- **Contents**:
  - Firebase/Firestore implementation
  - Gemini AI integration
  - Authentication service

#### Presentation Layer (`src/presentation/`)
- **Purpose**: User interface and user interactions
- **Dependencies**: Core layer, Infrastructure layer
- **Contents**:
  - React components
  - Pages and routing
  - Contexts and hooks

### 2. Dependency Rule

Dependencies flow inward:
```
Presentation → Infrastructure → Core
```

The Core layer has no dependencies on outer layers, making it:
- Testable in isolation
- Platform-independent
- Reusable across different UIs

## Data Flow

### Claim Submission Workflow

```
User Upload Receipt
     ↓
ClaimProcessorService.processReceipt()
     ↓
GeminiService.extractReceiptData()
     ↓
ClaimRepository.create()
     ↓
Check One-Click Eligibility
     ↓
[If Eligible] Auto-assign & Generate Email
     ↓
[If Not] Manual Review Required
     ↓
User Approves
     ↓
ClaimGeneratorService.submitClaim()
     ↓
ClaimRepository.update(status: SUBMITTED)
```

### Authentication Flow

```
User Signs In
     ↓
AuthService.signInWithGoogle()
     ↓
Firebase Auth
     ↓
UserRepository.upsertFromAuth()
     ↓
Firestore Users Collection
     ↓
AuthContext Updates
     ↓
UI Re-renders
```

## Service Architecture

### Service Container Pattern

The application uses a centralized service container (`src/core/container.ts`) for dependency injection:

```typescript
const container = new ServiceContainer();

// Repositories are singletons
const userRepo = container.userRepository;

// Services are lazily initialized
const authService = container.authService;
const claimProcessor = container.claimProcessorService;
```

### Repository Pattern

All data access goes through repository interfaces:

```typescript
abstract class BaseRepository<T> {
  abstract findById(id: UUID): Promise<T | null>;
  abstract create(entity: T): Promise<UUID>;
  abstract update(id: UUID, updates: Partial<T>): Promise<void>;
  abstract delete(id: UUID): Promise<void>;
}
```

Benefits:
- Abstraction over Firestore implementation
- Easy to mock for testing
- Consistent API across entities

## Database Schema (Firestore)

### Collections

#### `users`
```typescript
{
  appUserId: string (document ID)
  email: string
  displayName: string | null
  photoURL: string | null
  subscriptionTier: 'FREE' | 'PAID'
  createdAt: Timestamp
  updatedAt: Timestamp
}
```

#### `insured_persons`
```typescript
{
  personId: string (document ID)
  appUserId: string (foreign key)
  fullName: string
  dateOfBirth: string (YYYY-MM-DD)
  primaryId: string
  createdAt: Timestamp
  updatedAt: Timestamp
}
```

#### `insurers`
```typescript
{
  insurerId: string (document ID)
  insurerName: string
  claimsEmailTemplate: string
  createdAt: Timestamp
  updatedAt: Timestamp
}
```

#### `policies`
```typescript
{
  policyId: string (document ID)
  personId: string (foreign key)
  insurerId: string (foreign key)
  policyType: 'HEALTH' | 'DENTAL' | 'VISION' | 'OTHER'
  policyNumber: string
  isDefault: boolean
  createdAt: Timestamp
  updatedAt: Timestamp
}
```

#### `claims`
```typescript
{
  claimId: string (document ID)
  appUserId: string (foreign key)
  personId: string (foreign key)
  policyId: string (foreign key)
  extractedData: {
    retailerName: string
    serviceDescription: string
    receiptDate: string
    totalAmount: number
    currency: string
    invoiceNumber?: string
    receiptNumber?: string
    paymentMethod: PaymentMethod
    lineItems: LineItem[]
    extractionConfidence: number
  }
  emailDraft: string | null
  status: ClaimStatus
  isOneClickEligible: boolean
  submittedAt: Timestamp | null
  createdAt: Timestamp
  updatedAt: Timestamp
}
```

## Security Architecture

### Authentication
- Firebase Authentication with Google Sign-In and Email/Password
- Session management via Firebase Auth tokens
- Protected routes require authentication

### Authorization
- User-level isolation: Users can only access their own data
- Repository queries filtered by `appUserId`
- Firestore security rules enforce data isolation (to be configured)

### Data Validation
- Zod schemas for runtime validation
- TypeScript for compile-time type safety
- Input sanitization in services

## Scalability Considerations

### Current Architecture
- Firestore handles scaling automatically
- Stateless service layer (can be moved to serverless)
- Client-side processing reduces server load

### Future Optimizations
- **Caching**: Add Redis for frequently accessed data
- **CDN**: Serve static assets via CDN
- **Cloud Functions**: Move heavy processing to serverless
- **Batch Processing**: Queue claim submissions for batch processing

## Testing Strategy

### Unit Tests
- Service layer business logic
- Validation utilities
- Date/UUID helpers

### Integration Tests
- Repository CRUD operations
- Firebase Authentication flow
- Gemini API integration

### E2E Tests
- Complete claim submission workflow
- Authentication flows
- Subscription enforcement

## Performance Considerations

### Image Processing
- Client-side base64 encoding
- Size limits (10MB max)
- Lazy loading of claim images

### Database Queries
- Indexed fields: `appUserId`, `personId`, `createdAt`
- Pagination for large result sets
- Limited query depth (no N+1 queries)

### LLM Integration
- Timeout handling (30s default)
- Retry logic for transient failures
- Confidence thresholds for quality control

## Error Handling

### Error Hierarchy
```
AppError (base)
  ├── AuthenticationError (401)
  ├── AuthorizationError (403)
  ├── NotFoundError (404)
  ├── ValidationError (400)
  ├── SubscriptionLimitError (403)
  ├── LLMProcessingError (500)
  └── DatabaseError (500)
```

### Error Propagation
1. Service throws typed error
2. Repository/Infrastructure catches and wraps
3. Presentation layer displays user-friendly message
4. Critical errors logged to monitoring service

## Monitoring & Observability

### Logging (Future)
- Structured logging with context
- Error tracking (Sentry)
- Performance monitoring (Firebase Performance)

### Metrics (Future)
- Claim processing success rate
- OCR confidence distribution
- One-Click eligibility rate
- User engagement metrics

## Deployment Architecture

### Current (Client-Side)
- Vite build to static files
- Deployed to Firebase Hosting or Vercel
- Direct connection to Firebase/Firestore

### Future (Hybrid)
- Static UI on CDN
- Cloud Functions for sensitive operations
- API Gateway for rate limiting
- Pub/Sub for async processing
