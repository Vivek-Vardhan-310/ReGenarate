# System Architecture Document (SAD)

**Project:** AI Code Review & Rewrite Agent

**Version:** 1.0

**Status:** Architecture Design

**Owner:** Vivek Vardhan

**Related Documents**

- 01-PRD.md
- 03-Rules.md
- 04-Phases.md
- 07-API.md

---

# Table of Contents

1. Introduction
2. Architectural Goals
3. Design Principles
4. High-Level Architecture
5. System Components
6. Data Flow
7. Request Lifecycle
8. Backend Architecture
9. Frontend Architecture
10. AI Layer
11. Security Layer
12. Future Expansion

---

# 1. Introduction

The AI Code Review & Rewrite Agent follows a modern client-server architecture designed around modularity, scalability, and maintainability.

Rather than embedding AI logic directly into the user interface, the system separates responsibilities into independent layers. Each layer has a clearly defined purpose and communicates with adjacent layers using structured interfaces.

This separation ensures that future enhancements—such as authentication, multiple AI providers, repository analysis, or collaborative features—can be introduced with minimal changes to the overall architecture.

The architecture prioritizes:

- Low coupling
- High cohesion
- Clear separation of concerns
- Extensibility
- Testability
- Security
- Performance

---

# 2. Architectural Goals

The architecture has six primary objectives.

---

## Goal 1 — Modularity

Every module should have one clear responsibility.

Examples

Authentication

Review Engine

Rewrite Engine

Prompt Builder

Groq Client

Markdown Renderer

Syntax Highlighter

Each module should be independently replaceable.

---

## Goal 2 — Scalability

Version 1 targets individual users.

However, the architecture must support future growth without redesign.

Examples

Multiple AI Models

Multiple Backend Workers

Database Integration

Authentication

Review History

Repository Analysis

Cloud Deployment

Enterprise Dashboard

---

## Goal 3 — Maintainability

Developers should easily locate functionality.

A developer unfamiliar with the project should understand any folder within minutes.

Code duplication should be minimized.

Dependencies between modules should remain explicit.

---

## Goal 4 — Performance

The application should deliver AI responses with minimal perceived latency.

Performance is achieved through

FastAPI asynchronous endpoints

Groq low-latency inference

Minimal frontend rendering

Efficient prompt construction

Lazy UI updates

---

## Goal 5 — Security

Security is built into the architecture rather than added later.

Requirements include

Environment variables

Input validation

Output sanitization

Structured exception handling

API abstraction

Secret isolation

---

## Goal 6 — Future Compatibility

No architectural decision should unnecessarily restrict future development.

Future integrations should require extension rather than replacement.

---

# 3. Architectural Principles

The project follows several software engineering principles.

---

## Single Responsibility Principle

Every module performs one task.

Good Example

Prompt Builder

Only creates prompts.

Never calls Groq.

Never formats HTML.

---

Bad Example

Prompt Builder

Creates prompts

Calls API

Parses markdown

Formats JSON

Writes logs

This violates separation of concerns.

---

## Separation of Concerns

Business logic must never exist inside UI components.

Frontend

Displays information.

Backend

Processes requests.

AI Layer

Generates intelligence.

Utilities

Support the system.

---

## Loose Coupling

Modules communicate through interfaces rather than direct dependencies.

Changing one module should not require rewriting unrelated modules.

Example

Changing from Groq

↓

OpenAI

should only modify the AI Provider layer.

Everything else remains unchanged.

---

## High Cohesion

Each module groups closely related responsibilities.

Review Parser

Should only parse reviews.

Nothing else.

---

## Dependency Direction

Dependencies should always point inward.

UI

↓

API

↓

Services

↓

AI Provider

↓

External LLM

Never the reverse.

---

# 4. High-Level Architecture

The application follows a layered architecture.

```

                    Browser

                       │

                       ▼

              Frontend (HTML)

                       │

                       ▼

          Tailwind + JavaScript UI

                       │

                       ▼

             API Request Layer

                       │

                       ▼

                FastAPI Backend

                       │

        ┌──────────────┴──────────────┐

        ▼                             ▼

 Review Service              Rewrite Service

        ▼                             ▼

 Prompt Builder             Prompt Builder

        ▼                             ▼

         Groq API Client

                │

                ▼

         Llama 3.3 70B Model

                │

                ▼

      AI Generated Response

                │

                ▼

      Response Parser Layer

                │

                ▼

       JSON Response Object

                │

                ▼

         Frontend Renderer

                │

                ▼

 User Interface Update

```

---

# Why Layered Architecture?

Layered architecture provides

Clear responsibility boundaries

Simpler debugging

Better testing

Replaceable modules

Improved maintainability

Reduced coupling

Cleaner code organization

---

# 5. System Components

The project consists of six primary subsystems.

---

## Component 1

Frontend

Responsibilities

Display editor

Collect user input

Display loading states

Render markdown

