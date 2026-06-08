import os, sys
from dotenv import load_dotenv
load_dotenv(os.path.join(os.path.dirname(__file__), '..', '.env'))
sys.path.append(os.path.join(os.path.dirname(__file__), '..'))
import argparse
from datetime import date, time, timedelta

from sqlalchemy import inspect
from config.database import Base, SessionLocal, engine
import json
import random
from models import (
    Appointment, AppointmentHistory, Availability, Category, ServiceProvider, User,
    ServiceOffering, ProviderIntakeForm, PaymentRecord, RefundRecord,
    Organization, OrganizationRequest, OrganizationJoinRequest, ProviderReview
)
from models.appointment_extras import AppointmentServiceSelection
from models.service_provider import IndianState, IndianCity
from utils.security import hash_password


DEMO_MARKER = "[DEMO:"
DEMO_PASSWORD = "Provider123"
DEMO_CUSTOMER_PASSWORD = "Customer123"
DEMO_ADMIN_PASSWORD = "Admin123"
HEAVY_CUSTOMER_COUNT = 1000
HEAVY_PROVIDER_COUNT = 1000

DEMO_ADMIN = {
    "full_name": "Admin Operations",
    "email": "nikhilchathapuram@gmail.com",
    "phone": "+91 98765 41999",
}


def log_progress(message):
    print(f"[seed] {message}", flush=True)

CUSTOMERS = [
    {
        "full_name": "Neha Verma",
        "email": "neha.verma.customer@app-demo.com",
        "phone": "+91 98765 42001",
    },
    {
        "full_name": "Aditya Bose",
        "email": "aditya.bose.customer@app-demo.com",
        "phone": "+91 98765 42002",
    },
    {
        "full_name": "Sara Dsouza",
        "email": "sara.dsouza.customer@app-demo.com",
        "phone": "+91 98765 42003",
    },
    {
        "full_name": "Rahul Kapoor",
        "email": "rahul.kapoor.customer@app-demo.com",
        "phone": "+91 98765 42004",
    },
    {
        "full_name": "Sneha Gupta",
        "email": "sneha.gupta.customer@app-demo.com",
        "phone": "+91 98765 42005",
    },
    {
        "full_name": "Amit Singh",
        "email": "amit.singh.customer@app-demo.com",
        "phone": "+91 98765 42006",
    },
    {
        "full_name": "Pooja Desai",
        "email": "pooja.desai.customer@app-demo.com",
        "phone": "+91 98765 42007",
    },
    {
        "full_name": "Vikram Sethi",
        "email": "vikram.sethi.customer@app-demo.com",
        "phone": "+91 98765 42008",
    },
]

CATEGORIES = [
    {
        "name": "Healthcare",
        "description": "Doctors, therapists, nutritionists, and clinical consultants.",
        "icon": "stethoscope",
    },
    {
        "name": "Beauty & Wellness",
        "description": "Salons, spas, grooming, yoga, and wellness services.",
        "icon": "sparkles",
    },
    {
        "name": "Home Services",
        "description": "Repairs, cleaning, appliance care, and maintenance experts.",
        "icon": "home",
    },
    {
        "name": "Business Consulting",
        "description": "Finance, legal, career, marketing, and operations advisors.",
        "icon": "briefcase",
    },
    {
        "name": "Education",
        "description": "Tutors, coaches, trainers, and skill-development mentors.",
        "icon": "graduation-cap",
    },
]

# Categorized Organizations to eliminate cross-category mixups
ORGANIZATIONS_BY_CATEGORY = {
    "Healthcare": [
        {
            "name": "Manipal Hospitals",
            "description": "Multi-specialty healthcare chain with network of experienced doctors and specialists.",
            "location": "Bengaluru, Mumbai, Chennai",
            "contact_email": "admin@manipalhospitals.com",
            "contact_phone": "+91 80 4204 4444",
            "provider_emails": ["aisha.mehta.provider@app-demo.com", "rohan.iyer.provider@app-demo.com"],
        },
        {
            "name": "Apollo Clinics",
            "description": "Integrated network of multi-specialty clinics offering premium healthcare and diagnostics.",
            "location": "Delhi, Hyderabad, Bengaluru",
            "contact_email": "care@apolloclinics.com",
            "contact_phone": "+91 40 2360 7777",
            "provider_emails": ["kabir.singh.provider@app-demo.com"],
        }
    ],
    "Beauty & Wellness": [
        {
            "name": "Lakmé Salon",
            "description": "India's first and leading chain of beauty salons offering expert hair and skin services.",
            "location": "Mumbai, Pune, Ahmedabad",
            "contact_email": "care@lakmesalon.in",
            "contact_phone": "+91 22 6140 1234",
            "provider_emails": ["kavya.nair.provider@app-demo.com", "riya.patel.provider@app-demo.com"],
        },
        {
            "name": "Naturals Salon & Spa",
            "description": "Premium unisex salon chain delivering state-of-the-art grooming and wellness experiences.",
            "location": "Chennai, Kochi, Bengaluru",
            "contact_email": "hello@naturals.in",
            "contact_phone": "+91 44 2822 4444",
            "provider_emails": ["arjun.rao.provider@app-demo.com"],
        }
    ],
    "Home Services": [
        {
            "name": "Urban Company",
            "description": "Leading tech platform offering reliable at-home services from cleaning to repairs.",
            "location": "Delhi NCR, Mumbai, Hyderabad",
            "contact_email": "help@urbancompany.com",
            "contact_phone": "+91 124 456 7890",
            "provider_emails": ["meera.kulkarni.provider@app-demo.com", "sameer.khan.provider@app-demo.com"],
        },
        {
            "name": "TechRepair & Home Services",
            "description": "Trusted home services provider for appliance repair and cleaning across India.",
            "location": "Hyderabad, Delhi, Bangalore",
            "contact_email": "care@techrepairhome.com",
            "contact_phone": "+91 85 4567 8901",
            "provider_emails": ["siddharth.jain.provider@app-demo.com"],
        }
    ],
    "Business Consulting": [
        {
            "name": "Elite Business Advisory",
            "description": "Full-service business consulting firm specializing in startups and SMEs.",
            "location": "Ahmedabad, Chennai, multiple cities",
            "contact_email": "consult@elitebusiness.in",
            "contact_phone": "+91 99 1234 5678",
            "provider_emails": ["nisha.shah.provider@app-demo.com", "vikram.menon.provider@app-demo.com"],
        }
    ],
    "Education": [
        {
            "name": "Learning Academy India",
            "description": "Comprehensive online and offline tutoring platform for academic excellence.",
            "location": "Jaipur, Kolkata, Pan-India",
            "contact_email": "support@learningacademy.edu",
            "contact_phone": "+91 98 7654 3210",
            "provider_emails": ["priya.sharma.provider@app-demo.com"],
        }
    ]
}

# Flatten for backward compatibility where iterating over all organizations is required
ORGANIZATIONS = [org for orgs in ORGANIZATIONS_BY_CATEGORY.values() for org in orgs]

