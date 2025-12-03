# Product Requirements Document (PRD)

## AutoClaim Generator

| Attribute | Detail |
|-----------|--------|
| **Product Name** | AutoClaim Generator |
| **Version** | 1.3.0 |
| **Date** | December 3, 2025 |
| **Status** | Implemented |
| **Product Manager** | - |
| **Engineering Lead** | - |

---

## Executive Summary

AutoClaim Generator is an AI-powered web application that automates the submission of personal insurance claims by leveraging advanced OCR technology and structured data extraction. The platform reduces manual data entry, minimizes errors, and streamlines the entire claim submission workflow for individuals and families managing multiple insurance policies.

---

## Product Vision

**To eliminate the frustration and time waste associated with manual insurance claim submissions by providing an intelligent, automated solution that handles data extraction, claim generation, and submission with minimal user intervention.**

---

## Target Audience

### Primary Users
- **Individuals** managing their own health, dental, or vision insurance claims
- **Families** coordinating insurance claims across multiple family members
- **Frequent claimants** who submit insurance claims regularly (e.g., ongoing medical treatment)

### User Personas

#### Persona 1: Busy Professional
- **Age**: 30-50
- **Pain Points**: No time to manually fill out claim forms, loses receipts, forgets to submit claims
- **Goals**: Quick, automated claim submission; reliable record-keeping
- **Tech Savviness**: Medium to High

#### Persona 2: Family Manager
- **Age**: 35-55
- **Pain Points**: Managing claims for multiple family members, juggling different insurance policies
- **Goals**: Centralized claim management; clear tracking of who claimed what
- **Tech Savviness**: Medium

#### Persona 3: Retiree with Regular Medical Visits
- **Age**: 60+
- **Pain Points**: Frequent doctor visits generate many receipts; manual form-filling is tedious
- **Goals**: Simple, repeatable process for similar claims
- **Tech Savviness**: Low to Medium

---

## Product Goals & Success Metrics

### Business Goals
1. **Reduce claim submission time** by 80% compared to manual entry
2. **Achieve 95%+ OCR accuracy** on standard receipts and invoices
3. **Scale to 10,000+ active users** within first year
4. **Convert 15% of free users** to paid subscriptions

### Success Metrics (KPIs)

| Metric | Target | Measurement Method |
|--------|--------|-------------------|
| OCR Accuracy | >95% | Average extraction confidence score |
| Time to Submit | <2 minutes | Average from upload to submission |
| User Retention (Monthly) | >60% | Monthly Active Users / Total Users |
| One-Click Eligibility Rate | >40% | Eligible claims / Total claims |
| Conversion Rate (Free→Paid) | >15% | Paid subscriptions / Free users |
| Claim Success Rate | >98% | Successfully submitted / Total attempts |

### User Experience Goals
- **Simplicity**: Single-page upload for basic workflow
- **Speed**: One-Click submission for eligible claims (<5 seconds)
- **Accuracy**: AI-extracted data requires minimal corrections
- **Transparency**: Clear visibility into processing status and results

---

## Core Features & Requirements

## 1. Data Model & User Management

### 1.1 User Authentication (Auth-1.x)

| ID | Requirement | Priority | Status |
|----|-------------|----------|--------|
| Auth-1.1 | Implement Google Sign-In as primary authentication method | **MUST** | ✅ Implemented |
| Auth-1.2 | Support Email/Password authentication as alternative | SHOULD | ✅ Implemented |
| Auth-1.3 | Link all data operations to authenticated `appUserId` | **MUST** | ✅ Implemented |
| Auth-1.4 | Implement session persistence across browser refreshes | **MUST** | ✅ Implemented |

**Acceptance Criteria:**
- Users can sign in with Google with single click
- Email/password users can create accounts with valid email and 6+ character password
- All database records include `appUserId` foreign key
- User sessions persist after page refresh

### 1.2 Data Entities

#### 1.2.1 AppUser Entity