Highlight syntax

Display review

Copy code

Never communicate directly with Groq.

---

## Component 2

API Layer

Responsibilities

Receive requests

Validate input

Return responses

Handle HTTP

No business logic.

---

## Component 3

Business Logic Layer

Responsibilities

Review requests

Rewrite requests

Prompt generation

Validation

Response formatting

Logging

Error handling

This becomes the heart of the application.

---

## Component 4

AI Provider Layer

Responsibilities

Connect to Groq

Prepare request

Receive completion

Retry failed requests

Timeout management

Future

OpenAI

Claude

Gemini

Local LLMs

---

## Component 5

Response Processing Layer

Responsibilities

Parse markdown

Extract severity

Extract sections

Generate structured JSON

Clean formatting

Remove malformed output

---

## Component 6

Presentation Layer

Responsibilities

Cards

Severity colors

Markdown

Syntax highlighting

Animations

Notifications

Comparison view

---

# 6. Technology Stack

Frontend

HTML5

TailwindCSS

Vanilla JavaScript

Marked.js

Highlight.js

Backend

Python

FastAPI

Uvicorn

Groq SDK

Environment

python-dotenv

Deployment

Docker (Future)

Nginx (Future)

Render / Railway / VPS

Future

Database

PostgreSQL

Redis Cache

GitHub Integration

---

# 7. Design Decisions

### Why FastAPI?

- Excellent async performance
- Automatic OpenAPI documentation
- Simple dependency injection
- Easy validation using Pydantic
- Clean architecture

---

### Why Groq?

- Extremely low inference latency
- Simple SDK
- High throughput
- Ideal for interactive applications

---

### Why TailwindCSS?

- Utility-first workflow
- Consistent spacing
- Easy responsive design
- Rapid UI development

---

### Why Vanilla JavaScript?

Version 1 intentionally avoids React or Vue to reduce complexity and keep the project lightweight.

The architecture remains compatible with future migration to a frontend framework if needed.

---

# End of Part 1

# 8. Project Directory Structure

The project follows a modular architecture designed to separate responsibilities and maximize maintainability.

The following directory structure is recommended for Version 1.

```

AI-Code-Review-Agent/

│

├── backend/

│ ├── app/

│ │ ├── api/

│ │ │ ├── routes.py

│ │ │ └── health.py

│ │ │

│ │ ├── services/

│ │ │ ├── review_service.py

│ │ │ ├── rewrite_service.py

│ │ │ ├── prompt_builder.py

│ │ │ ├── parser.py

│ │ │ └── groq_client.py

│ │ │

│ │ ├── schemas/

│ │ │ ├── requests.py

│ │ │ └── responses.py

│ │ │

│ │ ├── config/

│ │ │ ├── settings.py

│ │ │ └── constants.py

│ │ │

│ │ ├── utils/

│ │ │ ├── validators.py

│ │ │ ├── logger.py

│ │ │ ├── exceptions.py

│ │ │ └── helpers.py

│ │ │

│ │ ├── static/

│ │ ├── templates/

│ │ └── main.py

│ │

│ ├── .env

│ ├── requirements.txt

│ └── README.md

│

├── frontend/

│ ├── assets/

│ ├── css/

│ ├── js/

│ ├── components/

│ ├── pages/

│ └── index.html

│

├── docs/

├── tests/

└── README.md

```

---

# Why This Structure?

The project intentionally separates

Presentation

Business Logic

AI Communication

Configuration

Utilities

Validation

Schemas

Documentation

Testing

No folder should become responsible for unrelated functionality.

---

# 9. Folder Responsibilities

## backend/app/api

Purpose

Defines every HTTP endpoint exposed by FastAPI.

Responsibilities

Receive requests

Validate HTTP methods

Call business services

Return responses

Should NEVER

Call Groq directly

Contain AI prompts

Contain HTML

Implement business logic

---

## backend/app/services

Purpose

Contains the application's core intelligence.

Responsibilities

Review logic

Rewrite logic

Prompt generation

Groq communication

Parsing

Business rules

This folder represents the heart of the project.

---

## backend/app/schemas

Purpose

Defines request and response models.

Responsibilities

Input validation

Serialization

Response consistency

Future API versioning

Use Pydantic models.

---

## backend/app/config

Purpose

Stores application configuration.

Contains

Settings

Constants

Environment configuration

Model selection

API URLs

Never place business logic here.

---

## backend/app/utils

Purpose

Reusable helper functions.

Examples

Validation

Logging

Formatting

Exception handling

Utility functions should remain generic.

---

## frontend/assets

Contains

Images

Icons

Fonts

Illustrations

Animations

---

## frontend/css

Contains

Global styles

Component styles

Theme overrides

Tailwind customizations

---

## frontend/js

Contains

Application logic

API communication

Event handling

DOM updates

Clipboard support

Markdown rendering

Syntax highlighting

---

## frontend/components

