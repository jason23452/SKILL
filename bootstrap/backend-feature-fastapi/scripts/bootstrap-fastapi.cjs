const fs = require('fs')
const path = require('path')

function write(file, content) {
  fs.mkdirSync(path.dirname(file), { recursive: true })
  fs.writeFileSync(file, content)
}

write('app/__init__.py', '')
write('app/features/__init__.py', '')
write(
  'app/features/router.py',
  `from fastapi import APIRouter

router = APIRouter()


@router.get("/")
def root():
    return {"status": "ok"}


@router.get("/health")
def health():
    return {"status": "ok"}
`,
)
write(
  'main.py',
  `from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.features.router import router as feature_router

app = FastAPI()
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=False,
    allow_methods=["*"],
    allow_headers=["*"],
)
app.include_router(feature_router)
`,
)
write(
  'pyproject.toml',
  `[project]
name = "greenfield-backend"
version = "0.1.0"
requires-python = ">=3.12"
dependencies = [
  "fastapi[standard]>=0.115.0",
  "uvicorn[standard]>=0.30.0",
]
`,
)