```typescript
interface AppUser {
  appUserId: UUID;              // Primary key
  email: string;                // Unique, required
  displayName: string | null;   // Optional display name
  photoURL: string | null;      // Profile photo URL
  subscriptionTier: SubscriptionTier; // FREE or PAID
  createdAt: Timestamp;         // Account creation time
  updatedAt: Timestamp;         // Last modification time
}
```

**Business Rules:**
- Email must be unique across the system
- New users default to FREE tier
- Subscription tier can only be changed through subscription service

#### 1.2.2 InsuredPerson Entity (PRD Section 2.1)

```typescript
interface InsuredPerson {
  personId: UUID;               // Primary key
  appUserId: UUID;              // Foreign key to AppUser
  fullName: string;             // Full legal name
  dateOfBirth: ISODateString;   // YYYY-MM-DD format
  primaryId: string;            // National ID or Passport
  createdAt: Timestamp;
  updatedAt: Timestamp;
}
```

**Business Rules:**
- Each person belongs to exactly one app user
- Primary ID must be unique within a user's persons
- Date of birth must be in the past
- Full name must match legal documents

#### 1.2.3 Insurer Master Table (PRD Section 2.2)

```typescript
interface Insurer {
  insurerId: UUID;              // Primary key
  insurerName: string;          // Company name (e.g., "Blue Cross")
  claimsEmailTemplate: string;  // Official claims email
  createdAt: Timestamp;
  updatedAt: Timestamp;
}
```

**Business Rules:**
- Insurers are shared across all users (master data)
- Any authenticated user can create new insurers
- Claims email must be valid email format
- Insurer names should be unique (soft constraint)

**Rationale:** Separating insurer data prevents duplication and ensures consistency when multiple users use the same insurance company.

#### 1.2.4 UserPolicy Entity (PRD Section 2.3)

```typescript
interface UserPolicy {
  policyId: UUID;               // Primary key
  personId: UUID;               // Foreign key to InsuredPerson
  insurerId: UUID;              // Foreign key to Insurer
  policyType: PolicyType;       // HEALTH, DENTAL, VISION, OTHER
  policyNumber: string;         // User's policy/group number
  isDefault: boolean;           // Default for One-Click
  createdAt: Timestamp;
  updatedAt: Timestamp;
}
```

**Business Rules:**
- Each policy links one person to one insurer
- A person can have multiple policies with same or different insurers
- Only one policy per person can be marked as default
- Policy number is required and user-specific

#### 1.2.5 Claim Entity

```typescript
interface Claim {
  claimId: UUID;                // Primary key
  appUserId: UUID;              // Foreign key to AppUser
  personId: UUID;               // Foreign key to InsuredPerson
  policyId: UUID;               // Foreign key to UserPolicy
  extractedData: ExtractedReceiptData; // AI-extracted data
  emailDraft: string | null;    // Generated claim email
  status: ClaimStatus;          // DRAFT, READY_FOR_REVIEW, APPROVED, SUBMITTED
  isOneClickEligible: boolean;  // Eligible for One-Click?
  submittedAt: Timestamp | null; // Actual submission time
  createdAt: Timestamp;
  updatedAt: Timestamp;
}
```

**Business Rules:**
- Claims must be linked to user, person, and policy
- Status transitions: DRAFT → READY_FOR_REVIEW → APPROVED → SUBMITTED
- Once SUBMITTED, claims are read-only
- One-Click eligibility is determined automatically

---

## 2. Receipt Processing & Data Extraction (FR-1.x)

### 2.1 Image Upload

| ID | Requirement | Priority | Status |
|----|-------------|----------|--------|
| FR-1.1 | Accept image uploads in JPEG, PNG, WebP formats | **MUST** | ✅ Implemented |
| FR-1.2 | Limit file size to 10MB maximum | **MUST** | ✅ Implemented |
| FR-1.3 | Provide drag-and-drop upload interface | SHOULD | ⏳ Pending |
| FR-1.4 | Display upload progress indicator during processing | **MUST** | ✅ Implemented |

