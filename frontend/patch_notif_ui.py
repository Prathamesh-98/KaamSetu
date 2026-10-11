filepath = "src/components/layout/NotificationDropdown.tsx"
with open(filepath, "r", encoding="utf-8") as f:
    content = f.read()

import re

# We will create a helper to get translated notification message
helper = """
  const getNotificationContent = (n: any) => {
    switch(n.type) {
      case 'NEW_MATCHING_JOB':
        return { title: t('notifications.NEW_MATCHING_JOB.title', n.title), body: t('notifications.NEW_MATCHING_JOB.body', n.body, { title: n.body.split("'")[1] || 'A job' }) };
      case 'NEW_APPLICATION':
        return { title: t('notifications.NEW_APPLICATION.title', n.title), body: t('notifications.NEW_APPLICATION.body', n.body) };
      case 'APPLICATION_STATUS_UPDATE':
        return { title: t('notifications.APPLICATION_STATUS_UPDATE.title', n.title), body: t('notifications.APPLICATION_STATUS_UPDATE.body', n.body) };
      case 'SHIFT_REQUESTED':
        return { title: t('notifications.SHIFT_REQUESTED.title', n.title), body: t('notifications.SHIFT_REQUESTED.body', n.body) };
      case 'SHIFT_ACCEPTED':
        return { title: t('notifications.SHIFT_ACCEPTED.title', n.title), body: t('notifications.SHIFT_ACCEPTED.body', n.body) };
      case 'SHIFT_DECLINED':
        return { title: t('notifications.SHIFT_DECLINED.title', n.title), body: t('notifications.SHIFT_DECLINED.body', n.body) };
      case 'SHIFT_CANCELLED':
        return { title: t('notifications.SHIFT_CANCELLED.title', n.title), body: t('notifications.SHIFT_CANCELLED.body', n.body) };
      default:
        return { title: n.title, body: n.body };
    }
  };
"""

content = content.replace("  const unreadCount = countData?.count || 0;", helper + "\n  const unreadCount = countData?.count || 0;")

content = re.sub(
    r'<span className="font-medium text-sm text-gray-900">\{n\.title\}</span>',
    r'<span className="font-medium text-sm text-gray-900">{getNotificationContent(n).title}</span>',
    content
)

content = re.sub(
    r'<p className="text-xs text-gray-600 line-clamp-2">\{n\.body\}</p>',
    r'<p className="text-xs text-gray-600 line-clamp-2">{getNotificationContent(n).body}</p>',
    content
)

with open(filepath, "w", encoding="utf-8") as f:
    f.write(content)
print("Added i18n support for notifications")
