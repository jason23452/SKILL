# Feature Template

Use this as a starting point when creating a database-backed feature. Replace `<feature>`, `<singular>`, and `<Thing>` consistently.

## `__init__.py`

```python
from app.features.<feature>.router import router

__all__ = ["router"]
```

## `models.py`

```python
from datetime import datetime

from sqlalchemy import DateTime, String, func
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base import Base


class <Thing>(Base):
    __tablename__ = "<feature>"

    id: Mapped[int] = mapped_column(primary_key=True)
    name: Mapped[str] = mapped_column(String(120), nullable=False)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=func.now(),
        nullable=False,
    )
```

## `schemas.py`

```python
from datetime import datetime

from pydantic import BaseModel, ConfigDict


class <Thing>Create(BaseModel):
    name: str


class <Thing>Read(BaseModel):
    id: int
    name: str
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)
```

## `repository.py`

```python
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.features.<feature>.models import <Thing>
from app.features.<feature>.schemas import <Thing>Create


class <Thing>Repository:
    def __init__(self, session: AsyncSession) -> None:
        self._session = session

    async def list(self, limit: int, offset: int) -> list[<Thing>]:
        statement = select(<Thing>).order_by(<Thing>.id).limit(limit).offset(offset)
        result = await self._session.scalars(statement)
        return list(result.all())

    async def create(self, payload: <Thing>Create) -> <Thing>:
        item = <Thing>(**payload.model_dump())
        self._session.add(item)
        await self._session.commit()
        await self._session.refresh(item)
        return item
```

## `service.py`

```python
from app.features.<feature>.models import <Thing>
from app.features.<feature>.repository import <Thing>Repository
from app.features.<feature>.schemas import <Thing>Create


class <Thing>Service:
    def __init__(self, repository: <Thing>Repository) -> None:
        self._repository = repository

    async def list_<feature>(self, limit: int, offset: int) -> list[<Thing>]:
        return await self._repository.list(limit=limit, offset=offset)

    async def create_<singular>(self, payload: <Thing>Create) -> <Thing>:
        return await self._repository.create(payload)
```

## `dependencies.py`

```python
from typing import Annotated

from fastapi import Depends
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.session import get_db_session
from app.features.<feature>.repository import <Thing>Repository
from app.features.<feature>.service import <Thing>Service


def get_<singular>_service(
    session: Annotated[AsyncSession, Depends(get_db_session)],
) -> <Thing>Service:
    return <Thing>Service(<Thing>Repository(session))
```

## `router.py`

```python
from typing import Annotated

from fastapi import APIRouter, Depends, Query, status

from app.features.<feature>.dependencies import get_<singular>_service
from app.features.<feature>.models import <Thing>
from app.features.<feature>.schemas import <Thing>Create, <Thing>Read
from app.features.<feature>.service import <Thing>Service


class <Thing>Router:
    def __init__(self) -> None:
        self.router = APIRouter(prefix="/<feature>", tags=["<feature>"])
        self.router.add_api_route("", self.list_<feature>, methods=["GET"], response_model=list[<Thing>Read])
        self.router.add_api_route(
            "",
            self.create_<singular>,
            methods=["POST"],
            response_model=<Thing>Read,
            status_code=status.HTTP_201_CREATED,
        )

    async def list_<feature>(
        self,
        service: Annotated[<Thing>Service, Depends(get_<singular>_service)],
        limit: int = Query(default=100, ge=1, le=100),
        offset: int = Query(default=0, ge=0),
    ) -> list[<Thing>]:
        return await service.list_<feature>(limit=limit, offset=offset)

    async def create_<singular>(
        self,
        payload: <Thing>Create,
        service: Annotated[<Thing>Service, Depends(get_<singular>_service)],
    ) -> <Thing>:
        return await service.create_<singular>(payload)


router = <Thing>Router().router
```

## Register The Feature

In `app/features/router.py`:

```python
from app.features.<feature> import router as <feature>_router


self.router.include_router(<feature>_router)
```

## Migration Reminder

After adding `models.py`, import the model in `migrations/env.py` and create a migration under `migrations/versions/` or with Alembic autogenerate.
