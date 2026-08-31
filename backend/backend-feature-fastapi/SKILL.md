---
name: backend-feature-fastapi
description: >-
  Use this skill for backend, 後端, API, FastAPI, SQLAlchemy, Alembic, or database-feature work that should follow this repository's backend architecture: uv-managed Python 3.12, FastAPI app factory, app/core settings, app/db async sessions, and app/features feature modules split into router, schemas, service, repository, models, and dependencies. Use it whenever the user asks to add or modify backend endpoints, feature modules, database models, repositories, services, migrations, or similar FastAPI backend code, even if they do not explicitly mention this architecture.
compatibility: Python 3.12 FastAPI backend using uv, SQLAlchemy 2 async, asyncpg, Alembic, and pydantic-settings.
---

# Backend Feature FastAPI

## OpenCode Greenfield Bootstrap Metadata

```opencode-bootstrap-json
{
  "role": "backend",
  "order": 10,
  "packageManager": "uv",
  "scaffoldCommand": [
    "node -e \"const fs=require('fs'),p=require('path');const w=(f,s)=>{fs.mkdirSync(p.dirname(f),{recursive:true});fs.writeFileSync(f,s)};w('app/__init__.py','');w('app/features/__init__.py','');w('app/features/router.py','from fastapi import APIRouter\\n\\nrouter = APIRouter()\\n\\n@router.get(\\\"/\\\")\\ndef root():\\n    return {\\\"status\\\": \\\"ok\\\"}\\n\\n@router.get(\\\"/health\\\")\\ndef health():\\n    return {\\\"status\\\": \\\"ok\\\"}\\n');w('app/main.py','from fastapi import FastAPI\\nfrom app.features.router import router as feature_router\\n\\napp = FastAPI()\\napp.include_router(feature_router)\\n');fs.writeFileSync('pyproject.toml','[project]\\nname = \\\"greenfield-backend\\\"\\nversion = \\\"0.1.0\\\"\\nrequires-python = \\\">=3.12\\\"\\ndependencies = [\\n  \\\"fastapi[standard]>=0.115.0\\\"\\n]\\n');\" && uv sync"
  ],
  "verificationCommands": ["uv run python -m compileall app"],
  "runtimeSmokeCommand": "uv run fastapi dev app/main.py --host 127.0.0.1 --port $PORT",
  "runtimeSmokeHealthUrl": "http://127.0.0.1:$PORT/health"
}
```

Use this skill to build or modify backend features in the same style as this project. The goal is to preserve the project's feature-based architecture so future backend work remains predictable and easy to extend.

## Start Here

1. Identify the backend root. In this project it is `backend/`.
2. Read `backend/README.md`, `backend/pyproject.toml`, `backend/app/features/router.py`, and the closest existing feature under `backend/app/features/` before editing.
3. If the task adds a database-backed feature, also read `backend/app/db/session.py`, `backend/app/db/base.py`, `backend/migrations/env.py`, and the latest files in `backend/migrations/versions/`.
4. Keep changes local to the relevant feature unless shared infrastructure is truly needed.

Read `references/architecture.md` when you need a compact project map. Read `references/feature-template.md` when creating a new feature from scratch.

## Architecture Rules

- `app/main.py` owns FastAPI app creation and only mounts the collected feature router. Do not import individual feature routers there.
- `app/features/router.py` collects feature routers. Add new feature routers here.
- `app/core/config.py` owns environment-backed settings through `pydantic-settings`.
- `app/db/` owns shared SQLAlchemy base, async engine, and async session dependency.
- Each feature owns its HTTP layer, schemas, service layer, repository layer, model, and dependency wiring.
- Use absolute imports from `app...`.
- Keep route prefixes versioned through `settings.api_prefix`; feature routers should use feature-local prefixes like `/users`, not `/api/v1/users`.

## Feature Layout

For a database-backed feature, prefer this shape:

```text
app/features/<feature>/
  __init__.py       # exports router
  router.py         # FastAPI routes and request validation wiring
  schemas.py        # Pydantic request/response DTOs
  service.py        # business rules and API errors
  repository.py     # SQLAlchemy async data access
  models.py         # SQLAlchemy model
  dependencies.py   # FastAPI dependency wiring for service/repository
```

For a feature without database access, omit `models.py`, `repository.py`, and `dependencies.py` unless they add real value. The `health` feature is the minimal pattern.

## Layer Responsibilities

- Router: declare `APIRouter`, route methods, `response_model`, status codes, query/path/body validation, and dependency injection.
- Schemas: define Pydantic request and response models. Use `ConfigDict(from_attributes=True)` for ORM-backed response schemas.
- Service: implement business rules, orchestration, and `HTTPException` decisions such as conflict or not-found errors.
- Repository: isolate async SQLAlchemy queries and persistence. Commit and refresh inside repository methods that mutate data.
- Models: define SQLAlchemy 2 models with `Mapped[...]` and `mapped_column` against `app.db.base.Base`.
- Dependencies: wire `AsyncSession` from `get_db_session` into repository and service instances.

## Router Pattern

Follow the existing class-based router style:

```python
from typing import Annotated

from fastapi import APIRouter, Depends, status

from app.features.<feature>.dependencies import get_<singular>_service
from app.features.<feature>.schemas import <Thing>Create, <Thing>Read
from app.features.<feature>.service import <Thing>Service


class <Thing>Router:
    def __init__(self) -> None:
        self.router = APIRouter(prefix="/<feature>", tags=["<feature>"])
        self.router.add_api_route("", self.list_<feature>, methods=["GET"], response_model=list[<Thing>Read])
        self.router.add_api_route(
            "",
            self.create_<thing>,
            methods=["POST"],
            response_model=<Thing>Read,
            status_code=status.HTTP_201_CREATED,
        )

    async def list_<feature>(
        self,
        service: Annotated[<Thing>Service, Depends(get_<singular>_service)],
    ):
        return await service.list_<feature>()


router = <Thing>Router().router
```

Use `Annotated[Service, Depends(get_service)]` for injected services. Keep direct database access out of routers.

## Database And Migrations

When adding or changing SQLAlchemy models:

1. Add or update the feature model in `app/features/<feature>/models.py`.
2. Ensure `migrations/env.py` imports the model module so Alembic can see its metadata.
3. Create or update a migration under `migrations/versions/`.
4. Inspect generated migrations before accepting them; Alembic autogenerate is a draft, not a guarantee.

Use async SQLAlchemy APIs in repositories. Do not introduce sync sessions or sync database engines.

## Verification

Run verification from `backend/` when possible:

```bash
uv run python -m compileall app
uv run alembic upgrade head
uv run dev
```

If the environment does not have Postgres running, report that migration/runtime verification was not executed and still run syntax-level checks when possible.

## Response Style

When completing backend work, summarize:

- Feature files added or modified.
- Router registration and endpoint paths.
- Database model and migration changes, if any.
- Verification commands run and any commands that could not be run.

Keep explanations direct and focus on how the changes follow the project architecture.
