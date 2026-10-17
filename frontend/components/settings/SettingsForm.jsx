'use client';

import { useEffect, useState } from 'react';
import { Card, Button } from '../ui';
import { settingsApi, authApi, userApi, errorMessage } from '@/lib/api';
import { useToast } from '@/lib/toast-context';
import { useAuth } from '@/lib/auth-context';

const NOTIFICATION_OPTIONS = [
  { key: 'workoutReminders', label: 'Workout reminders', help: 'Nudges to keep your streak alive' },
  { key: 'prAlerts', label: 'Personal record alerts', help: 'Celebrate each new PR instantly' },
  { key: 'challengeUpdates', label: 'Challenge updates', help: 'Progress and rank changes' },
  { key: 'socialActivity', label: 'Social activity', help: 'Likes and comments on your workouts' },
];

const LANGUAGES = [
  { value: 'en', label: 'English' },
  { value: 'hi', label: 'हिन्दी (Hindi)' },
  { value: 'es', label: 'Español (Spanish)' },
  { value: 'fr', label: 'Français (French)' },
  { value: 'de', label: 'Deutsch (German)' },
];

const UNITS = [
  { value: 'metric', label: 'Metric (kg, km)' },
  { value: 'imperial', label: 'Imperial (lb, mi)' },
];

function Toggle({ id, checked, onChange, label, help }) {
  return (
    <div className="flex items-start justify-between gap-4 py-2.5">
      <div className="min-w-0">
        <label htmlFor={id} className="block cursor-pointer text-sm font-medium">
          {label}
        </label>
        <p className="text-xs text-ink-soft">{help}</p>
      </div>
      <button
        type="button"
        id={id}
        role="switch"
        aria-checked={checked}
        aria-label={label}
        onClick={() => onChange(!checked)}
        className={`relative mt-0.5 h-6 w-11 shrink-0 rounded-full transition-colors ${
          checked ? 'bg-accent-deep' : 'bg-line-strong'
        }`}
      >
        <span
          className={`absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition-all ${
            checked ? 'left-[1.375rem]' : 'left-0.5'
          }`}
        />
      </button>
    </div>
  );
}

const inputClass =
  'w-full rounded-xl border border-line bg-surface px-3 py-2 text-sm shadow-sm transition focus:border-ink focus:outline-none sm:text-base';

