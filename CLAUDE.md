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
- No test framework configured (consider adding Vitest or Jest)

### Important Configuration Files

- `drizzle.config.ts` - Database migration configuration
- `vite.config.ts` - Frontend build configuration
- `tsconfig.json` - TypeScript compiler settings
- `.replit` - Replit deployment configuration

### Database Schema

The application uses a user-isolated architecture where all data (bookmarks, categories) belongs to a specific user. Key features include:

- Hierarchical category organization
- Bookmark sharing with passcodes
- Screenshot capture and link status checking
- Tag-based organization