PROVIDERS = [
    {
        "full_name": "Dr. Aisha Mehta",
        "email": "aisha.mehta.provider@app-demo.com",
        "phone": "+91 98765 41001",
        "category": "Healthcare",
        "specialization": "General Physician",
        "experience_years": 12,
        "profile_description": "Primary care doctor focused on preventive health, fever management, and chronic condition follow-ups.",
        "location": "Bengaluru, Karnataka",
        "avg_rating": 4.8,
        "total_reviews": 186,
        "consultation_fee": 700,
        "late_cancel_penalty_percent": 20,
        "late_cancel_cutoff_hours": 24,
        "schedule": [(0, "09:00", "13:00", 30), (2, "10:00", "14:00", 30), (4, "15:00", "19:00", 30)],
    },
    {
        "full_name": "Dr. Rohan Iyer",
        "email": "rohan.iyer.provider@app-demo.com",
        "phone": "+91 98765 41002",
        "category": "Healthcare",
        "specialization": "Physiotherapist",
        "experience_years": 9,
        "profile_description": "Sports injury rehabilitation, posture correction, and mobility programs for desk workers and athletes.",
        "location": "Mumbai, Maharashtra",
        "avg_rating": 4.7,
        "total_reviews": 143,
        "consultation_fee": 900,
        "late_cancel_penalty_percent": 20,
        "late_cancel_cutoff_hours": 24,
        "schedule": [(1, "08:00", "12:00", 45), (3, "14:00", "18:30", 45), (5, "09:00", "13:30", 45)],
    },
    {
        "full_name": "Kavya Nair",
        "email": "kavya.nair.provider@app-demo.com",
        "phone": "+91 98765 41003",
        "category": "Beauty & Wellness",
        "specialization": "Hair Stylist & Color Specialist",
        "experience_years": 8,
        "profile_description": "Precision cuts, balayage, bridal styling, and personalized hair-care consultations.",
        "location": "Kochi, Kerala",
        "avg_rating": 4.9,
        "total_reviews": 221,
        "consultation_fee": 1200,
        "late_cancel_penalty_percent": 20,
        "late_cancel_cutoff_hours": 24,
        "schedule": [(1, "11:00", "19:00", 60), (4, "11:00", "19:00", 60), (6, "10:00", "16:00", 60)],
    },
    {
        "full_name": "Arjun Rao",
        "email": "arjun.rao.provider@app-demo.com",
        "phone": "+91 98765 41004",
        "category": "Beauty & Wellness",
        "specialization": "Yoga & Mindfulness Coach",
        "experience_years": 10,
        "profile_description": "One-on-one yoga therapy, breathwork, stress management, and beginner-friendly mobility coaching.",
        "location": "Pune, Maharashtra",
        "avg_rating": 4.6,
        "total_reviews": 98,
        "consultation_fee": 650,
        "late_cancel_penalty_percent": 20,
        "late_cancel_cutoff_hours": 24,
        "schedule": [(0, "06:30", "10:30", 60), (2, "06:30", "10:30", 60), (5, "07:00", "12:00", 60)],
    },
    {
        "full_name": "Meera Kulkarni",
        "email": "meera.kulkarni.provider@app-demo.com",
        "phone": "+91 98765 41005",
        "category": "Home Services",
        "specialization": "Appliance Repair Technician",
        "experience_years": 11,
        "profile_description": "Certified repair specialist for refrigerators, washing machines, microwaves, and kitchen appliances.",
        "location": "Hyderabad, Telangana",
        "avg_rating": 4.5,
        "total_reviews": 132,
        "consultation_fee": 500,
        "late_cancel_penalty_percent": 20,
        "late_cancel_cutoff_hours": 24,
        "schedule": [(1, "14:00", "18:00", 60), (3, "14:00", "18:00", 60), (5, "10:00", "15:00", 60)],
    },
    {
        "full_name": "Dr. Kabir Singh",
        "email": "kabir.singh.provider@app-demo.com",
        "phone": "+91 98765 41011",
        "category": "Healthcare",
        "specialization": "Dermatologist",
        "experience_years": 14,
        "profile_description": "Skin and hair care specialist, cosmetic procedures, and advanced treatments.",
        "location": "Delhi NCR",
        "avg_rating": 4.9,
        "total_reviews": 312,
        "consultation_fee": 1500,
        "late_cancel_penalty_percent": 20,
        "late_cancel_cutoff_hours": 24,
        "schedule": [(0, "10:00", "16:00", 30), (2, "10:00", "16:00", 30), (4, "10:00", "16:00", 30)],
    },
    {
        "full_name": "Riya Patel",
        "email": "riya.patel.provider@app-demo.com",
        "phone": "+91 98765 41012",
        "category": "Beauty & Wellness",
        "specialization": "Makeup Artist",
        "experience_years": 5,
        "profile_description": "Bridal, party, and editorial makeup services.",
        "location": "Ahmedabad, Gujarat",
        "avg_rating": 4.8,
        "total_reviews": 210,
        "consultation_fee": 2000,
        "late_cancel_penalty_percent": 20,
        "late_cancel_cutoff_hours": 24,
        "schedule": [(4, "10:00", "20:00", 60), (5, "10:00", "20:00", 60), (6, "08:00", "22:00", 60)],
    },
    {
        "full_name": "Siddharth Jain",
        "email": "siddharth.jain.provider@app-demo.com",
        "phone": "+91 98765 41013",
        "category": "Home Services",
        "specialization": "Electrician",
        "experience_years": 8,
        "profile_description": "Home wiring, lighting installation, and electrical troubleshooting.",
        "location": "Bengaluru, Karnataka",
        "avg_rating": 4.5,
        "total_reviews": 189,
        "consultation_fee": 450,
        "late_cancel_penalty_percent": 20,
        "late_cancel_cutoff_hours": 24,
        "schedule": [(1, "09:00", "18:00", 60), (3, "09:00", "18:00", 60), (5, "09:00", "18:00", 60)],
    },
    {
        "full_name": "Sameer Khan",
        "email": "sameer.khan.provider@app-demo.com",
        "phone": "+91 98765 41006",
        "category": "Home Services",
        "specialization": "Deep Cleaning Supervisor",
        "experience_years": 7,
        "profile_description": "Home deep-cleaning, move-in cleaning, sofa shampooing, and sanitization service planning.",
        "location": "Delhi NCR",
        "avg_rating": 4.4,
        "total_reviews": 87,
        "consultation_fee": 400,
        "late_cancel_penalty_percent": 20,
        "late_cancel_cutoff_hours": 24,
        "schedule": [(2, "09:00", "17:00", 60), (4, "09:00", "17:00", 60), (6, "09:00", "14:00", 60)],
    },
    {
        "full_name": "Nisha Shah",
        "email": "nisha.shah.provider@app-demo.com",
        "phone": "+91 98765 41007",
        "category": "Business Consulting",
        "specialization": "Startup Finance Advisor",
        "experience_years": 13,
        "profile_description": "Financial modelling, pricing, fundraising readiness, and founder-friendly cash-flow planning.",
        "location": "Ahmedabad, Gujarat",
        "avg_rating": 4.8,
        "total_reviews": 164,
        "consultation_fee": 2500,
        "late_cancel_penalty_percent": 20,
        "late_cancel_cutoff_hours": 24,
        "schedule": [(1, "10:00", "16:00", 60), (3, "10:00", "16:00", 60), (5, "11:00", "15:00", 60)],
    },
    {
        "full_name": "Vikram Menon",
        "email": "vikram.menon.provider@app-demo.com",
        "phone": "+91 98765 41008",
        "category": "Business Consulting",
        "specialization": "Legal Consultant",
        "experience_years": 15,
        "profile_description": "Contract review, business registrations, compliance basics, and practical legal advisory for SMEs.",
        "location": "Chennai, Tamil Nadu",
        "avg_rating": 4.7,
        "total_reviews": 119,
        "consultation_fee": 3000,
        "late_cancel_penalty_percent": 20,
        "late_cancel_cutoff_hours": 24,
        "schedule": [(0, "16:00", "20:00", 60), (2, "16:00", "20:00", 60), (4, "16:00", "20:00", 60)],
    },
    {
        "full_name": "Priya Sharma",
        "email": "priya.sharma.provider@app-demo.com",
        "phone": "+91 98765 41009",
        "category": "Education",
        "specialization": "Mathematics Tutor",
        "experience_years": 9,
        "profile_description": "CBSE and ICSE mathematics coaching for grades 8-12, exam prep, and concept strengthening.",
        "location": "Jaipur, Rajasthan",
        "avg_rating": 4.9,
        "total_reviews": 203,
        "consultation_fee": 800,
        "late_cancel_penalty_percent": 20,
        "late_cancel_cutoff_hours": 24,
        "schedule": [(0, "17:00", "21:00", 60), (2, "17:00", "21:00", 60), (6, "10:00", "14:00", 60)],
    },
    {
        "full_name": "Ananya Sen",
        "email": "ananya.sen.provider@app-demo.com",
        "phone": "+91 98765 41010",
        "category": "Education",
        "specialization": "English Communication Coach",
        "experience_years": 6,
        "profile_description": "Spoken English, interview preparation, presentation confidence, and workplace communication.",
        "location": "Kolkata, West Bengal",
        "avg_rating": 4.6,
        "total_reviews": 76,
        "consultation_fee": 750,
        "late_cancel_penalty_percent": 20,
        "late_cancel_cutoff_hours": 24,
        "schedule": [(1, "18:00", "21:00", 45), (3, "18:00", "21:00", 45), (5, "10:00", "13:45", 45)],
    },
]

