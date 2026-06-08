from config.database import SessionLocal
from models import Category, ServiceProvider, User


def main():
    db = SessionLocal()
    try:
        total_categories = db.query(Category).count()
        active_categories = db.query(Category).filter(Category.is_active == True).count()
        total_providers = db.query(ServiceProvider).count()
        visible_providers = db.query(ServiceProvider).filter(
            ServiceProvider.is_verified == True,
            ServiceProvider.is_accepting_appointments == True,
        ).count()
        provider_users = db.query(User).filter(User.role == "provider").count()

        print(f"categories total={total_categories}, active={active_categories}")
        print(f"provider users={provider_users}")
        print(f"service_providers total={total_providers}, customer-visible={visible_providers}")

        rows = (
            db.query(ServiceProvider)
            .join(User, ServiceProvider.user_id == User.id)
            .filter(
                ServiceProvider.is_verified == True,
                ServiceProvider.is_accepting_appointments == True,
            )
            .order_by(ServiceProvider.avg_rating.desc())
            .limit(5)
            .all()
        )
        for provider in rows:
            print(
                f"- {provider.user.full_name} | {provider.specialization} | "
                f"verified={provider.is_verified} | accepting={provider.is_accepting_appointments}"
            )
    finally:
        db.close()


if __name__ == "__main__":
    main()