Reusable UI pieces.

Examples

Navbar

Buttons

Cards

Editor

Review Panel

Loading Spinner

Notification

Modal

Footer

No page-specific logic.

---

## frontend/pages

Contains complete pages.

Examples

Home

Review

Settings (Future)

History (Future)

---

# 10. Complete Request Lifecycle

The following sequence illustrates exactly how a review request moves through the application.

```

User

↓

Paste Code

↓

Select Language

↓

Choose Focus Areas

↓

Press Review

↓

JavaScript validates input

↓

POST /api/review

↓

FastAPI Route

↓

Pydantic Validation

↓

Review Service

↓

Prompt Builder

↓

Groq Client

↓

Groq API

↓

Llama 3.3

↓

AI Response

↓

Parser

↓

Structured JSON

↓

Frontend Renderer

↓

Markdown

↓

Highlight.js

↓

Display Review

```

Every request follows this pipeline.

---

# Step-by-Step Lifecycle

## Step 1

User clicks Review.

Frontend immediately

Validates input

Shows loading animation

Disables button

Creates JSON request

---

## Step 2

Frontend sends

POST

/api/review

Payload

{

source_code

language

focus_areas

}

---

## Step 3

FastAPI receives request.

Tasks

Validate JSON

Validate required fields

Reject invalid requests

Generate Request ID

Log request metadata

---

## Step 4

Business Service begins execution.

Responsibilities

Normalize input

Sanitize data

Prepare review context

Construct prompt

---

## Step 5

Prompt Builder generates final prompt.

Prompt contains

System Instructions

Developer Rules

User Code

Language

Focus Areas

Expected Output Format

The Prompt Builder never contacts Groq directly.

---

## Step 6

Groq Client

Receives completed prompt.

Responsibilities

Authentication

Retry logic

Timeout

Temperature

Model selection

Token configuration

API communication

Only this layer knows how Groq works.

---

## Step 7

Groq returns raw text.

Example

Markdown

Lists

Tables

Code Blocks

Structured Sections

This response is NEVER returned directly to users.

---

## Step 8

Parser Layer

Responsibilities

Extract severity

Extract sections

Normalize formatting

Generate JSON

Repair malformed markdown

Validate response

---

## Step 9

FastAPI returns

JSON

to frontend.

The backend should never return unstructured AI output.

Everything should be standardized.

---

## Step 10

Frontend

Receives JSON.

Renders

Markdown

Cards

Code blocks

Severity badges

Statistics

Animations

Syntax highlighting

---

## Step 11

User

Reads review.

Clicks Rewrite

or

Copies output.

The lifecycle then repeats using the Rewrite Service.

---

# 11. Rewrite Lifecycle

Although similar to Review, Rewrite follows a different service.

```

Review Complete

↓

Rewrite Button

↓

POST /api/rewrite

↓

Rewrite Service

↓

Prompt Builder

↓

Groq

↓

Parser

↓

Optimized Code

↓

Comparison View

↓

Copy

```

Notice

The frontend never knows whether Groq or another AI provider generated the response.

It simply displays structured data.

This abstraction allows replacing Groq later without modifying the UI.

---

# 12. Data Flow Architecture

The project intentionally follows a **one-directional data flow**.

```

User Input

↓

Frontend

↓

API

↓

Services

↓

AI Provider

↓

LLM

↓

Parser

↓

API Response

↓

Frontend

↓

Display

```

Benefits

✓ Easier debugging

✓ Predictable state

✓ Lower coupling

✓ Better testing

✓ Simpler maintenance

---

# 13. Communication Between Layers

Each layer communicates only with adjacent layers.

Allowed

Frontend

↓

API

↓

Services

↓

Provider

↓

LLM

Not Allowed

Frontend

↓

Groq

Frontend

↓

Database

Prompt Builder

↓

HTML

Parser

↓

Browser

Maintaining strict communication boundaries keeps the architecture clean and reduces future maintenance costs.

---

# End of Part 2

# 14. Backend Service Architecture

The backend follows a Service-Oriented Architecture (SOA) within a modular monolithic application.

Each service owns a single responsibility and communicates through well-defined interfaces. This approach improves readability, simplifies testing, and allows future migration to microservices if required.

The backend consists of the following core services:

- Review Service
- Rewrite Service
- Prompt Builder
- AI Provider (Groq Client)
- Response Parser
- Validation Service
- Configuration Manager
- Logging Service
- Exception Manager

These services collectively implement the application's business logic.

---

# Backend Service Relationships

```

                  FastAPI Routes

                        │

                        ▼

               Request Validation

                        │

                        ▼

                Review Service

               Rewrite Service

                   │      │

                   ▼      ▼

               Prompt Builder

                     │

                     ▼

               AI Provider Layer

                     │

                     ▼

                  Groq Client

                     │

                     ▼

               Llama 3.3 Model

                     │

                     ▼

                Response Parser

                     │

                     ▼

                Structured Result

                     │

                     ▼

                 FastAPI Response

```

