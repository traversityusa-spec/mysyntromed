import { HeroSection } from '@/components/home/HeroSection';
import { ServicesOverview } from '@/components/home/ServicesOverview';
import { WhyMySyntroMed } from '@/components/home/WhyMySyntroMed';
import { HowItWorksTeaser } from '@/components/home/HowItWorksTeaser';
import { TestimonialsSection } from '@/components/home/TestimonialsSection';
import { TrustCompliance } from '@/components/home/TrustCompliance';
import { FooterCTA } from '@/components/home/FooterCTA';
import { AnimatedDivider } from '@/components/ui/AnimatedDivider';

const Home = () => {
  return (
    <div className="flex flex-col">
      <HeroSection />
      <AnimatedDivider />
      <ServicesOverview />
      <WhyMySyntroMed />
      <HowItWorksTeaser />
      <TestimonialsSection />
      <TrustCompliance />
      <FooterCTA />
    </div>
  );
};

export default Home;
