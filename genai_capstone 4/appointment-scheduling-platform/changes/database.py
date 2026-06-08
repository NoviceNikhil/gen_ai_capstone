from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker, declarative_base
from config.settings import settings

engine = create_engine(
    settings.DATABASE_URL,
    pool_pre_ping=True,         # reconnect on stale connections
    pool_recycle=3600,          # recycle connections every hour
    echo=False,                 # set True for SQL query logging in dev
)

SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

Base = declarative_base()


# ─── FastAPI dependency injection ────────────────────────────────────────────
def get_db():
    """Yield a database session and ensure it's closed after the request."""
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
