import {
  collection,
  doc,
  getDoc,
  getDocs,
  addDoc,
  updateDoc,
  deleteDoc,
  query,
  where,
  serverTimestamp,
  Timestamp,
} from 'firebase/firestore';
import { db } from './firebase';

export type InviteCode = {
  id: string;
  code: string;
  role: 'admin' | 'specialist' | 'client';
  createdBy: string;
  createdAt: Date;
  expiresAt: Date;
  used: boolean;
  usedBy?: string;
  usedAt?: Date;
  label?: string;
  email?: string;
};

export type OtpRecord = {
  uid: string;
  code: string;
  expiresAt: Date;
  createdAt: Date;
  attempts: number;
};

/* ─── Temporary Email Blocklist ───────────────────────────────── */
const TEMP_EMAIL_DOMAINS = [
  'tempmail.com',
  'temp-mail.org',
  'temp-mail.io',
  'guerrillamail.com',
  'guerrillamail.org',
  'guerrillamail.net',
  'mailinator.com',
  'maildrop.cc',
  'throwaway.email',
  '10minutemail.com',
  '10minutemail.net',
  'fakeinbox.com',
  'trashmail.com',
  'trashmail.net',
  'yopmail.com',
  'yopmail.fr',
  'getnada.com',
  'getairmail.com',
  'mohmal.com',
  'dispostable.com',
  'mailcatch.com',
  'mailnesia.com',
  'tempr.email',
  'discard.email',
  'sharklasers.com',
  'spam4.me',
  'grr.la',
  'mailnull.com',
  'throwawaymail.com',
  'emailondeck.com',
  'tempail.com',
  'mytemp.email',
  'tempmailaddress.com',
  'burnermail.io',
  'mailsac.com',
  'mailtemp.info',
  'tmpmail.org',
  'tmpmail.net',
  'fakemailgenerator.com',
  'emailfake.com',
  'tempail.org',
  'dropmail.me',
  'crazymailing.com',
  'tempsky.com',
  'tempomail.fr',
  'tmails.net',
  'emailtemporario.com.br',
  'meltmail.com',
  'spambox.us',
  'mailforspam.com',
  'mintemail.com',
  'spamfree24.org',
  'jetable.org',
  'mailexpire.com',
  'wegwerfmail.de',
  'wegwerfmail.net',
  'trash-mail.at',
  'trashmail.at',
  'spambog.com',
  'spambog.de',
  'spambog.ru',
  'mail-temporaire.fr',
  'anonymbox.com',
  'emptymail.com',
  'fastacura.com',
  'klzlv.com',
  'sendspamhere.com',
  'sogetthis.com',
  'tempinbox.com',
  'temporaryemail.net',
  'temporaryemail.us',
  'temporaryforwarding.com',
  'temporaryinbox.com',
  'temporaryoutgoingaddress.com',
  'thanksnospam.info',
  'thankyou2010.com',
  'tmail.ws',
  'tmailinator.com',
  'toiea.com',
  'toomail.biz',
  'topranklist.de',
  'trbvm.com',
  'trbvn.com',
  'temp.email',
  'mailimate.com',
  'maildrop.cf',
  'maildrop.ga',
  'maildrop.gq',
  'maildrop.ml',
  'maildrop.tk',
  'inboxalias.com',
  'jetable.fr.nf',
  'nospam.ze.tc',
  'owlpic.com',
  'pjjkp.com',
  'plexolan.de',
  'rcpt.at',
  'rppkn.com',
  'rtrtr.com',
  'saynotospams.com',
  'selfdestructingmail.com',
  'spamherelots.com',
  'tempemailco.com',
  'trollproject.com',
  'upliftnow.com',
  'uplipht.com',
  'viditag.com',
  'viewcastmedia.com',
  'viewcastmedia.net',
  'viewcastmedia.org',
  'walkmail.net',
  'walkmail.ru',
  'webemail.me',
  'webm4il.info',
  'wegwerf-email.de',
  'wegwerfemail.de',
  'wetrainbayarea.com',
  'wetrainbayarea.org',
  'wh4f.org',
  'whopy.com',
  'wilemail.com',
  'willselfdestruct.com',
  'winemaven.info',
  'wolfsmail.tk',
  'writeme.us',
  'wronghead.com',
  'wuzup.net',
  'wuzupmail.net',
  'wwwnew.eu',
  'xagloo.com',
  'xemaps.com',
  'xents.com',
  'xmaily.com',
  'xoxy.net',
  'yapped.net',
  'yeah.net',
  'yogamaven.com',
  'yopmail.pp.fr',
  'yopmail.fr.nf',
  'yopweb.com',
  'yuurok.com',
  'za.com',
  'zehnminutenmail.de',
  'zippymail.info',
  'zoaxe.com',
  'zoemail.com',
  'zoemail.net',
  'zoemail.org',
  'incognitomail.com',
  'incognitomail.net',
  'incognitomail.org',
  'insorg-mail.info',
  'instant-mail.de',
  'instantemailaddress.com',
  'iozak.com',
  'ipoo.org',
  'irish2me.com',
  'iwi.net',
  'jetable.com',
  'jetable.net',
  'jnxjn.com',
  'jourrapide.com',
  'jsrsolutions.com',
  'kaspop.com',
  'keepmymail.com',
  'killmail.com',
  'killmail.net',
  'kimsdisk.com',
  'kingsq.ga',
  'kiois.com',
  'kir.ch.tc',
  'klassmaster.com',
  'klassmaster.net',
  'kulturbetrieb.info',
  'kurzepost.de',
  'lawlita.com',
  'letthemeatspam.com',
  'lhsdv.com',
  'lifebyfood.com',
  'link2mail.net',
  'litedrop.com',
  'lol.ovpn.to',
  'lookugly.com',
  'lopl.co.cc',
  'lortemail.dk',
  'lovemeleaveme.com',
  'lr78.com',
  'lroid.com',
  'lukop.dk',
  'm4ilweb.info',
  'maboard.com',
  'mail-hierarchie.net',
  'mail.by',
  'mail.mezimages.net',
  'mail.zp.ua',
  'mail114.net',
  'mail2rss.org',
  'mail333.com',
  'mail4trash.com',
  'mailbidon.com',
  'mailblocks.com',
  'mailbucket.org',
  'mailcat.biz',
  'mailde.de',
  'mailde.info',
  'maildu.de',
  'maildx.com',
  'mailed.ro',
  'mailfa.tk',
  'mailforsome.com',
  'mailfree.ga',
  'mailfree.gq',
  'mailfree.ml',
  'mailfreeonline.com',
  'mailguard.me',
  'mailin8r.com',
  'mailinater.com',
  'mailinator.gq',
  'mailinator.net',
  'mailinator.org',
  'mailinator.us',
  'mailinator2.com',
  'mailincubator.com',
  'mailismagic.com',
  'mailjunk.cf',
  'mailjunk.ga',
  'mailjunk.gq',
  'mailjunk.ml',
  'mailjunk.tk',
  'mailmate.com',
  'mailme.gq',
  'mailme.ir',
  'mailme.lv',
  'mailme24.com',
  'mailmetrash.com',
  'mailmoat.com',
  'mailnator.com',
  'mailorg.org',
  'mailpick.biz',
  'mailproxsy.com',
  'mailrock.biz',
  'mailscrap.com',
  'mailseal.de',
  'mailshell.com',
  'mailsiphon.com',
  'mailslapping.com',
  'mailslite.com',
  'mailtome.de',
  'mailtothis.com',
  'mailtrash.net',
  'mailtv.net',
  'mailtv.tv',
  'mailzi.ru',
  'mailzilla.com',
  'mailzilla.org',
  'mailzilla.orgmbx.cc',
  'makemetheking.com',
  'manifestgenerator.com',
  'manybrain.com',
  'mbx.cc',
  'mega.zik.dj',
  'meinspamschutz.de',
  'messagebeamer.de',
  'mezimages.net',
  'mfsa.ru',
  'migmail.pl',
  'migumail.com',
  'mjukgansen.nu',
  'moakt.com',
  'mobi.web.id',
  'mobileninja.co.uk',
  'moburl.com',
  'moncourrier.fr.nf',
  'monemail.fr.nf',
  'monmail.fr.nf',
  'monumentmail.com',
  'ms9.mailslite.com',
  'msb.minsmail.com',
  'msg.mailslite.com',
  'mspeciosa.com',
  'msrc.ml',
  'mssaan.ml',
  'mxfuel.com',
  'my10minutemail.com',
  'myalias.pw',
  'mycleaninbox.net',
  'myemailboxy.com',
  'mynetstore.de',
  'mypacks.net',
  'mypartyclip.de',
  'myphantomemail.com',
  'myspaceinc.com',
  'myspaceinc.net',
  'myspacepimpedup.com',
  'mytempmail.com',
  'mytrashmail.com',
  'nabuma.com',
  'neomailbox.com',
  'nepwk.com',
  'nervmich.net',
  'nervtmansen.de',
  'netmails.com',
  'netmails.net',
  'netzidiot.de',
  'neverbox.com',
  'nice-4u.com',
  'nincsmail.hu',
  'nmail.cf',
  'nnh.com',
  'nobulk.com',
  'noclickemail.com',
  'nogmailspam.info',
  'nomail.xl.cx',
  'nomail2me.com',
  'nomorespamemails.com',
  'nospam4.us',
  'nospamfor.us',
  'nospammail.net',
  'nospamthanks.info',
  'notmailinator.com',
  'nowhere.org',
  'nowmymail.com',
  'nurfuerspam.de',
  'nus.edu.sg',
  'nwldx.com',
  'objectmail.com',
  'obobbo.com',
  'odnorazovoe.ru',
  'oneoffemail.com',
  'onewaymail.com',
  'onlatedotcom.info',
  'online.ms',
  'oopi.org',
  'opayq.com',
  'ordinaryamerican.net',
  'otherinbox.com',
  'ourklips.com',
  'outlawspam.com',
  'ovpn.to',
  'pancakemail.com',
  'poczta.onet.pl',
  'politikerclub.de',
  'poofy.org',
  'pookmail.com',
  'privacy.net',
  'privatdemail.net',
  'proxymail.eu',
  'prtnx.com',
  'punkass.com',
  'putthisinyourspamdatabase.com',
  'pwrby.com',
  'qisdo.com',
  'qisoa.com',
  'quickinbox.com',
  'quickmail.nl',
  'rainmail.biz',
  're-gister.com',
  'reallymymail.com',
  'realtyalerts.ca',
  'recode.me',
  'recursor.net',
  'recyclemail.dk',
  'regbypass.com',
  'regbypass.comsafe-mail.net',
  'rejectmail.com',
  'remail.cf',
  'remail.ga',
  'rhyta.com',
  'rklips.com',
  'rmqkr.net',
  'royal.net',
  's0ny.net',
  'safe-mail.net',
  'safersignup.de',
  'safetymail.info',
  'safetypost.de',
  'sandelf.de',
  'schafmail.de',
  'schrott-email.de',
  'secretemail.de',
  'secure-mail.biz',
  'senseless-entertainment.com',
  'server.ms.selfip.net',
  'shieldemail.com',
  'shiftmail.com',
  'shitmail.me',
  'shitmail.org',
  'shortmail.net',
  'shut.name',
  'shut.ws',
  'sibmail.com',
  'sinnlos-mail.de',
  'siteposter.net',
  'skeefmail.com',
  'slaskpost.se',
  'slave-auctions.net',
  'slopsbox.com',
  'slushmail.com',
  'smashmail.de',
  'smellfear.com',
  'snakemail.com',
  'sneakemail.com',
  'snkmail.com',
  'sofimail.com',
  'sofort-mail.de',
  'softpls.asia',
  'soisz.com',
  'solvemail.info',
  'soodomail.com',
  'spam.la',
  'spam.su',
  'spamavert.com',
  'spambob.com',
  'spambob.net',
  'spambob.org',
  'spambog.net',
  'spambox.info',
  'spambox.irishspringrealty.com',
  'spamcannon.com',
  'spamcannon.net',
  'spamcero.com',
  'spamcon.org',
  'spamcorptastic.com',
  'spamcowboy.com',
  'spamcowboy.net',
  'spamcowboy.org',
  'spamday.com',
  'spamex.com',
  'spamfree.eu',
  'spamfree24.com',
  'spamfree24.de',
  'spamfree24.eu',
  'spamfree24.info',
  'spamfree24.net',
  'spamgoes.in',
  'spamgourmet.com',
  'spamhereplease.com',
  'spamhole.com',
  'spamify.com',
  'spaminator.de',
  'spamkill.info',
  'spaml.com',
  'spaml.de',
  'spammotel.com',
  'spamobox.com',
  'spamoff.de',
  'spamsalad.in',
  'spamslicer.com',
  'spamspot.com',
  'spamstack.net',
  'spamthis.co.uk',
  'spamthisplease.com',
  'spamtrail.com',
  'spamtroll.net',
  'speed.1s.fr',
  'spikio.com',
  'spoofmail.de',
  'squizzy.de',
  'ssoia.com',
  'startkeys.com',
  'stinkefinger.net',
  'stop-my-spam.cf',
  'stop-my-spam.com',
  'stop-my-spam.ga',
  'stop-my-spam.ml',
  'stop-my-spam.tk',
  'streetwisemail.com',
  'stuffmail.de',
  'super-auswahl.de',
  'supergreatmail.com',
  'supermailer.jp',
  'superrito.com',
  'superstachel.de',
  'suremail.info',
];

