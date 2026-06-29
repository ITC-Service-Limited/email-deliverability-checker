import json
from functools import lru_cache

from pydantic import Field
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    app_env: str = "development"
    allowed_origins_raw: str = Field(
        default="http://localhost:3000,http://127.0.0.1:3000",
        alias="ALLOWED_ORIGINS",
    )
    default_dkim_selector: str = "default"

    @property
    def allowed_origins(self) -> list[str]:
        trimmed = self.allowed_origins_raw.strip()
        if not trimmed:
            return []
        if trimmed.startswith("["):
            return json.loads(trimmed)
        return [origin.strip() for origin in trimmed.split(",") if origin.strip()]

    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        case_sensitive=False,
        populate_by_name=True,
    )


@lru_cache
def get_settings() -> Settings:
    return Settings()
