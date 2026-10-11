// KaamSetu — How It Works Page
import { Link } from 'react-router-dom'
import { Users, Briefcase, Search, FileText, CheckCircle, Star, ArrowRight, ChevronRight } from 'lucide-react'

const WORKER_STEPS = [
  {
    step: '01',
    icon: Users,
    title: 'Create Your Profile',
    desc: 'Sign up in minutes. Add your skills, years of experience, preferred work types, location, and expected salary. Your profile is your digital resume.',
    tip: 'Workers with complete profiles get 3x more job matches',
  },
  {
    step: '02',
    icon: Search,
    title: 'Discover Nearby Jobs',
    desc: 'Browse jobs tailored to your skills and location. Filter by work type, salary range, or urgency. Our smart matching surfaces the most relevant opportunities first.',
    tip: 'Enable location access for the best nearby matches',
  },
  {
    step: '03',
    icon: FileText,
    title: 'Apply in One Click',
    desc: 'Apply to any job instantly. Optionally add a short cover note. Track all your applications in one dashboard.',
    tip: 'You can apply to multiple jobs simultaneously',
  },
  {
    step: '04',
    icon: CheckCircle,
    title: 'Get Hired & Rate',
    desc: 'Get notified when an employer accepts your application. Complete the job, then rate your employer to help the community.',
    tip: 'Good ratings unlock priority placement in searches',
  },
]

const EMPLOYER_STEPS = [
  {
    step: '01',
    icon: Briefcase,
    title: 'Post Your Job',
    desc: 'Describe the role, set location, required skills, salary range, and work type. Takes less than 5 minutes.',
    tip: 'Jobs with detailed descriptions receive 40% more applications',
  },
  {
    step: '02',
    icon: Search,
    title: 'Review Applicants',
    desc: 'See ranked applicants matched by skill, location, rating, and experience. Each profile shows verified work history.',
    tip: 'Filter applicants by skill match score or availability',
  },
  {
    step: '03',
    icon: CheckCircle,
    title: 'Hire the Best Fit',
    desc: 'Accept your preferred candidate with one click. They get notified immediately and can start coordination.',
    tip: 'Most employers find the right candidate within 24 hours',
  },
  {
    step: '04',
    icon: Star,
    title: 'Rate After Completion',
    desc: 'After the job is done, leave a rating and review. Help build a trustworthy community for everyone.',
    tip: 'Employers with high ratings attract top talent',
  },
]

const FAQS = [
  {
    q: 'Is KaamSetu free to use?',
    a: 'KaamSetu is free for workers to sign up and apply. Employers can post a limited number of jobs free, with premium plans for high-volume hiring.',
  },
  {
    q: 'How does worker verification work?',
    a: 'Workers can optionally verify their phone number and government-issued identity document. Verified workers display a trust badge on their profile.',
  },
  {
    q: 'Can I apply to multiple jobs?',
    a: 'Yes. Workers can apply to as many jobs as they want simultaneously. You can withdraw applications at any time.',
  },
  {
    q: 'What types of work are available?',
    a: 'KaamSetu supports full-time, part-time, daily labour, project-based, hourly, and remote/local roles across dozens of categories.',
  },
  {
    q: 'How are disputes handled?',
    a: 'Our support team handles disputes. Workers and employers can raise concerns via in-platform messaging or our helpdesk.',
  },
]