export const emailValidation = {
  isTemporaryEmail(email: string): boolean {
    const domain = email.split('@')[1]?.toLowerCase() || '';
    return TEMP_EMAIL_DOMAINS.some(blocked => 
      domain === blocked || domain.endsWith('.' + blocked)
    );
  },

  isValidEmailFormat(email: string): boolean {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
    return emailRegex.test(email);
  },

  validateEmail(email: string): { valid: boolean; error?: string } {
    const trimmed = email.trim().toLowerCase();
    
    if (!trimmed) {
      return { valid: false, error: 'Email is required.' };
    }
    
    if (!this.isValidEmailFormat(trimmed)) {
      return { valid: false, error: 'Please enter a valid email address.' };
    }
    
    if (this.isTemporaryEmail(trimmed)) {
      return { valid: false, error: 'Temporary/disposable email addresses are not allowed. Please use your personal or work email.' };
    }
    
    return { valid: true };
  }
};

export const passwordValidation = {
  minLength: 8,
  hasUppercase: (pwd: string) => /[A-Z]/.test(pwd),
  hasLowercase: (pwd: string) => /[a-z]/.test(pwd),
  hasNumber: (pwd: string) => /[0-9]/.test(pwd),
  hasSpecial: (pwd: string) => /[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/.test(pwd),
  
  getStrength(password: string): { score: number; label: string; color: string; requirements: { met: boolean; text: string }[] } {
    const requirements = [
      { met: password.length >= 8, text: 'At least 8 characters' },
      { met: this.hasUppercase(password), text: 'One uppercase letter (A-Z)' },
      { met: this.hasLowercase(password), text: 'One lowercase letter (a-z)' },
      { met: this.hasNumber(password), text: 'One number (0-9)' },
      { met: this.hasSpecial(password), text: 'One special character (!@#$%)' },
    ];
    
    const metCount = requirements.filter(r => r.met).length;
    let score = 0;
    let label = '';
    let color = '';
    
    if (metCount === 0) {
      score = 0; label = ''; color = '';
    } else if (metCount <= 2) {
      score = 25; label = 'Weak'; color = 'bg-red-500';
    } else if (metCount === 3) {
      score = 50; label = 'Fair'; color = 'bg-amber-500';
    } else if (metCount === 4) {
      score = 75; label = 'Good'; color = 'bg-blue-500';
    } else {
      score = 100; label = 'Strong'; color = 'bg-emerald-500';
    }
    
    return { score, label, color, requirements };
  },
  
  validate(password: string): { valid: boolean; error?: string } {
    if (password.length < 8) {
      return { valid: false, error: 'Password must be at least 8 characters.' };
    }
    if (!this.hasUppercase(password)) {
      return { valid: false, error: 'Password must include at least one uppercase letter.' };
    }
    if (!this.hasLowercase(password)) {
      return { valid: false, error: 'Password must include at least one lowercase letter.' };
    }
    if (!this.hasNumber(password)) {
      return { valid: false, error: 'Password must include at least one number.' };
    }
    if (!this.hasSpecial(password)) {
      return { valid: false, error: 'Password must include at least one special character.' };
    }
    return { valid: true };
  }
};

/* ─── Invite Code Service ─────────────────────────────────────── */
export const inviteCodeService = {
  /**
   * Generate a cryptographically random invite code and store it in Firestore.
   * Only callable by admins (Firestore rules enforce this).
   */
  async generate(
    createdBy: string,
    role: 'admin' | 'specialist' | 'client',
    label: string = ''
  ): Promise<string> {
    // 24-char alphanumeric code, impossible to guess
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
    const bytes = new Uint8Array(24);
    crypto.getRandomValues(bytes);
    const code = Array.from(bytes)
      .map((b) => chars[b % chars.length])
      .join('');
    const formatted = [0, 6, 12, 18].map((i) => code.slice(i, i + 6)).join('-');

    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 7); // 7 days expiry

    await addDoc(collection(db, 'invite_codes'), {
      code: formatted,
      role,
      createdBy,
      createdAt: serverTimestamp(),
      expiresAt: Timestamp.fromDate(expiresAt),
      used: false,
      label,
    });

    return formatted;
  },

  /**
   * Auto-generate a specialist invite code tied to an email.
   * Used for specialist self-signup flow (no admin generation).
   */
  async generateForSpecialist(email: string): Promise<string> {
    const code = await this.generate('system', 'specialist', `Auto for ${email}`);
    const q = query(collection(db, 'invite_codes'), where('code', '==', code));
    const snap = await getDocs(q);
    if (!snap.empty) {
      await updateDoc(snap.docs[0].ref, { email: email.toLowerCase() });
    }
    return code;
  },

  async validateForSpecialist(email: string, code: string): Promise<void> {
    const trimmed = code.trim().toUpperCase();
    const q = query(collection(db, 'invite_codes'), where('code', '==', trimmed));
    const snap = await getDocs(q);

    if (snap.empty) {
      throw new Error('Invalid invite code. Please check the code and try again.');
    }

    const docData = snap.docs[0].data();

    if (docData.role !== 'specialist') {
      throw new Error('This invite code is not valid for specialists.');
    }

    if (docData.email && docData.email !== email.toLowerCase()) {
      throw new Error('This invite code does not match your email.');
    }

    if (docData.used) {
      throw new Error('This invite code has already been used.');
    }

    const expiresAt: Date = docData.expiresAt?.toDate?.() || new Date(0);
    if (expiresAt < new Date()) {
      throw new Error('This invite code has expired. Please request a new one.');
    }
  },

  async consumeForSpecialist(code: string, usedBy: string): Promise<void> {
    const trimmed = code.trim().toUpperCase();
    const q = query(collection(db, 'invite_codes'), where('code', '==', trimmed));
    const snap = await getDocs(q);
    if (!snap.empty) {
      await updateDoc(snap.docs[0].ref, {
        used: true,
        usedBy,
        usedAt: serverTimestamp(),
      });
    }
  },

  /**
   * Validate a code: returns the role if valid, throws if invalid/used/expired.
   */
  async validate(code: string): Promise<'admin' | 'specialist' | 'client'> {
    const trimmed = code.trim().toUpperCase();
    const q = query(collection(db, 'invite_codes'), where('code', '==', trimmed));
    const snap = await getDocs(q);

    if (snap.empty) {
      throw new Error('Invalid invite code. Please check the code and try again.');
    }

    const docData = snap.docs[0].data();

    if (docData.used) {
      throw new Error('This invite code has already been used. Please request a new one.');
    }

    const expiresAt: Date = docData.expiresAt?.toDate?.() || new Date(0);
    if (expiresAt < new Date()) {
      throw new Error('This invite code has expired. Please request a new one from your administrator.');
    }

    return docData.role as 'admin' | 'specialist' | 'client';
  },

  /**
   * Mark a code as consumed after successful registration.
   */
  async consume(code: string, usedBy: string): Promise<void> {
    const trimmed = code.trim().toUpperCase();
    const q = query(collection(db, 'invite_codes'), where('code', '==', trimmed));
    const snap = await getDocs(q);
    if (!snap.empty) {
      await updateDoc(snap.docs[0].ref, {
        used: true,
        usedBy,
        usedAt: serverTimestamp(),
      });
    }
  },

  /**
   * List all invite codes (admin only).
   */
  async list(): Promise<InviteCode[]> {
    const snap = await getDocs(collection(db, 'invite_codes'));
    return snap.docs.map((d) => {
      const data = d.data();
      return {
        id: d.id,
        code: data.code,
        role: data.role,
        createdBy: data.createdBy,
        createdAt: data.createdAt?.toDate?.() || new Date(),
        expiresAt: data.expiresAt?.toDate?.() || new Date(),
        used: data.used,
        usedBy: data.usedBy,
        usedAt: data.usedAt?.toDate?.(),
        label: data.label || '',
      } as InviteCode;
    });
  },
};

/* ─── OTP Service (Backend-only) ──────────────────────────────── */
const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'https://mysyntromed-backend-production.up.railway.app';

export const otpService = {
  async requestCode(email: string): Promise<{ success: boolean; error?: string }> {
    try {
      const response = await fetch(`${API_BASE_URL}/api/auth/request-otp`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email }),
      });
      const data = await response.json();
      if (!response.ok) {
        return { success: false, error: data.error || 'Failed to send code' };
      }
      return { success: true };
    } catch (error) {
      console.error('[OTP] Request failed:', error);
      return { success: false, error: 'Network error. Please try again.' };
    }
  },

  async verify(email: string, code: string): Promise<{ success: boolean; customToken?: string; error?: string }> {
    try {
      const response = await fetch(`${API_BASE_URL}/api/auth/verify-otp`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, code }),
      });
      const data = await response.json();
      if (!response.ok) {
        return { success: false, error: data.error || 'Verification failed' };
      }
      return { success: true, customToken: data.customToken };
    } catch (error) {
      console.error('[OTP] Verify failed:', error);
      return { success: false, error: 'Network error. Please try again.' };
    }
  },
};