### 2.2 AI-Powered OCR (Gemini Integration)

| ID | Requirement | Priority | Status |
|----|-------------|----------|--------|
| FR-1.5 | Use **Gemini 2.0 Flash** model for all OCR operations | **MUST** | ✅ Implemented |
| FR-1.6 | Extract retailer/provider name with >90% accuracy | **MUST** | ✅ Implemented |
| FR-1.7 | Extract service description and date | **MUST** | ✅ Implemented |
| FR-1.8 | Extract total amount and currency | **MUST** | ✅ Implemented |
| FR-1.9 | Extract invoice/receipt numbers when present | SHOULD | ✅ Implemented |
| FR-1.10 | Extract payment method information | SHOULD | ✅ Implemented |
| FR-1.11 | Extract line items with individual amounts | **MUST** | ✅ Implemented |
| FR-1.12 | Return confidence score (0-100) for extraction quality | **MUST** | ✅ Implemented |

**Technical Specification:**
```typescript
interface ExtractedReceiptData {
  retailerName: string;          // Business name
  serviceDescription: string;    // What was purchased
  receiptDate: ISODateString;    // Transaction date
  totalAmount: number;           // Total cost
  currency: string;              // USD, EUR, etc.
  invoiceNumber?: string;        // Optional invoice #
  receiptNumber?: string;        // Optional receipt #
  paymentMethod: PaymentMethod;  // How it was paid
  lineItems: ReceiptLineItem[];  // Individual items
  extractionConfidence: number;  // 0-100 percentage
  rawText?: string;              // Original OCR text
}
```

**Acceptance Criteria:**
- Confidence score accurately reflects extraction quality
- Line items are properly separated and totaled
- Dates are normalized to YYYY-MM-DD format
- Currency symbols are converted to ISO codes

### 2.3 Multi-Person Line Item Allocation

| ID | Requirement | Priority | Status |
|----|-------------|----------|--------|
| FR-1.13 | Allow users to allocate line items to different insured persons | SHOULD | ✅ Implemented |
| FR-1.14 | Support splitting single line item amounts across multiple persons | COULD | ✅ Implemented |
| FR-1.15 | Default all items to the selected primary person | SHOULD | ✅ Implemented |

**Use Case:** Family dental visit where different procedures were performed for different family members on a single invoice.

---

## 3. Claim Matching & Personalization (FR-2.x)

### 3.1 Automatic Person Selection

| ID | Requirement | Priority | Status |
|----|-------------|----------|--------|
| FR-2.1 | Automatically select person if user has only one insured person | **MUST** | ✅ Implemented |
| FR-2.2 | Prompt user to select person if multiple exist | **MUST** | ✅ Implemented |
| FR-2.3 | Remember user's last selection for future claims (per policy type) | COULD | ⏳ Pending |

### 3.2 Automatic Policy Selection

| ID | Requirement | Priority | Status |
|----|-------------|----------|--------|
| FR-2.4 | Auto-select default policy for chosen person | **MUST** | ✅ Implemented |
| FR-2.5 | Allow user to override policy selection | **MUST** | ✅ Implemented |
| FR-2.6 | Display policy details (type, number) during selection | SHOULD | ⏳ Pending |
| FR-2.7 | Filter policies by person to show only relevant options | **MUST** | ✅ Implemented |

### 3.3 Smart Matching (Future Enhancement)

| ID | Requirement | Priority | Status |
|----|-------------|----------|--------|
| FR-2.8 | Suggest policy based on service description (e.g., "dental" → DENTAL policy) | COULD | ⏳ V2.0 |
| FR-2.9 | Learn from user's past selections to improve suggestions | COULD | ⏳ V2.0 |

---

## 4. Claim Generation & Email Drafting (FR-3.x)

### 4.1 Email Generation