FIRST_NAMES = ["Aarav", "Vivaan", "Aditya", "Vihaan", "Arjun", "Sai", "Reyansh", "Ayaan", "Krishna", "Ishaan", "Shaurya", "Atharva", "Ananya", "Myra", "Aarohi", "Diya", "Navya", "Riya", "Kavya", "Saanvi", "Priya", "Neha", "Pooja", "Rahul", "Amit", "Vikram", "Kabir", "Sneha", "Kriti", "Rohit", "Virat", "Dhoni"]
LAST_NAMES = ["Sharma", "Verma", "Gupta", "Singh", "Kumar", "Patel", "Desai", "Mehta", "Iyer", "Nair", "Rao", "Reddy", "Chauhan", "Yadav", "Joshi", "Bose", "Chatterjee", "Sengupta", "Das", "Jain", "Shah", "Agarwal", "Kapoor", "Malhotra"]
CITIES = ["Mumbai", "Bengaluru", "Pune", "Delhi", "Hyderabad", "Chennai", "Ahmedabad", "Kolkata", "Jaipur", "Surat"]

CATEGORY_SPECS = {
    "Healthcare": ["General Physician", "Dermatologist", "Pediatrician", "Dentist", "Physiotherapist", "Cardiologist", "Orthopedic", "Psychiatrist"],
    "Beauty & Wellness": ["Makeup Artist", "Hair Stylist", "Yoga Coach", "Massage Therapist", "Nail Artist", "Dietitian", "Fitness Trainer"],
    "Home Services": ["Electrician", "Plumber", "Appliance Repair", "Deep Cleaning Supervisor", "Pest Control", "Carpenter"],
    "Business Consulting": ["Startup Finance Advisor", "Legal Consultant", "Marketing Expert", "Tax Advisor", "HR Consultant", "Business Coach"],
    "Education": ["Mathematics Tutor", "English Communication Coach", "Science Tutor", "Music Teacher", "Art Instructor", "Coding Instructor"]
}

def append_unique(items, value):
    if value not in items:
        items.append(value)


def parse_seed_location(location_str: str):
    loc_map = {
        "bengaluru": (IndianCity.BENGALURU, IndianState.KARNATAKA, "560001"),
        "mumbai": (IndianCity.MUMBAI, IndianState.MAHARASHTRA, "400001"),
        "kochi": (IndianCity.KOCHI, IndianState.KERALA, "682001"),
        "pune": (IndianCity.PUNE, IndianState.MAHARASHTRA, "411001"),
        "hyderabad": (IndianCity.HYDERABAD, IndianState.TELANGANA, "500001"),
        "delhi": (IndianCity.DELHI, IndianState.DELHI, "110001"),
        "ahmedabad": (IndianCity.AHMEDABAD, IndianState.GUJARAT, "380001"),
        "chennai": (IndianCity.CHENNAI, IndianState.TAMIL_NADU, "600001"),
        "jaipur": (IndianCity.JAIPUR, IndianState.RAJASTHAN, "302001"),
        "kolkata": (IndianCity.KOLKATA, IndianState.WEST_BENGAL, "700001"),
        "surat": (IndianCity.SURAT, IndianState.GUJARAT, "395001"),
    }
    cleaned = location_str.lower()
    for key, val in loc_map.items():
        if key in cleaned:
            return val
    return IndianCity.BENGALURU, IndianState.KARNATAKA, "560001"


for i in range(HEAVY_PROVIDER_COUNT):
    first = random.choice(FIRST_NAMES)
    last = random.choice(LAST_NAMES)
    full_name = f"Dr. {first} {last}" if random.random() < 0.4 else f"{first} {last}"
    email = f"provider_{i+1:04d}@app-demo.com"
    phone = f"+91 98{random.randint(10000000, 99999999)}"
    category = random.choice(list(CATEGORY_SPECS.keys()))
    specialization = random.choice(CATEGORY_SPECS[category])
    experience = random.randint(2, 25)
    location = random.choice(CITIES)
    rating = round(random.uniform(3.8, 5.0), 1)
    reviews = random.randint(12, 500)
    fee = random.choice([350, 500, 800, 1000, 1500, 2000, 2500])
    
    # Generate random schedule (3 slots)
    schedule = []
    days = random.sample(range(7), 3)
    for day in days:
        start_hour = random.randint(7, 16)
        end_hour = start_hour + random.randint(2, 6)
        schedule.append((day, f"{start_hour:02d}:00", f"{end_hour:02d}:00", random.choice([30, 45, 60])))

    # FIX: Select an organization belonging specifically to this provider's category
    org = random.choice(ORGANIZATIONS_BY_CATEGORY[category])
    append_unique(org["provider_emails"], email)

    city_enum, state_enum, pincode_str = parse_seed_location(location)

    PROVIDERS.append({
        "full_name": full_name,
        "email": email,
        "phone": phone,
        "category": category,
        "specialization": specialization,
        "experience_years": experience,
        "profile_description": f"Experienced {specialization} based in {location} with {experience} years of practice.",
        "location": f"{city_enum.value}, {state_enum.value}",
        "state": state_enum,
        "city": city_enum,
        "pincode": pincode_str,
        "organization_name": org["name"],
        "owner_name": full_name,
        "address": f"123 Main St, {city_enum.value}, {state_enum.value}",
        "tax_number": f"GSTIN{random.randint(100000, 999999)}",
        "bank_details": f"HDFC BANK A/C {random.randint(100000000, 999999999)}",
        "identity_proof_url": "/uploads/demo_identity.pdf",
        "certificates_urls": "/uploads/demo_cert.pdf",
        "profile_photo_url": "/uploads/demo_photo.pdf",
        "avg_rating": rating,
        "total_reviews": reviews,
        "consultation_fee": fee,
        "schedule": schedule,
    })


def parse_time(value: str) -> time:
    hour, minute = value.split(":")
    return time(int(hour), int(minute))


def validate_schema():
    required_schema = {
        "users": {
            "id", "full_name", "email", "password_hash", "phone", "role",
            "is_active", "otp_hash", "otp_expiry", "created_at", "updated_at",
        },
        "categories": {
            "id", "name", "description", "icon", "is_active", "created_at", "updated_at",
        },
        "organizations": {
            "id", "name", "description", "location", "logo_url", "admin_user_id",
            "contact_email", "contact_phone", "is_active", "is_approved", "approval_status",
            "metadata_json", "created_at", "updated_at",
        },
        "organization_requests": {
            "id", "organization_id", "request_type", "status", "requested_by",
            "approved_by", "requested_changes", "approval_notes", "created_at", "updated_at",
        },
        "service_providers": {
            "id", "user_id", "category_id", "organization_id", "specialization", "experience_years",
            "profile_description", "location", "profile_photo_url", "avg_rating",
            "total_reviews", "consultation_fee", "is_verified",
            "is_accepting_appointments", "created_at", "updated_at",
            "state", "city", "pincode", "organization_name", "owner_name",
            "address", "tax_number", "bank_details", "identity_proof_url", "certificates_urls",
        },
        "availability_slots": {
            "id", "provider_id", "day_of_week", "start_time", "end_time",
            "slot_duration_minutes", "is_active", "created_at", "updated_at",
        },
        "appointments": {
            "id", "customer_id", "provider_id", "category_id", "appointment_date",
            "time_slot", "status", "notes", "cancellation_reason", "is_paid",
            "razorpay_order_id", "razorpay_payment_id", "consultation_fee_snapshot",
            "penalty_fee_amount", "penalty_reason",
            "created_at", "updated_at",
        },
        "appointment_history": {
            "id", "appointment_id", "previous_status", "new_status",
            "changed_by", "notes", "created_at",
        },
        "provider_reviews": {
            "id", "appointment_id", "provider_id", "customer_id", "rating", "comment", "created_at",
        },
        "appointment_service_selection": {
            "id", "appointment_id", "offering_id", "service_title", "duration_minutes",
            "service_price_snapshot", "created_at",
        },
    }

    inspector = inspect(engine)
    existing_tables = set(inspector.get_table_names())
    missing_tables = sorted(set(required_schema) - existing_tables)
    if missing_tables:
        raise RuntimeError(
            "Missing required tables: "
            + ", ".join(missing_tables)
            + ". Start the FastAPI backend once or allow this seed script to create tables."
        )

    missing_columns = {}
    for table_name, required_columns in required_schema.items():
        existing_columns = {column["name"] for column in inspector.get_columns(table_name)}
        missing = sorted(required_columns - existing_columns)
        if missing:
            missing_columns[table_name] = missing

    if missing_columns:
        details = "; ".join(
            f"{table}: {', '.join(columns)}"
            for table, columns in missing_columns.items()
        )
        raise RuntimeError(
            "Database schema does not match the SQLAlchemy models. Missing columns: "
            + details
            + ". If this is a local demo DB, recreate/migrate the schema before seeding."
        )


