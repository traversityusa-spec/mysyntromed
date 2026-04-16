import { PortalHero } from '@/components/client-portal/PortalHero';
import { PortalFeatures } from '@/components/client-portal/PortalFeatures';
import { PortalEHR, PortalSecurity } from '@/components/client-portal/PortalSecurity';
import { PortalCTA } from '@/components/client-portal/PortalCTA';

const ClientPortal = () => {
  return (
    <div className="flex flex-col">
      <PortalHero />
      <PortalFeatures />
      <PortalEHR />
      <PortalSecurity />
      <PortalCTA />
    </div>
  );
};

export default ClientPortal;