| ID | Requirement | Priority | Status |
|----|-------------|----------|--------|
| FR-3.1 | Use Gemini LLM to generate professional claim email body | **MUST** | ✅ Implemented |
| FR-3.2 | Include all extracted receipt data in structured format | **MUST** | ✅ Implemented |
| FR-3.3 | Include insured person name and policy number | **MUST** | ✅ Implemented |
| FR-3.4 | Auto-generate subject line with policy number and service description | SHOULD | ✅ Implemented |
| FR-3.5 | Mention attachment of original receipt (even if not yet implemented) | SHOULD | ✅ Implemented |

**Email Template Structure:**
```
Subject: Insurance Claim Submission - Policy [NUMBER] - [SERVICE] ([DATE])

Body:
- Greeting
- Purpose statement (claim submission)
- Insured person details
- Service details from receipt
- Line-itemized breakdown
- Total amount
- Payment information
- Request for confirmation
- Professional closing
```

### 4.2 User Review & Editing

| ID | Requirement | Priority | Status |
|----|-------------|----------|--------|
| FR-3.6 | Display full email draft to user before submission | **MUST** | ✅ Implemented |
| FR-3.7 | Allow users to edit email content before submission | **MUST** | ⏳ Pending |
| FR-3.8 | Preserve user edits if they navigate away and return | SHOULD | ⏳ Pending |
| FR-3.9 | Show recipient email address (from insurer master) | **MUST** | ✅ Implemented |

**Acceptance Criteria:**
- Email draft is readable and professionally formatted
- All extracted data is accurately represented
- User can make edits without breaking formatting
- Original vs. edited versions are tracked

---

## 5. One-Click Claim Workflow (FR-3.4.x)

### 5.1 Eligibility Criteria

| ID | Requirement | Priority | Status |
|----|-------------|----------|--------|
| FR-3.4.1 | Check OCR confidence ≥ configured threshold (default: 98%) | **MUST** | ✅ Implemented |
| FR-3.4.2 | Check claim amount < configured threshold (default: $500) | **MUST** | ✅ Implemented |
| FR-3.4.3 | Verify single insured person exists for auto-selection | **MUST** | ✅ Implemented |
| FR-3.4.4 | Verify default policy exists for the person | **MUST** | ✅ Implemented |
| FR-3.4.5 | All four conditions must be met for One-Click eligibility | **MUST** | ✅ Implemented |

**Configuration:**
```env
VITE_OCR_CONFIDENCE_THRESHOLD=98
VITE_ONE_CLICK_THRESHOLD=500
```

### 5.2 One-Click User Experience

| ID | Requirement | Priority | Status |
|----|-------------|----------|--------|
| FR-3.4.6 | Display prominent "Approve & Send (1-Click)" button for eligible claims | **MUST** | ✅ Implemented |
| FR-3.4.7 | Show clear summary of claim details before One-Click submission | **MUST** | ✅ Implemented |
| FR-3.4.8 | Bypass manual editing screen for One-Click claims | **MUST** | ✅ Implemented |
| FR-3.4.9 | Provide instant feedback upon One-Click submission | SHOULD | ⏳ Pending |
| FR-3.4.10 | Allow users to opt-out of One-Click and review manually | SHOULD | ⏳ Pending |

**Success Criteria:**
- One-Click claims are submitted in <5 seconds from upload
- Users understand why claims are/aren't One-Click eligible
- Clear visual distinction between One-Click and manual review

---

## 6. Subscription Management (Sub-1.x)

### 6.1 Subscription Tiers

#### FREE Plan

| Feature | Limit |
|---------|-------|
| **Insured Persons** | 1 |
| **Claims per Month** | 3 |
| **Claim History** | View only (no advanced filtering) |
| **Policy Storage** | Unlimited policies per person |
| **One-Click Claims** | ✅ Available |
| **Email Generation** | ✅ Available |

#### PAID Plan

