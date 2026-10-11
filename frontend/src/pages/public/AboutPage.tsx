// KaamSetu — About Page
import { Shield, Users, TrendingUp, Heart, MapPin, Award } from 'lucide-react'

const VALUES = [
  {
    icon: Heart,
    color: 'text-rose-600 bg-rose-50',
    title: 'Dignity of Labour',
    desc: 'We believe every worker deserves respect, fair pay, and equal opportunity regardless of background or education.',
  },
  {
    icon: MapPin,
    color: 'text-primary-600 bg-primary-50',
    title: 'Local First',
    desc: 'We prioritise connecting workers with opportunities in their own communities, reducing commute burden.',
  },
  {
    icon: Shield,
    color: 'text-emerald-600 bg-emerald-50',
    title: 'Trust & Safety',
    desc: 'Verified profiles, transparent ratings, and in-platform communication protect both workers and employers.',
  },
  {
    icon: TrendingUp,
    color: 'text-secondary-600 bg-secondary-50',
    title: 'Economic Growth',
    desc: 'By formalising the informal workforce, we help workers earn more and employers scale faster.',
  },
  {
    icon: Users,
    color: 'text-indigo-600 bg-indigo-50',
    title: 'Inclusive Platform',
    desc: 'Designed for women, students, veterans — anyone seeking flexible, dignified employment.',
  },
  {
    icon: Award,
    color: 'text-amber-600 bg-amber-50',
    title: 'Skill Recognition',
    desc: 'We surface skilled tradespeople who are often invisible in traditional job markets.',
  },
]

const TEAM = [
  { name: 'Arjun Mehta', role: 'Co-Founder & CEO', avatar: '👨‍💼', location: 'Delhi' },
  { name: 'Priya Nair', role: 'Co-Founder & CTO', avatar: '👩‍💻', location: 'Bangalore' },
  { name: 'Rohit Sharma', role: 'Head of Operations', avatar: '👨‍🔧', location: 'Mumbai' },
  { name: 'Sunita Devi', role: 'Head of Worker Success', avatar: '👩‍🏫', location: 'Patna' },
]

export default function AboutPage() {
  return (
    <div className="overflow-x-hidden">

      {/* ── Hero ─────────────────────────────────────────────────────────── */}
      <section className="gradient-hero py-24">
        <div className="container-page text-center">
          <span className="inline-flex items-center gap-2 bg-white/10 backdrop-blur-sm border border-white/20 rounded-full px-4 py-1.5 mb-6">
            <div className="w-2 h-2 rounded-full bg-secondary-400 animate-pulse" />
            <span className="text-white/90 text-sm font-medium">Our Story</span>
          </span>
          <h1 className="text-4xl sm:text-5xl font-display font-black text-white leading-tight mb-6">
            Bridging the Gap Between<br />
            <span className="text-secondary-400">Workers & Opportunity</span>
          </h1>
          <p className="text-blue-100 text-lg leading-relaxed max-w-2xl mx-auto">
            KaamSetu — which means "Work Bridge" in Hindi — was born from a simple observation:
            India has millions of skilled workers and millions of employers who need them, yet
            connecting the two remains painfully inefficient.
          </p>
        </div>
      </section>

      {/* ── Mission ──────────────────────────────────────────────────────── */}
      <section className="section bg-white">
        <div className="container-page">
          <div className="grid lg:grid-cols-2 gap-16 items-center">
            <div>
              <span className="badge-primary mb-3">Our Mission</span>
              <h2 className="text-3xl lg:text-4xl text-dark mt-2 mb-6">
                Empowering India's Informal Workforce
              </h2>
              <div className="space-y-4 text-gray-600 leading-relaxed">
                <p>
                  India's informal workforce comprises over 400 million workers — electricians,
                  plumbers, construction workers, domestic helpers, drivers, and countless others.
                  Despite their indispensable contribution to the economy, they often struggle with
                  irregular work, unfair wages, and lack of professional visibility.
                </p>
                <p>
                  KaamSetu is our answer to this challenge. We build technology that treats every
                  worker as a skilled professional worthy of dignified, well-matched employment
                  opportunities.
                </p>
                <p>
                  For employers, we provide access to a verified, rated talent pool — reducing
                  hiring time from days to hours and eliminating the uncertainty of hiring through
                  informal networks.
                </p>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              {[
                { value: '50,000+', label: 'Registered Workers', icon: '👷' },
                { value: '12,000+', label: 'Jobs Posted', icon: '📋' },
                { value: '8,500+', label: 'Successful Hires', icon: '✅' },
                { value: '4.8★', label: 'Platform Rating', icon: '⭐' },
              ].map((stat) => (
                <div key={stat.label} className="card p-6 text-center">
                  <div className="text-3xl mb-2">{stat.icon}</div>
                  <div className="font-display font-black text-2xl text-dark">{stat.value}</div>
                  <div className="text-sm text-gray-500 mt-1">{stat.label}</div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* ── Values ───────────────────────────────────────────────────────── */}
      <section className="section bg-surface">
        <div className="container-page">
          <div className="text-center mb-12">
            <span className="badge-secondary mb-3">What We Stand For</span>
            <h2 className="text-3xl lg:text-4xl text-dark mt-2 mb-4">Our Core Values</h2>
            <p className="text-gray-500 max-w-xl mx-auto">
              Every product decision we make is guided by these principles.
            </p>
          </div>
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
            {VALUES.map((v) => (
              <div key={v.title} className="card p-6">
                <div className={`w-11 h-11 rounded-xl ${v.color} flex items-center justify-center mb-4`}>
                  <v.icon className="w-5 h-5" />
                </div>
                <h3 className="font-bold text-dark mb-2">{v.title}</h3>
                <p className="text-sm text-gray-500 leading-relaxed">{v.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Team ─────────────────────────────────────────────────────────── */}
      <section className="section bg-white">
        <div className="container-page">
          <div className="text-center mb-12">
            <span className="badge-primary mb-3">The Team</span>
            <h2 className="text-3xl lg:text-4xl text-dark mt-2 mb-4">Built by People Who Care</h2>
          </div>
          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-6">
            {TEAM.map((member) => (
              <div key={member.name} className="card p-6 text-center">
                <div className="w-16 h-16 bg-primary-50 rounded-full flex items-center justify-center text-3xl mx-auto mb-4">
                  {member.avatar}
                </div>
                <div className="font-bold text-dark">{member.name}</div>
                <div className="text-sm text-primary-600 font-medium mt-1">{member.role}</div>
                <div className="text-xs text-gray-400 mt-1 flex items-center justify-center gap-1">
                  <MapPin className="w-3 h-3" /> {member.location}
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── CTA ──────────────────────────────────────────────────────────── */}
      <section className="py-20 gradient-hero">
        <div className="container-page text-center">
          <h2 className="text-3xl lg:text-4xl font-display font-black text-white mb-4">
            Join the KaamSetu Community
          </h2>
          <p className="text-blue-100 mb-8 max-w-lg mx-auto">
            Whether you're a worker seeking opportunity or an employer seeking talent — we're here for you.
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <a href="/register?role=WORKER" className="btn btn-secondary btn-lg">
              Start as a Worker
            </a>
            <a href="/register?role=EMPLOYER" className="btn btn-lg bg-white text-primary-700 hover:bg-blue-50">
              Post a Job
            </a>
          </div>
        </div>
      </section>

    </div>
  )
}
