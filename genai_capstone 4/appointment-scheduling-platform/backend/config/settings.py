from pydantic_settings import BaseSettings
from functools import lru_cache
from urllib.parse import quote_plus


class Settings(BaseSettings):
    # Server
    PORT: int = 5000

    # JWT
    JWT_SECRET: str = "fallback_secret"
    JWT_EXPIRES_IN: int = 1  # days

    # MySQL
    SQL_DB_NAME: str = "appointment_scheduling"
    SQL_DB_USER: str = "root"
    SQL_PASSWORD: str = ""
    SQL_HOST: str = "localhost"
    SQL_PORT: int = 3306
    SQL_SSL: bool = False

    # Email
    EMAIL_USER: str = ""
    EMAIL_PASS: str = ""

    # Google OAuth
    GOOGLE_CLIENT_ID: str = ""
    GOOGLE_CLIENT_SECRET: str = ""
    GOOGLE_CALLBACK_URL: str = "http://localhost:5000/auth/google/callback"


    RAZORPAY_KEY_ID: str = ""
    RAZORPAY_KEY_SECRET: str = ""
    # Microservices
    REPORT_SERVICE_URL: str = "http://localhost:4000"
    REPORT_SERVICE_SECRET: str = "internal_shared_secret_key"

    # Redis
    REDIS_URL: str = ""
    MONGO_URI: str = ""
    MONGO_DB_NAME: str = "sigslot"
    PLATFORM_COMMISSION_RATE: float = 0.10

    # Schedully RAG Chatbot
    GEMINI_API_KEY: str = ""
    GROQ_API_KEY: str = ""
    PLATFORM_BASE_URL: str = "http://localhost:5000"

    # Frontend
    FRONTEND_URL: str = "http://localhost:5173"
    FRONTEND_URLS: str = ""

    @property
    def ALLOWED_FRONTEND_ORIGINS(self) -> list[str]:
        configured_origins = [
            origin.strip()
            for origin in f"{self.FRONTEND_URL},{self.FRONTEND_URLS}".split(",")
            if origin.strip()
        ]
        local_dev_origins = [
            "http://localhost:5173",
            "http://localhost:5174",
            "http://127.0.0.1:5173",
            "http://127.0.0.1:5174",
        ]

        return list(dict.fromkeys([*configured_origins, *local_dev_origins]))

    @property
    def DATABASE_URL(self) -> str:
        return (
            f"mysql+pymysql://{self.SQL_DB_USER}:{quote_plus(self.SQL_PASSWORD)}"
            f"@{self.SQL_HOST}:{self.SQL_PORT}/{self.SQL_DB_NAME}"
        )

    class Config:
        env_file = ".env"
        case_sensitive = True


@lru_cache()
def get_settings() -> Settings:
    return Settings()


settings = get_settings()