| Feature | Limit |
|---------|-------|
| **Insured Persons** | ♾️ Unlimited |
| **Claims per Month** | ♾️ Unlimited |
| **Claim History** | ✅ Full history with filtering |
| **Advanced Features** | ✅ V2.0 features included |
| **Priority Support** | ✅ Available |
| **Price** | $5-10/month (configurable) |

### 6.2 Subscription Enforcement

| ID | Requirement | Priority | Status |
|----|-------------|----------|--------|
| Sub-1.1 | Check subscription tier before allowing new insured person creation | **MUST** | ✅ Implemented |
| Sub-1.2 | Check subscription tier before allowing new claim submission | **MUST** | ✅ Implemented |
| Sub-1.3 | Count claims by billing period (monthly reset) | **MUST** | ✅ Implemented |
| Sub-1.4 | Display clear upgrade prompt when limits are reached | **MUST** | ✅ Implemented |
| Sub-1.5 | Show current usage vs. limits in dashboard | SHOULD | ⏳ Pending |
| Sub-1.6 | Prevent operations that exceed limits with descriptive errors | **MUST** | ✅ Implemented |

**Business Rules:**
- Billing period = calendar month (1st to last day)
- Existing claims and persons are not deleted when downgrading
- Users can view all historical data regardless of tier
- Claim submission limit applies to new claims only

### 6.3 Upgrade Flow

| ID | Requirement | Priority | Status |
|----|-------------|----------|--------|
| Sub-1.7 | Provide "Upgrade to Paid" button in navigation | SHOULD | ⏳ Pending |
| Sub-1.8 | Show upgrade modal when hitting limits | **MUST** | ⏳ Pending |
| Sub-1.9 | List benefits of upgrading in upgrade prompt | SHOULD | ⏳ Pending |
| Sub-1.10 | Integrate payment processing (Stripe) | **MUST** | ⏳ V1.4 |

---

## 7. User Interface Requirements

### 7.1 Login Page

| ID | Requirement | Priority | Status |
|----|-------------|----------|--------|
| UI-1.1 | Display prominent "Sign in with Google" button | **MUST** | ✅ Implemented |
| UI-1.2 | Provide email/password sign-in option | SHOULD | ✅ Implemented |
| UI-1.3 | Support new account creation with email | SHOULD | ✅ Implemented |
| UI-1.4 | Display clear error messages for auth failures | **MUST** | ✅ Implemented |
| UI-1.5 | Show loading state during authentication | **MUST** | ✅ Implemented |

### 7.2 Dashboard

| ID | Requirement | Priority | Status |
|----|-------------|----------|--------|
| UI-2.1 | Display user name and subscription tier in header | **MUST** | ✅ Implemented |
| UI-2.2 | Show prominent receipt upload area | **MUST** | ✅ Implemented |
| UI-2.3 | List recent claims with status indicators | **MUST** | ✅ Implemented |
| UI-2.4 | Show One-Click button for eligible claims | **MUST** | ✅ Implemented |
| UI-2.5 | Display claim amount, date, and status for each claim | SHOULD | ✅ Implemented |
| UI-2.6 | Provide navigation to full claim history | SHOULD | ⏳ Pending |
| UI-2.7 | Show usage stats (claims this month, persons added) | SHOULD | ⏳ Pending |

### 7.3 Claim Details View

| ID | Requirement | Priority | Status |
|----|-------------|----------|--------|
| UI-3.1 | Display all extracted receipt data in structured format | **MUST** | ⏳ Pending |
| UI-3.2 | Show confidence score with visual indicator | SHOULD | ⏳ Pending |
| UI-3.3 | Allow editing of extracted data fields | **MUST** | ⏳ Pending |
| UI-3.4 | Show person and policy selection dropdowns | **MUST** | ⏳ Pending |
| UI-3.5 | Display generated email draft in preview | **MUST** | ⏳ Pending |
| UI-3.6 | Provide "Generate Email" and "Submit Claim" buttons | **MUST** | ⏳ Pending |

