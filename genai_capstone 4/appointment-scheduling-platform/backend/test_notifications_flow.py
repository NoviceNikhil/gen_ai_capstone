#!/usr/bin/env python3
"""
Quick test to verify notifications are created and retrieved correctly
"""
import os
import sys
from dotenv import load_dotenv

load_dotenv(os.path.join(os.path.dirname(__file__), '.env'))
sys.path.append(os.path.dirname(__file__))

from config.database import SessionLocal
from models import User
from models.notification import Notification
from services.notification_service import create_notification, get_notifications_from_model

def test_notification_flow():
    db = SessionLocal()
    try:
        # Get a customer
        customer = db.query(User).filter(User.email == "neha.verma.customer@app-demo.com").first()
        if not customer:
            print("❌ Customer not found")
            return False
        
        print(f"✅ Found customer: {customer.email} (id: {customer.id})")
        
        # Create a test notification
        notif = create_notification(
            db,
            user_id=customer.id,
            notification_type="waitlist_lock",
            title="Test Slot Available",
            message="A test slot is available. You have 30 minutes to claim it.",
            related_entity_id="test-waitlist-123",
            related_entity_type="waitlist_entry",
            action_url="/customer/waitlist"
        )
        db.commit()
        print(f"✅ Created notification: {notif.id}")
        print(f"   - Type: {notif.type}")
        print(f"   - Title: {notif.title}")
        print(f"   - Is Read: {notif.is_read}")
        print(f"   - Created At: {notif.created_at}")
        
        # Fetch unread notifications
        notifs, total = get_notifications_from_model(
            db,
            user_id=customer.id,
            limit=10,
            offset=0,
            unread_only=True
        )
        
        print(f"\n✅ Fetched {len(notifs)} unread notifications (total: {total})")
        for n in notifs:
            print(f"   - {n['id']}: {n['title']} (read: {n['is_read']})")
        
        if len(notifs) > 0:
            print("\n✅ SUCCESS: Notifications are working correctly!")
            return True
        else:
            print("\n❌ FAILURE: No notifications retrieved")
            return False
            
    except Exception as e:
        print(f"❌ Error: {e}")
        import traceback
        traceback.print_exc()
        return False
    finally:
        db.close()

if __name__ == "__main__":
    success = test_notification_flow()
    sys.exit(0 if success else 1)
