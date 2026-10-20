import { useState, useId } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Sparkles } from 'lucide-react';

export interface PartyEnvelopeOpenerProps {
  title: string;
  hostName?: string;
  logoUrl?: string | null;
  useLogoOnWaxSeal?: boolean;
  waxSealText?: string | null;
  backgroundColor?: string;
  primaryColor?: string;
  accentColor?: string;
  locale?: 'ar' | 'en';
  onOpen?: () => void;
  isOpen?: boolean;
  onReset?: () => void;
  className?: string;
}

export function PartyEnvelopeOpener({
  title,
  hostName,
  logoUrl,
  useLogoOnWaxSeal = false,
  waxSealText,
  backgroundColor = '#0A2E23',
  primaryColor = '#FFFDF9',
  accentColor = '#D4AF37',
  locale = 'ar',
  onOpen,
  isOpen = false,
  className = '',
}: PartyEnvelopeOpenerProps) {
  const isArabic = locale === 'ar';
  const [opening, setOpening] = useState(false);
  const filterId = useId();

  // Compute 1-3 letter monogram if not provided
  const monogram = (waxSealText?.trim() || (() => {
    if (hostName?.trim()) {
      const parts = hostName.trim().split(/\s+/);
      return parts.length > 1 ? `${parts[0][0]}${parts[1][0]}` : parts[0].slice(0, 2);
    }
    const words = title.trim().split(/\s+/);
    return words.length > 1 ? `${words[0][0]}${words[1][0]}` : words[0].slice(0, 2);
  })()).toUpperCase();

  const handleOpen = () => {
    if (opening || isOpen) return;
    setOpening(true);
    setTimeout(() => {
      onOpen?.();
    }, 850);
  };

  if (isOpen) return null;

  return (
    <AnimatePresence>
      <motion.div
        data-testid="party-envelope-opener"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0, scale: 1.05, transition: { duration: 0.6, ease: [0.22, 1, 0.36, 1] } }}
        className={`fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md overflow-hidden ${className}`}
        style={{
          '--party-bg': backgroundColor,
          '--party-accent': accentColor,
        } as React.CSSProperties}
      >
        {/* Ambient Warm Golden Glow Backdrop */}
        <div className="absolute inset-0 pointer-events-none overflow-hidden" aria-hidden="true">
          <div
            className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] rounded-full blur-[120px] opacity-25"
            style={{ backgroundColor: accentColor }}
          />
        </div>

        {/* 3D Envelope Container */}
        <div className="relative w-full max-w-sm sm:max-w-md aspect-[4/3] rounded-3xl p-1 shadow-2xl perspective-1000">
          <div
            className={`relative w-full h-full rounded-2xl overflow-hidden shadow-2xl border border-[var(--party-accent)]/40 transition-transform duration-700 ease-[cubic-bezier(0.22,1,0.36,1)] ${
              opening ? 'scale-105 opacity-90' : 'hover:scale-[1.01]'
            }`}
            style={{ backgroundColor }}
          >
            {/* Subtle Textured Background Pattern */}
            <div className="absolute inset-0 opacity-10 pointer-events-none bg-[radial-gradient(#D4AF37_1px,transparent_1px)] [background-size:16px_16px]" />

            {/* Inner Double Gold Hairline Border */}
            <div className="absolute inset-3 rounded-xl border border-[var(--party-accent)]/25 pointer-events-none" />

            {/* Arabesque Corner SVG Filigrees */}
            <svg
              className="absolute top-2 start-2 w-8 h-8 opacity-45 pointer-events-none"
              viewBox="0 0 40 40"
              fill="none"
              stroke={accentColor}
              strokeWidth="1.2"
            >
              <path d="M4 24 C4 13, 13 4, 24 4 M4 14 C4 8.5, 8.5 4, 14 4 M4 34 L4 4 L34 4" />
            </svg>
            <svg
              className="absolute top-2 end-2 w-8 h-8 opacity-45 pointer-events-none rotate-90"
              viewBox="0 0 40 40"
              fill="none"
              stroke={accentColor}
              strokeWidth="1.2"
            >
              <path d="M4 24 C4 13, 13 4, 24 4 M4 14 C4 8.5, 8.5 4, 14 4 M4 34 L4 4 L34 4" />
            </svg>
            <svg
              className="absolute bottom-2 start-2 w-8 h-8 opacity-45 pointer-events-none -rotate-90"
              viewBox="0 0 40 40"
              fill="none"
              stroke={accentColor}
              strokeWidth="1.2"
            >
              <path d="M4 24 C4 13, 13 4, 24 4 M4 14 C4 8.5, 8.5 4, 14 4 M4 34 L4 4 L34 4" />
            </svg>
            <svg
              className="absolute bottom-2 end-2 w-8 h-8 opacity-45 pointer-events-none 180"
              viewBox="0 0 40 40"
              fill="none"
              stroke={accentColor}
              strokeWidth="1.2"
            >
              <path d="M4 24 C4 13, 13 4, 24 4 M4 14 C4 8.5, 8.5 4, 14 4 M4 34 L4 4 L34 4" />
            </svg>

            {/* Envelope Flap Triangles (SVG) */}
            <svg
              className="absolute inset-0 w-full h-full pointer-events-none"
              preserveAspectRatio="none"
              viewBox="0 0 400 300"
            >
              <defs>
                <linearGradient id={`flap-grad-${filterId}`} x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#FFFFFF" stopOpacity="0.08" />
                  <stop offset="100%" stopColor="#000000" stopOpacity="0.3" />
                </linearGradient>
              </defs>
              {/* Bottom flap */}
              <polygon points="0,300 200,165 400,300" fill={`url(#flap-grad-${filterId})`} stroke={accentColor} strokeWidth="0.75" strokeOpacity="0.3" />
              {/* Side left flap */}
              <polygon points="0,0 170,150 0,300" fill="black" fillOpacity="0.12" stroke={accentColor} strokeWidth="0.75" strokeOpacity="0.25" />
              {/* Side right flap */}
              <polygon points="400,0 230,150 400,300" fill="black" fillOpacity="0.12" stroke={accentColor} strokeWidth="0.75" strokeOpacity="0.25" />
            </svg>

            {/* Top Triangular Flap (Animated Opening) */}
            <div
              className={`absolute top-0 inset-x-0 h-1/2 origin-top transition-transform duration-700 ease-[cubic-bezier(0.22,1,0.36,1)] preserve-3d ${
                opening ? '-rotate-x-180 opacity-40' : ''
              }`}
            >
              <svg className="w-full h-full drop-shadow-md" preserveAspectRatio="none" viewBox="0 0 400 150">
                <polygon points="0,0 200,148 400,0" fill={backgroundColor} stroke={accentColor} strokeWidth="1" strokeOpacity="0.4" />
                <polygon points="10,0 200,140 390,0" fill="none" stroke={accentColor} strokeWidth="0.6" strokeOpacity="0.2" />
              </svg>
            </div>

            {/* Radial Light Burst Effect when opening */}
            {opening && (
              <div
                className="absolute inset-0 pointer-events-none animate-light-beam rounded-full blur-2xl"
                style={{
                  background: `radial-gradient(circle, ${accentColor} 0%, rgba(255,255,255,0.8) 35%, transparent 70%)`,
                }}
              />
            )}

            {/* Event Name & Host Callout on Envelope Face */}
            <div className="absolute top-6 inset-x-0 text-center px-6 pointer-events-none z-10">
              <span className="text-[10px] font-bold uppercase tracking-[.25em] text-[var(--party-accent)]">
                {isArabic ? 'دعوة خاصة · VIP INVITATION' : 'EXCLUSIVE INVITATION'}
              </span>
              <h3 className="mt-1 font-serif text-lg sm:text-xl font-bold truncate text-[var(--party-primary)]" style={{ color: primaryColor }}>
                {title}
              </h3>
            </div>

            {/* Center 3D Wax Seal Button */}
            <div className="absolute inset-0 flex flex-col items-center justify-center z-20">
              <button
                type="button"
                onClick={handleOpen}
                disabled={opening}
                data-testid="button-open-wax-seal"
                aria-label={isArabic ? 'فتح الدعوة' : 'Open Invitation'}
                className="group relative flex flex-col items-center cursor-pointer transition active:scale-95 focus:outline-none"
              >
                {/* 3D Embossed Wax Seal Disc */}
                <div
                  className={`relative flex items-center justify-center w-20 h-20 sm:w-22 sm:h-22 rounded-full border-2 border-[#FFE885] shadow-2xl transition-all duration-300 ${
                    opening ? 'scale-125 brightness-125' : 'group-hover:scale-105 group-hover:brightness-110'
                  }`}
                  style={{
                    background: 'radial-gradient(circle at 35% 35%, #F5D77F 0%, #D4AF37 45%, #997A15 85%, #594406 100%)',
                    boxShadow: '0 8px 24px rgba(0,0,0,0.45), 0 0 20px rgba(212,175,55,0.4), inset 0 2px 4px rgba(255,255,255,0.7), inset 0 -2px 6px rgba(0,0,0,0.6)',
                  }}
                >
                  {/* Wax Seal Outer Ruffled Edge */}
                  <div className="absolute inset-1 rounded-full border border-[#FFF6C7]/50 pointer-events-none" />

                  {/* Wax Seal Center Content */}
                  {useLogoOnWaxSeal && logoUrl ? (
                    <img
                      src={logoUrl}
                      alt={title}
                      className="w-10 h-10 object-contain drop-shadow-sm filter contrast-125"
                    />
                  ) : (
                    <span className="font-serif font-black text-xl sm:text-2xl tracking-widest text-[#423103] drop-shadow-[0_1px_1px_rgba(255,255,255,0.6)]">
                      {monogram}
                    </span>
                  )}
                </div>

                {/* Micro Tap Prompt */}
                <div className="mt-3.5 inline-flex items-center gap-1.5 rounded-full bg-black/40 backdrop-blur-md px-3.5 py-1 text-[11px] font-bold text-[#F5D77F] border border-[var(--party-accent)]/30 shadow-md">
                  <Sparkles size={12} className="animate-spin text-[#FFE885]" style={{ animationDuration: '4s' }} />
                  <span>{isArabic ? 'اضغط لفتح الدعوة' : 'Tap to Open'}</span>
                </div>
              </button>
            </div>
          </div>
        </div>
      </motion.div>
    </AnimatePresence>
  );
}
