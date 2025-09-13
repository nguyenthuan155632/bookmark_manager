# Bookmark Manager Application

## Overview

This is a full-stack bookmark manager application built with React, Express, and PostgreSQL. The application allows users to organize, categorize, and manage their bookmarks with features like search, filtering, tagging, and favorites. It provides a modern, responsive interface using shadcn/ui components and supports both light and dark themes.

## User Preferences

Preferred communication style: Simple, everyday language.
Favicon preference: Simple, non-colorful favicon (implemented as minimal bookmark icon).

## System Architecture

### Frontend Architecture

- **Framework**: React with TypeScript using Vite as the build tool
- **Routing**: Wouter for client-side routing with support for category-based URLs
- **State Management**: TanStack Query (React Query) for server state management and caching
- **UI Framework**: shadcn/ui components built on top of Radix UI primitives
- **Styling**: Tailwind CSS with CSS variables for theming support
- **Form Handling**: React Hook Form with Zod validation for type-safe forms

### Backend Architecture

- **Framework**: Express.js with TypeScript for the REST API server
- **Database ORM**: Drizzle ORM for type-safe database operations
- **API Design**: RESTful endpoints for bookmarks, categories, and statistics
- **Middleware**: Custom logging middleware for API request tracking
- **Development**: Hot reload support with Vite integration in development mode

### Data Storage

- **Database**: PostgreSQL with Neon serverless for scalable cloud hosting
- **Schema Management**: Drizzle Kit for migrations and schema management
- **Data Models**:
  - Bookmarks with name, URL, description, tags, favorites, and category relationships
  - Hierarchical categories with parent-child relationships
  - Users table (prepared for authentication features)

### Key Features

- **Search & Filtering**: Full-text search across bookmarks with category and tag filtering
- **Organization**: Hierarchical category system and flexible tagging
- **Favorites**: Mark important bookmarks for quick access
- **Responsive Design**: Mobile-first approach with collapsible sidebar navigation
- **Theme Support**: Light/dark mode toggle with persistent user preferences
- **Real-time Updates**: Optimistic updates and automatic cache invalidation

### Development Tools

- **Type Safety**: Full TypeScript coverage across frontend, backend, and shared schemas
- **Code Quality**: ESLint and Prettier configuration for consistent code formatting
- **Build System**: Vite for fast development and optimized production builds
- **Path Aliases**: Configured import aliases for cleaner code organization

## External Dependencies

### Database & Storage

- **Neon Database**: Serverless PostgreSQL database with websocket support
- **Drizzle ORM**: Type-safe database operations with PostgreSQL dialect
- **connect-pg-simple**: PostgreSQL session store for Express sessions

### UI & Styling

- **Radix UI**: Headless UI components for accessibility and customization
- **Tailwind CSS**: Utility-first CSS framework with custom design system
- **Lucide React**: Icon library for consistent iconography
- **date-fns**: Date manipulation and formatting utilities

### Development & Build

- **Vite**: Fast build tool with React plugin and runtime error overlay
- **esbuild**: Fast JavaScript bundler for production builds
- **PostCSS**: CSS processing with Tailwind and Autoprefixer

### Forms & Validation

- **React Hook Form**: Performant forms with minimal re-renders
- **Zod**: TypeScript-first schema validation
- **Hookform Resolvers**: Integration between React Hook Form and Zod

### State Management & Data Fetching

- **TanStack Query**: Server state management with caching and synchronization
- **Wouter**: Lightweight client-side routing library

### Utilities

- **class-variance-authority**: Utility for creating component variants
- **clsx**: Conditional class name utility
- **nanoid**: URL-safe unique ID generator
