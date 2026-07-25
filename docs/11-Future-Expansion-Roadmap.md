# Future Expansion & Architectural Roadmap

**Project:** AI Code Review & Rewrite Agent

**Version:** 2.0+ Roadmap

**Status:** Approved Architectural Specification

---

# 1. Overview

While Version 1 prioritizes a database-light, stateless processing model, Version 2.0+ will introduce persistent user data, authentication, multi-file workspace reviews, custom rule engines, and real-time streaming completions.

---

# 2. Database & Persistence Layer (v2.0)

Per [docs/09-Database.md](file:///d:/ALL%20PROJECTS/ReGenarate/docs/09-Database.md), future releases will introduce a PostgreSQL relational database managed by **SQLAlchemy ORM** and **Alembic** migrations.

## Entity Relationship Model

```
+---------------+        1:N        +-----------------+
|     User      | ----------------> |     Project     |
+---------------+                   +-----------------+
        |                                    |
        | 1:1                                | 1:N
        v                                    v
+---------------+                   +-----------------+
| UserSettings  |                   |     Review      |
+---------------+                   +-----------------+
                                             |
                                             | 1:N
                                             v
                                    +-----------------+
                                    |     Rewrite     |
                                    +-----------------+
```

## Entity Specifications

- **User**: `id` (UUID), `email` (unique), `password_hash`, `created_at`
- **UserSettings**: `user_id` (FK), `theme`, `preferred_language`, `default_focus`
- **Project**: `id` (UUID), `user_id` (FK), `name`, `description`
- **Review**: `id` (UUID), `project_id` (FK), `language`, `review_focus`, `review_markdown`
- **Rewrite**: `id` (UUID), `review_id` (FK), `rewritten_code`

---

# 3. Authentication & Authorization (v2.0)

- **Auth Standard**: OAuth2 with Password Grant & JSON Web Tokens (JWT).
- **Password Security**: Argon2 / bcrypt password hashing (plain text passwords prohibited).
- **Endpoints**:
  - `POST /api/v1/auth/register` — Account creation
  - `POST /api/v1/auth/login` — Token issuance (`access_token`, `refresh_token`)
  - `GET /api/v1/auth/me` — Authenticated user profile

---

# 4. Multi-File & Repository Analysis (v2.1)

- **Zip Upload & Git Integration**: Upload `.zip` repository archives or connect GitHub OAuth to pull branches.
- **AST Dependency Graphing**: Parse project structure to analyze cross-file imports and circular dependencies.
- **Batch Processing**: Incremental AI reviews across entire directories.

---

# 5. Custom Rule Engine (v2.2)

- **Coding Standard Compliance**: Allow teams to supply custom `.rules.json` (PEP-8, Google Style Guide, SonarQube rules).
- **Prompt Injection Gating**: Inject project-specific rules dynamically into `PromptBuilder`.

---

# 6. Streaming AI Responses (v2.3)

- **Server-Sent Events (SSE)**: Stream Llama 3.3 tokens in real-time to the frontend as they generate.
- **UI Progress Bar**: Character-by-character Markdown rendering with typing animation.

---

# 7. Summary

Version 1 establishes a production-grade, modular foundation. The architecture designed across Phases 1–8 allows all Version 2.0+ features to be introduced as non-breaking extensions.
