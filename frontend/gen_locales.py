import json
import os

languages = ["en", "hi", "mr", "kn", "te"]
base_keys = {
    "nav": {
        "dashboard": "Dashboard",
        "profile": "Profile",
        "findJobs": "Find Jobs",
        "myApplications": "My Applications",
        "savedJobs": "Saved Jobs",
        "myJobs": "My Jobs",
        "postJob": "Post Job",
        "applicants": "Applicants",
        "settings": "Settings",
        "logout": "Logout",
        "login": "Log In",
        "findWork": "Find Work",
        "hireWorkers": "Hire Workers"
    },
    "auth": {
        "login": "Login",
        "register": "Register"
    },
    "enums": {
        "status": {
            "ACTIVE": "Active",
            "DRAFT": "Draft",
            "CLOSED": "Closed",
            "CANCELLED": "Cancelled",
            "PENDING": "Pending",
            "SHORTLISTED": "Shortlisted",
            "ACCEPTED": "Accepted",
            "REJECTED": "Rejected",
            "WITHDRAWN": "Withdrawn",
            "COMPLETED": "Completed"
        },
        "workType": {
            "FULL_TIME": "Full Time",
            "PART_TIME": "Part Time",
            "DAILY": "Daily",
            "HOURLY": "Hourly",
            "PROJECT": "Project",
            "TEMPORARY": "Temporary",
            "REMOTE": "Remote",
            "LOCAL": "Local"
        },
        "salaryType": {
            "HOURLY": "per hour",
            "DAILY": "per day",
            "MONTHLY": "per month",
            "PROJECT": "per project",
            "FIXED": "fixed"
        }
    },
    "matching": {
        "skills": {
            "none_required": "This job has no specific required skills.",
            "matched": "You match {{matched}} of {{total}} required skills."
        },
        "location": {
            "not_set": "Your location is not set, so this factor was not penalized.",
            "exact": "The job is located in your city ({{city}}).",
            "state_only": "The job is in your state ({{state}}), but a different city.",
            "mismatch": "The job is located in {{city}}, {{state}}."
        },
        "experience": {
            "none_required": "This job does not require prior experience.",
            "meets": "Your experience ({{worker_exp}} years) meets the required {{req_exp}} years.",
            "missing": "This job requires {{req_exp}} years of experience.",
            "partial": "You have {{worker_exp}} years of experience, but the job prefers {{req_exp}} years."
        },
        "salary": {
            "fits_range": "The job's salary range fits your expectations.",
            "above_max": "Your expected salary is above the job's offered maximum.",
            "meets_min": "The job's starting salary meets your expectations.",
            "above_min": "Your expected salary is above the job's offered starting amount."
        },
        "work_type": {
            "matches": "The job's work type matches your preferences.",
            "mismatch": "The job's work type is not in your listed preferences."
        },
        "availability": {
            "available": "You are currently marked as Available.",
            "busy": "You are currently marked as Busy.",
            "unavailable": "You are currently marked as Unavailable."
        }
    }
}

os.makedirs("src/i18n/locales", exist_ok=True)
for lang in languages:
    filepath = f"src/i18n/locales/{lang}.json"
    if not os.path.exists(filepath):
        with open(filepath, "w", encoding="utf-8") as f:
            json.dump(base_keys, f, indent=2, ensure_ascii=False)
            
print("Base JSON files created.")