export default function HowItWorksPage() {
  return (
    <div className="overflow-x-hidden">

      {/* ── Hero ─────────────────────────────────────────────────────────── */}
      <section className="gradient-hero py-24">
        <div className="container-page text-center">
          <span className="inline-flex items-center gap-2 bg-white/10 backdrop-blur-sm border border-white/20 rounded-full px-4 py-1.5 mb-6">
            <div className="w-2 h-2 rounded-full bg-secondary-400 animate-pulse" />
            <span className="text-white/90 text-sm font-medium">Simple. Fast. Effective.</span>
          </span>
          <h1 className="text-4xl sm:text-5xl font-display font-black text-white leading-tight mb-6">
            How KaamSetu Works
          </h1>
          <p className="text-blue-100 text-lg max-w-xl mx-auto">
            From sign-up to hired — in as little as a few hours. Here's everything you need to know.
          </p>
        </div>
      </section>

      {/* ── For Workers ──────────────────────────────────────────────────── */}
      <section className="section bg-white" id="for-workers">
        <div className="container-page">
          <div className="flex items-center gap-3 mb-10">
            <div className="w-12 h-12 gradient-primary rounded-xl flex items-center justify-center">
              <Users className="w-6 h-6 text-white" />
            </div>
            <div>
              <div className="text-xs font-semibold text-primary-600 uppercase tracking-wide mb-0.5">
                For Workers
              </div>
              <h2 className="text-2xl font-bold text-dark">Find Work Near You</h2>
            </div>
          </div>
          <div className="grid md:grid-cols-2 gap-6">
            {WORKER_STEPS.map((item, i) => (
              <div key={item.step} className="card p-6 flex gap-5">
                <div className="flex-shrink-0">
                  <div className="w-12 h-12 bg-primary-50 rounded-xl flex items-center justify-center">
                    <span className="text-sm font-bold text-primary-600">{item.step}</span>
                  </div>
                </div>
                <div>
                  <div className="flex items-center gap-2 mb-2">
                    <item.icon className="w-4 h-4 text-primary-600" />
                    <h3 className="font-bold text-dark">{item.title}</h3>
                  </div>
                  <p className="text-sm text-gray-500 leading-relaxed mb-3">{item.desc}</p>
                  <div className="flex items-start gap-2 bg-primary-50 rounded-lg px-3 py-2">
                    <span className="text-xs">💡</span>
                    <span className="text-xs text-primary-700">{item.tip}</span>
                  </div>
                </div>
              </div>
            ))}
          </div>
          <div className="mt-8">
            <Link to="/register?role=WORKER" className="btn btn-primary inline-flex">
              Get Started as Worker <ChevronRight className="w-4 h-4" />
            </Link>
          </div>
        </div>
      </section>

      {/* ── For Employers ────────────────────────────────────────────────── */}
      <section className="section bg-surface" id="for-employers">
        <div className="container-page">
          <div className="flex items-center gap-3 mb-10">
            <div className="w-12 h-12 gradient-green rounded-xl flex items-center justify-center">
              <Briefcase className="w-6 h-6 text-white" />
            </div>
            <div>
              <div className="text-xs font-semibold text-secondary-600 uppercase tracking-wide mb-0.5">
                For Employers
              </div>
              <h2 className="text-2xl font-bold text-dark">Hire the Right Talent</h2>
            </div>
          </div>
          <div className="grid md:grid-cols-2 gap-6">
            {EMPLOYER_STEPS.map((item) => (
              <div key={item.step} className="card p-6 flex gap-5">
                <div className="flex-shrink-0">
                  <div className="w-12 h-12 bg-secondary-50 rounded-xl flex items-center justify-center">
                    <span className="text-sm font-bold text-secondary-600">{item.step}</span>
                  </div>
                </div>
                <div>
                  <div className="flex items-center gap-2 mb-2">
                    <item.icon className="w-4 h-4 text-secondary-600" />
                    <h3 className="font-bold text-dark">{item.title}</h3>
                  </div>
                  <p className="text-sm text-gray-500 leading-relaxed mb-3">{item.desc}</p>
                  <div className="flex items-start gap-2 bg-secondary-50 rounded-lg px-3 py-2">
                    <span className="text-xs">💡</span>
                    <span className="text-xs text-secondary-700">{item.tip}</span>
                  </div>
                </div>
              </div>
            ))}
          </div>
          <div className="mt-8">
            <Link to="/register?role=EMPLOYER" className="btn btn-secondary inline-flex">
              Post Your First Job <ChevronRight className="w-4 h-4" />
            </Link>
          </div>
        </div>
      </section>

      {/* ── FAQ ──────────────────────────────────────────────────────────── */}
      <section className="section bg-white">
        <div className="container-page">
          <div className="text-center mb-12">
            <span className="badge-primary mb-3">FAQ</span>
            <h2 className="text-3xl text-dark mt-2 mb-4">Frequently Asked Questions</h2>
          </div>
          <div className="max-w-2xl mx-auto space-y-4">
            {FAQS.map((faq) => (
              <div key={faq.q} className="card p-6">
                <h3 className="font-bold text-dark mb-2">{faq.q}</h3>
                <p className="text-sm text-gray-500 leading-relaxed">{faq.a}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── CTA ──────────────────────────────────────────────────────────── */}
      <section className="py-20 gradient-hero">
        <div className="container-page text-center">
          <h2 className="text-3xl font-display font-black text-white mb-4">
            Ready to Get Started?
          </h2>
          <p className="text-blue-100 mb-8">Join thousands already on KaamSetu.</p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Link to="/register?role=WORKER" className="btn btn-secondary btn-lg">
              <Search className="w-5 h-5" /> Find Work Now
            </Link>
            <Link to="/register?role=EMPLOYER" className="btn btn-lg bg-white text-primary-700 hover:bg-blue-50">
              <Briefcase className="w-5 h-5" /> Hire Workers <ArrowRight className="w-4 h-4" />
            </Link>
          </div>
        </div>
      </section>

    </div>
  )
}
