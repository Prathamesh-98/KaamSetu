import os

with open('src/pages/employer/JobApplicantsPage.tsx', 'r', encoding='utf-8') as f:
    content = f.read()

# Add imports
content = content.replace(
    "import { Users, FileText, CheckCircle, XCircle, ChevronLeft, MapPin, Search, Filter, MessageSquare } from 'lucide-react'",
    "import { Users, FileText, CheckCircle, XCircle, ChevronLeft, MapPin, Search, Filter, MessageSquare, Star } from 'lucide-react'\nimport { useState } from 'react'\nimport { RateUserModal } from '../../components/RateUserModal'"
)

# Add Rate Button
rate_button = """{(app.status === 'COMPLETED' || app.status === 'ACCEPTED') && (
                        <>
                          <button
                            onClick={() => setRatingModal({ isOpen: true, appId: app.id, workerName: app.worker?.full_name || 'Worker' })}
                            className="btn btn-secondary flex-1 shadow-sm text-sm"
                          >
                            <Star className="w-4 h-4 mr-1" />
                            {t('rate', 'Rate Worker')}
                          </button>
                        </>
                      )}
                      {(app.status === 'SHORTLISTED' || app.status === 'ACCEPTED') && ("""
content = content.replace(
    "{(app.status === 'SHORTLISTED' || app.status === 'ACCEPTED') && (",
    rate_button
)

# Add State to parent
content = content.replace(
    'export function JobApplicantsPage() {\n  const { t } = useTranslation()\n  const { id } = useParams()\n  const navigate = useNavigate()\n  const queryClient = useQueryClient()',
    'export function JobApplicantsPage() {\n  const { t } = useTranslation()\n  const { id } = useParams()\n  const navigate = useNavigate()\n  const queryClient = useQueryClient()\n  const [ratingModal, setRatingModal] = useState({ isOpen: false, appId: \'\', workerName: \'\' })'
)

# Add Modal
modal = """
      {ratingModal.isOpen && (
        <RateUserModal
          isOpen={ratingModal.isOpen}
          onClose={() => setRatingModal({ isOpen: false, appId: '', workerName: '' })}
          applicationId={ratingModal.appId}
          userName={ratingModal.workerName}
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

with open('src/pages/employer/JobApplicantsPage.tsx', 'w', encoding='utf-8') as f:
    f.write(content)
print("Updated JobApplicantsPage.tsx")
