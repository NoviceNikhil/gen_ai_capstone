#!/usr/bin/env python3
"""
Background task to process deferred provider payouts.

This script should be run periodically (every 1-5 minutes) via cron job or scheduler.
It processes all payouts scheduled for 1 hour after appointment completion.

Usage:
  python run_payout_processor.py
  
Or add to crontab:
  * * * * * cd /path/to/backend && python run_payout_processor.py >> payout_processor.log 2>&1
"""

import sys
import os
from datetime import datetime

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from config.database import SessionLocal
from services.payout_service import process_scheduled_payouts


def main():
    """Main payout processor entry point"""
    db = SessionLocal()
    
    try:
        timestamp = datetime.utcnow().isoformat()
        print(f"\n[{timestamp}] Starting payout processor...")
        
        result = process_scheduled_payouts(db)
        
        print(f"[PAYOUT_RESULT] Status: {result.get('status')}")
        print(f"[PAYOUT_RESULT] Processed: {result.get('processed_count')} payouts")
        print(f"[PAYOUT_RESULT] Failed: {result.get('failed_count')} payouts")
        
        if result.get('errors'):
            print(f"[PAYOUT_ERRORS]")
            for error in result.get('errors'):
                print(f"  - {error}")
        
        print(f"[{datetime.utcnow().isoformat()}] Payout processor finished\n")
        
        return 0 if result.get('status') == 'success' else 1
        
    except Exception as e:
        print(f"[PAYOUT_FATAL_ERROR] {str(e)}")
        import traceback
        traceback.print_exc()
        return 1
        
    finally:
        db.close()


if __name__ == "__main__":
    sys.exit(main())