def reset_demo_data(db):
    db.query(PaymentRecord).filter(PaymentRecord.status == "pending").delete(synchronize_session=False)

    demo_emails = [DEMO_ADMIN["email"]]
    demo_emails.extend(customer["email"] for customer in CUSTOMERS)
    demo_emails.extend(provider["email"] for provider in PROVIDERS)
    
    all_demo_users = db.query(User).filter(User.email.like("%@app-demo.com")).all()
    demo_emails.extend(u.email for u in all_demo_users)
    demo_emails = list(set(demo_emails))

    demo_appointments = db.query(Appointment).filter(
        Appointment.notes.like(f"{DEMO_MARKER}%")
    ).all()
    demo_appointment_ids = [appointment.id for appointment in demo_appointments]
    if demo_appointment_ids:
        db.query(AppointmentServiceSelection).filter(
            AppointmentServiceSelection.appointment_id.in_(demo_appointment_ids)
        ).delete(synchronize_session=False)
        db.query(AppointmentHistory).filter(
            AppointmentHistory.appointment_id.in_(demo_appointment_ids)
        ).delete(synchronize_session=False)
        db.query(Appointment).filter(
            Appointment.id.in_(demo_appointment_ids)
        ).delete(synchronize_session=False)

    demo_users = db.query(User).filter(User.email.in_(demo_emails)).all()
    demo_user_ids = [user.id for user in demo_users]
    if demo_user_ids:
        demo_providers = db.query(ServiceProvider).filter(
            ServiceProvider.user_id.in_(demo_user_ids)
        ).all()
        demo_provider_ids = [provider.id for provider in demo_providers]
        if demo_provider_ids:
            db.query(Availability).filter(
                Availability.provider_id.in_(demo_provider_ids)
            ).delete(synchronize_session=False)
            db.query(ServiceProvider).filter(
                ServiceProvider.id.in_(demo_provider_ids)
            ).delete(synchronize_session=False)

        db.query(User).filter(User.id.in_(demo_user_ids)).delete(synchronize_session=False)

    demo_org_names = [org["name"] for org in ORGANIZATIONS]
    db.query(Organization).filter(
        Organization.name.in_(demo_org_names)
    ).delete(synchronize_session=False)

    db.flush()


def upsert_organizations(db, provider_map):
    organizations_by_name = {}
    
    for org_data in ORGANIZATIONS:
        org = db.query(Organization).filter(Organization.name == org_data["name"]).first()
        if not org:
            org = Organization(name=org_data["name"])
            db.add(org)
        
        org.description = org_data["description"]
        org.location = org_data["location"]
        org.contact_email = org_data["contact_email"]
        org.contact_phone = org_data["contact_phone"]
        org.is_active = True
        org.is_approved = True
        org.approval_status = "approved"
        org.onboarding_completed = True
        db.flush()
        
        organizations_by_name[org_data["name"]] = org
        
        for provider_email in org_data["provider_emails"]:
            if provider_email in provider_map:
                provider = provider_map[provider_email]
                provider.organization_id = org.id
    
    db.flush()
    return organizations_by_name


def link_organization_admins(db):
    for org_data in ORGANIZATIONS:
        org = db.query(Organization).filter(Organization.name == org_data["name"]).first()
        admin_user = db.query(User).filter(User.email == org_data["contact_email"]).first()
        if org and admin_user:
            org.admin_user_id = admin_user.id
            org.onboarding_completed = True
            org.is_approved = True
            org.approval_status = "approved"
    db.flush()


def seed_organization_join_requests(db, provider_map):
    demo_requests = [
        ("kabir.singh.provider@app-demo.com", "Apollo Clinics"),
        ("riya.patel.provider@app-demo.com", "Lakmé Salon"),
    ]
    for provider_email, org_name in demo_requests:
        provider = provider_map.get(provider_email)
        org = db.query(Organization).filter(Organization.name == org_name).first()
        if not provider or not org:
            continue
        if provider.organization_id:
            continue
        existing = db.query(OrganizationJoinRequest).filter(
            OrganizationJoinRequest.organization_id == org.id,
            OrganizationJoinRequest.provider_id == provider.id,
            OrganizationJoinRequest.status == "pending",
        ).first()
        if existing:
            continue
        db.add(
            OrganizationJoinRequest(
                organization_id=org.id,
                provider_id=provider.id,
                status="pending",
            )
        )
    db.flush()


def upsert_categories(db):
    categories_by_name = {}
    for item in CATEGORIES:
        category = db.query(Category).filter(Category.name == item["name"]).first()
        if not category:
            category = Category(name=item["name"])
            db.add(category)

        category.description = item["description"]
        category.icon = item["icon"]
        category.is_active = True
        categories_by_name[item["name"]] = category

    db.flush()
    return categories_by_name


def upsert_provider(db, provider_data, category, verbose=False):
    if verbose:
        log_progress(f"Upserting provider user: {provider_data['email']}")
    user = db.query(User).filter(User.email == provider_data["email"]).first()
    if not user:
        user = User(email=provider_data["email"])
        db.add(user)

    user.full_name = provider_data["full_name"]
    user.phone = provider_data["phone"]
    user.role = "provider"
    user.is_active = True
    if verbose:
        log_progress(f"Hashing provider password: {provider_data['email']}")
    user.password_hash = hash_password(DEMO_PASSWORD)
    user.otp_hash = None
    user.otp_expiry = None
    if verbose:
        log_progress(f"Saving provider user: {provider_data['email']}")
    db.flush()

    provider = db.query(ServiceProvider).filter(ServiceProvider.user_id == user.id).first()
    if not provider:
        provider = ServiceProvider(user_id=user.id, specialization=provider_data["specialization"])
        db.add(provider)

    provider.category_id = category.id
    provider.specialization = provider_data["specialization"]
    provider.experience_years = provider_data["experience_years"]
    provider.profile_description = provider_data["profile_description"]
    
    city_enum, state_enum, pincode_str = parse_seed_location(provider_data["location"])
    provider.state = provider_data.get("state", state_enum)
    provider.city = provider_data.get("city", city_enum)
    provider.pincode = provider_data.get("pincode", pincode_str)
    
    provider.organization_name = provider_data.get("organization_name", "")
    provider.owner_name = provider_data.get("owner_name", provider_data["full_name"])
    provider.address = provider_data.get("address", "")
    provider.tax_number = provider_data.get("tax_number", "")
    provider.bank_details = provider_data.get("bank_details", "")
    provider.identity_proof_url = provider_data.get("identity_proof_url", "")
    provider.certificates_urls = provider_data.get("certificates_urls", "")
    provider.profile_photo_url = provider_data.get("profile_photo_url", "")
    
    provider.location = f"{provider.city.value}, {provider.state.value}"

    provider.avg_rating = provider_data["avg_rating"]
    provider.total_reviews = provider_data["total_reviews"]
    provider.consultation_fee = provider_data["consultation_fee"]
    provider.is_verified = True
    provider.is_accepting_appointments = True
    provider.approval_status = "approved"
    if verbose:
        log_progress(f"Saving provider profile: {provider_data['email']}")
    db.flush()

    existing_slots = {
        slot.day_of_week: slot
        for slot in db.query(Availability).filter(Availability.provider_id == provider.id).all()
    }
    active_days = set()

    for day_of_week, start, end, duration in provider_data["schedule"]:
        active_days.add(day_of_week)
        slot = existing_slots.get(day_of_week)
        if not slot:
            slot = Availability(provider_id=provider.id, day_of_week=day_of_week)
            db.add(slot)

        slot.start_time = parse_time(start)
        slot.end_time = parse_time(end)
        slot.slot_duration_minutes = duration
        slot.is_active = True

    for day_of_week, slot in existing_slots.items():
        if day_of_week not in active_days:
            slot.is_active = False

    return provider