### 7.4 Settings/Profile

| ID | Requirement | Priority | Status |
|----|-------------|----------|--------|
| UI-4.1 | Manage insured persons (add, edit, delete) | **MUST** | ⏳ Pending |
| UI-4.2 | Manage insurers (add, search existing) | **MUST** | ⏳ Pending |
| UI-4.3 | Manage policies (add, edit, set default) | **MUST** | ⏳ Pending |
| UI-4.4 | Display subscription details and upgrade option | SHOULD | ⏳ Pending |
| UI-4.5 | Allow user to update profile information | SHOULD | ⏳ Pending |

### 7.5 Responsive Design

| ID | Requirement | Priority | Status |
|----|-------------|----------|--------|
| UI-5.1 | Fully responsive on mobile (320px+) | **MUST** | ✅ Implemented |
| UI-5.2 | Optimized for tablet (768px+) | SHOULD | ✅ Implemented |
| UI-5.3 | Full desktop experience (1024px+) | **MUST** | ✅ Implemented |
| UI-5.4 | Touch-friendly buttons and inputs on mobile | SHOULD | ✅ Implemented |

---

## 8. Technical Requirements

### 8.1 Architecture

| ID | Requirement | Priority | Status |
|----|-------------|----------|--------|
| TECH-1.1 | Implement Clean Architecture with layer separation | **MUST** | ✅ Implemented |
| TECH-1.2 | Core business logic must be platform-agnostic | **MUST** | ✅ Implemented |
| TECH-1.3 | Use Repository Pattern for data access | **MUST** | ✅ Implemented |
| TECH-1.4 | Implement Dependency Injection via service container | SHOULD | ✅ Implemented |
| TECH-1.5 | Strict TypeScript with no implicit any | **MUST** | ✅ Implemented |

**Architecture Layers:**
```
Presentation (React, UI components)
      ↓
Infrastructure (Firebase, Gemini, external APIs)
      ↓
Core (Business logic, repositories, services)
```

### 8.2 Technology Stack

| Component | Technology | Version | Status |
|-----------|-----------|---------|--------|
| **Frontend Framework** | React | 18.3+ | ✅ |
| **Language** | TypeScript | 5.5+ | ✅ |
| **Build Tool** | Vite | 5.3+ | ✅ |
| **Styling** | Tailwind CSS | 3.4+ | ✅ |
| **Routing** | React Router | 6.26+ | ✅ |
| **Database** | Firebase Firestore | 10.13+ | ✅ |
| **Authentication** | Firebase Auth | 10.13+ | ✅ |
| **AI/LLM** | Google Gemini | 2.0 Flash | ✅ |
| **Validation** | Zod | 3.23+ | ✅ |
| **Date Utilities** | date-fns | 3.0+ | ✅ |
| **Icons** | Lucide React | 0.441+ | ✅ |
| **Testing** | Vitest | 2.0+ | ✅ |

### 8.3 Code Quality

| ID | Requirement | Priority | Status |
|----|-------------|----------|--------|
| TECH-2.1 | Maintain >80% code coverage with unit tests | SHOULD | ⏳ Pending |
| TECH-2.2 | Use ESLint with strict rules (no warnings) | **MUST** | ✅ Implemented |
| TECH-2.3 | Document all public functions and classes | SHOULD | ✅ Implemented |
| TECH-2.4 | Follow single responsibility principle | **MUST** | ✅ Implemented |
| TECH-2.5 | Use consistent naming conventions | **MUST** | ✅ Implemented |

### 8.4 Performance

