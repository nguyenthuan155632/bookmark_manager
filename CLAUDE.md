# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Development Commands

### Build and Development

- `npm run dev` - Start development server with hot reload (runs on port 4001)
- `npm run build` - Build production version (frontend with Vite, backend with esbuild)
- `npm run start` - Start production server from `dist/index.js`
- `npm run check` - Run TypeScript type checking

### Database Operations

- `npm run db:push` - Push database schema changes using Drizzle Kit
- `npm run db:reset:dev` - Complete database reset for development (delete, push, init, search, seed)
- `npm run db:reset:prod` - Complete database reset for production (delete, push, init, search)
- `npm run seed` - Seed database with initial data
- `npm run deploy:search` - Deploy full-text search functionality

### Code Quality

- `npm run lint` - Run ESLint
- `npm run lint:fix` - Run ESLint with automatic fixes
- `npm run format` - Format code with Prettier
- `npm run format:check` - Check code formatting with Prettier
- `npm run ci` - Run all CI checks (type check, lint, format, test)

### Testing

- `npm run test` - Run tests with Vitest
- `npm run test:watch` - Run tests in watch mode

### Integrated Cron Job

The cron job service is integrated directly into the main application server:

- `npm run dev` - Start server with integrated cron job in development mode
- `npm run start` - Start server with integrated cron job in production mode
- `npx tsx server/test-cron.ts` - Test cron job functionality manually

The cron job runs automatically every 5 minutes when the server is running.

## Project Architecture

This is a full-stack bookmark manager application using a modern React + Express architecture with shared TypeScript schemas.

### Key Architecture Components

**Monorepo Structure:**

- `client/` - React frontend with Vite build system
- `server/` - Express.js backend API
- `shared/` - Shared TypeScript schemas and utilities

**Database Layer:**

- PostgreSQL with Neon serverless hosting
- Drizzle ORM for type-safe database operations
- Schema defined in `shared/schema.ts` with user isolation

**Backend Architecture:**

- Express.js server with TypeScript
- RESTful API design
- Custom logging middleware that captures API requests and responses
- Background link checking service (started on server boot)
- Graceful shutdown handling
- Integrated cron job service for scheduled tasks (runs every 5 minutes)

**Frontend Architecture:**

- React 18 with TypeScript
- Vite build tool with React plugin
- Wouter for client-side routing
- TanStack Query for server state management
- shadcn/ui components built on Radix UI
- Tailwind CSS for styling

### Data Flow Patterns

**State Management:**

- TanStack Query manages server state with caching
- Local state handled through React state and React Hook Form
- Optimistic updates for better UX

**Database Relationships:**

- User-centric design with `userId` on all entities
- Hierarchical categories with parent-child relationships
- Bookmarks support tags, favorites, sharing, and screenshots
- User preferences for theme and view mode

**Authentication Flow:**

- Passport.js with Local strategy
- Express sessions with PostgreSQL storage
- User isolation enforced at database level

### Development Environment

**Type Safety:**

- Full TypeScript coverage across all layers
- Zod schemas for form validation
- Drizzle ORM provides compile-time SQL safety

**Build System:**

- Development: `tsx` for hot-reloadable TypeScript execution
- Production: esbuild for fast backend bundling, Vite for frontend
- Path aliases configured for clean imports

**Testing & Quality:**

- TypeScript type checking via `npm run check`
- Vitest for unit testing
- ESLint and Prettier for code quality

### Important Configuration Files

- `drizzle.config.ts` - Database migration configuration
- `vite.config.ts` - Frontend build configuration with path aliases and chunking
- `tsconfig.json` - TypeScript compiler settings with path mappings
- `.replit` - Replit deployment configuration
- `eslint.config.js` - ESLint configuration with React hooks and accessibility rules
- `components.json` - shadcn/ui component configuration

### Database Schema

The application uses a user-isolated architecture where all data (bookmarks, categories) belongs to a specific user. Key features include:

- Hierarchical category organization with parent-child relationships
- Bookmark sharing with passcodes and expiration dates
- Screenshot capture using Thum.io service
- Background link status checking and validation
- Tag-based organization with domain-based auto-suggestions
- Full-text search with multilingual support (20+ languages)
- AI-powered auto-tagging and description generation via OpenRouter
- Bookmark language detection and categorization
- Favorite/bookmark status tracking
- Click analytics and engagement metrics

### Environment Variables

Required:

- `DATABASE_URL` - PostgreSQL connection string (supports Neon serverless)
- `SESSION_SECRET` - Secret for session encryption

Optional:

- `THUMIO_TOKEN` - Thum.io auth token for screenshot capture
- `OPENROUTER_API_KEY` - For AI-powered auto-tagging and descriptions
- `VITE_PUBLIC_BASE_URL` - Public base URL for the site (important for sharing)
- `NODE_ENV` - Development/production environment (development enables hot reload)
- `REPL_ID` - Replit deployment identifier (for development features)

AI Configuration:

- `AI_MODEL` - Default AI model for content generation
- `AI_TIMEOUT_MS` - Timeout for AI requests
- `AI_TEMPERATURE` - Creativity level for AI responses
- `AI_MAX_TOKENS` - Maximum tokens for AI responses

### Path Aliases

- `@/` → `client/src/`
- `@shared/` → `shared/`
- `@assets/` → `attached_assets/`

### Advanced Features

**Browser Extension:**

- Chrome extension for bookmark capture and management
- Background service workers for real-time sync
- Content scripts for webpage interaction
- Separate manifest files for development and production

**WebSocket Real-time Features:**

- Real-time bookmark updates across connected clients
- Live collaboration features
- Instant notification system for bookmark changes

**Background Job System:**

- Automated link validation and status checking
- Screenshot capture queue
- AI-powered content processing
- Graceful shutdown handling for job completion

**Multi-client Architecture:**

- Primary React client (client/)
- Vue.js alternative client (vue-client/)
- Shared API and database layer
- Consistent authentication across clients
