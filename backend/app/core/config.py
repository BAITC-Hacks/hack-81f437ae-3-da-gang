from pathlib import Path
from pydantic import SecretStr
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=Path(__file__).resolve().parents[3] / '.env', extra='ignore')
    database_url: str = 'postgresql+asyncpg://sana:sana@localhost:5432/sana'
    openai_api_key: SecretStr = SecretStr('')
    openai_model: str = 'gpt-4.1-mini'
    frontend_origin: str = 'http://localhost:5173'


settings = Settings()
