// KaamSetu — Landing Page
import { Link } from 'react-router-dom'
import {
  Search, MapPin, Star, Shield, Users, Briefcase, Zap,
  CheckCircle, ArrowRight, ChevronRight, Award, TrendingUp
} from 'lucide-react'
import { motion } from 'framer-motion'
import { useTranslation } from 'react-i18next'
import HeroCarousel from '../../components/public/HeroCarousel'

// Animation variants
const fadeUp = {
  hidden: { opacity: 0, y: 24 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.5 } }
}

const stagger = {
  visible: { transition: { staggerChildren: 0.1 } }
}

export default function LandingPage() {
  const { t } = useTranslation()

  // ─── Data mapped with i18n ──────────────────────────────────────────────────
  const CATEGORIES = [
    { image: '/images/brick-workers.jpg.jpg', name: t('categories.Construction'), count: t('landing.categories.findWorkers'), routeName: 'Construction' },
    { image: '/images/electrician.jpg.jpg', name: t('categories.Electrical'), count: t('landing.categories.findWorkers'), routeName: 'Electrical' },
    { image: '/images/plumber.jpg.jpg', name: t('categories.Plumbing'), count: t('landing.categories.findWorkers'), routeName: 'Plumbing' },
    { image: '/images/mechanic.jpg.jpg', name: t('categories.Driving'), count: t('landing.categories.findWorkers'), routeName: 'Driving' },
    { image: '/images/textile-worker.jpg.jpg', name: t('categories.Domestic Help'), count: t('landing.categories.findWorkers'), routeName: 'Domestic Help' },
    { image: '/images/agricultural-workers.jpg.jpg', name: t('categories.Farming'), count: t('landing.categories.findWorkers'), routeName: 'Farming' },
    { image: '/images/electrical-team.jpg.jpg', name: t('categories.IT & Tech'), count: t('landing.categories.findWorkers'), routeName: 'IT & Tech' },
    { image: '/images/carpenter.jpg.jpg', name: t('categories.Painting'), count: t('landing.categories.findWorkers'), routeName: 'Painting' },
  ]

  const HOW_IT_WORKS_WORKER = [
    { step: '01', title: t('landing.howItWorks.wStep1Title'), desc: t('landing.howItWorks.wStep1Desc') },
    { step: '02', title: t('landing.howItWorks.wStep2Title'), desc: t('landing.howItWorks.wStep2Desc') },
    { step: '03', title: t('landing.howItWorks.wStep3Title'), desc: t('landing.howItWorks.wStep3Desc') },
  ]

  const HOW_IT_WORKS_EMPLOYER = [
    { step: '01', title: t('landing.howItWorks.eStep1Title'), desc: t('landing.howItWorks.eStep1Desc') },
    { step: '02', title: t('landing.howItWorks.eStep2Title'), desc: t('landing.howItWorks.eStep2Desc') },
    { step: '03', title: t('landing.howItWorks.eStep3Title'), desc: t('landing.howItWorks.eStep3Desc') },
  ]



  const BENEFITS = [
    { icon: MapPin, color: 'text-primary-600 bg-primary-50', title: t('landing.benefits.b1Title'), desc: t('landing.benefits.b1Desc') },
    { icon: Zap, color: 'text-secondary-600 bg-secondary-50', title: t('landing.benefits.b2Title'), desc: t('landing.benefits.b2Desc') },
    { icon: Shield, color: 'text-purple-600 bg-purple-50', title: t('landing.benefits.b3Title'), desc: t('landing.benefits.b3Desc') },
    { icon: TrendingUp, color: 'text-orange-600 bg-orange-50', title: t('landing.benefits.b4Title'), desc: t('landing.benefits.b4Desc') },
    { icon: Award, color: 'text-indigo-600 bg-indigo-50', title: t('landing.benefits.b5Title'), desc: t('landing.benefits.b5Desc') },
    { icon: Users, color: 'text-pink-600 bg-pink-50', title: t('landing.benefits.b6Title'), desc: t('landing.benefits.b6Desc') },
  ]

  const TRUST_ITEMS = [
    t('landing.trust.t1'), t('landing.trust.t2'), t('landing.trust.t3'),
    t('landing.trust.t4'), t('landing.trust.t5'), t('landing.trust.t6'),
  ]



  return (
    <div className="overflow-x-hidden">

      {/* ── 1. HERO ──────────────────────────────────────────────────────── */}
      <HeroCarousel />

      {/* ── 2. HOW IT WORKS ──────────────────────────────────────────────── */}
      <section className="section bg-white" id="how-it-works">
        <div className="container-page">
          <motion.div
            initial="hidden" whileInView="visible" viewport={{ once: true }}
            variants={stagger} className="text-center mb-16"
          >
            <motion.span variants={fadeUp} className="badge-primary mb-3">{t('landing.howItWorks.badge')}</motion.span>
            <motion.h2 variants={fadeUp} className="text-3xl lg:text-4xl text-dark mt-2 mb-4">
              {t('landing.howItWorks.title')}
            </motion.h2>
            <motion.p variants={fadeUp} className="text-gray-500 max-w-xl mx-auto">
              {t('landing.howItWorks.description')}
            </motion.p>
          </motion.div>

          <div className="grid md:grid-cols-2 gap-12">
            {/* For Workers */}
            <div>
              <div className="flex items-center gap-3 mb-8">
                <div className="w-10 h-10 gradient-primary rounded-xl flex items-center justify-center">
                  <Users className="w-5 h-5 text-white" />
                </div>
                <h3 className="text-xl font-bold text-dark">{t('landing.howItWorks.forWorkers')}</h3>
              </div>
              <div className="space-y-6">
                {HOW_IT_WORKS_WORKER.map((item, i) => (
                  <motion.div
                    key={item.step}
                    initial={{ opacity: 0, x: -20 }}
                    whileInView={{ opacity: 1, x: 0 }}
                    viewport={{ once: true }}
                    transition={{ delay: i * 0.1 }}
                    className="flex gap-4"
                  >
                    <div className="flex-shrink-0 w-10 h-10 bg-primary-50 rounded-xl flex items-center justify-center">
                      <span className="text-sm font-bold text-primary-600">{item.step}</span>
                    </div>
                    <div>
                      <h4 className="font-semibold text-dark mb-1">{item.title}</h4>
                      <p className="text-sm text-gray-500">{item.desc}</p>
                    </div>
                  </motion.div>
                ))}
              </div>
              <Link to="/register?role=WORKER" className="btn btn-primary mt-8 inline-flex">
                {t('landing.howItWorks.wBtn')} <ChevronRight className="w-4 h-4" />
              </Link>
            </div>

            {/* For Employers */}
            <div>
              <div className="flex items-center gap-3 mb-8">
                <div className="w-10 h-10 gradient-green rounded-xl flex items-center justify-center">
                  <Briefcase className="w-5 h-5 text-white" />
                </div>
                <h3 className="text-xl font-bold text-dark">{t('landing.howItWorks.forEmployers')}</h3>
              </div>
              <div className="space-y-6">
                {HOW_IT_WORKS_EMPLOYER.map((item, i) => (
                  <motion.div
                    key={item.step}
                    initial={{ opacity: 0, x: 20 }}
                    whileInView={{ opacity: 1, x: 0 }}
                    viewport={{ once: true }}
                    transition={{ delay: i * 0.1 }}
                    className="flex gap-4"
                  >
                    <div className="flex-shrink-0 w-10 h-10 bg-secondary-50 rounded-xl flex items-center justify-center">
                      <span className="text-sm font-bold text-secondary-600">{item.step}</span>
                    </div>
                    <div>
                      <h4 className="font-semibold text-dark mb-1">{item.title}</h4>
                      <p className="text-sm text-gray-500">{item.desc}</p>
                    </div>
                  </motion.div>
                ))}
              </div>
              <Link to="/register?role=EMPLOYER" className="btn btn-secondary mt-8 inline-flex">
                {t('landing.howItWorks.eBtn')} <ChevronRight className="w-4 h-4" />
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* ── 3. JOB CATEGORIES ────────────────────────────────────────────── */}
      <section className="section bg-surface">
        <div className="container-page">
          <motion.div initial="hidden" whileInView="visible" viewport={{ once: true }} variants={stagger}>
            <motion.div variants={fadeUp} className="text-center mb-12">
              <span className="badge-secondary mb-3">{t('landing.categories.badge')}</span>
              <h2 className="text-3xl lg:text-4xl text-dark mt-2 mb-4">
                {t('landing.categories.title')}
              </h2>
              <p className="text-gray-500">
                {t('landing.categories.description')}
              </p>
            </motion.div>

            <motion.div variants={stagger} className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-6">
              {CATEGORIES.map((cat) => (
                <motion.div key={cat.routeName} variants={fadeUp}>
                  <Link
                    to={`/worker/jobs?category=${cat.routeName}`}
                    className="card-hover overflow-hidden flex flex-col group rounded-2xl border border-gray-100 shadow-sm block"
                  >
                    <div className="relative h-44 overflow-hidden">
                      <img src={cat.image} alt={cat.name} loading="lazy" className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-110" />
                      <div className="absolute inset-0 bg-gradient-to-t from-gray-900/80 via-gray-900/20 to-transparent" />
                      <div className="absolute bottom-4 left-4 right-4 text-left">
                        <div className="font-semibold text-white text-lg drop-shadow-md">{cat.name}</div>
                        <div className="text-xs text-gray-200 mt-1 font-medium">{cat.count}</div>
                      </div>
                    </div>
                  </Link>
                </motion.div>
              ))}
            </motion.div>
          </motion.div>
        </div>
      </section>

      {/* ── 4. KEY BENEFITS ──────────────────────────────────────────────── */}
      <section className="section bg-white">
        <div className="container-page">
          <motion.div initial="hidden" whileInView="visible" viewport={{ once: true }} variants={stagger}>
            <motion.div variants={fadeUp} className="text-center mb-16">
              <span className="badge-primary mb-3">{t('landing.benefits.badge')}</span>
              <h2 className="text-3xl lg:text-4xl text-dark mt-2 mb-4">
                {t('landing.benefits.title')}
              </h2>
            </motion.div>

            <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
              {BENEFITS.map((benefit) => (
                <motion.div key={benefit.title} variants={fadeUp} className="card p-6">
                  <div className={`w-11 h-11 rounded-xl ${benefit.color} flex items-center justify-center mb-4`}>
                    <benefit.icon className="w-5 h-5" />
                  </div>
                  <h3 className="font-bold text-dark mb-2">{benefit.title}</h3>
                  <p className="text-sm text-gray-500 leading-relaxed">{benefit.desc}</p>
                </motion.div>
              ))}
            </div>
          </motion.div>
        </div>
      </section>



      {/* ── 6. TRUST & SAFETY ────────────────────────────────────────────── */}
      <section className="section bg-white">
        <div className="container-page">
          <div className="grid lg:grid-cols-2 gap-16 items-center">
            <motion.div initial="hidden" whileInView="visible" viewport={{ once: true }} variants={stagger}>
              <motion.span variants={fadeUp} className="badge-primary mb-3">{t('landing.trust.badge')}</motion.span>
              <motion.h2 variants={fadeUp} className="text-3xl lg:text-4xl text-dark mt-2 mb-6">
                {t('landing.trust.title')}
              </motion.h2>
              <motion.div variants={stagger} className="space-y-4">
                {TRUST_ITEMS.map((item) => (
                  <motion.div key={item} variants={fadeUp} className="flex items-start gap-3">
                    <CheckCircle className="w-5 h-5 text-secondary-600 flex-shrink-0 mt-0.5" />
                    <span className="text-gray-600 text-sm">{item}</span>
                  </motion.div>
                ))}
              </motion.div>
            </motion.div>
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              whileInView={{ opacity: 1, scale: 1 }}
              viewport={{ once: true }}
              className="gradient-hero rounded-3xl p-10 text-white"
            >
              <div className="text-center">
                <div className="text-6xl mb-4">🛡️</div>
                <h3 className="text-2xl font-bold mb-3">{t('landing.trust.cardTitle')}</h3>
                <p className="text-blue-100 text-sm leading-relaxed mb-6">
                  {t('landing.trust.cardDesc')}
                </p>
                <div className="grid grid-cols-2 gap-4">
                  <div className="bg-white/10 rounded-xl p-4">
                    <div className="text-2xl font-bold">95%</div>
                    <div className="text-xs text-blue-200">{t('landing.trust.stat1')}</div>
                  </div>
                  <div className="bg-white/10 rounded-xl p-4">
                    <div className="text-2xl font-bold">48h</div>
                    <div className="text-xs text-blue-200">{t('landing.trust.stat2')}</div>
                  </div>
                </div>
              </div>
            </motion.div>
          </div>
        </div>
      </section>

      {/* ── 7. FINAL CTA ─────────────────────────────────────────────────── */}
      <section className="py-20 gradient-hero relative overflow-hidden">
        <div className="absolute inset-0 opacity-10"
          style={{
            backgroundImage: 'radial-gradient(circle at 1px 1px, white 1px, transparent 0)',
            backgroundSize: '40px 40px',
          }}
        />
        <div className="container-page relative text-center">
          <motion.div initial="hidden" whileInView="visible" viewport={{ once: true }} variants={stagger}>
            <motion.h2 variants={fadeUp} className="text-3xl lg:text-5xl font-display font-black text-white mb-6">
              {t('landing.cta.title')}
            </motion.h2>
            <motion.p variants={fadeUp} className="text-blue-100 text-lg mb-10 max-w-lg mx-auto">
              {t('landing.cta.description')}
            </motion.p>
            <motion.div variants={fadeUp} className="flex flex-col sm:flex-row gap-4 justify-center">
              <Link to="/register?role=WORKER" className="btn btn-secondary btn-lg">
                <Search className="w-5 h-5" />
                {t('landing.cta.findWork')}
              </Link>
              <Link to="/register?role=EMPLOYER" className="btn btn-lg bg-white text-primary-700 hover:bg-blue-50">
                <Briefcase className="w-5 h-5" />
                {t('landing.cta.hireWorkers')}
              </Link>
            </motion.div>
          </motion.div>
        </div>
      </section>

    </div>
  )
}