def seed_provider_products(db, provider, provider_data):
    primary_offering = db.query(ServiceOffering).filter(
        ServiceOffering.provider_id == provider.id,
        ServiceOffering.title == "Standard Session",
    ).first()
    if not primary_offering:
        primary_offering = ServiceOffering(provider_id=provider.id, title="Standard Session")
        db.add(primary_offering)
    primary_offering.description = f"{provider_data['specialization']} standard consultation."
    primary_offering.duration_minutes = 30
    primary_offering.price = float(provider_data["consultation_fee"] or 0)
    primary_offering.is_active = True

    intro_offering = db.query(ServiceOffering).filter(
        ServiceOffering.provider_id == provider.id,
        ServiceOffering.title == "Intro Call",
    ).first()
    if not intro_offering:
        intro_offering = ServiceOffering(provider_id=provider.id, title="Intro Call")
        db.add(intro_offering)
    intro_offering.description = "Short discovery call before full consultation."
    intro_offering.duration_minutes = 15
    intro_offering.price = max(round(float(provider_data["consultation_fee"] or 0) * 0.5, 2), 199)
    intro_offering.is_active = True

    extended_offering = db.query(ServiceOffering).filter(
        ServiceOffering.provider_id == provider.id,
        ServiceOffering.title == "Extended Session",
    ).first()
    if not extended_offering:
        extended_offering = ServiceOffering(provider_id=provider.id, title="Extended Session")
        db.add(extended_offering)
    extended_offering.description = f"In-depth {provider_data['specialization']} session with detailed follow-up."
    extended_offering.duration_minutes = 60
    extended_offering.price = round(float(provider_data["consultation_fee"] or 0) * 1.6, 2)
    extended_offering.is_active = True

    intake = db.query(ProviderIntakeForm).filter(
        ProviderIntakeForm.provider_id == provider.id,
    ).first()
    if not intake:
        intake = ProviderIntakeForm(provider_id=provider.id)
        db.add(intake)
    intake.title = f"{provider_data['specialization']} Intake"
    intake.fields_json = json.dumps([
        {"key": "goal", "label": "What is your main goal for this session?"},
        {"key": "history", "label": "Any relevant history we should know?"},
    ])
    intake.is_active = True


def upsert_user(db, user_data, role, password):
    log_progress(f"Upserting {role}: {user_data['email']}")
    user = db.query(User).filter(User.email == user_data["email"]).first()
    if not user:
        user = User(email=user_data["email"])
        db.add(user)

    user.full_name = user_data["full_name"]
    user.phone = user_data["phone"]
    user.role = role
    user.is_active = True
    log_progress(f"Hashing {role} password: {user_data['email']}")
    user.password_hash = hash_password(password)
    user.otp_hash = None
    user.otp_expiry = None
    log_progress(f"Saving {role}: {user_data['email']}")
    db.flush()
    return user


def next_weekday(day_of_week, weeks_ahead=0):
    today = date.today()
    days_ahead = (day_of_week - today.weekday()) % 7
    if days_ahead == 0:
        days_ahead = 7
    return today + timedelta(days=days_ahead + (weeks_ahead * 7))


def previous_weekday(day_of_week, weeks_back=1):
    today = date.today()
    days_back = (today.weekday() - day_of_week) % 7
    if days_back == 0:
        days_back = 7
    return today - timedelta(days=days_back + ((weeks_back - 1) * 7))


def upsert_appointment(db, key, customer, provider, appt_date, time_slot, status, notes, is_paid=False):
    marker = f"{DEMO_MARKER}{key}]"
    appointment = db.query(Appointment).filter(Appointment.notes.like(f"{marker}%")).first()
    if not appointment:
        appointment = Appointment(notes=marker)
        db.add(appointment)

    previous_status = appointment.status or status
    appointment.customer_id = customer.id
    appointment.provider_id = provider.id
    appointment.category_id = provider.category_id
    appointment.appointment_date = appt_date
    appointment.time_slot = time_slot
    appointment.status = status
    appointment.notes = f"{marker} {notes}"
    appointment.is_paid = is_paid
    appointment.consultation_fee_snapshot = float(provider.consultation_fee or 0)
    appointment.cancellation_reason = (
        "Customer requested a different date." if status == "cancelled" else None
    )
    db.flush()

    payment_rec = db.query(PaymentRecord).filter(PaymentRecord.appointment_id == appointment.id).first()
    if not payment_rec and is_paid:
        payment_rec = PaymentRecord(
            appointment_id=appointment.id,
            customer_id=customer.id,
            amount=float(provider.consultation_fee or 0),
            status="paid",
            razorpay_order_id=f"demo_order_{appointment.id[:8]}",
            razorpay_payment_id=f"demo_pay_{appointment.id[:8]}",
        )
        db.add(payment_rec)
        db.flush()

    if status == "cancelled" and is_paid:
        refund_rec = db.query(RefundRecord).filter(RefundRecord.appointment_id == appointment.id).first()
        if not refund_rec:
            refund_rec = RefundRecord(
                payment_record_id=payment_rec.id if payment_rec else None,
                appointment_id=appointment.id,
                customer_id=customer.id,
                amount=float(provider.consultation_fee or 0),
                penalty_deducted=0.0,
                reason="demo_cancel: Customer requested cancellation",
                status="processed",
            )
            db.add(refund_rec)
            if payment_rec:
                payment_rec.status = "refunded"

    existing_history = db.query(AppointmentHistory).filter(
        AppointmentHistory.appointment_id == appointment.id,
        AppointmentHistory.notes.like(f"{marker}%"),
    ).first()
    if not existing_history:
        db.add(AppointmentHistory(
            appointment_id=appointment.id,
            previous_status=previous_status,
            new_status=status,
            changed_by="demo_seed",
            notes=f"{marker} Seeded {status} appointment",
        ))

    return appointment


