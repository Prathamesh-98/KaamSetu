import asyncio
import httpx
import uuid

async def test():
    async with httpx.AsyncClient(timeout=30) as c:
        # Create an employer
        em = f'emp_details_{uuid.uuid4().hex[:5]}@t.com'
        r = await c.post('http://localhost:8000/api/auth/register', json={'email': em, 'password': 'Password123!', 'role': 'EMPLOYER'})
        assert r.status_code == 201, f"Register failed: {r.text}"
        tok = r.json()['access_token']
        h = {'Authorization': f'Bearer {tok}'}
        rp = await c.post('http://localhost:8000/api/employers/profile', headers=h, json={'full_name': 'Test Employer Details'})
        assert rp.status_code == 201, f"Profile failed: {rp.text}"

        # Get categories and skills
        cats = (await c.get('http://localhost:8000/api/categories')).json()
        skills = (await c.get('http://localhost:8000/api/skills', headers=h)).json()
        
        c1 = cats[0]['id']
        s1 = skills[0]['id']
        s2 = skills[1]['id']
        
        print("Creating job...")
        job_data = {
            'title': 'Master Plumber',
            'category_id': c1,
            'description': 'Advanced plumbing tasks.',
            'work_type': 'FULL_TIME',
            'city': 'Chennai',
            'state': 'Tamil Nadu',
            'salary_type': 'MONTHLY',
            'salary_min': 20000,
            'salary_max': 35000,
            'is_urgent': True,
            'required_skill_ids': [s1, s2],
            'experience_required': 5,
            'additional_requirements': 'Must have own tools.'
        }
        rj = await c.post('http://localhost:8000/api/jobs', headers=h, json=job_data)
        assert rj.status_code == 201, f"Create job failed: {rj.text}"
        job_id = rj.json()['id']
        
        print(f"Testing GET /jobs/{job_id} ...")
        
        # Create a worker to test fetching job details
        w_em = f'worker_details_{uuid.uuid4().hex[:5]}@t.com'
        rw = await c.post('http://localhost:8000/api/auth/register', json={'email': w_em, 'password': 'Password123!', 'role': 'WORKER'})
        assert rw.status_code == 201, f"Register failed: {rw.text}"
        w_tok = rw.json()['access_token']
        w_h = {'Authorization': f'Bearer {w_tok}'}
        
        # 1. Valid Job Request
        r_get = await c.get(f'http://localhost:8000/api/jobs/{job_id}', headers=w_h)
        assert r_get.status_code == 200, f"GET job failed: {r_get.text}"
        data = r_get.json()
        
        assert data['title'] == 'Master Plumber'
        assert data['employer']['full_name'] == 'Test Employer Details'
        assert data['category']['id'] == c1
        assert data['additional_requirements'] == 'Must have own tools.'
        assert len(data['required_skills']) == 2
        assert any(sk['skill']['id'] == s1 for sk in data['required_skills'])
        assert any(sk['skill']['id'] == s2 for sk in data['required_skills'])
        print("[1] Valid Job Request (200 OK) + Full Payload: PASS")
        
        # 2. View Count Increment Verification
        r_get_2 = await c.get(f'http://localhost:8000/api/jobs/{job_id}', headers=w_h)
        data_2 = r_get_2.json()
        assert data_2['views_count'] > data['views_count']
        print("[2] Views Count Incremented: PASS")
        
        # 3. Invalid UUID Request (422)
        r_inv = await c.get('http://localhost:8000/api/jobs/invalid-id-format', headers=w_h)
        assert r_inv.status_code == 422
        print("[3] Invalid UUID Request (422): PASS")
        
        # 4. Non-existent Job Request (404)
        r_404 = await c.get(f'http://localhost:8000/api/jobs/{uuid.uuid4()}', headers=w_h)
        assert r_404.status_code == 404
        print("[4] Non-existent Job Request (404): PASS")
        
        print("\nAll Job Details tests passed successfully!")

asyncio.run(test())