| ID | Requirement | Priority | Status |
|----|-------------|----------|--------|
| PERF-1.1 | Receipt processing completes in <10 seconds | **MUST** | ✅ Implemented |
| PERF-1.2 | Email generation completes in <5 seconds | SHOULD | ✅ Implemented |
| PERF-1.3 | Dashboard loads in <2 seconds | SHOULD | ✅ Implemented |
| PERF-1.4 | Implement pagination for claim lists (100+ items) | SHOULD | ✅ Implemented |
| PERF-1.5 | Lazy load images and heavy components | SHOULD | ⏳ Pending |

### 8.5 Security

| ID | Requirement | Priority | Status |
|----|-------------|----------|--------|
| SEC-1.1 | All API keys stored in environment variables (never committed) | **MUST** | ✅ Implemented |
| SEC-1.2 | Firestore security rules enforce user data isolation | **MUST** | ⏳ Pending |
| SEC-1.3 | Validate all user inputs with Zod schemas | **MUST** | ✅ Implemented |
| SEC-1.4 | Use HTTPS for all connections | **MUST** | ✅ Implemented |
| SEC-1.5 | Implement rate limiting for LLM API calls | SHOULD | ⏳ V1.4 |
| SEC-1.6 | Sanitize all user-generated content | SHOULD | ✅ Implemented |

---

## 9. Future Roadmap (V2.0+)

### 9.1 Policy Document Upload (V2.0)

| ID | Feature | Priority | Timeline |
|----|---------|----------|----------|
| FF-1.1 | Allow users to upload policy PDF documents | HIGH | Q1 2026 |
| FF-1.2 | Extract coverage limits and deductibles from policy docs | HIGH | Q1 2026 |
| FF-1.3 | Parse covered services and exclusions | MEDIUM | Q2 2026 |
| FF-1.4 | Store policy metadata for quick reference | HIGH | Q1 2026 |

### 9.2 Coverage Verification (V2.0)

| ID | Feature | Priority | Timeline |
|----|---------|----------|----------|
| FF-2.1 | Check if service is covered before claim submission | HIGH | Q2 2026 |
| FF-2.2 | Warn users about potential out-of-pocket costs | MEDIUM | Q2 2026 |
| FF-2.3 | Suggest alternative covered services | LOW | Q3 2026 |
| FF-2.4 | Track remaining deductible amounts | HIGH | Q2 2026 |

### 9.3 Advanced Reporting (V2.0)

| ID | Feature | Priority | Timeline |
|----|---------|----------|----------|
| FF-3.1 | Generate annual tax reports for medical expenses | HIGH | Q1 2026 |
| FF-3.2 | Filter claims by person, policy, date range | MEDIUM | Q1 2026 |
| FF-3.3 | Export claims to CSV/PDF | MEDIUM | Q2 2026 |
| FF-3.4 | Visualize spending trends over time | LOW | Q3 2026 |

### 9.4 Multi-Language Support (V3.0)

| ID | Feature | Priority | Timeline |
|----|---------|----------|----------|
| FF-4.1 | Support Spanish language interface | MEDIUM | Q3 2026 |
| FF-4.2 | Support French language interface | LOW | Q4 2026 |
| FF-4.3 | OCR for non-English receipts | LOW | Q4 2026 |

### 9.5 Mobile App (V3.0)

| ID | Feature | Priority | Timeline |
|----|---------|----------|----------|
| FF-5.1 | React Native iOS app | HIGH | Q2 2026 |
| FF-5.2 | React Native Android app | HIGH | Q2 2026 |
| FF-5.3 | Camera integration for live receipt capture | HIGH | Q2 2026 |
| FF-5.4 | Push notifications for claim status | MEDIUM | Q3 2026 |

---

## 10. Non-Functional Requirements

### 10.1 Reliability
- **Uptime**: 99.5% availability (excluding planned maintenance)
- **Data Durability**: 99.9999% (inherited from Firestore)
- **Error Recovery**: Graceful degradation when LLM service is unavailable

### 10.2 Scalability
- **Concurrent Users**: Support 1,000+ simultaneous users
- **Database**: Firestore auto-scales to handle growth
- **LLM API**: Implement queuing for high-volume periods

