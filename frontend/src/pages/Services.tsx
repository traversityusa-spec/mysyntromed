import { PageHero } from '@/components/layout/PageHero';
import { ServiceBlock } from '@/components/services/ServiceBlock';
import { SERVICES } from '@/lib/constants';
import { FooterCTA } from '@/components/home/FooterCTA';

const Services = () => {
  return (
    <div className="flex flex-col">
      <PageHero 
        title="Support that adapts to your practice"
        description="MySyntroMed provides dependable, HIPAA-compliant virtual support across all areas of medical practice operations."
      />
      {SERVICES.map((service, idx) => (
        <ServiceBlock 
          key={service.id}
          {...service}
          reverse={idx % 2 === 1}
        />
      ))}
      <FooterCTA />
    </div>
  );
};

export default Services;