No service should bypass another service to communicate directly with the AI provider.

---

# 15. Review Service

## Purpose

The Review Service orchestrates the complete review workflow.

It acts as the application's primary business service for code analysis.

---

## Responsibilities

- Receive validated request data.
- Normalize source code.
- Validate business rules.
- Request prompt generation.
- Call the AI Provider.
- Parse AI responses.
- Return standardized results.

---

## Responsibilities NOT Included

The Review Service should never:

- Build prompts manually.
- Make HTTP requests.
- Parse Markdown.
- Render HTML.
- Manage API keys.
- Perform frontend formatting.

These concerns belong to dedicated services.

---

## Inputs

- Source Code
- Programming Language
- Review Focus Areas

---

## Outputs

Structured review object containing:

- Summary
- Issues
- Severity Levels
- Recommendations
- Positive Observations

---

## Internal Workflow

```

Receive Request

↓

Validate Business Rules

↓

Normalize Code

↓

Prompt Builder

↓

Groq Client

↓

Response Parser

↓

Return Review

```

---

# 16. Rewrite Service

## Purpose

Generates production-quality code while preserving the original behavior.

Unlike the Review Service, the Rewrite Service focuses on transformation rather than analysis.

---

## Responsibilities

- Accept reviewed source code.
- Build rewrite prompts.
- Request optimized implementation.
- Preserve functionality.
- Improve readability.
- Improve maintainability.
- Improve performance.
- Improve security.

---

## Rewrite Rules

The Rewrite Service must never:

- Change business logic.
- Remove required functionality.
- Introduce unnecessary complexity.
- Rewrite code simply for stylistic reasons.

Every modification should provide measurable value.

---

## Internal Workflow

```

Receive Request

↓

Prompt Builder

↓

Groq Client

↓

Parser

↓

Return Optimized Code

```

---

# 17. Prompt Builder

## Purpose

The Prompt Builder converts application data into structured prompts suitable for Large Language Models.

This service acts as the "translator" between the application and the AI.

---

## Why a Dedicated Prompt Builder?

Without a centralized Prompt Builder:

- Prompts become inconsistent.
- Prompt updates require changes across multiple files.
- Reuse becomes difficult.
- AI quality becomes unpredictable.

Centralizing prompt construction ensures consistency across every request.

---

## Responsibilities

- Build Review prompts.
- Build Rewrite prompts.
- Inject language information.
- Inject focus areas.
- Define expected output format.
- Apply prompt templates.
- Escape unsafe characters.

---

## Example Prompt Structure

System Prompt

↓

Developer Instructions

↓

Project Rules

↓

Programming Language

↓

Review Focus

↓

Source Code

↓

Expected Response Format

This structure ensures predictable AI behavior.

---

## Design Principle

The Prompt Builder should not know:

- Which AI provider is used.
- How HTTP requests are made.
- How responses are parsed.

Its only responsibility is prompt construction.

---

# 18. AI Provider Layer

## Purpose

The AI Provider Layer abstracts communication with external language models.

Version 1 uses Groq.

Future versions may support:

- OpenAI
- Anthropic Claude
- Google Gemini
- DeepSeek
- Local LLMs

---

## Why an Abstraction Layer?

Instead of writing:

Review Service

↓

Groq

we design:

Review Service

↓

AI Provider

↓

Groq

This means replacing Groq requires changes in only one module.

---

## Responsibilities

- Authenticate requests.
- Configure model settings.
- Send prompts.
- Handle retries.
- Handle timeouts.
- Validate responses.
- Return raw AI output.

---

## Configuration

The provider should read configuration from environment variables, including:

- API Key
- Model Name
- Temperature
- Maximum Tokens
- Timeout

Hardcoded values should never appear in source code.

---

# 19. Groq Client

## Purpose

Implements the AI Provider interface specifically for Groq.

This class is responsible only for Groq communication.

---

## Responsibilities

- Initialize SDK.
- Authenticate requests.
- Send completion requests.
- Receive responses.
- Retry transient failures.
- Measure latency.
- Handle provider-specific errors.

---

## Should Never

- Parse Markdown.
- Build prompts.
- Validate requests.
- Render UI.
- Apply business rules.

---

## Future Replacement

```

Current

Review Service

↓

Groq Client

Future

Review Service

↓

OpenAI Client

OR

Claude Client

OR

Gemini Client

```

No business logic changes required.

---

# 20. Response Parser

## Purpose

Large Language Models return free-form text.

The Response Parser converts that output into a predictable internal structure.

---

## Responsibilities

Extract:

- Review Summary
- Severity Levels
- Recommendations
- Code Blocks
- Bullet Lists
- Markdown Sections

Normalize formatting before returning data to the frontend.

---

## Why Parsing Matters

AI output is inherently variable.

Without parsing:

