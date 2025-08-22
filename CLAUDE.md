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
- **Groq AI SDK** for email pattern generation
- **SearXNG** for search engine aggregation

### Key Architecture Patterns

**Real-time Streaming Architecture**:
- Server-Sent Events (SSE) for live updates from `/api/search-companies-and-contacts/route.ts`
- Companies appear incrementally as discovered via Yellow Pages scraping
- Email patterns generated in batches using AI after company discovery
- Contacts discovered with immediate email pattern application
- Frontend processes streams in `SearchInput.tsx` and `SearchResults.tsx`

**State Management**:
- **Global State**: Zustand store at `src/store/searchStore.ts` manages companies, contacts, email patterns, search state
- **Server State**: TanStack Query for API calls and caching
- **Database**: Direct Supabase queries for simple operations, API routes for complex scraping

**Database Schema** (Supabase PostgreSQL):
- `scraped_company` - Company data with normalized domains for deduplication
- `contact` - Individual contacts linked to companies
- `contact_email` - Generated email addresses with confidence scores and status
- `prompt` - Search queries and results tracking
- `prompt_to_scraped_company` - Query-company relationships

### New AI-Powered Email Discovery System

**SearXNG Integration** (`src/lib/searxng-service.ts`):
- Searches RocketReach for company-specific email patterns
- Discovers contacts via LinkedIn and other sources
- Multiple search strategies for comprehensive coverage

**Groq AI Email Pattern Generation** (`src/lib/groq-email-pattern-generator.ts`):
- Uses Llama 3.3 70B for intelligent email pattern analysis
- Processes multiple companies in batch for efficiency
- Generates confidence-scored patterns based on company research
- Fallback patterns for when AI is unavailable

**Enhanced Email Generation Strategy**:
1. **Company Discovery**: Yellow Pages scraping finds companies with domains
2. **Pattern Research**: SearXNG searches RocketReach for email patterns
3. **AI Pattern Generation**: Groq analyzes found patterns and generates smart formats
4. **Contact Discovery**: SearXNG finds LinkedIn profiles and other contacts
5. **Email Application**: AI patterns applied to discovered contacts with confidence scoring
6. **Real-time Streaming**: All steps stream results to frontend immediately

**Contact Discovery Flow**:
- Multiple SearXNG queries per company (LinkedIn, email directories, team pages)
- Name extraction from LinkedIn titles and content
- Duplicate prevention by URL and company
- Real-time streaming of contacts with generated emails

### Web Scraping System

**Yellow Pages Scraper** (`src/lib/yellow-pages-scraper.ts`):
- Primary company discovery method
- Uses Playwright with Chromium in headless mode
- Extracts company data (name, address, reviews, etc.)
- Normalizes websites and phone numbers
- Implements retry logic and error handling

### Component Structure

**Main Page Flow**:
1. `app/(site)/page.tsx` - Main layout with conditional search interface
2. `WelcomeSection.tsx` - Initial welcome/instructions
3. `SearchInput.tsx` - Search input with real-time processing and AI pattern handling
4. `SearchResults.tsx` - Streaming results display with email pattern visualization
5. `CompanyDetailsModal.tsx` - Detailed company/contact view with generated emails

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
- Use SearXNG service for external data discovery
- Leverage Groq AI for intelligent pattern generation

**Database operations**:
- Simple queries: Use Supabase client directly from `src/lib/supabase.ts`
- Complex operations: Create API routes with streaming responses
- Follow singular table naming convention (`scraped_company`, not `scraped_companies`)

**AI and Search Integration**:
- SearXNG instance required on localhost:8888 for email pattern and contact discovery
- Groq API key required for AI-powered email pattern generation
- Yellow Pages scraping logic in `src/lib/yellow-pages-scraper.ts`
- Email patterns generated via `src/lib/groq-email-pattern-generator.ts`
- Contact discovery via `src/lib/searxng-service.ts`

**Environment Variables**:
- `NEXT_PUBLIC_SUPABASE_URL` - Supabase project URL
- `NEXT_PUBLIC_SUPABASE_ANON_KEY` - Supabase anonymous key
- `SEARXNG_INSTANCE_URL` - SearXNG instance URL (default: http://localhost:8888)
- `GROQ_API_KEY` - Groq API key for AI pattern generation