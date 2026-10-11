const fs = require('fs');

const path = 'src/pages/employer/MyJobsPage.tsx';
let content = fs.readFileSync(path, 'utf8');

const target = `      {/* ── List ─────────────────────────────────────────────────────────── */}
      {!isLoading && !isError && jobs && jobs.length > 0 && (
        <div className="space-y-4">
          {jobs.map((job) => (
            <JobCard key={job.id} job={job} />
          ))}
        </div>
      )}`;

const replacement = `      {/* ── List ─────────────────────────────────────────────────────────── */}
      {!isLoading && !isError && jobs && jobs.length > 0 && (
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm whitespace-nowrap">
              <thead className="bg-gray-50 text-gray-600 border-b border-gray-100">
                <tr>
                  <th className="px-6 py-4 font-semibold">{t('jobs.title', 'Title & Category')}</th>
                  <th className="px-6 py-4 font-semibold">{t('jobs.status', 'Status')}</th>
                  <th className="px-6 py-4 font-semibold">{t('jobs.applicants', 'Applicants')}</th>
                  <th className="px-6 py-4 font-semibold">{t('jobs.posted', 'Posted')}</th>
                  <th className="px-6 py-4 font-semibold text-right">{t('jobs.actions', 'Actions')}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {jobs.map((job) => {
                  const status = STATUS_CONFIG[job.status];
                  return (
                    <tr key={job.id} className="hover:bg-gray-50 transition-colors">
                      <td className="px-6 py-4">
                        <div className="font-medium text-gray-900">{job.title}</div>
                        <div className="text-xs text-gray-500 mt-1 flex items-center gap-1">
                          <Briefcase className="w-3 h-3" /> {job.category.name ? t(\`categories.\${job.category.name}\`, { defaultValue: job.category.name }) : ''}
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <span className={\`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold \${status.color}\`}>
                          {t(\`statuses.\${job.status}\`, { defaultValue: job.status })}
                        </span>
                      </td>
                      <td className="px-6 py-4">
                        <span className="flex items-center gap-1.5 font-medium">
                          <Users className="w-4 h-4 text-blue-500" />
                          {job.applications_count}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-gray-500">
                        {new Date(job.created_at).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}
                      </td>
                      <td className="px-6 py-4 text-right">
                        <div className="flex items-center justify-end gap-2">
                          <Link to={\`/employer/jobs/\${job.id}/applicants\`} className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors">
                            <Users className="w-4 h-4" />
                          </Link>
                          <Link to={\`/employer/jobs/\${job.id}/candidates\`} className="p-2 text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors">
                            <Zap className="w-4 h-4" />
                          </Link>
                          <Link to={\`/employer/jobs/\${job.id}/edit\`} className="p-2 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors">
                            <Pencil className="w-4 h-4" />
                          </Link>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}`;

content = content.replace(target, replacement);
fs.writeFileSync(path, content);