- UI becomes fragile.
- Rendering errors increase.
- Automation becomes difficult.

The parser guarantees consistency regardless of minor differences in AI responses.

---

## Example Output Structure

```json
{
  "summary": "...",
  "issues": [
    {
      "severity": "High",
      "title": "...",
      "description": "...",
      "recommendation": "..."
    }
  ],
  "rewritten_code": "..."
}
```

This standardized structure simplifies frontend rendering.

---

# 21. Validation Service

## Purpose

Ensures incoming requests meet application rules before business logic executes.

---

## Responsibilities

- Check required fields.
- Validate language selection.
- Verify code length.
- Reject empty submissions.
- Sanitize input.
- Normalize whitespace.

---

## Validation Pipeline

```

Incoming Request

↓

Schema Validation

↓

Business Validation

↓

Sanitization

↓

Business Service

```

Validation failures should produce informative, user-friendly error messages.

---

# 22. Configuration Manager

## Purpose

Provides centralized access to application configuration.

---

## Responsibilities

- Load environment variables.
- Store application constants.
- Define model configuration.
- Configure API URLs.
- Configure timeout values.
- Configure feature flags.

---

## Example Configuration

- GROQ_API_KEY
- MODEL_NAME
- MAX_TOKENS
- TEMPERATURE
- REQUEST_TIMEOUT
- DEBUG_MODE

Centralizing configuration avoids duplicated values throughout the codebase.

---

# 23. Logging Service

## Purpose

Collect diagnostic information without exposing sensitive user data.

---

## Responsibilities

- Record request IDs.
- Log execution time.
- Log warnings.
- Log recoverable errors.
- Log critical failures.
- Support debugging during development.

---

## Logging Levels

- DEBUG
- INFO
- WARNING
- ERROR
- CRITICAL

Sensitive information such as API keys and submitted source code must never be written to logs.

---

# 24. Exception Management

The application should use centralized exception handling rather than scattered try-catch blocks.

---

## Exception Categories

### ValidationError

Invalid request data.

---

### ConfigurationError

Missing or invalid environment configuration.

---

### AIProviderError

Groq or other provider returned an error.

---

### TimeoutError

AI request exceeded configured timeout.

---

### ParsingError

AI response could not be processed into the expected structure.

---

### InternalServerError

Unexpected application failure.

---

## Error Response Format

```json
{
  "success": false,
  "error": {
    "code": "AI_PROVIDER_ERROR",
    "message": "Unable to generate AI response. Please try again later.",
    "request_id": "abc123"
  }
}
```

The backend should always return structured error responses rather than raw stack traces.

---

# 25. Applying SOLID Principles

The backend architecture is intentionally aligned with SOLID principles.

| Principle | Application |
|-----------|-------------|
| Single Responsibility | Each service owns one concern. |
| Open/Closed | New AI providers can be added without modifying existing services. |
| Liskov Substitution | Any AI provider implementation can replace another through a common interface. |
| Interface Segregation | Services depend only on the methods they actually use. |
| Dependency Inversion | Business logic depends on abstractions rather than concrete AI clients. |

Following these principles keeps the codebase maintainable as the project grows.

---

# End of Part 3

# 26. Frontend Architecture

The frontend is responsible for presenting information to users while remaining completely independent of business logic.

Its responsibilities include:

- Accepting user input
- Validating simple client-side rules
- Sending API requests
- Displaying loading states
- Rendering AI responses
- Syntax highlighting
- Markdown rendering
- Responsive layouts

The frontend must never contain AI logic or business rules.

---

# Frontend Layer Structure

```

Browser

↓

HTML Layout

↓

Tailwind Components

↓

JavaScript Controllers

↓

API Client

↓

FastAPI Backend

```

Each layer owns one responsibility.

---

# Component Hierarchy

```

App

│

├── Navbar

├── Hero Section

├── Code Editor

│ ├── Language Selector

│ ├── Focus Selector

│ ├── Review Button

│ └── Rewrite Button

│

├── Loading Overlay

│

├── Review Panel

│ ├── Summary Card

│ ├── Issues Card

│ ├── Severity Cards

│ ├── Recommendations

│ └── Positive Feedback

│

├── Rewrite Panel

│

├── Notification System

│

└── Footer

```

Every component should have a single responsibility.

---

# JavaScript Module Architecture

Instead of placing everything inside one large script file, the frontend should be divided into small reusable modules.

Recommended structure

```

js/

│

├── app.js

├── api.js

├── editor.js

├── review.js

├── rewrite.js

├── renderer.js

├── markdown.js

├── clipboard.js

├── notifications.js

├── validator.js

└── utils.js

```

---

## Module Responsibilities

### app.js

Application bootstrap.

Initializes all components.

---

### api.js

Responsible only for backend communication.

Contains

GET

POST

Timeout

Retry

Error handling

No DOM manipulation.

---

### editor.js

Handles

Editor initialization

Input collection

Language selector

