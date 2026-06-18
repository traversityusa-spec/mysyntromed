import { useState, useEffect } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { motion, AnimatePresence } from 'motion/react';
import { Menu, X } from 'lucide-react';
import { NAV_LINKS } from '@/lib/constants';
import { Button } from '@/components/ui/Button';
import { cn } from '@/lib/utils';

export const Navbar = () => {
  const [isScrolled, setIsScrolled] = useState(false);
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const location = useLocation();
  const isHomePage = location.pathname === '/';

  useEffect(() => {
    const handleScroll = () => setIsScrolled(window.scrollY > 60);
    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  useEffect(() => {
    setIsMenuOpen(false);
  }, [location]);

  return (
    <nav className={cn(
      "fixed top-0 left-0 right-0 z-50 transition-all duration-300",
      isScrolled || !isHomePage ? "bg-white/90 backdrop-blur-md border-b border-neutral-100 py-3 shadow-sm" : "bg-transparent py-6"
    )}>
      <div className="max-w-7xl mx-auto px-6 md:px-12 flex items-center justify-between">
        <Link to="/" className="flex items-center gap-2 group">
          <img 
            src="/MySyntroMed-LM-AQUA.png" 
            alt="MySyntroMed Logo" 
            className="w-10 h-10 object-contain"
          />
          <span className={cn(
            "text-2xl font-bold tracking-tighter transition-colors duration-300",
            isScrolled || !isHomePage ? "text-navy-900" : "text-white"
          )}>
            MySyntroMed
          </span>
        </Link>

        {/* Desktop Nav */}
        <div className="hidden md:flex items-center gap-8">
          {NAV_LINKS.map((link) => (
            <Link
              key={link.href}
              to={link.href}
              className={cn(
                "text-sm font-semibold transition-colors hover:text-teal-600 relative",
                location.pathname === link.href 
                  ? "text-teal-600" 
                  : (isScrolled || !isHomePage) ? "text-muted" : "text-white/80"
              )}
            >
              {link.label}
              {location.pathname === link.href && (
                <motion.div 
                  layoutId="nav-underline"
                  className="absolute -bottom-1 left-0 right-0 h-0.5 bg-teal-600 rounded-full"
                />
              )}
            </Link>
          ))}
          <Button href="/client-portal" size="sm">Get Started</Button>
        </div>

        {/* Mobile Toggle */}
        <button 
          className={cn(
            "md:hidden p-2 min-h-11 min-w-11 transition-colors duration-300",
            isScrolled || !isHomePage ? "text-navy-900" : "text-white"
          )} 
          onClick={() => setIsMenuOpen(!isMenuOpen)}
        >
          {isMenuOpen ? <X size={28} /> : <Menu size={28} />}
        </button>
      </div>

      {/* Mobile Menu */}
      <AnimatePresence>
        {isMenuOpen && (
          <motion.div
            initial={{ opacity: 0, y: -12, height: 0 }}
            animate={{ opacity: 1, y: 0, height: 'auto' }}
            exit={{ opacity: 0, y: -12, height: 0 }}
            className="absolute top-full left-0 right-0 bg-white border-t border-neutral-100 shadow-xl p-6 flex flex-col gap-4 md:hidden overflow-hidden"
          >
            {NAV_LINKS.map((link, idx) => (
              <motion.div
                key={link.href}
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: idx * 0.05 }}
              >
                <Link
                  to={link.href}
                  className={cn(
                    "text-lg font-semibold block py-2",
                    location.pathname === link.href ? "text-teal-600" : "text-navy-900"
                  )}
                >
                  {link.label}
                </Link>
              </motion.div>
            ))}
            <Button href="/client-portal" className="w-full mt-2">Get Started</Button>
            <Button href="/contact" variant="outline" className="w-full">Book Consultation</Button>
          </motion.div>
        )}
      </AnimatePresence>
    </nav>
  );
};
