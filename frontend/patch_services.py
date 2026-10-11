filepath = "src/api/services.ts"
with open(filepath, "r", encoding="utf-8") as f:
    content = f.read()

notif_api = """
export const notificationsApi = {
  getNotifications: async (unreadOnly = false) => {
    const { data } = await api.get(`/notifications?unread_only=${unreadOnly}`);
    return data;
  },
  getUnreadCount: async () => {
    const { data } = await api.get('/notifications/unread-count');
    return data;
  },
  markAsRead: async (id: string) => {
    const { data } = await api.put(`/notifications/${id}/read`);
    return data;
  },
  markAllAsRead: async () => {
    const { data } = await api.put('/notifications/read-all');
    return data;
  }
};
"""

if "notificationsApi" not in content:
    content = content + "\n" + notif_api
    with open(filepath, "w", encoding="utf-8") as f:
        f.write(content)
    print("Added notificationsApi")
