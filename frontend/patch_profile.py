filepath = "src/pages/worker/WorkerProfilePage.tsx"
with open(filepath, "r", encoding="utf-8") as f:
    content = f.read()

# We need to add job_alerts_enabled to the profile update form and initial state.
# Let's see how formData is defined.
import re

# Add job_alerts_enabled to initial state
content = re.sub(
    r'(const \[formData, setFormData\] = useState<any>\(\{.*?)(}\);)',
    r'\1  job_alerts_enabled: profile?.job_alerts_enabled ?? true,\n\2',
    content,
    flags=re.DOTALL
)

# Also update useEffect when profile changes
content = re.sub(
    r'(setFormData\(\{.*?)(}\))',
    r'\1  job_alerts_enabled: profile?.job_alerts_enabled ?? true,\n\2',
    content,
    flags=re.DOTALL
)

# Now inject the UI for Job Alerts preference in the Basic Info form
toggle_ui = """
        <div>
          <label className="flex items-center gap-2 mt-4 cursor-pointer">
            <input 
              type="checkbox" 
              className="w-5 h-5 text-primary-600 rounded focus:ring-primary-500"
              checked={formData.job_alerts_enabled}
              onChange={(e) => setFormData({ ...formData, job_alerts_enabled: e.target.checked })}
            />
            <span className="text-sm font-medium text-gray-700">{t('worker.jobAlerts', 'Enable Smart Job Alerts')}</span>
          </label>
          <p className="text-xs text-gray-500 mt-1 ml-7">{t('worker.jobAlertsDesc', 'Receive notifications when new jobs match your skills and location.')}</p>
        </div>
"""

content = content.replace(
    '</form>\n          </div>\n        </div>\n      </div>',
    f'{toggle_ui}\n          </form>\n          </div>\n        </div>\n      </div>'
)

with open(filepath, "w", encoding="utf-8") as f:
    f.write(content)
print("Patched WorkerProfilePage.tsx")
