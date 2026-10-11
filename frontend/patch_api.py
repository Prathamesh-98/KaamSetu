filepath = "src/api/services.ts"
with open(filepath, "r", encoding="utf-8") as f:
    content = f.read()

import re
content = content.replace(
    "markAllRead: () =>",
    "getUnreadCount: () => api.get<{count: number}>('/notifications/unread-count').then(r => r.data),\n  markAllRead: () =>"
)

with open(filepath, "w", encoding="utf-8") as f:
    f.write(content)
print("Patched notificationsApi")