def seed_appointments(db, customers, providers):
    demo_items = [
        ("A1", 0, 0, 0, 0, "09:00", "confirmed", "Annual wellness consultation and medication review.", True),
        ("A2", 1, 1, 1, 0, "08:00", "confirmed", "Knee mobility assessment after weekend football injury.", True),
        ("A3", 2, 2, 4, 0, "11:00", "confirmed", "Hair color consultation before bridal styling package.", True),
        ("A4", 3, 6, 3, 0, "10:00", "confirmed", "Startup cash-flow planning for next funding quarter.", True),
        ("A5", 0, 8, 2, 1, "17:00", "confirmed", "Board exam revision plan and weak-topic diagnosis.", True),
        ("A6", 1, 4, 3, 1, "10:00", "completed", "Washing machine inspection and repair scope finalized.", True),
        ("A7", 2, 3, 5, 1, "07:00", "completed", "Introductory yoga therapy session completed.", True),
        ("A8", 3, 9, 1, 1, "18:00", "cancelled", "Interview communication session cancelled by customer.", False),
        ("A9", 0, 5, 2, 0, "09:00", "confirmed", "Deep cleaning scope and area walkthrough.", True),
        ("A10", 1, 7, 4, 0, "16:00", "confirmed", "Contract review for upcoming enterprise client.", True),
        ("A11", 2, 4, 0, 0, "10:00", "confirmed", "Microwave diagnosis and repair estimate.", True),
        ("A12", 3, 2, 1, 0, "11:00", "confirmed", "Hair transformation consultation before event.", True),
        ("A13", 0, 6, 1, 1, "10:00", "completed", "Seed-stage finance planning session closed.", True),
        ("A14", 1, 8, 6, 0, "10:00", "confirmed", "Calculus confidence-building problem set review.", True),
        ("A15", 2, 9, 3, 0, "18:00", "confirmed", "Spoken English mock interview round.", True),
        ("A16", 3, 0, 2, 1, "10:00", "completed", "Fever follow-up and medication adjustment.", True),
        ("A17", 0, 1, 3, 0, "14:00", "confirmed", "Posture correction progress check.", True),
        ("A18", 1, 3, 5, 0, "07:00", "confirmed", "Breathwork and flexibility baseline session.", True),
        ("A19", 0, 0, 0, 0, "10:30", "completed", "General checkup and vital signs review.", True),
        ("A20", 1, 1, 1, 0, "09:15", "completed", "Follow-up physiotherapy after injury recovery.", True),
        ("A21", 2, 0, 0, 1, "14:00", "confirmed", "Vaccination and immunization consultation.", True),
        ("A22", 3, 1, 1, 1, "11:00", "completed", "Back pain management strategy session.", True),
        ("A23", 0, 0, 0, 0, "15:30", "confirmed", "Allergy testing and management plan.", True),
        ("A24", 1, 1, 1, 0, "13:45", "confirmed", "Post-operative rehabilitation session.", True),
        ("A25", 2, 2, 4, 0, "15:00", "confirmed", "Blonde balayage pre-consultation.", True),
        ("A26", 2, 2, 4, 0, "16:00", "confirmed", "Bridal makeup trial and hairdo design.", True),
        ("A27", 3, 3, 5, 0, "07:00", "completed", "Morning yoga and meditation session.", True),
        ("A28", 0, 3, 5, 1, "06:30", "completed", "Evening vinyasa flow yoga practice.", True),
        ("A29", 1, 3, 5, 1, "07:15", "confirmed", "Stress-relief yoga and breathing workshop.", True),
        ("A30", 2, 3, 5, 0, "17:30", "confirmed", "Beginner yoga foundations class.", True),
        ("A31", 3, 4, 3, 0, "10:00", "completed", "Refrigerator compressor diagnosis.", True),
        ("A32", 0, 5, 2, 0, "11:00", "confirmed", "Sofa and carpet deep-cleaning service.", True),
        ("A33", 1, 4, 3, 1, "09:00", "completed", "Washing machine drum repair consultation.", True),
        ("A34", 2, 5, 2, 1, "14:00", "confirmed", "Move-in pre-cleaning walkthrough.", True),
        ("A35", 3, 4, 3, 0, "15:00", "confirmed", "Microwave servicing and parts replacement.", True),
        ("A36", 0, 6, 1, 0, "11:00", "confirmed", "Series A funding pitch review and feedback.", True),
        ("A37", 1, 7, 4, 0, "14:00", "completed", "Employment contract template walkthrough.", True),
        ("A38", 2, 6, 1, 1, "10:00", "confirmed", "Tax filing and GST compliance session.", True),
        ("A39", 3, 7, 4, 1, "16:00", "confirmed", "Vendor agreement review and negotiation.", True),
        ("A40", 0, 6, 1, 0, "12:00", "completed", "Business license and registration guidance.", True),
        ("A41", 1, 8, 6, 0, "17:00", "confirmed", "Differential calculus problem-solving session.", True),
        ("A42", 2, 8, 6, 1, "18:00", "completed", "Integration and advanced calculus revision.", True),
        ("A43", 3, 9, 1, 0, "19:00", "confirmed", "Interview preparation and confidence building.", True),
        ("A44", 0, 8, 6, 0, "17:30", "confirmed", "Statistics and probability concept review.", True),
        ("A45", 1, 9, 1, 1, "18:30", "completed", "English grammar and sentence structure practice.", True),
        ("A46", 2, 0, 0, 0, "09:00", "confirmed", "Pediatric consultation and growth tracking.", True),
        ("A47", 3, 2, 4, 0, "12:00", "confirmed", "Professional hair cutting and styling.", True),
        ("A48", 0, 5, 2, 0, "16:00", "confirmed", "Home sanitization and disinfection service.", True),
        ("A49", 1, 6, 1, 0, "13:00", "completed", "Business growth strategy and roadmap planning.", True),
        ("A50", 2, 9, 1, 0, "19:00", "confirmed", "Advanced spoken English and accent coaching.", True),
    ]

    for key, customer_index, provider_index, weekday, week_offset, slot, status, notes, is_paid in demo_items:
        appt_date = (
            previous_weekday(weekday, week_offset)
            if status in ("completed", "cancelled")
            else next_weekday(weekday, week_offset)
        )
        upsert_appointment(
            db,
            key,
            customers[customer_index],
            providers[provider_index],
            appt_date,
            slot,
            status,
            notes,
            is_paid,
        )


def run_heavy_seeding(db):
    log_progress(
        f"Starting heavy demo seeding for {HEAVY_CUSTOMER_COUNT} customers and {HEAVY_PROVIDER_COUNT} providers."
    )
    
    customers_to_add = []
    default_pwd = hash_password(DEMO_CUSTOMER_PASSWORD)
    
    for i in range(HEAVY_CUSTOMER_COUNT):
        first = random.choice(FIRST_NAMES)
        last = random.choice(LAST_NAMES)
        customers_to_add.append(
            User(
                full_name=f"{first} {last}",
                email=f"customer_{i+1:04d}@app-demo.com",
                phone=f"+91 97{random.randint(10000000, 99999999)}",
                role="customer",
                is_active=True,
                auth_provider="local",
                password_hash=default_pwd,
                otp_hash=None,
                otp_expiry=None,
            )
        )
    
    db.add_all(customers_to_add)
    db.commit()
    log_progress(f"Added {len(customers_to_add)} customers.")
    
    all_customers = db.query(User).filter(User.email.like("customer_%@app-demo.com")).order_by(User.email.asc()).all()
    all_providers = db.query(ServiceProvider).all()
    
    if not all_providers:
        log_progress("No providers found to book appointments with.")
        return
        
    log_progress(f"Generating appointments for {len(all_customers)} customers...")
    
    appointments_to_add = []
    statuses = ["confirmed", "completed", "cancelled"]
    
    for customer in all_customers:
        num_appts = random.randint(1, 5)
        for appointment_index in range(num_appts):
            provider = random.choice(all_providers)
            status = "completed" if appointment_index == 0 else random.choice(statuses)
            
            if status in ["completed", "cancelled"]:
                appt_date = date.today() - timedelta(days=random.randint(1, 30))
            else:
                appt_date = date.today() + timedelta(days=random.randint(1, 30))
                
            appointments_to_add.append(
                Appointment(
                    customer_id=customer.id,
                    provider_id=provider.id,
                    category_id=provider.category_id,
                    appointment_date=appt_date,
                    time_slot=f"{random.randint(9, 16):02d}:00",
                    status=status,
                    notes="[DEMO:HEAVY_SEED] Procedurally generated appointment",
                    is_paid=(status in ["completed", "confirmed"]),
                    consultation_fee_snapshot=provider.consultation_fee
                )
            )
            
    db.add_all(appointments_to_add)
    db.flush()

    payment_records_to_add = []
    for appointment in appointments_to_add:
        if not appointment.is_paid:
            continue

        payment_records_to_add.append(
            PaymentRecord(
                appointment_id=appointment.id,
                customer_id=appointment.customer_id,
                amount=float(appointment.consultation_fee_snapshot or 0),
                status="paid",
                razorpay_order_id=f"demo_order_{appointment.id[:8]}",
                razorpay_payment_id=f"demo_pay_{appointment.id[:8]}",
            )
        )

    db.add_all(payment_records_to_add)
    db.commit()
    log_progress(f"Added {len(appointments_to_add)} random appointments.")
    log_progress(f"Added {len(payment_records_to_add)} random payment records.")


def seed_aditya(db):
    aditya = db.query(User).filter(User.email == "aditya.bose.customer@app-demo.com").first()
    providers = db.query(ServiceProvider).limit(10).all()

    if aditya and providers:
        print(f"Seeding extra test appointments for: {aditya.email}")
        appts = []
        for _ in range(2):
            p = random.choice(providers)
            appts.append(Appointment(
                customer_id=aditya.id, provider_id=p.id, category_id=p.category_id,
                appointment_date=date.today() + timedelta(days=random.randint(1, 10)),
                time_slot="10:00", status="confirmed", notes="Heavy seed test", is_paid=True,
                consultation_fee_snapshot=p.consultation_fee
            ))
        for _ in range(2):
            p = random.choice(providers)
            appts.append(Appointment(
                customer_id=aditya.id, provider_id=p.id, category_id=p.category_id,
                appointment_date=date.today() - timedelta(days=random.randint(1, 10)),
                time_slot="14:00", status="completed", notes="Heavy seed test", is_paid=True,
                consultation_fee_snapshot=p.consultation_fee
            ))
        db.add_all(appts)
        db.flush()
        db.add_all([
            PaymentRecord(
                appointment_id=appointment.id,
                customer_id=appointment.customer_id,
                amount=float(appointment.consultation_fee_snapshot or 0),
                status="paid",
                razorpay_order_id=f"demo_order_{appointment.id[:8]}",
                razorpay_payment_id=f"demo_pay_{appointment.id[:8]}",
            )
            for appointment in appts
            if appointment.is_paid
        ])
        db.commit()


def log_customer_seed_summary(db, email):
    user = db.query(User).filter(User.email == email).first()
    if not user:
        log_progress(f"Customer summary: {email} was not found.")
        return

    appointment_count = db.query(Appointment).filter(Appointment.customer_id == user.id).count()
    payment_count = db.query(PaymentRecord).filter(PaymentRecord.customer_id == user.id).count()
    paid_payment_count = db.query(PaymentRecord).filter(
        PaymentRecord.customer_id == user.id,
        PaymentRecord.status == "paid",
    ).count()
    log_progress(
        f"Customer summary: {email} has {appointment_count} appointments, "
        f"{payment_count} payment records, {paid_payment_count} paid."
    )


