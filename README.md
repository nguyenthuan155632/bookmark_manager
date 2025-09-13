# Bookmark Manager - Local Development Setup

[![CI](https://github.com/OWNER/REPO/actions/workflows/ci.yml/badge.svg)](https://github.com/OWNER/REPO/actions/workflows/ci.yml)

<!-- Replace OWNER/REPO above with your GitHub org/user and repository slug. -->

## Tech Stack Overview

This comprehensive bookmark manager application is built with modern full-stack technologies. Here's everything you need to set up the project locally.

## Prerequisites

### Required Software

- **Node.js**: Version 18+ (LTS recommended)
- **npm**: Version 8+ (comes with Node.js)
- **PostgreSQL**: Version 14+ or access to a PostgreSQL database
- **Git**: For version control

### System Requirements

- Operating System: Windows, macOS, or Linux
- RAM: 4GB minimum, 8GB recommended
- Storage: 2GB free space for dependencies

## Frontend Stack

### Core Framework

- **React 18.3.1**: Modern React with hooks and concurrent features
- **TypeScript 5.6.3**: Full type safety across the application
- **Vite 5.4.19**: Fast build tool and development server

### UI & Styling

- **Tailwind CSS 3.4.17**: Utility-first CSS framework
- **shadcn/ui**: Component library built on Radix UI primitives
- **Radix UI**: Headless, accessible UI components
- **Lucide React**: Modern icon library
- **Framer Motion**: Animation library for smooth interactions

### State Management & Data Fetching

- **TanStack Query 5.60.5**: Server state management with caching
- **Wouter 3.3.5**: Lightweight client-side routing
- **React Hook Form 7.55.0**: Performant form handling
- **Zod 3.24.2**: TypeScript-first schema validation

### Additional Frontend Dependencies

```json
{
  "@hookform/resolvers": "^3.10.0",
  "class-variance-authority": "^0.7.1",
  "clsx": "^2.1.1",
  "date-fns": "^3.6.0",
  "react-markdown": "^10.1.0",
  "next-themes": "^0.4.6"
}
```

## Backend Stack

### Core Framework

- **Express.js 4.21.2**: Fast, minimalist web framework
- **TypeScript**: Full backend type safety
- **tsx 4.19.1**: TypeScript execution for development

### Database & ORM

- **PostgreSQL**: Primary database (local or cloud)
- **Drizzle ORM 0.39.1**: Type-safe SQL ORM
- **Drizzle Kit 0.30.4**: Database migrations and schema management
- **@neondatabase/serverless**: Neon database adapter (optional)

### Authentication & Security

- **Passport.js 0.7.0**: Authentication middleware
- **passport-local 1.0.0**: Local authentication strategy
- **bcrypt 6.0.0**: Password hashing
- **express-session 1.18.1**: Session management
- **express-rate-limit**: API rate limiting

### Additional Backend Dependencies

```json
{
  "connect-pg-simple": "^10.0.0",
  "memorystore": "^1.6.7",
  "nanoid": "^5.1.5",
  "ws": "^8.18.0",
  "zod-validation-error": "^3.4.0"
}
```

## Development Tools

### Build & Bundling

- **Vite**: Frontend build tool with HMR
- **esbuild 0.25.0**: Fast JavaScript bundler for production
- **PostCSS 8.4.47**: CSS processing
- **Autoprefixer**: Automatic vendor prefixing

### Code Quality

- **TypeScript**: Static type checking
- **ESLint**: Code linting (configured)
- **Prettier**: Code formatting (configured)

### Database Tools

- **Drizzle Kit**: Schema management and migrations
- **Drizzle Studio**: Database GUI (optional)

## Installation Instructions

### 1. Clone Repository

```bash
git clone <repository-url>
cd bookmark-manager
```

### 2. Install Dependencies

```bash
npm install
```

### 3. Environment Setup

Create a `.env` file in the root directory:

```env
# Database Configuration
DATABASE_URL="postgresql://username:password@localhost:5432/bookmark_manager"

# Session Configuration
SESSION_SECRET="your-secure-session-secret-here"

# Development Settings
NODE_ENV=development
```

### 4. Database Setup

#### Option A: Local PostgreSQL

1. Install PostgreSQL locally
2. Create a database: `createdb bookmark_manager`
3. Update `DATABASE_URL` in `.env`

#### Option B: Cloud Database (Neon/Supabase)

1. Create a PostgreSQL instance on Neon, Supabase, or similar
2. Copy connection string to `DATABASE_URL`

### 5. Database Schema

```bash
# Push schema to database
npm run db:push
```

### 6. Start Development Server

```bash
# Start both frontend and backend
npm run dev
```

The application will be available at `http://localhost:4001`

## Project Structure

```
bookmark-manager/
├── client/                 # Frontend React application
│   ├── src/
│   │   ├── components/     # Reusable UI components
│   │   ├── pages/          # Route components
│   │   ├── lib/            # Utilities and configurations
│   │   └── hooks/          # Custom React hooks
│   └── index.html
├── server/                 # Backend Express application
│   ├── index.ts           # Server entry point
│   ├── routes.ts          # API routes
│   └── storage.ts         # Database operations
├── shared/                 # Shared types and schemas
│   └── schema.ts          # Drizzle database schema
├── migrations/            # Database migrations
├── vite.config.ts         # Vite configuration
├── tailwind.config.ts     # Tailwind CSS configuration
├── drizzle.config.ts      # Drizzle ORM configuration
└── package.json           # Dependencies and scripts
```

## Available Scripts

```bash
# Development
npm run dev          # Start development server

# Building
npm run build        # Build for production
npm run start        # Start production server

# Database
npm run db:push      # Push schema changes to database

# Type Checking
npm run check        # Run TypeScript type checking
```

## Configuration Files

### vite.config.ts

- React plugin configuration
- Path aliases (@, @shared, @assets)
- Development server settings
- Build output configuration

### tailwind.config.ts

- Custom color palette with CSS variables
- Dark mode configuration
- Component variants and animations
- Typography and spacing customization

### drizzle.config.ts

- Database connection configuration
- Schema file location
- Migration output directory
- PostgreSQL dialect settings

## Key Features Implemented

### Core Functionality

- ✅ User authentication with sessions
- ✅ Bookmark CRUD operations
- ✅ Hierarchical categories
- ✅ Tag-based organization
- ✅ Search and filtering
- ✅ Favorites system

### Advanced Features

- ✅ Bulk operations (select, delete, move)
- ✅ AI-powered auto-tagging
- ✅ Automatic screenshot thumbnails
- ✅ Broken link monitoring
- ✅ Protected bookmarks with passcode
- ✅ Public bookmark sharing
- ✅ Mobile-responsive design
- ✅ Dark/light theme support

### Security Features

- ✅ Passcode protection for sensitive bookmarks
- ✅ Rate limiting on API endpoints
- ✅ SSRF protection for external requests
- ✅ Session-based authentication
- ✅ Input validation with Zod schemas

## Development Notes

### Path Aliases

- `@/` → `client/src/`
- `@shared/` → `shared/`
- `@assets/` → `attached_assets/`

### Database Migrations

- Use `npm run db:push` for schema changes
- Drizzle Kit manages migrations automatically
- Schema defined in `shared/schema.ts`

### Environment Variables

- `DATABASE_URL`: PostgreSQL connection string
- `SESSION_SECRET`: Secret for session encryption
- `NODE_ENV`: Development/production mode

### Hot Module Replacement

- Frontend: Automatic with Vite
- Backend: Automatic with tsx watch mode
- Database: Manual push required for schema changes

## Troubleshooting

### Common Issues

1. **Database Connection**: Verify `DATABASE_URL` format and credentials
2. **Port Conflicts**: Application uses port 5000 by default
3. **Node Version**: Ensure Node.js 18+ is installed
4. **Dependencies**: Clear `node_modules` and reinstall if needed

### Performance Tips

- Use lazy loading for large bookmark collections
- Enable database indexing for search queries
- Optimize images and screenshots for faster loading
- Consider connection pooling for production

This setup provides a complete development environment for the bookmark manager application with all modern tooling and best practices included.