Focus selector

---

### renderer.js

Converts backend JSON into HTML.

Responsible for

Cards

Tables

Lists

Badges

Statistics

---

### review.js

Controls review workflow.

---

### rewrite.js

Controls rewrite workflow.

---

### markdown.js

Handles Marked.js rendering.

---

### clipboard.js

Copy functionality.

---

### validator.js

Frontend validation.

---

### notifications.js

Toast messages.

Alerts.

Success messages.

---

# 27. API Design Philosophy

The backend exposes RESTful APIs.

The frontend should never communicate directly with the AI provider.

Instead

```

Frontend

↓

FastAPI

↓

Business Service

↓

AI Provider

↓

Groq

```

This abstraction protects API keys and centralizes business logic.

---

## Endpoint Design Principles

Every endpoint should

- Be stateless
- Validate inputs
- Return JSON
- Use HTTP status codes correctly
- Return structured errors
- Avoid leaking internal implementation details

---

## Versioning Strategy

Current

```

/api/review

/api/rewrite

/api/health

```

Future

```

/api/v2/review

/api/v2/history

/api/v2/projects

```

API versioning should prevent breaking existing clients.

---

# 28. Request & Response Schema Design

## Review Request

```json
{
  "source_code": "...",
  "language": "python",
  "focus_areas": [
    "performance",
    "security"
  ]
}
```

---

## Review Response

```json
{
  "success": true,

  "summary": "...",

  "issues": [],

  "statistics": {},

  "recommendations": [],

  "positive_feedback": []
}
```

---

## Rewrite Request

```json
{
  "source_code": "...",
  "language": "java"
}
```

---

## Rewrite Response

```json
{
  "success": true,

  "rewritten_code": "...",

  "changes": [],

  "summary": "..."
}
```

---

## Error Response

```json
{
  "success": false,

  "error": {

      "code":"TIMEOUT",

      "message":"Unable to generate response.",

      "request_id":"xyz123"

  }
}
```

Every response should follow a consistent schema.

---

# 29. State Management

Although Version 1 uses Vanilla JavaScript, application state should still be organized.

Recommended state

```

Application State

↓

Editor State

↓

Loading State

↓

Review State

↓

Rewrite State

↓

Notification State

```

Never store duplicated data.

Always maintain a single source of truth.

---

## Example State

```javascript
state = {

editor:{},

review:{},

rewrite:{},

loading:false,

notification:null

}
```

---

# 30. Security Architecture

Security is implemented across multiple layers.

```

Browser

↓

Input Validation

↓

HTTPS

↓

FastAPI

↓

Business Validation

↓

AI Provider

↓

Groq

```

---

## Security Layers

Layer 1

Client Validation

Reject obviously invalid requests.

---

Layer 2

Server Validation

Never trust client input.

---

Layer 3

Environment Variables

API keys remain private.

---

Layer 4

Exception Handling

Prevent stack trace exposure.

---

Layer 5

Output Sanitization

Prevent HTML injection.

---

Layer 6

Rate Limiting (Future)

Prevent abuse.

---

Layer 7

Authentication (Future)

Restrict protected features.

---

# 31. Authentication Architecture (Future)

Version 1 intentionally avoids authentication.

Future authentication flow

```

User

↓

Login

↓

JWT

↓

FastAPI

↓

Protected Route

↓

Business Service

```

Future providers

Google

GitHub

Microsoft

Email

---

# 32. Deployment Architecture

## Local Development

```

Browser

↓

localhost:8000

↓

FastAPI

↓

Groq

```

---

## Production Deployment

```

Internet

↓

Nginx

↓

FastAPI

↓

Business Services

↓

Groq

```

Future

```

Internet

↓

Load Balancer

↓

FastAPI Instances

↓

Redis

↓

PostgreSQL

↓

Groq

```

The architecture should support growth without major redesign.

---

# 33. Performance Optimization

The application should minimize unnecessary work.

Frontend

- Lazy rendering
- Efficient DOM updates
- Debounced inputs
- Cached selectors

Backend

- Async endpoints
- Connection reuse
- Efficient prompt generation
- Lightweight parsing

Future

- Redis caching
- Background workers
- Queue processing

---

# 34. Monitoring & Observability

The application should expose operational metrics.

Track

- API latency
- AI latency
- Request count
- Error rate
- Success rate
- Timeout rate
- Average response size

Future integrations

- Grafana
- Prometheus
- Sentry
- OpenTelemetry

Monitoring should help identify problems before users report them.

---

# 35. Sequence Diagram — Review Request

```

User

 │

 │ Click Review

 ▼

Frontend

 │

 │ POST /api/review

 ▼

FastAPI

 │

 │ Validate

 ▼

Review Service

 │

 │ Build Prompt

 ▼

Prompt Builder

 │

 │ Send Prompt

 ▼

Groq Client

 │

 │ API Request

 ▼

Groq LLM

 │

 │ AI Response

 ▼

Response Parser

 │

 │ JSON

 ▼

FastAPI

 │

 │ HTTP Response

 ▼

Frontend

 │

 │ Render Cards

 ▼

User

```

