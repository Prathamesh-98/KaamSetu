content = ""
with open("frontend/src/api/services.ts", "r", encoding="utf-8") as f:
    content = f.read()

new_api = '''

export const shiftsApi = {
  // Worker Availability
  getMyAvailability: () => api.get('/availability/me').then(res => res.data),
  createAvailability: (data: any) => api.post('/availability', data).then(res => res.data),
  updateAvailability: (id: string, data: any) => api.patch(/availability/, data).then(res => res.data),
  deleteAvailability: (id: string) => api.delete(/availability/).then(res => res.data),
  
  // Shift Bookings
  getMyBookings: () => api.get('/shift-bookings/me').then(res => res.data),
  requestShift: (data: any) => api.post('/shift-bookings', data).then(res => res.data),
  acceptShift: (id: string) => api.post(/shift-bookings//accept).then(res => res.data),
  declineShift: (id: string) => api.post(/shift-bookings//decline).then(res => res.data),
  cancelShift: (id: string) => api.post(/shift-bookings//cancel).then(res => res.data),
}
'''

if "shiftsApi" not in content:
    with open("frontend/src/api/services.ts", "w", encoding="utf-8") as f:
        f.write(content + new_api)
    print("shiftsApi added.")
else:
    print("shiftsApi already exists.")
