from config.database import engine
from sqlalchemy import inspect
inspector = inspect(engine)
print(inspector.has_table("payment_records"))
