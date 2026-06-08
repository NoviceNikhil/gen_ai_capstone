import sys
import json
from pathlib import Path

_parent = str(Path(__file__).resolve().parents[2])
if _parent not in sys.path:
    sys.path.insert(0, _parent)

from schedully.backend.generator import _answer_from_tool_results

def test():
    tool_results = [
        {
            "source": "[Live: get_appointments]",
            "text": json.dumps({
                "success": True,
                "data": {
                    "total": 239,
                    "page": 1,
                    "total_pages": 24,
                    "appointments": [
                        {
                            "date": "2026-06-17",
                            "time": "17:00",
                            "status": "confirmed",
                            "provider": "Sameer Khan",
                            "specialization": "Deep Cleaning Supervisor",
                            "customer": "Customer",
                            "is_paid": True,
                            "notes": "[DEMO:A5] Board exam revision plan"
                        }
                    ]
                }
            })
        }
    ]
    
    ans = _answer_from_tool_results("what are my upcoming appointments", tool_results)
    print("Direct Formatted Answer:")
    print(ans)

if __name__ == "__main__":
    test()
