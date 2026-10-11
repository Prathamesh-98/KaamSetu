import re

with open('frontend/src/pages/worker/WorkerProfilePage.tsx', 'r', encoding='utf-8') as f:
    content = f.read()

new_handlers = '''              onBlur={() => setShowDropdown(false)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault();
                  if (results && results.length > 0) {
                    const firstSkill = results[0];
                    const hasSkill = profile.skills.some((ws: any) => ws.skill.id === firstSkill.id);
                    if (!hasSkill && !addSkillMutation.isPending) {
                      addSkillMutation.mutate(firstSkill.id);
                    }
                  }
                }
              }}'''

content = content.replace("onBlur={() => setTimeout(() => setShowDropdown(false), 200)}", new_handlers)

with open('frontend/src/pages/worker/WorkerProfilePage.tsx', 'w', encoding='utf-8') as f:
    f.write(content)

print("Patched onBlur successfully")
