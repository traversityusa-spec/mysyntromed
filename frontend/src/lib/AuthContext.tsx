import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import {
  signInAnonymously,
  signInWithEmailAndPassword,
  onAuthStateChanged,
  signOut,
  updatePassword,
  reauthenticateWithCredential,
  EmailAuthProvider,
  multiFactor,
  getMultiFactorResolver,
  TotpMultiFactorGenerator,
  TotpSecret,
  type MultiFactorResolver,
  type User,
} from 'firebase/auth';
import { doc, getDoc, setDoc, serverTimestamp } from 'firebase/firestore';
import { auth, db } from './firebase';
import { inviteCodeService } from './security';
import { presenceService } from './presence';

export type SessionUser = {
  uid: string;
  displayName: string;
  role: 'client' | 'admin' | 'specialist';
  isNewUser: boolean;
  createdAt: Date;
  assignedSpecialistId?: string;
  assignedSpecialistName?: string;
  photoURL?: string;
  specialties?: string[];
  yearsExperience?: number;
  bio?: string;
};

type AuthContextType = {
  user: User | null;
  sessionUser: SessionUser | null;
  loading: boolean;
  mfaResolver: MultiFactorResolver | null;
  loginWithCode: (code: string, displayName: string) => Promise<SessionUser>;
  loginWithEmail: (email: string, password: string) => Promise<SessionUser>;
  loginWithMfaTotp: (totpCode: string) => Promise<SessionUser>;
  logout: () => Promise<void>;
  refreshSessionUser: () => Promise<void>;
  getRedirectPath: (role: SessionUser['role']) => string;
  changePassword: (currentPassword: string, newPassword: string) => Promise<void>;
  enrollTotp: () => Promise<{ secret: TotpSecret; qrCodeUrl: string }>;
  verifyTotpEnrollment: (secret: TotpSecret, totpCode: string, displayName: string) => Promise<void>;
  unenrollTotp: () => Promise<void>;
  isTotpEnrolled: () => boolean;
};

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const [user, setUser] = useState<User | null>(null);
  const [sessionUser, setSessionUser] = useState<SessionUser | null>(null);
  const [loading, setLoading] = useState(true);
  const [mfaResolver, setMfaResolver] = useState<MultiFactorResolver | null>(null);

  const buildSessionUser = async (firebaseUser: User): Promise<SessionUser> => {
    const userDocRef = doc(db, 'users', firebaseUser.uid);
    const userDoc = await getDoc(userDocRef);
    const data = userDoc.data();

    if (!userDoc.exists()) {
      throw new Error('User profile not found');
    }

    return {
      uid: firebaseUser.uid,
      displayName: data?.displayName || 'User',
      role: data?.role || 'client',
      isNewUser: data?.isNewUser ?? false,
      createdAt: data?.createdAt?.toDate() || new Date(),
      assignedSpecialistId: data?.assignedSpecialistId,
      assignedSpecialistName: data?.assignedSpecialistName,
      photoURL: data?.photoURL,
      specialties: data?.specialties || [],
      yearsExperience: data?.yearsExperience,
      bio: data?.bio,
    };
  };

  const createUserProfile = async (
    firebaseUser: User,
    role: 'client' | 'specialist' | 'admin',
    displayName: string
  ): Promise<void> => {
    const userDocRef = doc(db, 'users', firebaseUser.uid);
    await setDoc(
      userDocRef,
      {
        uid: firebaseUser.uid,
        displayName,
        role,
        isNewUser: true,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      },
      { merge: true }
    );

    try {
      const { messageService } = await import('./firestore');
      await messageService.sendMessage({
        senderId: 'system_admin',
        senderName: 'MySyntroMed Support',
        senderRole: 'admin',
        receiverId: firebaseUser.uid,
        text: `Welcome to MySyntroMed, ${displayName}! We are absolutely thrilled to have you onboard. Let us know if you have any questions or need assistance navigating your new dashboard.`,
        read: false,
      });
    } catch (err) {
      console.error('Failed to send welcome message:', err);
    }
  };

  const refreshSessionUser = async () => {
    if (!user) return;
    try {
      const profile = await buildSessionUser(user);
      setSessionUser(profile);
    } catch (e) {
      console.error('refreshSessionUser error:', e);
    }
  };

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (nextUser) => {
      setUser(nextUser);

      if (!nextUser) {
        setSessionUser(null);
        setLoading(false);
        return;
      }

      try {
        const profile = await buildSessionUser(nextUser);
        setSessionUser(profile);
      } catch {
        setSessionUser(null);
      } finally {
        setLoading(false);
      }
    });

    return unsubscribe;
  }, []);

  useEffect(() => {
    if (!user || !sessionUser) return;
    return presenceService.setupPresence(
      user.uid,
      sessionUser.role,
      sessionUser.displayName || 'User'
    );
  }, [user?.uid, sessionUser?.role, sessionUser?.displayName]);

  const loginWithCode = async (code: string, displayName: string): Promise<SessionUser> => {
    const role = await inviteCodeService.validate(code);
    const cred = await signInAnonymously(auth);

    await createUserProfile(cred.user, role, displayName);
    await inviteCodeService.consume(code, cred.user.uid);

    const profile = await buildSessionUser(cred.user);
    setSessionUser(profile);
    return profile;
  };

  const loginWithEmail = async (email: string, password: string): Promise<SessionUser> => {
    try {
      const cred = await signInWithEmailAndPassword(auth, email, password);
      const profile = await buildSessionUser(cred.user);
      setSessionUser(profile);
      return profile;
    } catch (error: any) {
      if (error.code === 'auth/multi-factor-auth-required') {
        const resolver = getMultiFactorResolver(auth, error);
        setMfaResolver(resolver);
        throw error; // re-throw so login UI can handle it
      }
      throw error;
    }
  };

  const loginWithMfaTotp = async (totpCode: string): Promise<SessionUser> => {
    if (!mfaResolver) throw new Error('No MFA resolver available');
    const hint = mfaResolver.hints.find(h => h.factorId === TotpMultiFactorGenerator.FACTOR_ID);
    if (!hint) throw new Error('No TOTP factor found');
    const assertion = TotpMultiFactorGenerator.assertionForSignIn(hint.uid, totpCode);
    const cred = await mfaResolver.resolveSignIn(assertion);
    const profile = await buildSessionUser(cred.user);
    setSessionUser(profile);
    setMfaResolver(null);
    return profile;
  };

  const changePassword = async (currentPassword: string, newPassword: string): Promise<void> => {
    if (!user || !user.email) throw new Error('Not authenticated');
    const credential = EmailAuthProvider.credential(user.email, currentPassword);
    await reauthenticateWithCredential(user, credential);
    await updatePassword(user, newPassword);
  };

  const enrollTotp = async (): Promise<{ secret: TotpSecret; qrCodeUrl: string }> => {
    if (!user) throw new Error('Not authenticated');
    const mfa = multiFactor(user);
    const session = await mfa.getSession();
    const totpSecret = await TotpMultiFactorGenerator.generateSecret(session);
    const qrCodeUrl = totpSecret.generateQrCodeUrl(
      user.email || 'user',
      'MySyntroMed'
    );
    return { secret: totpSecret, qrCodeUrl };
  };

  const verifyTotpEnrollment = async (secret: TotpSecret, totpCode: string, displayName: string): Promise<void> => {
    if (!user) throw new Error('Not authenticated');
    const mfa = multiFactor(user);
    const assertion = TotpMultiFactorGenerator.assertionForEnrollment(secret, totpCode);
    await mfa.enroll(assertion, displayName);
  };

  const unenrollTotp = async (): Promise<void> => {
    if (!user) throw new Error('Not authenticated');
    const mfa = multiFactor(user);
    const enrolledFactors = mfa.enrolledFactors;
    const totpFactor = enrolledFactors.find(f => f.factorId === TotpMultiFactorGenerator.FACTOR_ID);
    if (totpFactor) {
      await mfa.unenroll(totpFactor);
    }
  };

  const isTotpEnrolled = (): boolean => {
    if (!user) return false;
    const mfa = multiFactor(user);
    return mfa.enrolledFactors.some(f => f.factorId === TotpMultiFactorGenerator.FACTOR_ID);
  };

  const logout = async () => {
    await signOut(auth);
  };

  const getRedirectPath = (role: SessionUser['role']): string => {
    switch (role) {
      case 'admin':
        return '/admin/dashboard';
      case 'specialist':
        return '/specialist/dashboard';
      case 'client':
      default:
        return '/portal/dashboard';
    }
  };

  const value = useMemo<AuthContextType>(
    () => ({
      user,
      sessionUser,
      loading,
      mfaResolver,
      loginWithCode,
      loginWithEmail,
      loginWithMfaTotp,
      logout,
      refreshSessionUser,
      getRedirectPath,
      changePassword,
      enrollTotp,
      verifyTotpEnrollment,
      unenrollTotp,
      isTotpEnrolled,
    }),
    [loading, sessionUser, user, mfaResolver]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used within AuthProvider');
  return context;
};