export default function SettingsForm() {
  const { user, updateUser } = useAuth();
  const { success, error } = useToast();

  const [settings, setSettings] = useState(null);
  const [profile, setProfile] = useState({ name: '', bio: '', location: '' });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [profileSaving, setProfileSaving] = useState(false);
  const [errors, setErrors] = useState({});

  useEffect(() => {
    let cancelled = false;
    async function load() {
      setLoading(true);
      try {
        const [settingsData, profileData] = await Promise.all([settingsApi.get(), userApi.me()]);
        if (cancelled) return;
        setSettings(settingsData.settings);
        setProfile({
          name: profileData.user.name || '',
          bio: profileData.user.bio || '',
          location: profileData.user.location || '',
        });
      } catch (err) {
        if (!cancelled) error(errorMessage(err));
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    load();
    return () => {
      cancelled = true;
    };
  }, [error]);

  const setNotification = (key, value) =>
    setSettings((current) => ({
      ...current,
      notifications: { ...current.notifications, [key]: value },
    }));

  const saveSettings = async (event) => {
    event.preventDefault();
    setErrors({});

    if (settings.upiId && !/^[\w.-]{2,64}@[\w.-]{2,64}$/.test(settings.upiId)) {
      setErrors({ upiId: 'UPI ID must look like name@bank' });
      return;
    }

    setSaving(true);
    try {
      const data = await settingsApi.update({
        notifications: settings.notifications,
        language: settings.language,
        units: settings.units,
        upiId: settings.upiId,
      });
      setSettings(data.settings);
      updateUser({ settings: data.settings });
      success('Settings saved');
    } catch (err) {
      error(errorMessage(err));
      if (err.fieldErrors) setErrors(err.fieldErrors);
    } finally {
      setSaving(false);
    }
  };

  const saveProfile = async (event) => {
    event.preventDefault();
    setErrors({});
    setProfileSaving(true);
    try {
      const data = await userApi.updateMe({
        name: profile.name.trim(),
        bio: profile.bio.trim(),
        location: profile.location.trim(),
      });
      updateUser(data.user);
      window.dispatchEvent(new CustomEvent('fittrack:profile-updated', { detail: data.user }));
      success('Profile updated');
    } catch (err) {
      error(errorMessage(err));
      if (err.fieldErrors) setErrors(err.fieldErrors);
    } finally {
      setProfileSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="flex flex-col gap-4">
        {[...Array(3)].map((_, i) => (
          <div key={i} className="card h-48 space-y-3 p-5">
            <div className="h-3 w-1/3 rounded-full skeleton" />
            <div className="h-3 w-2/3 rounded-full skeleton" />
            <div className="h-3 w-1/2 rounded-full skeleton" />
          </div>
        ))}
      </div>
    );
  }

  if (!settings) {
    return (
      <Card className="items-center py-8 text-center">
        <p className="text-sm text-ink-soft">Couldn’t load your settings. Try reloading the page.</p>
      </Card>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      <Card className="gap-4">
        <div className="space-y-1">
          <h2 className="text-lg font-semibold">Notifications</h2>
          <p className="text-sm text-ink-soft">Choose what FitTrack tells you about.</p>
        </div>
        <div className="divide-y divide-line">
          {NOTIFICATION_OPTIONS.map((option) => (
            <Toggle
              key={option.key}
              id={`notif-${option.key}`}
              label={option.label}
              help={option.help}
              checked={Boolean(settings.notifications?.[option.key])}
              onChange={(value) => setNotification(option.key, value)}
            />
          ))}
        </div>
      </Card>

      <form onSubmit={saveSettings} className="flex flex-col gap-4">
        <Card className="gap-4">
          <div className="space-y-1">
            <h2 className="text-lg font-semibold">Preferences</h2>
            <p className="text-sm text-ink-soft">Language, measurement units and payments ID.</p>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="flex flex-col gap-1.5">
              <label htmlFor="language" className="text-xs font-medium text-ink-soft sm:text-sm">
                Language
              </label>
              <select
                id="language"
                value={settings.language}
                onChange={(event) => setSettings((s) => ({ ...s, language: event.target.value }))}
                className={inputClass}
              >
                {LANGUAGES.map((lang) => (
                  <option key={lang.value} value={lang.value}>
                    {lang.label}
                  </option>
                ))}
              </select>
            </div>

            <div className="flex flex-col gap-1.5">
              <label htmlFor="units" className="text-xs font-medium text-ink-soft sm:text-sm">
                Measurement units
              </label>
              <select
                id="units"
                value={settings.units}
                onChange={(event) => setSettings((s) => ({ ...s, units: event.target.value }))}
                className={inputClass}
              >
                {UNITS.map((unit) => (
                  <option key={unit.value} value={unit.value}>
                    {unit.label}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="flex flex-col gap-1.5">
            <label htmlFor="upiId" className="text-xs font-medium text-ink-soft sm:text-sm">
              UPI ID
            </label>
            <input
              id="upiId"
              value={settings.upiId || ''}
              onChange={(event) => setSettings((s) => ({ ...s, upiId: event.target.value }))}
              placeholder="yourname@okhdfcbank"
              className={inputClass}
              aria-invalid={errors.upiId ? 'true' : 'false'}
            />
            <p className="text-xs text-ink-faint">
              Used for optional sponsorship payouts on community challenges.
            </p>
            {errors.upiId ? (
              <p className="text-xs text-danger" role="alert">
                {errors.upiId}
              </p>
            ) : null}
          </div>

          <Button type="submit" loading={saving} disabled={saving} className="self-start">
            {saving ? 'Saving…' : 'Save settings'}
          </Button>
        </Card>
      </form>

      <Card className="gap-4">
        <div className="space-y-1">
          <h2 className="text-lg font-semibold">Profile</h2>
          <p className="text-sm text-ink-soft">
            This is what other athletes see on your public page.
          </p>
        </div>
        <form onSubmit={saveProfile} className="flex flex-col gap-4" noValidate>
          <div className="flex flex-col gap-1.5">
            <label htmlFor="profile-name" className="text-xs font-medium text-ink-soft sm:text-sm">
              Display name
            </label>
            <input
              id="profile-name"
              value={profile.name}
              onChange={(event) => setProfile((p) => ({ ...p, name: event.target.value }))}
              className={inputClass}
            />
            {errors.name ? (
              <p className="text-xs text-danger" role="alert">
                {errors.name}
              </p>
            ) : null}
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="flex flex-col gap-1.5">
              <label htmlFor="profile-location" className="text-xs font-medium text-ink-soft sm:text-sm">
                Location
              </label>
              <input
                id="profile-location"
                value={profile.location}
                onChange={(event) => setProfile((p) => ({ ...p, location: event.target.value }))}
                placeholder="Bengaluru, India"
                className={inputClass}
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <label htmlFor="profile-bio" className="text-xs font-medium text-ink-soft sm:text-sm">
                Bio
              </label>
              <input
                id="profile-bio"
                value={profile.bio}
                onChange={(event) => setProfile((p) => ({ ...p, bio: event.target.value }))}
                placeholder="Training for a spring half"
                maxLength={240}
                className={inputClass}
              />
            </div>
          </div>

          <Button type="submit" variant="secondary" loading={profileSaving} disabled={profileSaving} className="self-start">
            {profileSaving ? 'Saving…' : 'Save profile'}
          </Button>
        </form>
      </Card>

      <PasswordCard email={user?.email} />
    </div>
  );
}

function PasswordCard({ email }) {
  const { success, error } = useToast();
  const [form, setForm] = useState({ currentPassword: '', newPassword: '' });
  const [saving, setSaving] = useState(false);
  const [errors, setErrors] = useState({});

  const submit = async (event) => {
    event.preventDefault();
    setErrors({});
    if (form.newPassword.length < 8) {
      setErrors({ newPassword: 'Use at least 8 characters with letters and numbers' });
      return;
    }
    setSaving(true);
    try {
      await authApi.changePassword(form);
      setForm({ currentPassword: '', newPassword: '' });
      success('Password updated');
    } catch (err) {
      error(errorMessage(err));
      if (err.fieldErrors) setErrors(err.fieldErrors);
    } finally {
      setSaving(false);
    }
  };

  return (
    <Card className="gap-4">
      <div className="space-y-1">
        <h2 className="text-lg font-semibold">Password</h2>
        <p className="text-sm text-ink-soft">Signed in as {email}</p>
      </div>
      <form onSubmit={submit} className="flex flex-col gap-4 sm:flex-row sm:items-start" noValidate>
        <div className="flex flex-1 flex-col gap-1.5">
          <label htmlFor="current-password" className="text-xs font-medium text-ink-soft sm:text-sm">
            Current password
          </label>
          <input
            id="current-password"
            type="password"
            autoComplete="current-password"
            value={form.currentPassword}
            onChange={(event) => setForm((f) => ({ ...f, currentPassword: event.target.value }))}
            className={inputClass}
          />
        </div>
        <div className="flex flex-1 flex-col gap-1.5">
          <label htmlFor="new-password" className="text-xs font-medium text-ink-soft sm:text-sm">
            New password
          </label>
          <input
            id="new-password"
            type="password"
            autoComplete="new-password"
            value={form.newPassword}
            onChange={(event) => setForm((f) => ({ ...f, newPassword: event.target.value }))}
            className={inputClass}
          />
          {errors.newPassword ? (
            <p className="text-xs text-danger" role="alert">
              {errors.newPassword}
            </p>
          ) : null}
        </div>
        <Button type="submit" loading={saving} disabled={saving} className="sm:mt-6">
          Update
        </Button>
      </form>
    </Card>
  );
}