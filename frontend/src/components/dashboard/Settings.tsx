import { type FormEvent, useState, type ChangeEvent, useEffect } from 'react';
import {
  Bell,
  Check,
  Eye,
  EyeOff,
  Key,
  Shield,
  Smartphone,
  User,
  Camera,
  AlertCircle,
} from 'lucide-react';
import { useAuth } from '@/lib/AuthContext';
import { useUserProfile } from '@/lib/dashboard';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { storage } from '@/lib/firebase';
import { userService } from '@/lib/firestore';
import { passwordValidation } from '@/lib/security';

const PasswordStrengthIndicator = ({ password }: { password: string }) => {
  const { score, label, color, requirements } = passwordValidation.getStrength(password);
  
  if (!password) return null;
  
  return (
    <div className="mt-2 space-y-2">
      <div className="flex items-center gap-2">
        <div className="flex-1 h-1.5 bg-slate-200 rounded-full overflow-hidden">
          <div 
            className={`h-full transition-all duration-300 ${color}`}
            style={{ width: `${score}%` }}
          />
        </div>
        <span className={`text-xs font-medium ${
          score === 100 ? 'text-emerald-600' : 
          score >= 50 ? 'text-amber-600' : 'text-red-600'
        }`}>
          {label}
        </span>
      </div>
      <div className="grid grid-cols-1 gap-1">
        {requirements.map((req, i) => (
          <div key={i} className="flex items-center gap-2 text-xs">
            {req.met ? (
              <Check size={12} className="text-emerald-500" />
            ) : (
              <span className="text-slate-300">○</span>
            )}
            <span className={req.met ? 'text-emerald-600' : 'text-slate-400'}>
              {req.text}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
};

const Settings = () => {
  const { user, changePassword, refreshSessionUser } = useAuth();
  const { profile, loading, updateProfile } = useUserProfile();
  
  const [profileForm, setProfileForm] = useState({
    displayName: profile?.displayName || '',
    clinicName: profile?.clinicName || '',
    phone: profile?.phone || '',
    photoURL: profile?.photoURL || '',
    specialties: (profile?.specialties || []).join(', '),
    yearsExperience: profile?.yearsExperience ? String(profile.yearsExperience) : '',
    bio: profile?.bio || '',
  });

  const [notifications, setNotifications] = useState({
    emailRequests: profile?.notificationPreferences?.emailRequests ?? true,
    emailMessages: profile?.notificationPreferences?.emailMessages ?? true,
  });
  const [notifSaving, setNotifSaving] = useState(false);

  useEffect(() => {
    if (profile?.notificationPreferences) {
      setNotifications(prev => ({
        ...prev,
        emailRequests: profile.notificationPreferences?.emailRequests ?? prev.emailRequests,
        emailMessages: profile.notificationPreferences?.emailMessages ?? prev.emailMessages,
      }));
    }
  }, [profile?.notificationPreferences?.emailRequests, profile?.notificationPreferences?.emailMessages]);

  const handleNotificationChange = async (key: 'emailRequests' | 'emailMessages', value: boolean) => {
    const updated = { ...notifications, [key]: value };
    setNotifications(updated);
    setNotifSaving(true);
    try {
      if (user?.uid) {
        await userService.saveNotificationPreferences(user.uid, updated);
      }
    } catch (e) {
      console.error('Failed to save notification preferences:', e);
      setNotifications(prev => ({ ...prev, [key]: !value }));
    } finally {
      setNotifSaving(false);
    }
  };

  const [showPasswordForm, setShowPasswordForm] = useState(false);
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showCurrentPassword, setShowCurrentPassword] = useState(false);
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [twoFactor, setTwoFactor] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [passwordError, setPasswordError] = useState<string | null>(null);
  const [passwordSuccess, setPasswordSuccess] = useState(false);

  const handleProfileSave = async (e: FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setSaved(false);
    
    try {
      await updateProfile({
        displayName: profileForm.displayName,
        clinicName: profileForm.clinicName,
        phone: profileForm.phone,
        photoURL: profileForm.photoURL,
        specialties: profileForm.specialties
          .split(',')
          .map((s) => s.trim())
          .filter(Boolean),
        yearsExperience: profileForm.yearsExperience ? Number(profileForm.yearsExperience) : undefined,
        bio: profileForm.bio,
      });
      await refreshSessionUser();
      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
    } catch (error) {
      console.error('Error saving profile:', error);
    } finally {
      setSaving(false);
    }
  };

  const handleImageUpload = async (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !user?.uid) return;

    setSaving(true);
    setSaved(false);
    try {
      if (file.size > 2 * 1024 * 1024) {
        throw new Error('Image must be under 2MB.');
      }
      const fileRef = ref(storage, `profile_photos/${user.uid}/${Date.now()}-${file.name}`);
      await uploadBytes(fileRef, file);
      const url = await getDownloadURL(fileRef);
      setProfileForm((prev) => ({ ...prev, photoURL: url }));
      await updateProfile({ photoURL: url });
      await refreshSessionUser();
      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
    } catch (error) {
      console.error('Error uploading image:', error);
      alert('Failed to upload image. Please ensure Firebase Storage is enabled in your Firebase console.');
    } finally {
      setSaving(false);
    }
  };

  const handlePasswordChange = async (e: FormEvent) => {
    e.preventDefault();
    setPasswordError(null);
    setPasswordSuccess(false);

    if (!currentPassword) {
      setPasswordError('Please enter your current password');
      return;
    }

    const pwdCheck = passwordValidation.validate(newPassword);
    if (!pwdCheck.valid) {
      setPasswordError(pwdCheck.error || 'Password does not meet requirements');
      return;
    }

    if (newPassword !== confirmPassword) {
      setPasswordError('Passwords do not match');
      return;
    }

    if (currentPassword === newPassword) {
      setPasswordError('New password must be different from current password');
      return;
    }

    setSaving(true);
    try {
      await changePassword(currentPassword, newPassword);
      setPasswordSuccess(true);
      setShowPasswordForm(false);
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
      setTimeout(() => setPasswordSuccess(false), 5000);
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to update password';
      setPasswordError(errorMessage);
    } finally {
      setSaving(false);
    }
  };

  const Toggle = ({
    checked,
    onChange,
  }: {
    checked: boolean;
    onChange: (checked: boolean) => void;
  }) => (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      onClick={() => onChange(!checked)}
      className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
        checked ? 'bg-teal-600' : 'bg-slate-200'
      }`}
    >
      <span
        className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
          checked ? 'translate-x-6' : 'translate-x-1'
        }`}
      />
    </button>
  );

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-navy-900">Settings</h1>
        <p className="mt-1 text-slate-600">Manage your account and preferences</p>
      </div>

      {saved && (
        <div className="flex items-center gap-2 rounded-lg border border-emerald-200 bg-emerald-50 p-4 text-emerald-700">
          <Check size={18} />
          <span className="text-sm font-medium">Settings saved successfully!</span>
        </div>
      )}

      <div className="rounded-xl border border-slate-200 bg-white">
        <div className="border-b border-slate-200 p-4">
          <h2 className="flex items-center gap-2 text-lg font-semibold text-navy-900">
            <User size={20} className="text-teal-600" />
            Profile Information
          </h2>
        </div>
        <form onSubmit={handleProfileSave} className="p-6">
          <div className="mb-6 flex items-center gap-6">
            <div className="relative flex h-20 w-20 shrink-0 items-center justify-center rounded-full bg-slate-100 text-teal-600">
              {profileForm.photoURL ? (
                <img src={profileForm.photoURL} alt="Profile" className="h-full w-full rounded-full object-cover" />
              ) : (
                <User size={32} />
              )}
              <label className="absolute bottom-0 right-0 flex h-7 w-7 cursor-pointer items-center justify-center rounded-full border-2 border-white bg-teal-600 text-white shadow-sm hover:bg-teal-700">
                <Camera size={12} />
                <input type="file" accept="image/*" className="hidden" onChange={handleImageUpload} />
              </label>
            </div>
            <div>
              <p className="font-medium text-slate-900">Profile Picture</p>
              <p className="text-sm text-slate-500">JPG, GIF or PNG. 1MB max.</p>
            </div>
          </div>
          <div className="grid gap-5 sm:grid-cols-2">
            <div>
              <label className="mb-2 block text-sm font-medium text-slate-700">Full Name</label>
              <input
                type="text"
                value={profileForm.displayName}
                onChange={(e) => setProfileForm({ ...profileForm, displayName: e.target.value })}
                className="w-full rounded-lg border border-slate-200 px-4 py-2.5 text-sm outline-none focus:border-teal-500"
              />
            </div>
            <div>
              <label className="mb-2 block text-sm font-medium text-slate-700">Email</label>
              <input
                type="email"
                value={user?.email || ''}
                disabled
                className="w-full cursor-not-allowed rounded-lg border border-slate-200 bg-slate-50 px-4 py-2.5 text-sm text-slate-500 outline-none"
              />
            </div>
            <div>
              <label className="mb-2 block text-sm font-medium text-slate-700">Phone</label>
              <input
                type="tel"
                value={profileForm.phone}
                onChange={(e) => setProfileForm({ ...profileForm, phone: e.target.value })}
                placeholder="+1 (555) 123-4567"
                className="w-full rounded-lg border border-slate-200 px-4 py-2.5 text-sm outline-none focus:border-teal-500"
              />
            </div>
            <div>
              <label className="mb-2 block text-sm font-medium text-slate-700">Clinic/Practice Name</label>
              <input
                type="text"
                value={profileForm.clinicName}
                onChange={(e) => setProfileForm({ ...profileForm, clinicName: e.target.value })}
                placeholder="Your clinic name"
                className="w-full rounded-lg border border-slate-200 px-4 py-2.5 text-sm outline-none focus:border-teal-500"
              />
            </div>
          </div>

          {profile?.role === 'specialist' && (
            <div className="mt-6 grid gap-5 sm:grid-cols-2">
              <div className="sm:col-span-2">
                <label className="mb-2 block text-sm font-medium text-slate-700">Specialties (comma separated)</label>
                <input
                  type="text"
                  value={profileForm.specialties}
                  onChange={(e) => setProfileForm({ ...profileForm, specialties: e.target.value })}
                  placeholder="EHR Documentation, Patient Follow-Up, Scheduling"
                  className="w-full rounded-lg border border-slate-200 px-4 py-2.5 text-sm outline-none focus:border-teal-500"
                />
              </div>
              <div>
                <label className="mb-2 block text-sm font-medium text-slate-700">Years of Experience</label>
                <input
                  type="number"
                  min={0}
                  value={profileForm.yearsExperience}
                  onChange={(e) => setProfileForm({ ...profileForm, yearsExperience: e.target.value })}
                  placeholder="5"
                  className="w-full rounded-lg border border-slate-200 px-4 py-2.5 text-sm outline-none focus:border-teal-500"
                />
              </div>
              <div className="sm:col-span-2">
                <label className="mb-2 block text-sm font-medium text-slate-700">Short Bio</label>
                <textarea
                  rows={4}
                  value={profileForm.bio}
                  onChange={(e) => setProfileForm({ ...profileForm, bio: e.target.value })}
                  placeholder="Tell clients about your experience and strengths..."
                  className="w-full rounded-lg border border-slate-200 px-4 py-2.5 text-sm outline-none focus:border-teal-500"
                />
              </div>
            </div>
          )}
          <div className="mt-5 flex justify-end">
            <button
              type="submit"
              disabled={saving || loading}
              className="inline-flex items-center gap-2 rounded-lg bg-teal-600 px-4 py-2 text-sm font-medium text-white hover:bg-teal-700 disabled:opacity-50"
            >
              {saving ? 'Saving...' : 'Save Changes'}
            </button>
          </div>
        </form>
      </div>

      <div className="rounded-xl border border-slate-200 bg-white">
        <div className="border-b border-slate-200 p-4">
          <h2 className="flex items-center gap-2 text-lg font-semibold text-navy-900">
            <Bell size={20} className="text-teal-600" />
            Email Notifications
            {notifSaving && <span className="ml-2 text-xs text-slate-400">Saving...</span>}
          </h2>
        </div>
        <div className="divide-y divide-slate-100 p-6">
           <div className="flex items-center justify-between py-3">
             <div>
               <p className="font-medium text-slate-900">Request Updates</p>
               <p className="text-sm text-slate-500">Get notified when request status changes</p>
             </div>
              <Toggle
                checked={notifications.emailRequests}
                onChange={(checked) => handleNotificationChange('emailRequests', checked)}
              />
            </div>
            <div className="flex items-center justify-between py-3">
              <div>
                <p className="font-medium text-slate-900">New Messages</p>
                <p className="text-sm text-slate-500">Get notified of new messages from specialist</p>
              </div>
              <Toggle
                checked={notifications.emailMessages}
                onChange={(checked) => handleNotificationChange('emailMessages', checked)}
              />
           </div>
        </div>
      </div>

      <div className="rounded-xl border border-slate-200 bg-white">
        <div className="border-b border-slate-200 p-4">
          <h2 className="flex items-center gap-2 text-lg font-semibold text-navy-900">
            <Shield size={20} className="text-teal-600" />
            Security
          </h2>
        </div>
        <div className="divide-y divide-slate-100 p-6">
          <div className="py-3">
            <button
              onClick={() => setShowPasswordForm(!showPasswordForm)}
              className="flex w-full items-center justify-between rounded-lg border border-slate-200 p-4 transition hover:bg-slate-50"
            >
              <div className="flex items-center gap-3">
                <Key size={18} className="text-slate-400" />
                <div className="text-left">
                  <p className="font-medium text-slate-900">Change Password</p>
                  <p className="text-sm text-slate-500">Update your account password</p>
                </div>
              </div>
              <span className="text-sm text-teal-600">{showPasswordForm ? 'Cancel' : 'Change'}</span>
            </button>

            {showPasswordForm && (
              <form onSubmit={handlePasswordChange} className="mt-4 space-y-4 rounded-lg border border-slate-200 bg-slate-50 p-4">
                {passwordSuccess && (
                  <div className="flex items-center gap-2 rounded-lg border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-700">
                    <Check size={16} />
                    Password updated successfully!
                  </div>
                )}
                {passwordError && (
                  <div className="flex items-center gap-2 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">
                    <AlertCircle size={16} />
                    {passwordError}
                  </div>
                )}
                <div>
                  <label className="mb-2 block text-sm font-medium text-slate-700">Current Password</label>
                  <div className="relative">
                    <input
                      type={showCurrentPassword ? 'text' : 'password'}
                      value={currentPassword}
                      onChange={(e) => setCurrentPassword(e.target.value)}
                      placeholder="Enter current password"
                      className="w-full rounded-lg border border-slate-200 px-4 py-2.5 pr-10 text-sm outline-none focus:border-teal-500"
                    />
                    <button
                      type="button"
                      onClick={() => setShowCurrentPassword(!showCurrentPassword)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                    >
                      {showCurrentPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                    </button>
                  </div>
                </div>
                <div>
                  <label className="mb-2 block text-sm font-medium text-slate-700">New Password</label>
                  <div className="relative">
                    <input
                      type={showNewPassword ? 'text' : 'password'}
                      value={newPassword}
                      onChange={(e) => setNewPassword(e.target.value)}
                      placeholder="Create a strong password"
                      className="w-full rounded-lg border border-slate-200 px-4 py-2.5 pr-10 text-sm outline-none focus:border-teal-500"
                    />
                    <button
                      type="button"
                      onClick={() => setShowNewPassword(!showNewPassword)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                    >
                      {showNewPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                    </button>
                  </div>
                  <PasswordStrengthIndicator password={newPassword} />
                </div>
                <div>
                  <label className="mb-2 block text-sm font-medium text-slate-700">Confirm New Password</label>
                  <input
                    type="password"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    placeholder="Confirm new password"
                    className="w-full rounded-lg border border-slate-200 px-4 py-2.5 text-sm outline-none focus:border-teal-500"
                  />
                  {confirmPassword && newPassword === confirmPassword && (
                    <p className="mt-1 flex items-center gap-1 text-xs text-emerald-600">
                      <Check size={12} /> Passwords match
                    </p>
                  )}
                  {confirmPassword && newPassword !== confirmPassword && (
                    <p className="mt-1 flex items-center gap-1 text-xs text-red-600">
                      <AlertCircle size={12} /> Passwords do not match
                    </p>
                  )}
                </div>
                <div className="rounded-lg bg-white border border-slate-200 p-3">
                  <p className="text-xs font-medium text-slate-700 mb-2">Password Requirements:</p>
                  <ul className="space-y-1 text-xs text-slate-600">
                    <li className="flex items-center gap-1">• At least 8 characters</li>
                    <li className="flex items-center gap-1">• One uppercase letter (A-Z)</li>
                    <li className="flex items-center gap-1">• One lowercase letter (a-z)</li>
                    <li className="flex items-center gap-1">• One number (0-9)</li>
                    <li className="flex items-center gap-1">• One special character (!@#$%)</li>
                  </ul>
                </div>
                <button
                  type="submit"
                  disabled={saving}
                  className="w-full rounded-lg bg-teal-600 py-2.5 text-sm font-medium text-white hover:bg-teal-700 disabled:opacity-50"
                >
                  {saving ? 'Updating...' : 'Update Password'}
                </button>
              </form>
            )}
          </div>

          <div className="flex items-center justify-between py-3">
            <div className="flex items-center gap-3">
              <Smartphone size={18} className="text-slate-400" />
              <div>
                <p className="font-medium text-slate-900">Two-Factor Authentication</p>
                <p className="text-sm text-slate-500">Verification code sent to your email</p>
              </div>
            </div>
            <Toggle checked={twoFactor} onChange={setTwoFactor} />
          </div>
        </div>
      </div>
    </div>
  );
};

export default Settings;
