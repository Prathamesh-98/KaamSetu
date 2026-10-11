import asyncio
import httpx
import uuid

async def test():
    async with httpx.AsyncClient(timeout=30) as c:
        print("Registering Employer...")
        em = f'emp_app_{uuid.uuid4().hex[:5]}@t.com'
        r = await c.post('http://localhost:8000/api/auth/register', json={'email': em, 'password': 'Password123!', 'role': 'EMPLOYER'})
        assert r.status_code == 201
        emp_tok = r.json()['access_token']
        h_emp = {'Authorization': f'Bearer {emp_tok}'}
        await c.post('http://localhost:8000/api/employers/profile', headers=h_emp, json={'full_name': 'Test Employer App'})

        print("Registering Worker 1...")
        w1 = f'worker1_{uuid.uuid4().hex[:5]}@t.com'
        r1 = await c.post('http://localhost:8000/api/auth/register', json={'email': w1, 'password': 'Password123!', 'role': 'WORKER'})
        assert r1.status_code == 201
        w1_tok = r1.json()['access_token']
        h_w1 = {'Authorization': f'Bearer {w1_tok}'}
        await c.post('http://localhost:8000/api/workers/profile', headers=h_w1, json={'full_name': 'Worker One'})

        print("Registering Worker 2...")
        w2 = f'worker2_{uuid.uuid4().hex[:5]}@t.com'
        r2 = await c.post('http://localhost:8000/api/auth/register', json={'email': w2, 'password': 'Password123!', 'role': 'WORKER'})
        assert r2.status_code == 201
        w2_tok = r2.json()['access_token']
        h_w2 = {'Authorization': f'Bearer {w2_tok}'}
        await c.post('http://localhost:8000/api/workers/profile', headers=h_w2, json={'full_name': 'Worker Two'})

        # Get categories and skills
        cats = (await c.get('http://localhost:8000/api/categories')).json()
        skills = (await c.get('http://localhost:8000/api/skills', headers=h_emp)).json()
        c1 = cats[0]['id']
        s1 = skills[0]['id']

        print("Creating Job...")
        job_data = {
            'title': 'Need 1 Plumber',
            'category_id': c1,
            'description': 'Plumbing.',
            'work_type': 'FULL_TIME',
            'city': 'Chennai',
            'state': 'Tamil Nadu',
            'salary_type': 'MONTHLY',
            'salary_min': 20000,
            'workers_needed': 1,
            'required_skill_ids': [s1]
        }
        rj = await c.post('http://localhost:8000/api/jobs', headers=h_emp, json=job_data)
        assert rj.status_code == 201
        job_id = rj.json()['id']

        # 1. Worker applies to an active job -> Success
        print("Test 1: Worker 1 applies")
        ra = await c.post(f'http://localhost:8000/api/jobs/{job_id}/apply', headers=h_w1, json={'cover_note': 'I can do it'})
        assert ra.status_code == 201
        app1_id = ra.json()['id']

        # 2. Worker applies again -> 400
        print("Test 2: Duplicate apply")
        r_dup = await c.post(f'http://localhost:8000/api/jobs/{job_id}/apply', headers=h_w1, json={})
        assert r_dup.status_code == 400

        # 3. Worker 2 applies -> Success
        print("Test 3: Worker 2 applies")
        ra2 = await c.post(f'http://localhost:8000/api/jobs/{job_id}/apply', headers=h_w2, json={})
        assert ra2.status_code == 201
        app2_id = ra2.json()['id']
        
        # 4. Employer views applicants -> sees 2
        print("Test 4: Employer views applicants")
        r_apps = await c.get(f'http://localhost:8000/api/jobs/{job_id}/applicants', headers=h_emp)
        assert r_apps.status_code == 200
        assert len(r_apps.json()) == 2
        
        # 5. Employer transitions app 1 to SHORTLISTED -> ACCEPTED
        print("Test 5: App 1 to SHORTLISTED")
        r_sh = await c.put(f'http://localhost:8000/api/applications/{app1_id}/status', headers=h_emp, json={'status': 'SHORTLISTED'})
        assert r_sh.status_code == 200
        
        print("Test 6: App 1 to ACCEPTED")
        r_ac = await c.put(f'http://localhost:8000/api/applications/{app1_id}/status', headers=h_emp, json={'status': 'ACCEPTED'})
        assert r_ac.status_code == 200
        
        # 7. Employer tries to accept App 2 but limit is reached
        print("Test 7: App 2 limit enforcement")
        await c.put(f'http://localhost:8000/api/applications/{app2_id}/status', headers=h_emp, json={'status': 'SHORTLISTED'})
        r_ac2 = await c.put(f'http://localhost:8000/api/applications/{app2_id}/status', headers=h_emp, json={'status': 'ACCEPTED'})
        assert r_ac2.status_code == 400, f"Expected 400 due to limit, got {r_ac2.status_code}"

        print("\nAll Applications tests passed successfully!")

asyncio.run(test())
