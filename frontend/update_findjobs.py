import re

def update_file(path, replacements):
    with open(path, 'r', encoding='utf-8') as f:
        content = f.read()
    
    for old, new in replacements:
        if old not in content:
            print(f"Warning: Could not find snippet in {path}:\n{old[:50]}...")
        content = content.replace(old, new)
        
    with open(path, 'w', encoding='utf-8') as f:
        f.write(content)

find_jobs_replacements = [
    (
        '<div className="container-page py-8">',
        '<div className="container-page py-8 bg-[#F5F7FB] min-h-screen">'
    ),
    (
        '<div className="mb-6">\n        <h1 className="text-2xl font-bold text-dark">{t(\'nav.findJobs\')}</h1>\n        <p className="text-gray-500 mt-1">Discover opportunities matched to your skills and location</p>\n      </div>',
        '<div className="mb-6">\n        <h1 className="text-2xl font-bold text-dark">{t(\'nav.findJobs\')}</h1>\n        <p className="text-gray-500 mt-1">{t(\'jobs.discover\', \'Discover opportunities matched to your skills and location\')}</p>\n      </div>\n      <div className="flex flex-col md:flex-row gap-6">'
    ),
    (
        '      {/* ── Search Bar ───────────────────────────────────────────────────── */}\n      <div className="flex gap-3 mb-4">\n        <div className="relative flex-1">\n          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />\n          <input\n            type="text"\n            placeholder="Search by job title, description or keyword..."\n            value={keyword}\n            onChange={(e) => setKeyword(e.target.value)}\n            className="input pl-10 w-full"\n          />\n        </div>\n        <button\n          onClick={() => setShowFilters(!showFilters)}\n          className={`btn ${showFilters ? \'btn-primary\' : \'btn-outline\'} gap-2 flex-shrink-0 transition-colors`}\n        >\n          <SlidersHorizontal className="w-4 h-4" />\n          {t(\'jobs.filters\')}\n          {activeFilterCount > 0 && (\n            <span className={`w-5 h-5 rounded-full text-xs flex items-center justify-center font-bold ${showFilters ? \'bg-white text-primary-600\' : \'bg-primary-600 text-white\'}`}>\n              {activeFilterCount}\n            </span>\n          )}\n        </button>\n      </div>\n\n      {/* ── Filter Panel ─────────────────────────────────────────────────── */}\n      {showFilters && (\n        <div className="card p-5 mb-6 bg-white border border-gray-200">\n          <div className="grid sm:grid-cols-2 md:grid-cols-3 gap-5">',
        '      {/* ── Left Sidebar (Filters) ─────────────────────────────────────────── */}\n      <div className="w-full md:w-1/4 flex-shrink-0">\n        <div className="card p-5 bg-white border border-gray-100 rounded-xl shadow-sm mb-4 md:mb-0">\n          <div className="flex items-center justify-between mb-4">\n            <h2 className="font-bold text-lg text-dark">{t(\'jobs.filters\', \'Filters\')}</h2>\n          </div>\n          <div className="space-y-4">\n            <div>\n              <label className="label">Keyword</label>\n              <div className="relative">\n                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />\n                <input\n                  type="text"\n                  placeholder="Search by keyword..."\n                  value={keyword}\n                  onChange={(e) => setKeyword(e.target.value)}\n                  className="input pl-10 w-full"\n                />\n              </div>\n            </div>'
    ),
    (
        '            {/* Urgent & Actions */}\n            <div className="sm:col-span-2 md:col-span-3 flex items-center justify-between pt-2 border-t border-gray-100">',
        '            {/* Urgent & Actions */}\n            <div className="flex items-center justify-between pt-2 border-t border-gray-100">'
    ),
    (
        '      {/* ── Results Header ─────────────────────────────────────────────────── */}\n      <div className="flex flex-col sm:flex-row sm:items-center justify-between mb-4 gap-3">',
        '        </div>\n      </div>\n      \n      {/* ── Main Column ─────────────────────────────────────────────────── */}\n      <div className="w-full md:w-3/4 flex-1">\n        <div className="flex flex-col sm:flex-row sm:items-center justify-between mb-4 gap-3 bg-white p-4 rounded-xl shadow-sm">'
    ),
    (
        '          {jobsResponse.total_pages > 1 && (\n            <div className="mt-8 flex items-center justify-between card p-4">',
        '          {jobsResponse.total_pages > 1 && (\n            <div className="mt-8 flex items-center justify-between card p-4 bg-white rounded-xl shadow-sm border-0">'
    ),
    (
        '      )}',
        '      )}\n      </div>\n      </div>'
    ),
    (
        '    </Link>',
        '    </Link>\n    </div>'
    ),
    (
        'export function JobCard',
        'export function JobCard'
    ),
    (
        'className="card p-5 hover:border-primary-200 hover:shadow-md transition-all block group"',
        'className="card p-5 hover:shadow-md transition-all block group bg-white rounded-xl border border-gray-100"'
    )
]

update_file('c:/Users/HP/OneDrive/Documents/KaamSetu/frontend/src/pages/worker/FindJobs.tsx', find_jobs_replacements)
