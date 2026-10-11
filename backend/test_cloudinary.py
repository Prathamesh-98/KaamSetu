import httpx
import asyncio
import os

BASE_URL = "http://localhost:8000/api"

async def test_upload():
    # 1. Create a dummy image file
    dummy_image = b"\x89PNG\r\n\x1a\n\x00\x00\x00\rIHDR\x00\x00\x00\x01\x00\x00\x00\x01\x08\x06\x00\x00\x00\x1f\x15\xc4\x89\x00\x00\x00\nIDATx\x9cc\x00\x01\x00\x00\x05\x00\x01\x0d\n-\xb4\x00\x00\x00\x00IEND\xaeB`\x82"
    with open("test_image.png", "wb") as f:
        f.write(dummy_image)
        
    async with httpx.AsyncClient(timeout=30) as c:
        # Register an employer to get a token
        em = f'emp_upload@test.com'
        r = await c.post(f'{BASE_URL}/auth/register', json={'email': em, 'password': 'Password123!', 'role': 'EMPLOYER', 'full_name': 'Upload Tester', 'phone': '9998887776'})
        
        # If already exists, login
        if r.status_code != 201:
            r = await c.post(f'{BASE_URL}/auth/login', json={'email': em, 'password': 'Password123!'})
            
        token = r.json()['access_token']
        headers = {'Authorization': f'Bearer {token}'}

        # Upload
        print("[*] Uploading image...")
        files = {'file': ('test_image.png', open('test_image.png', 'rb'), 'image/png')}
        data = {'folder': 'kaamsetu/employers'}
        r = await c.post(f'{BASE_URL}/upload/image', headers=headers, files=files, data=data)
        
        if r.status_code == 200:
            print(f"[+] Upload success: {r.json()['url']}")
        else:
            print(f"[-] Upload failed: {r.status_code} - {r.text}")

        # Invalid file type test
        print("[*] Testing invalid upload (PDF)...")
        with open("test.pdf", "wb") as f:
            f.write(b"%PDF-1.4\n1 0 obj\n")
        files = {'file': ('test.pdf', open('test.pdf', 'rb'), 'application/pdf')}
        r2 = await c.post(f'{BASE_URL}/upload/image', headers=headers, files=files, data=data)
        if r2.status_code == 400:
            print(f"[+] PDF rejected correctly: {r2.text}")
        else:
            print(f"[-] PDF upload returned {r2.status_code}")

    os.remove("test_image.png")
    os.remove("test.pdf")

if __name__ == "__main__":
    asyncio.run(test_upload())
