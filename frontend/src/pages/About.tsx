import { PageHero } from '@/components/layout/PageHero';
import { MissionVision, ValuesGrid } from '@/components/about/AboutComponents';
import { FooterCTA } from '@/components/home/FooterCTA';

const About = () => {
  return (
    <div className="flex flex-col">
      <PageHero 
        title="MySyntroMed – Every healthcare professional’s sidekick"
        description="Healthcare professionals are the heroes. MySyntroMed is the sidekick. We provide trained, HIPAA-compliant virtual support to help you manage documentation, administrative tasks, and patient coordination."
      />
      <MissionVision />
      <ValuesGrid />
      <FooterCTA />
    </div>
  );
};

export default About;
