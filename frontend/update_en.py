import json
import os

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
        "hireWorkers": "Hire Workers",
        "howItWorks": "How It Works",
        "about": "About"
    },
    "landing": {
      "hero": {
        "badge": "India's Fastest Growing Workforce Marketplace",
        "title": "Connecting Workers",
        "titleHighlight": "with Opportunities",
        "description": "Find reliable local talent or discover work opportunities based on your skills, location, and availability — not just a resume.",
        "findWork": "Find Work Near Me",
        "postJob": "Post a Job",
        "verifiedWorkers": "Verified Workers",
        "ratedReviewed": "Rated & Reviewed",
        "locationBased": "Location-Based"
      },
      "stats": {
        "workers": "Registered Workers",
        "jobs": "Jobs Posted",
        "hires": "Successful Hires",
        "rating": "Average Rating"
      },
      "howItWorks": {
        "badge": "How It Works",
        "title": "Simple. Fast. Effective.",
        "description": "Whether you're looking for work or looking to hire, KaamSetu makes it happen in three simple steps.",
        "forWorkers": "For Workers",
        "wStep1Title": "Create Your Profile",
        "wStep1Desc": "Add your skills, experience, location, and availability in minutes.",
        "wStep2Title": "Discover Nearby Jobs",
        "wStep2Desc": "Browse jobs matched to your skills and location with smart filtering.",
        "wStep3Title": "Apply & Get Hired",
        "wStep3Desc": "Apply with one click, chat with employers, and start earning.",
        "wBtn": "Start Finding Work",
        "forEmployers": "For Employers",
        "eStep1Title": "Post Your Job",
        "eStep1Desc": "Describe what you need, set budget, location, and required skills.",
        "eStep2Title": "Find Matched Workers",
        "eStep2Desc": "See ranked applicants matched by skill, location, and rating.",
        "eStep3Title": "Hire & Rate",
        "eStep3Desc": "Accept the best fit, communicate directly, and rate after completion.",
        "eBtn": "Post Your First Job"
      },
      "categories": {
        "badge": "Popular Categories",
        "title": "Find Work in Your Trade",
        "description": "From skilled trades to domestic help — opportunities across every sector."
      },
      "benefits": {
        "badge": "Why KaamSetu",
        "title": "Built for India's Workforce",
        "b1Title": "Location-First Matching",
        "b1Desc": "Jobs are matched by proximity. Find work within walking/commuting distance from your home.",
        "b2Title": "Instant Applications",
        "b2Desc": "Apply to jobs in one tap. No lengthy forms, no cover letters required — just your profile.",
        "b3Title": "Verified & Trusted",
        "b3Desc": "Worker profiles are verified. Employer ratings are transparent. Build trust on both sides.",
        "b4Title": "Smart Matching Score",
        "b4Desc": "Our transparent scoring explains exactly why you're a 92% match — skill, distance, availability.",
        "b5Title": "Skill-Based Discovery",
        "b5Desc": "Add your skills, get discovered. Workers with rare skills appear in front of relevant employers.",
        "b6Title": "Inclusive Employment",
        "b6Desc": "Designed for women returning to work, students, and anyone seeking flexible opportunities."
      },
      "testimonials": {
        "badge": "Success Stories",
        "title": "Real People, Real Opportunities"
      },
      "trust": {
        "badge": "Trust & Safety",
        "title": "Your Safety is Our Priority",
        "t1": "Worker profiles are manually verified by our team",
        "t2": "Employer ratings and reviews are transparent",
        "t3": "All communications happen within the platform",
        "t4": "Dispute resolution support available",
        "t5": "No sensitive documents stored unnecessarily",
        "t6": "Secure payments protection (coming soon)",
        "cardTitle": "Verified Platform",
        "cardDesc": "We verify worker identities, skills, and backgrounds so employers can hire with confidence.",
        "stat1": "Satisfaction Rate",
        "stat2": "Avg. Hire Time"
      },
      "cta": {
        "title": "Ready to Get Started?",
        "description": "Join thousands of workers and employers already using KaamSetu.",
        "findWork": "Find Work Now",
        "hireWorkers": "Hire Workers"
      }
    },
    "auth": {
        "login": "Log In",
        "register": "Register",
        "email": "Email Address",
        "password": "Password",
        "noAccount": "Don't have an account?",
        "hasAccount": "Already have an account?",
        "registerWorker": "Register as Worker",
        "registerEmployer": "Register as Employer"
    },
    "worker": {
      "dashboard": "Worker Dashboard",
      "welcome": "Welcome back",
      "profileCompletion": "Profile Completion",
      "activeApplications": "Active Applications",
      "savedJobs": "Saved Jobs",
      "recommendedJobs": "Recommended Jobs",
      "recentApplications": "Recent Applications",
      "viewAll": "View All",
      "findMore": "Find More Jobs"
    },
    "employer": {
      "dashboard": "Employer Dashboard",
      "activeJobs": "Active Jobs",
      "totalApplicants": "Total Applicants",
      "recentJobs": "Recent Jobs",
      "postNew": "Post New Job"
    },
    "jobs": {
      "expectedSalary": "Expected Salary",
      "yearsExperience": "Years of Experience",
      "skills": "Skills",
      "addSkill": "Add Skill",
      "removeSkill": "Remove Skill",
      "saveProfile": "Save Profile",
      "availability": "Availability",
      "location": "Location",
      "applyNow": "Apply Now",
      "applied": "Applied",
      "saveJob": "Save Job",
      "unsaveJob": "Unsave Job"
    },
    "categories": {
      "Construction": "Construction",
      "Electrical": "Electrical",
      "Plumbing": "Plumbing",
      "Carpentry": "Carpentry",
      "Painting": "Painting",
      "Driving": "Driving",
      "Domestic Help": "Domestic Help",
      "Farming": "Farming",
      "Welding": "Welding",
      "Mechanics": "Mechanics",
      "IT & Tech": "IT & Tech",
      "Teaching": "Teaching",
      "Security": "Security",
      "Event Work": "Event Work",
      "Delivery": "Delivery",
      "Gardening": "Gardening",
      "Healthcare": "Healthcare",
      "Tailoring": "Tailoring",
      "Other": "Other"
    },
    "skills": {
      "Masonry": "Masonry", "Plastering": "Plastering", "Tiling": "Tiling",
      "Steel Fixing": "Steel Fixing", "Scaffolding": "Scaffolding",
      "Wiring": "Wiring", "Panel Installation": "Panel Installation", "Solar Installation": "Solar Installation",
      "Pipe Fitting": "Pipe Fitting", "Bathroom Installation": "Bathroom Installation", "Water Pump Repair": "Water Pump Repair",
      "Furniture Making": "Furniture Making", "Door/Window Fitting": "Door/Window Fitting", "Cabinet Making": "Cabinet Making",
      "Interior Painting": "Interior Painting", "Exterior Painting": "Exterior Painting", "Waterproofing": "Waterproofing",
      "LMV Driving": "LMV Driving", "HMV Driving": "HMV Driving", "Delivery Driving": "Delivery Driving",
      "Cooking": "Cooking", "Cleaning": "Cleaning", "Babysitting": "Babysitting",
      "Crop Harvesting": "Crop Harvesting", "Irrigation": "Irrigation", "Tractor Operation": "Tractor Operation",
      "MIG Welding": "MIG Welding", "Arc Welding": "Arc Welding", "Fabrication": "Fabrication",
      "Web Development": "Web Development", "Mobile App Development": "Mobile App Development", "Computer Repair": "Computer Repair",
      "MS Office": "MS Office", "Data Entry": "Data Entry", "Customer Service": "Customer Service"
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

with open("src/i18n/locales/en.json", "w", encoding="utf-8") as f:
    json.dump(base_keys, f, indent=2, ensure_ascii=False)
print("Updated en.json.")
