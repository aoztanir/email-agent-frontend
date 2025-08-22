# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Development Commands

- **Development server**: `pnpm dev` (uses Turbopack for faster builds)
- **Build**: `pnpm build`
- **Production server**: `pnpm start`
- **Linting**: `pnpm lint`
- **Package manager**: Uses `pnpm` (not npm/yarn)

## Architecture Overview

This is a **Next.js 15 frontend** for an email mining application that discovers companies and extracts contact information. The app uses real-time streaming to show results as they're discovered.

### Tech Stack
- **Next.js 15** with App Router and React 19
- **TypeScript** throughout
- **Tailwind CSS** + **Shadcn/ui** component library
- **Zustand** for client state management
- **TanStack Query** for server state and caching
- **Supabase** for database operations
- **Playwright** for web scraping

### Key Architecture Patterns

**Real-time Streaming Architecture**:
- Server-Sent Events (SSE) for live updates from `/api/search-companies-and-contacts/route.ts:78`
- Companies appear incrementally as discovered via Google Maps scraping
- Frontend processes streams in `SimpleSearchResults.tsx` and `SimpleSearchCard.tsx`

**State Management**:
- **Global State**: Zustand store at `src/store/searchStore.ts` manages companies, contacts, search state
- **Server State**: TanStack Query for API calls and caching
- **Database**: Direct Supabase queries for simple operations, API routes for complex scraping

**Database Schema** (Supabase PostgreSQL):
- `scraped_company` - Company data with normalized domains for deduplication
- `contact` - Individual contacts linked to companies
- `contact_email` - Validated email addresses with confidence scores  
- `prompt` - Search queries and results tracking
- `prompt_to_scraped_company` - Query-company relationships

### Web Scraping System

**Google Maps Scraper** (`src/lib/google-maps-scraper.ts`):
- Uses Playwright with Chromium in headless mode
- Extracts company data (name, address, reviews, etc.)
- Normalizes websites and phone numbers
- Implements retry logic and error handling

**Email Validation Strategy**:
- **Blocked domains** (Gmail, Outlook): Generate likely patterns instantly
- **Custom domains**: Validate via Reacher API on localhost:8080
- **Confidence scoring**: "Validated" vs "Pattern Generated" labels

### Component Structure

**Main Page Flow**:
1. `app/(site)/page.tsx` - Main layout with conditional search interface
2. `WelcomeSection.tsx` - Initial welcome/instructions
3. `SimpleSearchCard.tsx` - Search input with real-time processing
4. `SimpleSearchResults.tsx` - Streaming results display
5. `CompanyDetailsModal.tsx` - Detailed company/contact view

**UI Components**:
- Extensive Shadcn/ui component library in `src/components/ui/`
- Custom MagicUI components for animations in `src/components/magicui/`
- Consistent design system with dark/light mode support

### Configuration Notes

- **React Compiler**: Enabled experimentally in `next.config.ts:6`
- **Dev indicators**: Disabled for cleaner development experience
- **Turbopack**: Used for faster development builds
- Environment variables required: `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`

## Working with the Codebase

**When adding features**:
- Follow existing patterns in `src/app/(site)/components/` for search-related UI
- Use Zustand store for app state, TanStack Query for server state
- Implement streaming responses for real-time updates
- Add TypeScript interfaces in relevant files (avoid separate type files)

**Database operations**:
- Simple queries: Use Supabase client directly from `src/lib/supabase.ts`
- Complex operations: Create API routes with streaming responses
- Follow singular table naming convention (`scraped_company`, not `scraped_companies`)

**Scraping and validation**:
- Google Maps scraping logic in `src/lib/google-maps-scraper.ts`
- Multiple scraper variants available for experimentation
- Email validation requires external Reacher API on localhost:8080