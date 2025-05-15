# Gym Registration GraphQL API

A comprehensive gym registration system providing identical functionality through REST, SOAP, and **GraphQL** APIs. This project demonstrates functional equivalence between different API architectures for the same business logic.

## Table of Contents

- [Project Overview](#project-overview)
- [Features](#features)
- [Architecture](#architecture)
- [Prerequisites](#prerequisites)
- [Installation](#installation)
- [Quick Start](#quick-start)
- [GraphQL Schema](#graphql-schema)
- [API Documentation](#api-documentation)
- [Testing](#testing)
- [Client Examples](#client-examples)
- [Project Structure](#project-structure)


## Project Overview

This project provides a complete gym registration management system with:

- **REST API** - Modern HTTP-based interface following RESTful principles
- **SOAP API** - Enterprise-grade web service with full WSDL specification
- **GraphQL API** - Modern query language for APIs with flexible data fetching
- **Functional Equivalence** - All three APIs provide identical business functionality
- **Comprehensive Testing** - Automated tests comparing REST, SOAP, and GraphQL responses

### Core Entities

- **Trainees** - Gym members with authentication
- **Workouts** - Exercise types with duration and details
- **Routines** - Trainee availability schedules
- **Registrations** - Workout session bookings

## Features

### GraphQL API Features
- Full schema definition with SDL (Schema Definition Language)
- Introspection support for schema exploration
- Flexible query structure - fetch only needed fields
- Single endpoint for all operations
- Real-time GraphQL Playground for testing
- Type safety with comprehensive input validation

### Common Features (Shared across all APIs)
- Identical business logic
- Same database backend
- Equivalent error handling
- Consistent data validation
- JWT-based authentication

## Architecture

```
┌─────────────────────────────────────────────┐
│                  Frontend                   │
│            (HTML/CSS/JS)                    │
└─────────────────┬───────────────────────────┘
                  │
┌─────────────────┴───────────────────────────┐
│               API Layer                     │
├─────────────────┬─────────────┬─────────────┤
│    REST API     │  SOAP API   │ GraphQL API │
│   (Port 3000)   │ (Port 3001) │ (Port 4000) │
├─────────────────┴─────────────┴─────────────┤
│           Business Logic Layer              │
├─────────────────────────────────────────────┤
│            Database Layer                   │
│              (SQLite)                       │
└─────────────────────────────────────────────┘
```

## Prerequisites

- **Node.js** 16.x or higher
- **npm** 6.x or higher
- **curl** (for testing)

## Installation

1. **Clone the repository**
   ```bash
   git clone https://github.com/your-repo/gym-registration-graphql
   cd gym-registration-graphql
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Set up environment variables**
   ```bash
   cp .env.example .env
   ```

   Edit `.env` file with your configuration:
   ```env
   DATABASE_URL="file:./dev.db"
   PORT=3000
   JWT_SECRET=your_secure_jwt_secret_here
   GRAPHQL_PORT=4000
   ```

4. **Initialize database**
   ```bash
   npx prisma generate
   npx prisma migrate dev --name init
   ```

## Quick Start

### Using the run script
```bash
chmod +x scripts/run.sh
./scripts/run.sh
```

This will start all three services:
- REST API on port 3000
- SOAP service on port 3001
- GraphQL service on port 4000

### Manual startup (GraphQL only)
```bash
npm start
```

## GraphQL Schema

### Key Types

```graphql
type Trainee {
   id: ID!
   name: String!
   email: String!
   timezone: String
   createdAt: DateTime!
   updatedAt: DateTime!
   routines: [Routine!]!
   registrations: [Registration!]!
}

type Workout {
   id: ID!
   name: String!
   duration: Int!
   description: String
   color: String
   createdAt: DateTime!
   updatedAt: DateTime!
}

type Routine {
   id: ID!
   userId: String!
   availability: [TimeSlot!]!
   trainee: Trainee!
   createdAt: DateTime!
   updatedAt: DateTime!
}

type Registration {
   id: ID!
   eventId: String!
   userId: String!
   inviteeEmail: String!
   startTime: DateTime!
   endTime: DateTime
   status: RegistrationStatus!
   trainee: Trainee!
   createdAt: DateTime!
   updatedAt: DateTime!
}
```

### Example Queries

**Login and get user info:**
```graphql
mutation {
   login(input: { email: "user@example.com", password: "password" }) {
      token
      trainee {
         id
         name
         email
      }
   }
}

query {
   me {
      authenticated
      trainee {
         id
         name
         email
         routines {
            availability {
               day
               startTime
               endTime
            }
         }
      }
   }
}
```

**Create and query workouts:**
```graphql
mutation {
   createWorkout(input: {
      name: "HIIT Training"
      duration: 45
      description: "High intensity workout"
      color: "#FF5733"
   }) {
      id
      name
      duration
   }
}

query {
   workouts {
      id
      name
      duration
      description
      color
   }
}
```

## API Documentation

### GraphQL Playground
- **URL**: `http://localhost:4000/graphql`
- Interactive playground with schema explorer
- Auto-completion and documentation
- Real-time query testing

### Other APIs
- **REST Swagger UI**: `http://localhost:3000/api-docs-en`
- **SOAP WSDL**: `http://localhost:3001/soap?wsdl`

### Operation Comparison

| Operation | REST | SOAP | GraphQL |
|-----------|------|------|---------|
| Login | `POST /sessions` | `CreateSession` | `mutation { login }` |
| Get Trainees | `GET /trainees` | `ListTrainees` | `query { trainees }` |
| Create Workout | `POST /workouts` | `CreateWorkout` | `mutation { createWorkout }` |
| Update Routine | `PATCH /routines/trainee/{id}` | `UpdateTraineeRoutine` | `mutation { updateTraineeRoutine }` |

## Testing

### Run All Tests
```bash
# Automated comparison tests
npm test

# Or manually
chmod +x tests/test.sh
./tests/test.sh
```

### Run Client Examples
```bash
# Test all GraphQL operations
npm run test:client
```

### Validate GraphQL Schema
```bash
# Validate schema syntax
npm run validate:schema
```

### Test Coverage

1. **Authentication Tests**
   - Login/logout functionality
   - Session validation with `me` query
   - Token verification

2. **CRUD Operation Tests**
   - Create, read, update, delete for all entities
   - Data consistency between REST, SOAP, and GraphQL

3. **GraphQL-Specific Tests**
   - Schema introspection validation
   - Query complexity and nested field resolution
   - Input validation and error handling

4. **Error Handling Tests**
   - Invalid token scenarios
   - Missing required fields
   - GraphQL validation errors

## Client Examples

The `client/example.js` file demonstrates:

- Authentication flow
- CRUD operations for all entities
- Nested queries with related data
- Error handling
- Token management

Run examples:
```bash
node client/example.js
```

## Project Structure

```
gym-registration-graphql/
├── README.md
├── package.json
├── .env.example
├── .gitignore
├── scripts/
│   └── run.sh              # Main startup script
├── schema/
│   └── schema.graphql      # GraphQL schema definition
├── src/
│   └── server.js           # GraphQL server implementation
├── tests/
│   ├── test.sh             # Test runner script
│   └── test.js             # Automated tests
├── client/
│   └── example.js          # GraphQL client example
├── prisma/
│   ├── schema.prisma       # Database schema
│   └── migrations/         # Database migrations
└── server.js               # REST API server
```

## Development

### Development Commands
```bash
# Start GraphQL server with auto-reload
npm run dev

# Database operations
npm run db:migrate
npm run db:generate
npm run db:studio
npm run db:reset

# Validate GraphQL schema
npm run validate:schema
```
