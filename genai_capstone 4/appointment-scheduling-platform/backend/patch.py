import re

with open("services/appointment_service.py", "r") as f:
    content = f.read()

# Remove the old reschedule_appointment function entirely
content = re.sub(r"# ─── Reschedule Appointment ───────────────────────────────────────────────────.*?# ─── Provider: Update Appointment Status ─────────────────────────────────────", "# ─── Provider: Update Appointment Status ─────────────────────────────────────", content, flags=re.DOTALL)

with open("services/appointment_service.py", "w") as f:
    f.write(content)