### 10.3 Usability
- **Learning Curve**: New users should successfully submit first claim within 5 minutes
- **Accessibility**: WCAG 2.1 Level AA compliance (future enhancement)
- **Browser Support**: Chrome, Firefox, Safari, Edge (latest 2 versions)

### 10.4 Maintainability
- **Modularity**: Changes to one layer don't affect others
- **Documentation**: All services and complex functions documented
- **Testing**: Automated tests for critical paths
- **Monitoring**: Error tracking and performance monitoring (future)

---

## 11. Constraints & Assumptions

### Constraints
1. **LLM API Costs**: Gemini API usage must stay within budget ($500/month initially)
2. **Firebase Free Tier**: Initial deployment uses Firestore free tier limits
3. **No Backend Server**: Entire application runs client-side (serverless)
4. **Internet Required**: Application requires active internet connection

### Assumptions
1. Users have smartphones capable of taking clear receipt photos
2. Receipts are in English and use standard formatting
3. Users have active insurance policies and know their policy numbers
4. Insurance companies accept email claim submissions
5. Users trust AI-extracted data with manual review option

---

## 12. Risk Analysis

| Risk | Probability | Impact | Mitigation |
|------|------------|--------|------------|
| **OCR accuracy too low** | Medium | High | Provide manual edit option; improve prompts; add confidence thresholds |
| **LLM API costs exceed budget** | Medium | Medium | Implement caching; rate limiting; optimize prompts |
| **Users don't upgrade from free** | High | Medium | Focus on power users; add more value in paid tier |
| **Insurance companies reject AI-generated claims** | Low | High | Make emails indistinguishable from human-written; allow full editing |
| **Data privacy concerns** | Low | High | Clear privacy policy; encryption; compliance with regulations |
| **Competition from insurance companies** | Medium | Medium | Focus on multi-insurer support; better UX; additional features |

---

## 13. Success Criteria & Launch Readiness

### MVP Launch Criteria (V1.3)
- ✅ User authentication working
- ✅ Receipt upload and OCR extraction
- ✅ Claim email generation
- ✅ Subscription tier enforcement
- ✅ One-Click workflow implemented
- ✅ Basic dashboard UI
- ⏳ Firestore security rules deployed
- ⏳ Error monitoring setup
- ⏳ User documentation complete

### V1.4 Launch Criteria (Next Release)
- Payment integration (Stripe)
- Full claim details view
- Settings page for managing persons/policies
- Email editing capability
- Comprehensive testing (80% coverage)
- Performance optimization
- Mobile responsiveness verified

---

## 14. Appendix

### A. Glossary

| Term | Definition |
|------|------------|
| **One-Click Claim** | Claim eligible for automatic submission with minimal user interaction |
| **OCR** | Optical Character Recognition - extracting text from images |
| **LLM** | Large Language Model - AI for text generation (Gemini) |
| **Clean Architecture** | Software design pattern with strict layer separation |
| **Repository Pattern** | Data access abstraction layer |
| **Firestore** | NoSQL cloud database by Google |
| **Insured Person** | Individual covered under an insurance policy |
| **Policy** | Insurance coverage contract |
| **Claim** | Request for insurance payment/reimbursement |

### B. References
- [Firebase Documentation](https://firebase.google.com/docs)
- [Gemini API Documentation](https://ai.google.dev/docs)
- [React Documentation](https://react.dev/)
- [Tailwind CSS](https://tailwindcss.com/)
- [TypeScript Handbook](https://www.typescriptlang.org/docs/)

### C. Revision History

| Version | Date | Author | Changes |
|---------|------|--------|---------|
| 1.0 | Nov 30, 2025 | Initial | Original PRD draft |
| 1.3 | Dec 3, 2025 | Engineering | Implementation complete; PRD documentation |

---

**Document Status**: ✅ **Implemented & Documented**
**Next Review**: Q1 2026 (for V2.0 planning)
