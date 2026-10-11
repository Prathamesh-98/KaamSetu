import asyncio
import httpx
import uuid

async def test():
    async with httpx.AsyncClient(timeout=30) as c:
        print("Registering Employer...")
        em = f'emp_sj_{uuid.uuid4().hex[:5]}@t.com'
        tok = (await c.post('http://localhost:8000/api/auth/register', json={'email': em, 'password': 'Password123!', 'role': 'EMPLOYER'})).json()['access_token']
        h_emp = {'Authorization': f'Bearer {tok}'}
        await c.post('http://localhost:8000/api/employers/profile', headers=h_emp, json={'full_name': 'Test Employer App'})

        print("Registering Worker 1...")
        w1 = f'worker1_sj_{uuid.uuid4().hex[:5]}@t.com'
        tok1 = (await c.post('http://localhost:8000/api/auth/register', json={'email': w1, 'password': 'Password123!', 'role': 'WORKER'})).json()['access_token']
        h_w1 = {'Authorization': f'Bearer {tok1}'}
        await c.post('http://localhost:8000/api/workers/profile', headers=h_w1, json={'full_name': 'Worker One'})

        print("Registering Worker 2...")
        w2 = f'worker2_sj_{uuid.uuid4().hex[:5]}@t.com'
        tok2 = (await c.post('http://localhost:8000/api/auth/register', json={'email': w2, 'password': 'Password123!', 'role': 'WORKER'})).json()['access_token']
        h_w2 = {'Authorization': f'Bearer {tok2}'}
        await c.post('http://localhost:8000/api/workers/profile', headers=h_w2, json={'full_name': 'Worker Two'})

        cats = (await c.get('http://localhost:8000/api/categories')).json()
        skills = (await c.get('http://localhost:8000/api/skills', headers=h_emp)).json()

        print("Creating Job...")
        job_data = {
            'title': 'Test Job for Saving',
            'category_id': cats[0]['id'],
            'description': 'Plumbing.',
            'work_type': 'FULL_TIME',
            'city': 'Chennai',
            'state': 'Tamil Nadu',
            'salary_type': 'MONTHLY',
            'salary_min': 20000,
            'workers_needed': 1,
            'required_skill_ids': [skills[0]['id']]
        }
        rj = await c.post('http://localhost:8000/api/jobs', headers=h_emp, json=job_data)
        job_id = rj.json()['id']

        # 1. Worker saves active job -> success
        print("Test 1: Worker 1 saves job")
        r_save = await c.post(f'http://localhost:8000/api/workers/saved-jobs/{job_id}', headers=h_w1)
        assert r_save.status_code == 201
        
        # 2. Worker saves same job again -> 400
        print("Test 2: Duplicate save")
        r_dup = await c.post(f'http://localhost:8000/api/workers/saved-jobs/{job_id}', headers=h_w1)
        assert r_dup.status_code == 400

        # 3. Nonexistent job -> 404
        print("Test 3: Nonexistent job")
        r_404 = await c.post(f'http://localhost:8000/api/workers/saved-jobs/{uuid.uuid4()}', headers=h_w1)
        assert r_404.status_code == 404

        # 4. List saved jobs
        print("Test 4: List saved jobs for Worker 1")
        r_list = await c.get('http://localhost:8000/api/workers/me/saved-jobs', headers=h_w1)
        assert r_list.status_code == 200
        assert len(r_list.json()) == 1
        assert r_list.json()[0]['job']['id'] == job_id
        
        # 5. Worker 2 retrieves their saved jobs -> empty
        print("Test 5: Empty saved jobs")
        r_empty = await c.get('http://localhost:8000/api/workers/me/saved-jobs', headers=h_w2)
        assert len(r_empty.json()) == 0

        # 6. Employer cannot use save endpoint -> 403
        print("Test 6: Employer authorization")
        r_emp_save = await c.post(f'http://localhost:8000/api/workers/saved-jobs/{job_id}', headers=h_emp)
        assert r_emp_save.status_code == 403

        # 7. Worker unsaves job -> 204
        print("Test 7: Unsave job")
        r_unsave = await c.delete(f'http://localhost:8000/api/workers/saved-jobs/{job_id}', headers=h_w1)
        assert r_unsave.status_code == 204
        
        # 8. Worker list should now be empty
        assert len((await c.get('http://localhost:8000/api/workers/me/saved-jobs', headers=h_w1)).json()) == 0

        # 9. Unsave nonexistent saved relationship -> 404
        print("Test 9: Unsave nonexistent")
        r_unsave2 = await c.delete(f'http://localhost:8000/api/workers/saved-jobs/{job_id}', headers=h_w1)
        assert r_unsave2.status_code == 404

        print("\nAll Saved Jobs tests passed successfully!")

asyncio.run(test())