REVIEW_COMMENTS = [
    "Excellent experience, very professional and thorough.",
    "Highly recommended! The session was incredibly helpful.",
    "Great service, exactly what I needed.",
    "Very knowledgeable and easy to communicate with.",
    "Outstanding quality, I will definitely book again.",
    "Prompt, efficient, and results were perfect.",
    "Wonderful experience from start to finish.",
    "Very helpful and patient throughout the session.",
    "Exceeded my expectations in every way.",
    "Professional and courteous, great value for money.",
    "Solid session, addressed all my concerns clearly.",
    "Good experience overall, would recommend to others.",
    "The provider was well-prepared and very informative.",
    "Satisfied with the outcome, smooth booking process.",
    "Thorough and detailed, I felt well taken care of.",
    "Average experience, some room for improvement.",
    "Good enough, though I expected a bit more depth.",
    "Decent session, covered the basics well.",
]


def seed_service_selection(db, appointment, category_name):
    existing = db.query(AppointmentServiceSelection).filter(
        AppointmentServiceSelection.appointment_id == appointment.id
    ).first()
    if existing:
        return

    offerings = (
        db.query(ServiceOffering)
        .filter(
            ServiceOffering.provider_id == appointment.provider_id,
            ServiceOffering.is_active == True,
        )
        .all()
    )

    if offerings:
        weights = [0.70 if "Standard" in o.title else 0.30 for o in offerings]
        total_w = sum(weights) or 1
        weights = [w / total_w for w in weights]
        chosen = random.choices(offerings, weights=weights, k=1)[0]
        service_title = chosen.title
        duration = chosen.duration_minutes
        price = float(chosen.price or appointment.consultation_fee_snapshot or 0)
    else:
        service_title = "Standard Session"
        duration = 30
        price = float(appointment.consultation_fee_snapshot or 0)

    db.add(AppointmentServiceSelection(
        appointment_id=appointment.id,
        offering_id=None,
        service_title=service_title,
        duration_minutes=duration,
        service_price_snapshot=price,
    ))


def seed_provider_reviews(db, customers):
    log_progress("Seeding provider reviews for completed appointments (excluding CX_ demo appointments)...")

    CX_MARKER = f"{DEMO_MARKER}CX_"

    completed_appts = (
        db.query(Appointment)
        .filter(
            Appointment.status == "completed",
            Appointment.notes.like(f"{DEMO_MARKER}%"),
            ~Appointment.notes.like(f"{CX_MARKER}%"),
        )
        .all()
    )

    reviews_added = 0
    for appt in completed_appts:
        existing = db.query(ProviderReview).filter(
            ProviderReview.appointment_id == appt.id
        ).first()
        if existing:
            continue

        provider = db.query(ServiceProvider).filter(ServiceProvider.id == appt.provider_id).first()
        base_rating = float(provider.avg_rating) if provider else 4.5
        if base_rating >= 4.8:
            rating = random.choices([5, 5, 5, 4, 4, 3], weights=[35, 30, 20, 10, 4, 1])[0]
        elif base_rating >= 4.5:
            rating = random.choices([5, 4, 4, 3], weights=[30, 40, 20, 10])[0]
        else:
            rating = random.choices([5, 4, 3, 3], weights=[20, 40, 25, 15])[0]

        comment = random.choice(REVIEW_COMMENTS)
        db.add(ProviderReview(
            appointment_id=appt.id,
            provider_id=appt.provider_id,
            customer_id=appt.customer_id,
            rating=rating,
            comment=comment,
        ))
        reviews_added += 1

    db.flush()
    log_progress(f"Added {reviews_added} provider reviews for completed demo appointments.")


def seed_cross_appointments_for_reviews(db, customers, providers):
    log_progress("Seeding cross-appointments (named customers ↔ named providers) for reviews...")

    CROSS_PAIRS = [
        (0, 0,  8, "09:00", "CX_N_AISHA_1"),
        (0, 0, 22, "10:30", "CX_N_AISHA_2"),
        (0, 1, 14, "08:00", "CX_N_ROHAN_1"),
        (0, 5, 10, "10:00", "CX_N_KABIR_1"),
        (1, 2, 12, "11:00", "CX_A_KAVYA_1"),
        (1, 3,  9, "07:00", "CX_A_ARJUN_1"),
        (1, 8, 16, "09:00", "CX_A_PRIYA_1"),
        (1, 8,  5, "17:00", "CX_A_PRIYA_2"),
        (2, 6, 11, "10:00", "CX_S_RIYA_1"),
        (2, 4, 18, "14:00", "CX_S_MEERA_1"),
        (2, 9,  7, "18:00", "CX_S_ANANYA_1"),
        (3, 7, 13, "16:00", "CX_R_VIKRAM_1"),
        (3, 6,  6, "10:00", "CX_R_NISHA_1"),
        (3, 7, 20, "14:00", "CX_R_VIKRAM_2"),
        (4, 0,  4, "09:00", "CX_SN_AISHA_1"),
        (4, 2, 19, "11:00", "CX_SN_KAVYA_1"),
        (5, 1,  3, "08:00", "CX_AM_ROHAN_1"),
        (5, 8, 15, "09:00", "CX_AM_SAMEER_1"),
        (6, 3,  7, "07:00", "CX_P_ARJUN_1"),
        (6, 8,  2, "17:00", "CX_P_PRIYA_1"),
        (7, 6,  9, "11:00", "CX_V_NISHA_1"),
        (7, 5, 21, "10:00", "CX_V_KABIR_1"),
    ]

    today = date.today()
    added = 0
    for customer_idx, provider_idx, days_back, time_slot, key in CROSS_PAIRS:
        if customer_idx >= len(customers) or provider_idx >= len(providers):
            continue

        customer = customers[customer_idx]
        provider = providers[provider_idx]
        appt_date = today - timedelta(days=days_back)
        marker = f"{DEMO_MARKER}{key}]"

        appt = db.query(Appointment).filter(Appointment.notes.like(f"{marker}%")).first()
        if not appt:
            appt = Appointment(
                customer_id=customer.id,
                provider_id=provider.id,
                category_id=provider.category_id,
                appointment_date=appt_date,
                time_slot=time_slot,
                status="completed",
                notes=f"{marker} Completed session — ready for review",
                is_paid=True,
                consultation_fee_snapshot=float(provider.consultation_fee or 0),
            )
            db.add(appt)
            db.flush()

            db.add(PaymentRecord(
                appointment_id=appt.id,
                customer_id=customer.id,
                amount=float(provider.consultation_fee or 0),
                status="paid",
                razorpay_order_id=f"demo_order_{appt.id[:8]}",
                razorpay_payment_id=f"demo_pay_{appt.id[:8]}",
            ))

            seed_service_selection(db, appt, None)
            added += 1

    db.flush()
    log_progress(f"Added {added} cross-appointments for named customer → named provider review flow.")


