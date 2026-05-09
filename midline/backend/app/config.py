from functools import lru_cache

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    app_name: str = "Midline API"
    env: str = "development"
    mongodb_uri: str = "mongodb://localhost:27017"
    mongodb_db: str = "midline"
    jwt_secret: str = "change-me-in-dev"
    jwt_algorithm: str = "HS256"
    jwt_expire_minutes: int = 60 * 24 * 7
    frontend_origins: str = "http://localhost:5173,http://127.0.0.1:5173"
    show_dev_otp: bool = True

    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    @property
    def cors_origins(self) -> list[str]:
        return [origin.strip() for origin in self.frontend_origins.split(",") if origin.strip()]

    def validate_runtime(self) -> None:
        if self.env == "production" and self.jwt_secret == "change-me-in-dev":
            raise ValueError("JWT_SECRET must be set to a strong value in production")


@lru_cache
def get_settings() -> Settings:
    return Settings()