This sequence represents the complete lifecycle of a review operation from the user's action to the final rendered result.

---

# 36. Architecture Decision Records (ADR)

The following key architectural decisions have been made for Version 1.

| ADR ID | Decision | Reason |
|--------|----------|--------|
| ADR-001 | Use FastAPI | High performance, async support, automatic API documentation |
| ADR-002 | Use Groq as AI provider | Low latency and simple integration |
| ADR-003 | Separate Prompt Builder | Consistent prompt generation and easier maintenance |
| ADR-004 | Modular Monolith | Simpler to develop while remaining easy to scale |
| ADR-005 | Vanilla JavaScript | Lower complexity for Version 1 with a straightforward migration path to React or Vue |
| ADR-006 | REST API | Simple, well-understood communication model |
| ADR-007 | Environment-based configuration | Keeps secrets and environment-specific settings out of the codebase |
| ADR-008 | Structured JSON responses | Predictable frontend rendering and easier testing |

Documenting architectural decisions helps future contributors understand *why* choices were made instead of only *what* was implemented.

---

# End of Part 4

# 37. Coding Standards & Conventions

To ensure consistency across the project, all contributors should follow a common set of coding standards.

---

## General Principles

- Prioritize readability over cleverness.
- Write self-documenting code.
- Keep functions small and focused.
- Avoid duplicate logic.
- Prefer composition over inheritance.
- Fail early with meaningful errors.
- Keep modules loosely coupled.

---

## Python Standards

Naming

- Classes → PascalCase
- Functions → snake_case
- Variables → snake_case
- Constants → UPPER_CASE

Example

```python
class ReviewService:
    pass

def build_prompt():
    pass

MAX_TOKENS = 4096
```

---

## JavaScript Standards

Naming

- Variables → camelCase
- Functions → camelCase
- Classes → PascalCase

Example

```javascript
const reviewButton = document.getElementById("review");

function submitReview() {}

class ApiClient {}
```

---

## File Naming

Examples

```

review_service.py

rewrite_service.py

prompt_builder.py

groq_client.py

parser.py

```

Avoid names such as

```

utils2.py

temp.py

final_final.py

newCode.js

```

---

## Documentation

Every public function should include:

- Purpose
- Parameters
- Return Value
- Possible Exceptions

Example

```python
def review_code(source_code: str) -> dict:
    """
    Generates an AI review for the supplied source code.

    Args:
        source_code: User submitted source code.

    Returns:
        Structured review dictionary.
    """
```

---

# 38. Recommended Design Patterns

The project intentionally uses several well-established software design patterns.

---

## Strategy Pattern

Used for AI Providers.

```

Review Service

↓

AI Provider Interface

↓

Groq

↓

OpenAI

↓

Claude

↓

Gemini

```

Benefits

- Easy provider replacement
- Minimal code changes
- Better testing

---

## Factory Pattern

Future versions may instantiate providers through a factory.

Example

```python
provider = AIProviderFactory.create("groq")
```

This avoids scattering provider-specific logic across the application.

---

## Adapter Pattern

Each external AI provider exposes a different SDK.

Adapters normalize these differences into a common internal interface.

Benefits

- Consistent behavior
- Easier provider switching
- Reduced coupling

---

## Builder Pattern

The Prompt Builder naturally follows the Builder pattern.

Example

```

Prompt

↓

System Instructions

↓

Developer Rules

↓

Language

↓

Focus Areas

↓

User Code

↓

Expected Format

```

Each section is assembled into a final prompt.

---

## Dependency Injection

Services should receive dependencies rather than creating them internally.

Instead of

```python
client = GroqClient()
```

Prefer

```python
def __init__(self, ai_provider):
    self.ai_provider = ai_provider
```

This improves testing and flexibility.

---

# 39. Dependency Graph

The following diagram illustrates the permitted dependency direction.

```

Frontend

↓

API Routes

↓

Services

↓

Prompt Builder

↓

AI Provider

↓

Groq Client

↓

Groq SDK

```

Dependencies should always point downward.

Lower layers must never depend on higher layers.

---

# 40. Extension Points

The architecture intentionally provides locations where future functionality can be added with minimal impact.

---

## New AI Provider

Add a new provider implementation inside:

```

services/providers/

```

No changes should be required in the Review or Rewrite services.

---

## Authentication

Future authentication should integrate through middleware without altering business services.

```

JWT Middleware

↓

Routes

↓

Services

```

---

## Persistent Storage

Database support can be introduced by adding a Repository layer.

```

Services

↓

Repository

↓

PostgreSQL

```

Business services should not execute raw SQL directly.

---

## Background Processing

Long-running tasks can be delegated to worker processes.

