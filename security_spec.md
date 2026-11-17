# FABRO Security Specification (Zero-Trust Firestore & Privacy)

## 1. Data Invariants
1. **Strict Single-Tenant Isolation (Minors & Student Privacy)**: Every document in `/users/{userId}`, `/subjects`, `/notes`, `/libraryDocs`, `/exams`, `/calendarEvents`, `/flashcardDecks`, `/flashcardDecks/{deckId}/cards`, `/studySessions`, `/aiChats`, `/books`, and `/books/{bookId}/chapters` belongs to exactly one `userId`. Cross-user reads, listings, and writes are mathematically impossible.
2. **Email Verification Enforcement**: Every write operation and private read requires `request.auth != null && request.auth.token.email_verified == true`.
3. **Parent Master Gate**: Every card in `/flashcardDecks/{deckId}/cards/{cardId}` verifies via `get()` on create/update/delete/get that the parent deck exists and `deck.userId == request.auth.uid`. Likewise, every chapter in `/books/{bookId}/chapters/{chapterId}` verifies via `get()` that `/books/{bookId}` exists and `book.userId == request.auth.uid`.
4. **Immortal Identity & Temporal Integrity**: `userId`, `id`, and `createdAt` are immutable after creation. `createdAt` must equal `request.time` on creation, and `updatedAt` must equal `request.time` on updates.
5. **Terminal State Locking**: Once an `/exams/{examId}` document transitions to `status == 'completado'`, its score, feedback, and answers are locked against client tampering (`existing().status != 'completado'`).
6. **Shadow Field & Ghost Payload Prevention**: Every `create` enforces `hasAll` + `hasOnly` key checks, and every `update` uses action-based branches with `affectedKeys().hasOnly(...)` wrapped inside `isValid[Entity](incoming())`.
7. **PII Isolation**: `/users/{userId}` forbids `allow list` completely and allows `get` only when `request.auth.uid == userId`.
8. **EL ÚLTIMO DÍA DE TU VIDA & Mi Legado Privacy**: `/lastDayReflections`, `/lastDayActivities`, `/lastDayDreams`, `/lastDayWritings`, `/lastDayMemories`, and `/lastDayLegacy` are strictly single-owner isolated (`userId == request.auth.uid`). `/lastDayLegacy` additionally enforces `consentConfirmed == true && privateOnly == true && autoSendDisabled == true` in rules—no automated dispatch ever occurs.
9. **Adult-Only Contact Requests**: `/contactRequests` enforces `hasMinorParticipant == false` and checks via `get()` on `/publicProfiles` that neither sender nor recipient is marked `isMinor == true`.

## 2. "Dirty Dozen" Adversarial Payloads
1. **Identity Spoofing on Subject Create**: Authenticated user `A` attempts to create `/subjects/sub1` with `userId: "user_B"`. -> **Expected: PERMISSION_DENIED**.
2. **Unverified Email Write**: Authenticated user with `email_verified: false` attempts to create `/notes/note1`. -> **Expected: PERMISSION_DENIED**.
3. **PII Scraping List**: Authenticated user `A` attempts to list `/users`. -> **Expected: PERMISSION_DENIED**.
4. **Cross-User Note List without Owner Filter**: User `A` queries `/notes` without `where('userId', '==', 'A')`. -> **Expected: PERMISSION_DENIED**.
5. **Shadow / Ghost Field Injection**: User `A` creates `/users/A` adding `"planTier": "enterprise"` or `"isAdmin": true`. -> **Expected: PERMISSION_DENIED**.
6. **ID Poisoning**: User `A` attempts to write `/subjects/` + 2000-character or `$invalid!` ID. -> **Expected: PERMISSION_DENIED**.
7. **Timestamp Forgery**: User `A` creates `/notes/n1` with backdated `createdAt: "2020-01-01T00:00:00Z"` instead of `serverTimestamp()`. -> **Expected: PERMISSION_DENIED**.
8. **Immutable Ownership Hijack on Update**: User `A` updates `/subjects/s1` changing `userId` to `"user_B"`. -> **Expected: PERMISSION_DENIED**.
9. **Terminal State Tampering**: User `A` updates `/exams/e1` where `existing().status == "completado"` to raise `scorePercent` to `100`. -> **Expected: PERMISSION_DENIED**.
10. **Orphan Card Creation**: User `A` creates `/flashcardDecks/nonexistentDeck/cards/c1`. -> **Expected: PERMISSION_DENIED**.
11. **Cross-Tenant Deck Card Injection**: User `A` creates `/flashcardDecks/deckOwnedByB/cards/c1` with `userId: "A"`. -> **Expected: PERMISSION_DENIED**.
12. **Value Poisoning / Oversized Payload**: User `A` updates `/notes/n1` with `title: 12345` (wrong type) or a 1MB string in `title`. -> **Expected: PERMISSION_DENIED**.
13. **Legacy Auto-Send Bypass Attempt**: User `A` attempts to create `/lastDayLegacy/leg1` with `autoSendDisabled: false` or `consentConfirmed: false`. -> **Expected: PERMISSION_DENIED**.
14. **Cross-User Legacy Read**: User `B` (or Admin) attempts `get` on `/lastDayLegacy/leg_owned_by_A`. -> **Expected: PERMISSION_DENIED**.
