import os

with open('src/pages/worker/MyApplications.tsx', 'r', encoding='utf-8') as f:
    content = f.read()

# Add imports
content = content.replace(
    '// KaamSetu — My Applications Page (Worker)',
    '// KaamSetu — My Applications Page (Worker)\nimport { useState } from \'react\'\nimport { RateUserModal } from \'../../components/RateUserModal\''
)
content = content.replace(
    "import { FileText, MapPin, Clock, Briefcase, ChevronRight, Trash2, AlertCircle, MessageSquare } from 'lucide-react'",
    "import { FileText, MapPin, Clock, Briefcase, ChevronRight, Trash2, AlertCircle, MessageSquare, Star } from 'lucide-react'"
)

# Update Component Props
content = content.replace(
    'function ApplicationCard({ app }: { app: Application }) {',
    'function ApplicationCard({ app, onRate }: { app: Application, onRate: () => void }) {'
)

# Add Rate Button
rate_button = """{(app.status === 'COMPLETED' || app.status === 'ACCEPTED') && (
                  <button
                    onClick={onRate}
                    className="btn btn-secondary text-sm py-1.5 px-3 flex items-center gap-1"
                  >
                    <Star className="w-3 h-3" />
                    {t('rate', 'Rate Employer')}
                  </button>
                )}
                {app.status === 'PENDING' && ("""
content = content.replace(
    "{app.status === 'PENDING' && (",
    rate_button
)

# Add State to parent
content = content.replace(
    'export function MyApplications() {\n  const { t } = useTranslation()\n  const navigate = useNavigate()\n  const queryClient = useQueryClient()',
    'export function MyApplications() {\n  const { t } = useTranslation()\n  const navigate = useNavigate()\n  const queryClient = useQueryClient()\n  const [ratingModal, setRatingModal] = useState({ isOpen: false, appId: \'\', employerName: \'\' })'
)

# Pass onRate prop
content = content.replace(
    '<ApplicationCard key={app.id} app={app} />',
    '<ApplicationCard key={app.id} app={app} onRate={() => setRatingModal({ isOpen: true, appId: app.id, employerName: app.job?.employer?.organization_name || \'Employer\' })} />'
)

# Add Modal
modal = """
      {ratingModal.isOpen && (
        <RateUserModal
          isOpen={ratingModal.isOpen}
          onClose={() => setRatingModal({ isOpen: false, appId: '', employerName: '' })}
          applicationId={ratingModal.appId}
          userName={ratingModal.employerName}
        />
      )}
    </div>
  )
}
"""
content = content.replace(
    '    </div>\n  )\n}\n',
    modal
)

with open('src/pages/worker/MyApplications.tsx', 'w', encoding='utf-8') as f:
    f.write(content)
print("Updated MyApplications.tsx")
