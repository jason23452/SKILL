# Backend Architecture Snapshot

This project uses a feature-based FastAPI backend located at `backend/`.

## Stack

- Python `>=3.12`
- Dependency/runtime manager: `uv`
- Web framework: `FastAPI`
- ORM: `SQLAlchemy 2.x async`
- Postgres driver: `asyncpg`
- Migrations: `Alembic`
- Settings: `pydantic-settings`

## Entry Points

- `backend/main.py`: CLI entrypoint for `uv run dev`; runs `uvicorn` against `app.main:app`.
- `backend/app/main.py`: contains `AppFactory`, creates `FastAPI`, sets title/debug/lifespan, and includes `api_router` with `settings.api_prefix`.
- `backend/app/features/router.py`: imports feature packages and includes each feature router.

## Shared Infrastructure

- `backend/app/core/config.py`: `Settings` class, `.env` loading, cached `settings` singleton.
- `backend/app/db/base.py`: SQLAlchemy declarative `Base`.
- `backend/app/db/session.py`: async engine, `async_sessionmaker`, and `get_db_session` dependency.
- `backend/migrations/env.py`: Alembic async migration setup. It must import model modules so `Base.metadata` includes them.

## Existing Feature Patterns

### `health`

Minimal non-database feature:

- `__init__.py` exports `router`.
- `router.py` defines a class-based router with `APIRouter(prefix="/health", tags=["health"])`.
- `schemas.py` defines response DTOs.
- `service.py` contains simple business logic.

Use this pattern for utility endpoints that do not need persistence.

### `users`

Database-backed feature:

- `models.py`: SQLAlchemy model using `Mapped` and `mapped_column`.
- `schemas.py`: create/read Pydantic schemas; read schema uses `ConfigDict(from_attributes=True)`.
- `repository.py`: async SQLAlchemy queries and commit/refresh for mutations.
- `service.py`: business logic and API errors such as duplicate email conflict.
- `dependencies.py`: builds `UserService(UserRepository(session))` from `get_db_session`.
- `router.py`: class-based router with `add_api_route`, response models, status codes, and injected service.
- `__init__.py`: exports `router`.

Use this pattern for normal CRUD-style features.

## Conventions To Preserve

- Keep `app/main.py` free of direct feature imports.
- Register new features in `app/features/router.py`.
- Keep route prefixes feature-local; API versioning comes from `settings.api_prefix`.
- Keep database access in repositories, not routers or services.
- Keep business rules in services, not repositories.
- Use async repository methods and `AsyncSession`.
- Commit and refresh newly created models in repository methods.
- Add Alembic migrations for schema changes.
- Keep public feature export simple: `from app.features.<feature>.router import router` and `__all__ = ["router"]`.

## Commands

Run from `backend/`:

```bash
uv sync
uv run dev
uv run uvicorn app.main:app --reload
uv run alembic upgrade head
uv run python -m compileall app
```