```

Request

↓

Queue

↓

Worker

↓

AI

↓

Result

```

Possible technologies:

- Celery
- RQ
- Dramatiq

---

# 41. Migration Strategy

The architecture supports gradual evolution without requiring complete rewrites.

---

## Version 1

- Single AI provider
- No authentication
- Stateless API
- No database

---

## Version 2

- User accounts
- Saved history
- File uploads
- Export functionality

---

## Version 3

- Repository analysis
- Team collaboration
- CI/CD integration
- Multiple AI providers
- Enterprise dashboard

Each version builds upon the existing architecture rather than replacing it.

---

# 42. Testing Architecture

Testing is divided into multiple layers.

```

Unit Tests

↓

Integration Tests

↓

API Tests

↓

UI Tests

↓

End-to-End Tests

```

---

## Unit Tests

Test individual services.

Examples

- Prompt Builder
- Validators
- Parser
- Utility functions

---

## Integration Tests

Verify communication between services.

Examples

Review Service → Prompt Builder

Prompt Builder → AI Provider

AI Provider → Parser

---

## API Tests

Verify endpoints.

```

POST /review

POST /rewrite

GET /health

```

Check:

- Status codes
- Validation
- Error responses
- Response schema

---

## End-to-End Tests

Simulate complete user workflows.

Example

```

Paste Code

↓

Click Review

↓

Receive Review

↓

Generate Rewrite

↓

Copy Code

```

---

# 43. Future Microservices Evolution

If the project grows significantly, the modular monolith can evolve into microservices.

Possible architecture:

```

                API Gateway

                     │

     ┌───────────────┼───────────────┐

     ▼               ▼               ▼

 Review Service  Rewrite Service  User Service

     │               │               │

     └───────────────┼───────────────┘

                     ▼

                AI Provider Service

                     ▼

                 External LLM

```

This transition should be evolutionary rather than revolutionary.

---

# 44. Architecture Review Checklist

Before implementation begins, verify the following:

### Structure

- [ ] Folder structure is finalized.
- [ ] Modules have clear responsibilities.
- [ ] Dependencies follow the approved direction.

---

### Backend

- [ ] Services are independent.
- [ ] Prompt Builder is centralized.
- [ ] AI Provider abstraction is implemented.
- [ ] Parsers return structured data.
- [ ] Validation occurs before business logic.

---

### Frontend

- [ ] UI contains no business logic.
- [ ] API communication is centralized.
- [ ] Components are reusable.
- [ ] State management is organized.

---

### Security

- [ ] API keys stored in `.env`.
- [ ] Inputs validated.
- [ ] Errors sanitized.
- [ ] Secrets never logged.

---

### Performance

- [ ] Async endpoints.
- [ ] Efficient rendering.
- [ ] Minimal duplicate processing.
- [ ] Configurable timeouts.

---

### Documentation

- [ ] PRD approved.
- [ ] Architecture reviewed.
- [ ] Rules document prepared.
- [ ] API specification complete.

---

# 45. Architecture Summary

The AI Code Review & Rewrite Agent is built using a layered, modular architecture designed for clarity, maintainability, and future growth.

The design intentionally separates presentation, business logic, AI communication, configuration, validation, and response processing into independent modules. This separation reduces coupling, simplifies testing, and enables new capabilities—such as additional AI providers, authentication, persistent storage, and repository analysis—to be introduced with minimal changes to existing components.

Key architectural characteristics include:

- Modular Monolith for Version 1
- Layered Architecture with clear dependency direction
- RESTful API using FastAPI
- AI Provider abstraction for vendor independence
- Centralized Prompt Builder
- Structured response parsing
- Environment-based configuration
- Comprehensive validation and error handling
- Extensible frontend architecture
- Clear migration path toward enterprise-scale deployment

This architecture establishes a stable foundation that supports both the immediate goals of Version 1 and the long-term vision of an extensible AI-assisted software engineering platform.

---

# 46. References

### Related Documents

- 01-PRD.md
- 03-Rules.md
- 04-Phases.md
- 05-Design.md
- 06-Memory.md
- 07-API.md
- 08-Prompt-Engineering.md
- 09-Database.md
- 10-Testing.md

### External Technologies

- FastAPI
- Python
- Groq API
- Llama 3.3 70B
- HTML5
- Tailwind CSS
- Vanilla JavaScript
- Marked.js
- Highlight.js

---

# 47. Conclusion

The System Architecture Document defines the technical blueprint for the AI Code Review & Rewrite Agent. It transforms the product vision outlined in the PRD into an implementable design by specifying system layers, service responsibilities, communication patterns, deployment strategies, and engineering standards.

Adhering to this architecture will help ensure that the project remains modular, maintainable, secure, and scalable throughout its lifecycle. As the platform evolves, future enhancements should extend the existing architecture wherever possible, preserving consistency and minimizing technical debt.

---

**Document Status:** Approved for Development Planning
