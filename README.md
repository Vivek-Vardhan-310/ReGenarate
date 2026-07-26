# AI Code Review & Rewrite Agent

A production-quality, modular, and scalable AI-powered web application that reviews source code, identifies architectural/security/performance issues, and generates optimized implementations using Meta's **Llama 3.3 70B** Large Language Model via the **Groq API**.

---

## 🌟 Features

- 📋 **AI Code Review**: Generates structured Markdown reviews evaluating correctness, readability, maintainability, performance, security, and best practices.
- ✨ **AI Code Rewrite**: Generates production-ready, refactored source code preserving intended business logic while improving structure and naming.
- ⚡ **High-Speed Inference**: Powered by Groq LPU inference engine for near-instant completions.
- 🚀 **In-Memory LRU Caching**: Caches duplicate review and rewrite payloads using MD5 hashing and 1-hour TTL expiration for sub-5ms cached responses.
- 🛡️ **Robust Input Validation**: Strict Pydantic field validation enforcing boundaries across 15 programming languages and 7 review focus categories.
- 🎨 **Modern Responsive UI**: Dark theme workspace built with HTML5, Tailwind CSS, Marked.js, and Highlight.js for code syntax highlighting.
- 🗜️ **Response Compression**: FastAPI GZip middleware compressing HTTP responses exceeding 1000 bytes.
- 🐳 **Docker & Docker Compose**: Production-ready multi-stage Dockerfile and Docker Compose orchestration.

## New in Version 2

- 📂 Import source code files
- 🔍 Automatic language detection
- 🖥️ Built-in execution console
- 🤖 Runtime-aware AI reviews
- 🐞 Improved debugging assistance

---

## 🏗️ System Architecture

The application follows a clean, single-direction layered architecture per [docs/02-Architecture.md](docs/02-Architecture.md):

```
User Browser
    │
    ▼
Frontend Web Interface (HTML5 / Tailwind CSS / Vanilla JS)
    │
    ▼ HTTP / JSON API (v1)
FastAPI Backend (CORS + GZip Middleware)
    │
    ├─► Input Validation (Pydantic Schemas)
    ├─► Response Cache (In-Memory LRU)
    │
    ▼ Service Layer
ReviewService / RewriteService
    │
    ├─► PromptBuilder (System Role + Task Templates)
    ├─► GroqClient (AsyncGroq SDK + Llama 3.3 70B)
    └─► ResponseParser (Markdown Cleaning & Fence Stripping)
```

---

## 🛠️ Technology Stack

| Layer | Technology |
|---|---|
| **Backend Framework** | Python 3.11 / FastAPI |
| **Server Engine** | Uvicorn |
| **Validation & Config** | Pydantic v2 / Pydantic Settings |
| **AI Inference Provider** | Groq SDK / Meta Llama 3.3 70B Versatile |
| **Frontend UI** | HTML5 / Vanilla JavaScript (ES6 Modules) |
| **Styling** | Tailwind CSS (Dark Theme System) |
| **Markdown & Highlighting**| Marked.js & Highlight.js |
| **Testing** | Pytest / HTTPX TestClient |
| **Containerization** | Docker / Docker Compose / NGINX |

---

## 🚀 Quick Start & Installation

### Prerequisites
- Python 3.11+
- Git
- Groq API Key (Obtain from [Groq Console](https://console.groq.com))

### 1. Clone Repository & Setup Virtual Environment
```bash
git clone https://github.com/Vivek-Vardhan-310/ReGenarate.git
cd ReGenarate/backend

# Create virtual environment
python -m venv .venv

# Activate virtual environment
# Windows (PowerShell):
.venv\Scripts\Activate.ps1
# Linux/macOS:
source .venv/bin/activate

# Install dependencies
pip install -r requirements.txt
```

### 2. Configure Environment Variables
Copy `.env.example` to `.env` inside the `backend/` directory:
```bash
cp .env.example .env
```

Edit `.env` and insert your Groq API Key:
```ini
GROQ_API_KEY=gsk_your_actual_groq_api_key_here
MODEL_NAME=llama-3.3-70b-versatile
TEMPERATURE=0.3
MAX_TOKENS=4096
HOST=0.0.0.0
PORT=8000
REQUEST_TIMEOUT=30
DEBUG=true
APP_ENV=development
```

### 3. Run FastAPI Backend
```bash
uvicorn app.main:app --host 0.0.0.0 --port 8000 --reload
```
The API server will run at: `http://localhost:8000`
- **Swagger Documentation:** `http://localhost:8000/docs`
- **ReDoc Documentation:** `http://localhost:8000/redoc`

### 4. Run Frontend Interface
Open `frontend/index.html` directly in your browser, or serve via Python local server:
```bash
python -m http.server 3000 --directory ../frontend
```
Open `http://localhost:3000` in your web browser.

---

## 🐳 Docker Deployment

### Run with Docker Compose
```bash
# Set your API Key in environment
export GROQ_API_KEY=gsk_your_groq_api_key_here

# Build and start containers
docker-compose up --build -d
```
- **Frontend App:** `http://localhost`
- **Backend API:** `http://localhost:8000`

---

## 📡 API Specification

### 1. GET `/api/v1/health`
Service health check check endpoint.
```json
{
  "success": true,
  "data": {
    "status": "healthy",
    "service": "AI Code Review API",
    "version": "1.0.0"
  },
  "message": "Service is operational."
}
```

### 2. POST `/api/v1/review`
Generates an AI code review.
```json
// Request Body
{
  "language": "python",
  "review_focus": "performance",
  "code": "def process(data):\n    return [x*2 for x in data]"
}

// Response
{
  "success": true,
  "data": {
    "review": "# Summary\n\nYour Python implementation..."
  },
  "message": "Review generated successfully."
}
```

### 3. POST `/api/v1/rewrite`
Generates rewritten, optimized source code.
```json
// Request Body
{
  "language": "python",
  "code": "def calc(a, b): return a + b"
}

// Response
{
  "success": true,
  "data": {
    "rewritten_code": "def add_numbers(first: int, second: int) -> int:\n    \"\"\"Calculates the sum of two integers.\"\"\"\n    return first + second"
  },
  "message": "Rewrite generated successfully."
}
```

---

## 🧪 Testing & Verification

Run the full 35-test automated test suite:
```bash
cd backend
.venv\Scripts\python.exe -m pytest ..\tests\ -v
```

Execute deployment verification script:
```bash
python scripts/verify_deployment.py http://localhost:8000/api/v1
```

---

## 📚 Project Documentation

Detailed specification documents located in `docs/`:

1. [PRD](docs/01-PRD.md)
2. [Architecture](docs/02-Architecture.md)
3. [Rules & Coding Standards](docs/03-Rules.md)
4. [Phases](docs/04-Phases.md)
5. [UI/UX Design](docs/05-Design.md)
6. [API Specification](docs/07-API.md)
7. [Prompt Engineering](docs/08-Prompt-Engineering.md)
8. [Testing Strategy](docs/10-Testing.md)

---

## 📄 License

Developed by **Vivek Vardhan**. Production Release v1.0.0.