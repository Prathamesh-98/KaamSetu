import re

with open('frontend/src/pages/worker/WorkerProfilePage.tsx', 'r', encoding='utf-8') as f:
    content = f.read()

# Replace onBlur and add onKeyDown
new_input = '''            <input
              type="text"
              className="input w-full pl-11 rounded-xl bg-gray-50 border-gray-200 focus:bg-white focus:ring-primary-500 focus:border-primary-500 font-medium"
              placeholder={t('worker.searchAddSkills', 'Search and add skills...')}
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              onFocus={() => setShowDropdown(true)}
              onBlur={() => setShowDropdown(false)}
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
              }}
            />'''

content = re.sub(
    r'<input\s+type="text"\s+className="input w-full[^>]*?onBlur=\{\(\) => setTimeout\(\(\) => setShowDropdown\(false\), 200\)\}\s*/>',
    new_input,
    content,
    flags=re.DOTALL
)

# Replace onClick with onMouseDown
new_button = '''                  <button
                    key={skill.id}
                    type="button"
                    disabled={hasSkill || addSkillMutation.isPending}
                    onMouseDown={(e) => {
                      e.preventDefault();
                      if (!hasSkill && !addSkillMutation.isPending) {
                        addSkillMutation.mutate(skill.id);
                      }
                    }}
                    className="w-full text-left px-5 py-3 text-sm hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed flex justify-between items-center border-b border-gray-50 last:border-0 transition-colors"
                  >'''

content = re.sub(
    r'<button\s+key=\{skill\.id\}\s+type="button"\s+disabled=\{hasSkill \|\| addSkillMutation\.isPending\}\s+onClick=\{\(\) => addSkillMutation\.mutate\(skill\.id\)\}\s+className="w-full text-left[^>]*?>',
    new_button,
    content,
    flags=re.DOTALL
)

with open('frontend/src/pages/worker/WorkerProfilePage.tsx', 'w', encoding='utf-8') as f:
    f.write(content)

print("Patched successfully")
