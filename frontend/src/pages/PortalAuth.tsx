import { useAuth } from '@/lib/AuthContext';
import EmailLogin from '@/components/ui/EmailLogin';

const PortalAuth = () => {
  return (
    <EmailLogin 
      portal="client"
      title="MySyntroMed Patient Portal"
      subtitle="Secure access for approved patients and representatives."
    />
  );
};

export default PortalAuth;