def seed_recent_appointments_for_named_providers(db, customers, providers):
    log_progress("Heavy-seeding recent (30-day) appointments for named providers...")

    today = date.today()
    named_provider_count = 13

    RECENT_SEED_MARKER = f"{DEMO_MARKER}RECENT7D]"

    TIME_SLOTS = [
        ("08:00", 6), ("09:00", 12), ("09:30", 8), ("10:00", 14), ("10:30", 8),
        ("11:00", 12), ("11:30", 6), ("12:00", 5), ("13:00", 4), ("14:00", 10),
        ("14:30", 7), ("15:00", 11), ("15:30", 6), ("16:00", 9), ("16:30", 5),
        ("17:00", 8), ("17:30", 4), ("18:00", 7), ("18:30", 3), ("19:00", 4),
    ]
    slot_values = [s[0] for s in TIME_SLOTS]
    slot_weights = [s[1] for s in TIME_SLOTS]

    STATUS_POOL = (
        ["completed"] * 35 +
        ["confirmed"] * 30 +
        ["cancelled"] * 15 +
        ["pending"] * 10 +
        ["completed"] * 10
    )

    CANCEL_REASONS = [
        "Schedule conflict",
        "Personal reasons",
        "Found another provider",
        "Medical emergency",
        "Travel plans changed",
        "Work commitment",
        "Rescheduled to different date",
        "Cost concerns",
    ]

    def daily_count(d):
        weekday = d.weekday()
        if weekday < 5:
            return random.randint(3, 7)
        else:
            return random.randint(1, 3)

    recent_appts_added = []

    for provider_index in range(min(named_provider_count, len(providers))):
        provider = providers[provider_index]

        for days_back in range(30, -1, -1):
            appt_date = today - timedelta(days=days_back)
            count = daily_count(appt_date)

            for i in range(count):
                customer = customers[(provider_index * 7 + days_back * 3 + i) % len(customers)]
                time_slot = random.choices(slot_values, weights=slot_weights, k=1)[0]
                status = random.choice(STATUS_POOL)

                if days_back > 0 and status in ("pending", "confirmed"):
                    status = random.choice(["completed", "completed", "cancelled"])

                appt = Appointment(
                    customer_id=customer.id,
                    provider_id=provider.id,
                    category_id=provider.category_id,
                    appointment_date=appt_date,
                    time_slot=time_slot,
                    status=status,
                    notes=f"{RECENT_SEED_MARKER} Recent insights seed appointment",
                    is_paid=(status in ["completed", "confirmed"]),
                    consultation_fee_snapshot=float(provider.consultation_fee or 0),
                    cancellation_reason=(
                        random.choice(CANCEL_REASONS) if status == "cancelled" else None
                    ),
                )
                db.add(appt)
                recent_appts_added.append((appt, status, provider))

    db.flush()
    log_progress(f"Flushed {len(recent_appts_added)} recent appointments. Now seeding payments, reviews, selections...")

    reviews_added = 0
    for appt, status, provider_obj in recent_appts_added:
        if appt.is_paid:
            db.add(PaymentRecord(
                appointment_id=appt.id,
                customer_id=appt.customer_id,
                amount=float(appt.consultation_fee_snapshot or 0),
                status="paid",
                razorpay_order_id=f"demo_order_{appt.id[:8]}",
                razorpay_payment_id=f"demo_pay_{appt.id[:8]}",
            ))

        seed_service_selection(db, appt, None)

        if status == "completed" and appt.appointment_date < today:
            base_rating = float(provider_obj.avg_rating) if provider_obj else 4.5
            if base_rating >= 4.8:
                rating = random.choices([5, 5, 5, 4, 4, 3], weights=[30, 25, 20, 15, 8, 2])[0]
            elif base_rating >= 4.5:
                rating = random.choices([5, 5, 4, 4, 3], weights=[25, 20, 30, 15, 10])[0]
            else:
                rating = random.choices([5, 4, 4, 3, 3], weights=[15, 25, 30, 20, 10])[0]

            db.add(ProviderReview(
                appointment_id=appt.id,
                provider_id=appt.provider_id,
                customer_id=appt.customer_id,
                rating=rating,
                comment=random.choice(REVIEW_COMMENTS),
            ))
            reviews_added += 1

    db.flush()

    existing_demo_appts = (
        db.query(Appointment)
        .filter(Appointment.notes.like(f"{DEMO_MARKER}%"))
        .filter(~Appointment.notes.like(f"{RECENT_SEED_MARKER}%"))
        .all()
    )
    for appt in existing_demo_appts:
        seed_service_selection(db, appt, None)

    db.flush()
    log_progress(
        f"Heavy seed done: {len(recent_appts_added)} appointments, "
        f"{reviews_added} reviews across last 30 days for {named_provider_count} named providers."
    )


def main(reset_demo=False):
    log_progress("Creating missing database tables...")
    Base.metadata.create_all(bind=engine)
    log_progress("Validating database schema...")
    validate_schema()

    db = SessionLocal()
    try:
        if reset_demo:
            log_progress("Resetting previous demo data...")
            reset_demo_data(db)

        log_progress("Seeding categories...")
        categories_by_name = upsert_categories(db)
        log_progress("Seeding admin user...")
        upsert_user(db, DEMO_ADMIN, "admin", DEMO_ADMIN_PASSWORD)
        log_progress(f"Seeding {len(CUSTOMERS)} customers...")
        customers = []
        for customer_data in CUSTOMERS:
            customers.append(upsert_user(db, customer_data, "customer", DEMO_CUSTOMER_PASSWORD))

        log_progress(f"Seeding {len(PROVIDERS)} providers...")
        providers = []
        provider_map = {}
        for index, provider_data in enumerate(PROVIDERS, start=1):
            if index == 1 or index % 100 == 0 or index == len(PROVIDERS):
                log_progress(f"Provider batch progress: {index}/{len(PROVIDERS)}")
            provider = upsert_provider(db, provider_data, categories_by_name[provider_data["category"]])
            seed_provider_products(db, provider, provider_data)
            providers.append(provider)
            provider_map[provider_data["email"]] = provider

        log_progress(f"Seeding {len(ORGANIZATIONS)} organizations...")
        upsert_organizations(db, provider_map)
        
        for index, org in enumerate(ORGANIZATIONS, start=1):
            log_progress(f"Organization user {index}/{len(ORGANIZATIONS)}: {org['contact_email']}")
            upsert_user(
                db, 
                {"email": org["contact_email"], "full_name": org["name"], "phone": org["contact_phone"]}, 
                "organization", 
                DEMO_PASSWORD
            )

        log_progress("Linking organisation admin accounts...")
        link_organization_admins(db)
        log_progress("Seeding organisation join requests...")
        seed_organization_join_requests(db, provider_map)

        log_progress("Seeding demo appointments...")
        seed_appointments(db, customers, providers)
        log_progress("Running heavy customer and appointment seeding...")
        run_heavy_seeding(db)
        log_progress("Seeding extra test appointments...")
        seed_aditya(db)

        log_progress("Seeding recent appointments + reviews for named providers (for Insights & Reviews pages)...")
        seed_recent_appointments_for_named_providers(db, customers, providers)
        log_progress("Seeding cross-appointments (named customers ↔ named providers) for customer reviews...")
        seed_cross_appointments_for_reviews(db, customers, providers)
        log_progress("Seeding reviews for existing completed demo appointments...")
        seed_provider_reviews(db, customers)

        log_progress("Committing seed data...")
        db.commit()
        
        pending_payment_count = db.query(PaymentRecord).filter(
            PaymentRecord.status == "pending"
        ).count()
        if pending_payment_count > 0:
            raise RuntimeError(
                f"ERROR: Seeding created {pending_payment_count} pending payments! "
                "This is not allowed. All seeded payments must have a final status (paid, refunded, failed)."
            )
        log_progress("✓ Validation passed: No pending payments found in seeded data.")
        
        log_progress("Schema validation passed.")
        if reset_demo:
            log_progress("Previous demo users, providers, slots, and demo appointments were reset.")
        log_progress(f"Seeded {len(CATEGORIES)} categories, {len(ORGANIZATIONS)} organizations, and {len(PROVIDERS)} verified providers.")
        demo_appointment_count = db.query(Appointment).filter(
            Appointment.notes.like(f"{DEMO_MARKER}%")
        ).count()
        total_demo_customers = db.query(User).filter(User.email.like("customer_%@app-demo.com")).count()
        log_progress(f"Seeded {len(CUSTOMERS)} named customers, 1 admin, {total_demo_customers} generated customers, and {demo_appointment_count} demo appointments.")
        log_progress(f"Demo provider password for all seeded providers: {DEMO_PASSWORD}")
        log_progress(f"Demo customer password for all seeded customers: {DEMO_CUSTOMER_PASSWORD}")
        log_progress(f"Generated providers use the same provider password: {DEMO_PASSWORD}")
        log_progress(
            "Sample provider logins: "
            f"provider_0001@app-demo.com / {DEMO_PASSWORD}, "
            f"provider_0500@app-demo.com / {DEMO_PASSWORD}, "
            f"provider_1000@app-demo.com / {DEMO_PASSWORD}"
        )
        log_progress(f"Demo admin login: {DEMO_ADMIN['email']} / {DEMO_ADMIN_PASSWORD}")
        log_customer_seed_summary(db, "neha.verma.customer@app-demo.com")
    except Exception:
        db.rollback()
        raise
    finally:
        db.close()


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Seed Schedex demo data.")
    parser.add_argument(
        "--reset-demo",
        action="store_true",
        help="Delete only previous demo users/providers/slots/demo appointments before seeding.",
    )
    args = parser.parse_args()
    main(reset_demo=args.reset_demo)