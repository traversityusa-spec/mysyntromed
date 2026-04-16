import { PageHero } from '@/components/layout/PageHero';
import { StepsTimeline } from '@/components/how-it-works/StepsTimeline';
import { FooterCTA } from '@/components/home/FooterCTA';

const HowItWorks = () => {
  return (
    <div className="flex flex-col">
      <PageHero 
        title="Simple process. Seamless integration."
        description="Our onboarding process is designed to be as smooth and non-disruptive as possible. We work with you to ensure a perfect fit for your practice."
      />
      <StepsTimeline />
      <FooterCTA />
    </div>
  );
};

export default HowItWorks;
