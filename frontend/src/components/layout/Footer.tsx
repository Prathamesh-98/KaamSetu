// KaamSetu — Footer
import { Link } from 'react-router-dom'
import { Briefcase, MapPin, Mail, Phone } from 'lucide-react'

export default function Footer() {
  const currentYear = new Date().getFullYear()

  return (
    <footer className="bg-dark text-white">
      <div className="container-page py-16">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-10">

          {/* Brand */}
          <div className="lg:col-span-1">
            <Link to="/" className="flex items-center gap-2 mb-4">
              <div className="w-8 h-8 bg-primary-600 rounded-lg flex items-center justify-center">
                <Briefcase className="w-4 h-4 text-white" />
              </div>
              <span className="font-display font-bold text-xl">KaamSetu</span>
            </Link>
            <p className="text-gray-400 text-sm leading-relaxed mb-4">
              Connecting workers with opportunities across India. Find local talent or discover work based on your skills and availability.
            </p>
            <div className="flex items-center gap-2 text-gray-400 text-sm">
              <MapPin className="w-4 h-4 text-primary-400" />
              <span>Serving communities across India</span>
            </div>
          </div>

          {/* For Workers */}
          <div>
            <h3 className="font-semibold text-white mb-4">For Workers</h3>
            <ul className="space-y-2">
              {[
                { label: 'Find Jobs', href: '/worker/jobs' },
                { label: 'Create Profile', href: '/register?role=WORKER' },
                { label: 'How It Works', href: '/how-it-works' },
                { label: 'Browse Categories', href: '/worker/jobs' },
              ].map((link) => (
                <li key={link.label}>
                  <Link to={link.href} className="text-gray-400 hover:text-white text-sm transition-colors">
                    {link.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          {/* For Employers */}
          <div>
            <h3 className="font-semibold text-white mb-4">For Employers</h3>
            <ul className="space-y-2">
              {[
                { label: 'Post a Job', href: '/employer/post-job' },
                { label: 'Find Workers', href: '/register?role=EMPLOYER' },
                { label: 'Pricing', href: '/about' },
                { label: 'Success Stories', href: '/about' },
              ].map((link) => (
                <li key={link.label}>
                  <Link to={link.href} className="text-gray-400 hover:text-white text-sm transition-colors">
                    {link.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          {/* Company */}
          <div>
            <h3 className="font-semibold text-white mb-4">Company</h3>
            <ul className="space-y-2 mb-6">
              {[
                { label: 'About Us', href: '/about' },
                { label: 'How It Works', href: '/how-it-works' },
                { label: 'Privacy Policy', href: '/about' },
                { label: 'Terms of Service', href: '/about' },
              ].map((link) => (
                <li key={link.label}>
                  <Link to={link.href} className="text-gray-400 hover:text-white text-sm transition-colors">
                    {link.label}
                  </Link>
                </li>
              ))}
            </ul>
            <div className="space-y-2">
              <a href="mailto:support@kaamsetu.in" className="flex items-center gap-2 text-gray-400 hover:text-white text-sm transition-colors">
                <Mail className="w-4 h-4 text-primary-400" />
                support@kaamsetu.in
              </a>
            </div>
          </div>
        </div>

        <div className="border-t border-white/10 mt-12 pt-8 flex flex-col sm:flex-row items-center justify-between gap-4">
          <p className="text-gray-500 text-sm">
            © {currentYear} KaamSetu. All rights reserved. Made with ❤️ for India's workforce.
          </p>
          <div className="flex items-center gap-1">
            <span className="text-xs text-gray-500 bg-secondary-700/30 border border-secondary-700/40 px-2 py-0.5 rounded-full">
              🇮🇳 Made in India
            </span>
          </div>
        </div>
      </div>
    </footer>
  )
}
