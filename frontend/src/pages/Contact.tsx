import { ContactForm } from '@/components/contact/ContactForm';
import { FooterCTA } from '@/components/home/FooterCTA';

const Contact = () => {
  return (
    <div className="flex flex-col">
      <ContactForm />
      <FooterCTA />
    </div>
  );
};

export default Contact;
