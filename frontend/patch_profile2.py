filepath = "src/pages/worker/WorkerProfilePage.tsx"
with open(filepath, "r", encoding="utf-8") as f:
    content = f.read()

# Finding the state
if "job_alerts_enabled" not in content:
    content = content.replace(
        "expected_salary: profile?.expected_salary || '',",
        "expected_salary: profile?.expected_salary || '',\n      job_alerts_enabled: profile?.job_alerts_enabled ?? true,"
    )

toggle_ui = """
        <div className="md:col-span-2">
          <label className="flex items-center gap-2 mt-2 cursor-pointer">
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
    '</form>',
    f'{toggle_ui}\n          </form>'
)

with open(filepath, "w", encoding="utf-8") as f:
    f.write(content)
print("Patched WorkerProfilePage.tsx simply")
