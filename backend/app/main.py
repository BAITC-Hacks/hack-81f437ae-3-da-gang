from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from sqlalchemy.exc import SQLAlchemyError
from app.api.routes import router
from app.core.config import settings

app = FastAPI(title='AI Sana Challenge Hub', version='1.0.0')
app.add_middleware(CORSMiddleware, allow_origins=[settings.frontend_origin], allow_methods=['*'], allow_headers=['*'])
app.include_router(router)


@app.exception_handler(SQLAlchemyError)
async def database_error(request: Request, exc: SQLAlchemyError):
    return JSONResponse(status_code=503, content={'detail': 'База данных недоступна. Проверьте PostgreSQL и выполните миграции.'})


@app.exception_handler(OSError)
async def connection_error(request: Request, exc: OSError):
    return JSONResponse(status_code=503, content={'detail': 'Не удалось подключиться к сервису. Проверьте PostgreSQL и сеть.'})


@app.get('/api/health')
async def health():
    return {'status': 'ok'}
