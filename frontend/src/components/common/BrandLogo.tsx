import React from 'react';
import { Link } from 'react-router-dom';

export interface BrandLogoProps {
  /**
   * Theme variant for the logo.
   * - 'light': Black "Kaam", orange "Setu" (for light backgrounds)
   * - 'dark': White "Kaam", orange "Setu" (for dark backgrounds)
   */
  variant?: 'light' | 'dark';
  /**
   * Sizing preset or custom size.
   * - 'xs': height 24px (h-6)
   * - 'sm': height 32px (h-8)
   * - 'md': height 36px (h-9)
   * - 'lg': height 48px (h-12)
   * - 'xl': height 64px (h-16)
   */
  size?: 'xs' | 'sm' | 'md' | 'lg' | 'xl';
  /**
   * Whether to display the full horizontal logo (icon + text) or just the square icon mark.
   * Default: true
   */
  showText?: boolean;
  /**
   * Destination path if clickable. Pass null to disable wrapping in a Link.
   * Default: '/'
   */
  linkTo?: string | null;
  /**
   * Optional portal subtitle displayed below or next to the logo (e.g. 'Admin', 'Employer Portal').
   */
  subtitle?: string;
  /**
   * Custom classes applied to the root element.
   */
  className?: string;
  /**
   * Custom classes applied directly to the <img> element.
   */
  imgClassName?: string;
}

const SIZE_MAP = {
  xs: 'h-6',
  sm: 'h-8',
  md: 'h-9',
  lg: 'h-12',
  xl: 'h-16',
};

export const BrandLogo: React.FC<BrandLogoProps> = ({
  variant = 'light',
  size = 'md',
  showText = true,
  linkTo = '/',
  subtitle,
  className = '',
  imgClassName = '',
}) => {
  const heightClass = SIZE_MAP[size] || 'h-9';

  let src = '/logo.png';
  if (!showText) {
    src = '/logo-icon.png';
  } else if (variant === 'dark') {
    src = '/logo-dark.png';
  }

  const imageElement = (
    <img
      src={src}
      alt="KaamSetu"
      className={`${heightClass} w-auto object-contain flex-shrink-0 transition-transform duration-200 ${imgClassName}`}
      loading="eager"
      decoding="async"
    />
  );

  const content = (
    <div className={`inline-flex items-center gap-2.5 ${className}`}>
      {imageElement}
      {subtitle && (
        <span
          className={`text-xs font-semibold px-2 py-0.5 rounded-md tracking-wide uppercase transition-colors ${
            variant === 'dark'
              ? 'bg-white/10 text-white/80 border border-white/15'
              : 'bg-primary-50 text-primary-700 border border-primary-100'
          }`}
        >
          {subtitle}
        </span>
      )}
    </div>
  );

  if (linkTo) {
    return (
      <Link
        to={linkTo}
        className="inline-flex items-center group focus:outline-none focus-visible:ring-2 focus-visible:ring-primary-500 rounded-lg"
        aria-label="KaamSetu Home"
      >
        {content}
      </Link>
    );
  }

  return content;
};

export default BrandLogo;
