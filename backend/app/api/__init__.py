"""
API package.

Defines all HTTP endpoints exposed by the FastAPI application.
This package is responsible for receiving requests, delegating
to business services, and returning responses.

Per Architecture (docs/02-Architecture.md, Section 9):
- Routes should NEVER contain business logic.
- Routes should NEVER call Groq directly.
- Routes should NEVER contain AI prompts.
"""
