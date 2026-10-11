import httpx
import asyncio
import uuid
import sys

BASE_URL = "http://localhost:8000/api"

def print_step(msg):
    print(f"[*] {msg}")

def print_success(msg):
    print(f"[+] {msg}")

def print_fail(msg):
    print(f"[-] {msg}")
    sys.exit(1)

async def register_and_login(c, role, email, password, full_name, phone):
    res = await c.post(f"{BASE_URL}/auth/register", json={
        "email": email,
        "password": password,
        "phone": phone,
        "role": role,
        "full_name": full_name
    })
    if res.status_code != 201:
        print_fail(f"Failed to register {role}: {res.json()}")
    print_success(f"Registered {role}: {email}")

    # Login
    res = await c.post(f"{BASE_URL}/auth/login", json={
        "email": email,
        "password": password
    })
    if res.status_code != 200:
        print_fail(f"Failed to login {role}: {res.json()}")
    
    token = res.json().get("access_token")
    print_success(f"Logged in {role}")
    return {"Authorization": f"Bearer {token}"}

async def run_tests():
    async with httpx.AsyncClient(timeout=30) as c:
        suffix = str(uuid.uuid4())[:8]
        
        # 1. Employer Journey
        print_step("Starting Employer Journey")
        emp_headers = await register_and_login(c, "EMPLOYER", f"emp_{suffix}@test.com", "Pass123!", "Test Employer", f"9{suffix[:9]}")

        # Employer profile update
        res = await c.post(f"{BASE_URL}/employers/profile", json={
            "full_name": "Test Employer",
            "organization_name": "Test Org",
            "city": "Mumbai"
        }, headers=emp_headers)
        if res.status_code in [200, 201]:
            print_success("Employer profile created")
        else:
            print_fail(f"Failed employer profile: {res.json()}")

        # Categories
        res = await c.get(f"{BASE_URL}/categories")
        cat_id = res.json()[0]["id"]

        # Post Job
        res = await c.post(f"{BASE_URL}/jobs", json={
            "title": "Need Plumber",
            "category_id": cat_id,
            "description": "Fix pipes",
            "work_type": "HOURLY",
            "city": "Mumbai",
            "state": "MH",
            "salary_type": "HOURLY",
            "salary_min": 500,
            "workers_needed": 1
        }, headers=emp_headers)
        
        if res.status_code != 201:
            print_fail(f"Failed to post job: {res.json()}")
        job_id = res.json()["id"]
        print_success(f"Job posted: {job_id}")

        # 2. Worker Journey
        print_step("Starting Worker Journey")
        wrk_headers = await register_and_login(c, "WORKER", f"wrk_{suffix}@test.com", "Pass123!", "Test Worker", f"8{suffix[:9]}")

        # Worker profile
        res = await c.post(f"{BASE_URL}/workers/profile", json={
            "full_name": "Test Worker",
            "city": "Mumbai",
            "years_experience": 2,
            "salary_type": "HOURLY"
        }, headers=wrk_headers)
        if res.status_code in [200, 201]:
            print_success("Worker profile created")
        else:
            print_fail(f"Failed worker profile: {res.json()}")

        # Save job
        res = await c.post(f"{BASE_URL}/workers/saved-jobs/{job_id}", headers=wrk_headers)
        if res.status_code == 201:
            print_success("Job saved by worker")
        else:
            print_fail(f"Failed to save job: {res.json()}")

        # Apply to job
        res = await c.post(f"{BASE_URL}/jobs/{job_id}/apply", json={"cover_note": "I can do this"}, headers=wrk_headers)
        if res.status_code == 201:
            app_id = res.json()["id"]
            print_success(f"Applied to job: {app_id}")
        else:
            print_fail(f"Failed to apply: {res.json()}")

        # Employer check applications
        res = await c.get(f"{BASE_URL}/jobs/{job_id}/applicants", headers=emp_headers)
        if res.status_code == 200 and len(res.json()) > 0:
            print_success("Employer viewed applications")
        else:
            print_fail("Failed to view applications")
        
        # Employer shortlist
        res = await c.put(f"{BASE_URL}/applications/{app_id}/status", json={"status": "SHORTLISTED"}, headers=emp_headers)
        if res.status_code == 200:
            print_success("Employer shortlisted application")
        else:
            print_fail(f"Failed to shortlist application: {res.json()}")
        
        # Employer accept
        res = await c.put(f"{BASE_URL}/applications/{app_id}/status", json={"status": "ACCEPTED"}, headers=emp_headers)
        if res.status_code == 200:
            print_success("Employer accepted application")
        else:
            print_fail(f"Failed to accept application: {res.json()}")

        print_success("E2E test completed successfully!")

if __name__ == "__main__":
    asyncio.run(run_tests())
